import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * PR-13 Phase 1B (consensus-013) — DB 시드/정리 helper.
 *
 * 각 e2e 테스트 파일 상단에서 `beforeEach` 로 호출하여 격리.
 * `singleFork` (vitest.config.e2e.ts) 와 함께 사용해 동일 schema 동시 접근 차단.
 *
 * 사용자 정책 (feedback_model_decoupling_test_first.md): 가상 데이터 / fixture
 * 만으로 시스템 동작 검증 가능해야 함.
 */

export function getDataSource(app: INestApplication): DataSource {
  return app.get(DataSource);
}

/**
 * 사용자 데이터 전체 정리 — 테스트 격리용.
 * 외래키 의존성 역순으로 TRUNCATE CASCADE.
 *
 * 주의: discussion / community / audit_log 테이블은 ADR-021 머지 후 추가.
 */
export async function clearUserData(app: INestApplication): Promise<void> {
  const ds = getDataSource(app);
  const tables = [
    'discussion_votes',
    'discussion_posts',
    'discussion_threads',
    'review_queue',
    'sr_metrics_daily',
    'answer_history',
    'user_progress',
    'refresh_tokens',
    'ops_event_log',
    'users',
  ];

  // 존재하는 테이블만 정리 (ADR-021 미머지 시 community 계열 부재)
  for (const table of tables) {
    try {
      await ds.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('does not exist')) {
        throw err;
      }
    }
  }
}

/**
 * 마이그레이션 실행 helper — Session 14 hotfix #1 (EXTRACT IMMUTABLE) 회귀 차단.
 * AppModule synchronize 가 false 인 production-parity 환경에서 실 마이그레이션 실행.
 */
export async function runMigrations(app: INestApplication): Promise<void> {
  const ds = getDataSource(app);
  const migrations = await ds.runMigrations({ transaction: 'each' });
  if (migrations.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[e2e] applied ${migrations.length} migrations`);
  }
}

/**
 * Migration 회귀 검증 — 1714000012000 expression index (PR-12) 작동 확인.
 * Session 14 hotfix #1 EXTRACT IMMUTABLE 패턴.
 */
export async function assertExpressionIndexExists(
  app: INestApplication,
  indexName: string,
): Promise<void> {
  const ds = getDataSource(app);
  const rows = await ds.query<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
    [indexName],
  );
  if (rows.length === 0) {
    throw new Error(`[e2e] expected expression index '${indexName}' to exist`);
  }
}
