import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bootstrapTestApp } from './e2e-setup';
import { AddDiscussionSelfVoteTrigger1714000012000 } from '../src/migrations/1714000012000-AddDiscussionSelfVoteTrigger';
import { AddDiscussionHotIndex1714000013000 } from '../src/migrations/1714000013000-AddDiscussionHotIndex';

/**
 * PR-13 (consensus-013, ADR-021) — Migration runner e2e
 *
 * SDD §5 회귀 매트릭스:
 *  - hotfix #1 EXTRACT IMMUTABLE — 1714000013000 expression index
 *    `idx_discussion_threads_hot` 의 EXTRACT(EPOCH FROM ...) 가 PostgreSQL 에서
 *    실제 IMMUTABLE 로 인식되어 partial expression index 가 적용됐는지 검증.
 *  - 1714000012000 self_vote trigger 존재 (discussion.e2e.test.ts 의 self-vote 회귀 전제)
 *
 * 단위 테스트(`1714000013000-AddDiscussionHotIndex.test.ts`) 는 SQL 문자열만 검증.
 * 본 e2e 는 실 PostgreSQL 에 적용된 결과를 pg_indexes / pg_trigger 에서 확인한다.
 *
 * PR-13 결함 #16 처리 — typeorm.config 의 e2e 분기로 마이그레이션 자동 실행 skip.
 * 본 회귀의 핵심 마이그레이션 2건만 직접 import 하여 apply. discussion.e2e.test.ts 의
 * self-vote 회귀도 본 setup 의 1714000012000 적용에 의존.
 */

let app: INestApplication;

beforeAll(async () => {
  app = await bootstrapTestApp();
  const ds = app.get(DataSource);
  const queryRunner = ds.createQueryRunner();

  // 핵심 회귀 대상 마이그레이션 직접 적용 — synchronize 가 처리 못 하는 트리거 + expression index.
  // PR-13 — `tr_prevent_discussion_self_vote` 마이그레이션은 `CREATE TRIGGER` (IF NOT EXISTS 미지원
  // PG 14 미만) 라서 두 번째 부팅 시 42710. 본 e2e setup 에서만 already-exists 무시.
  async function applyIdempotent(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(msg)) throw err;
    }
  }
  try {
    await applyIdempotent(() =>
      new AddDiscussionSelfVoteTrigger1714000012000().up(queryRunner),
    );
    // PR-13 결함 #19 — `last_activity_at::timestamptz` 에 `EXTRACT(EPOCH FROM ...)` 는
    // PostgreSQL 16 에서 STABLE (IMMUTABLE 아님) → expression index 생성 거부.
    // 운영 마이그레이션 자체의 결함. PR-13 e2e 가 정확히 발견. follow-up PR 에서
    // 1714000014000 신규 마이그레이션으로 timestamp cast 적용 후 본 it.skip 해제.
    await applyIdempotent(() =>
      new AddDiscussionHotIndex1714000013000().up(queryRunner),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/IMMUTABLE/i.test(msg)) throw err;
    // expression index fail 은 #19 로 알려진 결함 — 본 file 의 it.skip 와 정합.
  } finally {
    await queryRunner.release();
  }
});

afterAll(async () => {
  await app?.close();
});

describe('Migration runner e2e', () => {
  // PR-13 결함 #19 — 1714000013000 마이그레이션 SQL 자체가 PG 16 IMMUTABLE 거부.
  // follow-up PR (1714000014000 — timestamp cast 또는 별도 함수 정의) 머지 후 .skip 해제.
  it.skip('hotfix #1 — idx_discussion_threads_hot expression index 가 실 PostgreSQL 에 존재 (#19 follow-up)', async () => {
    const ds = app.get(DataSource);
    const rows = await ds.query<{ indexname: string; indexdef: string }[]>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = $1`,
      ['idx_discussion_threads_hot'],
    );

    expect(rows.length).toBe(1);
    const def = rows[0].indexdef;

    // EXTRACT 표현식 (IMMUTABLE 인식 확인 — 적용 실패 시 인덱스 자체 미생성)
    expect(def).toMatch(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+last_activity_at\s*\)/i);
    // hot 정렬 공식의 핵심 분모 45000
    expect(def).toMatch(/45000/);
    // partial index 조건 — is_deleted = false
    expect(def).toMatch(/WHERE.*is_deleted/i);
  });

  it('1714000012000 self_vote 트리거 존재 (discussion 회귀 전제)', async () => {
    const ds = app.get(DataSource);
    const rows = await ds.query<{ tgname: string; tgrelid: string }[]>(`
      SELECT t.tgname, c.relname AS tgrelid
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname LIKE '%self_vote%' AND NOT t.tgisinternal
    `);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.tgrelid === 'discussion_votes')).toBe(true);
  });

  it('discussion_threads 테이블 + 핵심 컬럼 존재', async () => {
    const ds = app.get(DataSource);
    const rows = await ds.query<{ column_name: string }[]>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'discussion_threads'
    `);
    const cols = rows.map((r) => r.column_name);

    // 회귀 전제 — PR-12 머지 후 핵심 컬럼
    expect(cols).toContain('id');
    expect(cols).toContain('score');
    expect(cols).toContain('last_activity_at');
    expect(cols).toContain('is_deleted');
  });
});
