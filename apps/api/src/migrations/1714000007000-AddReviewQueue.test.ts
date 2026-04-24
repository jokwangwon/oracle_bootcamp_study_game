import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddReviewQueue1714000007000 } from './1714000007000-AddReviewQueue';

/**
 * ADR-019 PR-1 — migration up/down SQL smoke.
 *
 * 실 Postgres 없이 쿼리 문자열만 assert. 실 적용은 dev / staging 부팅 시
 * synchronize 와 함께 검증.
 */

function makeRunner() {
  const queries: string[] = [];
  const queryRunner: Partial<QueryRunner> = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return undefined as unknown;
    }),
  };
  return { queryRunner: queryRunner as QueryRunner, queries };
}

describe('AddReviewQueue1714000007000', () => {
  it('migration 이름이 고정된다 (migration history 일관성)', () => {
    const m = new AddReviewQueue1714000007000();
    expect(m.name).toBe('AddReviewQueue1714000007000');
  });

  it('up: review_queue CREATE TABLE IF NOT EXISTS + 복합 PK', async () => {
    const m = new AddReviewQueue1714000007000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const createSql = queries[0]!;
    expect(createSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+review_queue/);
    expect(createSql).toMatch(/PRIMARY KEY \(user_id, question_id\)/);
  });

  it('up: SM-2 상태 컬럼이 모두 SQL 에 존재', async () => {
    const m = new AddReviewQueue1714000007000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/ease_factor\s+NUMERIC\(4,3\)\s+NOT NULL DEFAULT 2\.500/);
    expect(sql).toMatch(/interval_days\s+INT\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/repetition\s+INT\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/due_at\s+TIMESTAMPTZ/);
    expect(sql).toMatch(/last_reviewed_at\s+TIMESTAMPTZ/);
    expect(sql).toMatch(/last_quality\s+SMALLINT/);
    expect(sql).toMatch(/algorithm_version\s+VARCHAR\(16\)\s+NOT NULL DEFAULT 'sm2-v1'/);
  });

  it('up: D3 Hybrid 대칭 컬럼 (user_token_hash + _epoch)', async () => {
    const m = new AddReviewQueue1714000007000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/user_token_hash\s+VARCHAR\(32\)/);
    expect(sql).toMatch(/user_token_hash_epoch\s+SMALLINT/);
  });

  it('up: partial index (user_id, due_at) WHERE due_at IS NOT NULL', async () => {
    const m = new AddReviewQueue1714000007000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const indexSql = queries[1]!;
    expect(indexSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_review_queue_user_due/);
    expect(indexSql).toMatch(/ON review_queue \(user_id, due_at\)/);
    expect(indexSql).toMatch(/WHERE due_at IS NOT NULL/);
  });

  it('down: index 먼저 drop → 테이블 drop (IF EXISTS)', async () => {
    const m = new AddReviewQueue1714000007000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatch(/DROP INDEX IF EXISTS idx_review_queue_user_due/);
    expect(queries[1]).toMatch(/DROP TABLE IF EXISTS review_queue/);
  });

  it('up 과 down 이 서로 반대 순서로 DDL 을 실행 (재진입성)', async () => {
    const m = new AddReviewQueue1714000007000();
    const up = makeRunner();
    const down = makeRunner();
    await m.up(up.queryRunner);
    await m.down(down.queryRunner);

    expect(up.queries[0]).toMatch(/CREATE TABLE/);
    expect(up.queries[1]).toMatch(/CREATE INDEX/);
    expect(down.queries[0]).toMatch(/DROP INDEX/);
    expect(down.queries[1]).toMatch(/DROP TABLE/);
  });
});
