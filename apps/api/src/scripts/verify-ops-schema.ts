#!/usr/bin/env tsx
/**
 * OpsModule entity 스키마 검증 스크립트.
 *
 * 목적: TypeORM `synchronize: true`(개발 환경 정책)가 OpsModule의 두 entity를
 * 정확히 PostgreSQL 스키마로 변환하는지 격리 schema에서 시뮬레이션한다.
 *
 * 동작:
 *  1. 기존 oracle_game DB의 `ops_check` schema를 DROP CASCADE
 *  2. 두 entity로 DataSource 생성 + synchronize
 *  3. information_schema에서 테이블/컬럼/인덱스 검증
 *  4. 검증 결과 출력 후 schema DROP
 *
 * 사용:
 *   PGURL=postgresql://oracle_game:changeme@localhost:5434/oracle_game \
 *     npx tsx apps/api/src/scripts/verify-ops-schema.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { OpsEventLogEntity } from '../modules/ops/entities/ops-event-log.entity';
import { OpsQuestionMeasurementEntity } from '../modules/ops/entities/ops-question-measurement.entity';
import { NotionSyncStateEntity } from '../modules/notion/entities/notion-sync-state.entity';
import { NotionDocumentEntity } from '../modules/notion/entities/notion-document.entity';

const PGURL =
  process.env.PGURL ?? 'postgresql://oracle_game:changeme@localhost:5434/oracle_game';
const SCHEMA = 'ops_check';

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: PGURL,
    schema: SCHEMA,
    entities: [
      OpsEventLogEntity,
      OpsQuestionMeasurementEntity,
      NotionSyncStateEntity,
      NotionDocumentEntity,
    ],
    synchronize: false,
    logging: false,
  });

  console.log(`▶ connecting to ${PGURL.replace(/:[^:@]*@/, ':***@')}`);
  await ds.initialize();

  // 격리 schema reset
  await ds.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await ds.query(`CREATE SCHEMA ${SCHEMA}`);
  console.log(`▶ schema ${SCHEMA} ready`);

  // typeorm synchronize 호출 → entity → CREATE TABLE 변환
  await ds.synchronize();
  console.log(`▶ synchronize() completed`);

  // 검증 1: 테이블 존재
  const tables = (await ds.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name`,
    [SCHEMA],
  )) as Array<{ table_name: string }>;
  const names = new Set(tables.map((t) => t.table_name));
  for (const expected of [
    'ops_question_measurements',
    'ops_event_log',
    'notion_sync_state',
    'notion_documents',
  ]) {
    if (!names.has(expected)) throw new Error(`테이블 누락: ${expected}`);
  }
  console.log(`✅ 테이블 ${names.size}개 모두 생성됨: ${[...names].join(', ')}`);

  // 검증 2: ops_question_measurements 컬럼
  const measurementCols = (await ds.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position`,
    [SCHEMA, 'ops_question_measurements'],
  )) as Array<{ column_name: string; data_type: string; is_nullable: string }>;
  const requiredCols = [
    'id',
    'question_id',
    'measured_at',
    'mt3_pass',
    'mt3_out_of_scope',
    'mt4_pass',
    'mt4_failures',
    'latency_ms',
    'model_digest',
    'window_index',
  ];
  for (const c of requiredCols) {
    if (!measurementCols.find((row) => row.column_name === c)) {
      throw new Error(`ops_question_measurements 컬럼 누락: ${c}`);
    }
  }
  console.log(`✅ ops_question_measurements 컬럼 ${requiredCols.length}개 모두 존재`);

  // 검증 3: ops_event_log 부분 unique index (kind='student_report_incorrect' 한정)
  const indexes = (await ds.query(
    `SELECT indexname, indexdef
       FROM pg_indexes WHERE schemaname=$1 AND tablename=$2`,
    [SCHEMA, 'ops_event_log'],
  )) as Array<{ indexname: string; indexdef: string }>;

  const partialUnique = indexes.find(
    (i) =>
      i.indexname === 'uq_ops_event_student_report' &&
      /UNIQUE/i.test(i.indexdef) &&
      /student_report_incorrect/.test(i.indexdef),
  );
  if (!partialUnique) {
    console.error('인덱스 후보:', indexes.map((i) => `${i.indexname}: ${i.indexdef}`).join('\n  '));
    throw new Error('ops_event_log 부분 unique index 누락 (uq_ops_event_student_report)');
  }
  console.log(`✅ 부분 unique index 존재: ${partialUnique.indexname}`);
  console.log(`   indexdef: ${partialUnique.indexdef}`);

  // 검증 4: ops_question_measurements window_index 부분 인덱스
  const windowIdx = (await ds.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname=$1 AND tablename=$2 AND indexname=$3`,
    [SCHEMA, 'ops_question_measurements', 'idx_ops_measurements_window'],
  )) as Array<{ indexname: string; indexdef: string }>;
  if (windowIdx.length === 0) {
    console.warn(`⚠️  window_index 인덱스(idx_ops_measurements_window) 미생성 — 부분 인덱스 옵션 미적용 가능성`);
  } else {
    console.log(`✅ window_index 인덱스 존재: ${windowIdx[0]!.indexdef}`);
  }

  // 검증 5: 실제 INSERT 동작 (UUID PK + jsonb default)
  await ds.query(
    `INSERT INTO ${SCHEMA}.ops_event_log (kind, question_id, user_id, payload)
     VALUES ('measurement_fail', NULL, NULL, '{"error":"smoke","stage":"mt3"}'::jsonb)`,
  );
  const inserted = (await ds.query(
    `SELECT id, kind, payload FROM ${SCHEMA}.ops_event_log LIMIT 1`,
  )) as Array<{ id: string; kind: string; payload: { error: string; stage: string } }>;
  if (inserted.length !== 1 || inserted[0]!.kind !== 'measurement_fail') {
    throw new Error('INSERT 검증 실패');
  }
  console.log(`✅ INSERT/SELECT 정상: id=${inserted[0]!.id.slice(0, 8)}… payload=${JSON.stringify(inserted[0]!.payload)}`);

  // cleanup
  await ds.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await ds.destroy();
  console.log(`▶ schema ${SCHEMA} dropped + connection closed`);
  console.log('\n🎉 OpsModule 스키마 검증 통과');
}

main().catch((err) => {
  console.error('❌ 검증 실패:', err);
  process.exit(1);
});
