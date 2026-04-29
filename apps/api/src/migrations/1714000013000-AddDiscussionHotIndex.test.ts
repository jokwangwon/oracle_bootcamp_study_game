import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddDiscussionHotIndex1714000013000 } from './1714000013000-AddDiscussionHotIndex';

/**
 * PR-12 §5.3 — discussion_threads 의 hot 정렬 expression index.
 *
 * 실 Postgres 없이 쿼리 문자열만 assert. SDD §5.2 의 hot 공식
 * (`LOG(GREATEST(ABS(score),1)) * SIGN(score) + EXTRACT(EPOCH FROM
 * last_activity_at)/45000`) 가 expression index 의 ORDER 표현식과 1:1 매칭
 * 되어야 hot 정렬 쿼리에서 인덱스가 사용된다.
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

describe('AddDiscussionHotIndex1714000013000', () => {
  it('migration 이름이 고정된다', () => {
    const m = new AddDiscussionHotIndex1714000013000();
    expect(m.name).toBe('AddDiscussionHotIndex1714000013000');
  });

  it('up: hot 공식이 expression index 정의에 포함', async () => {
    const m = new AddDiscussionHotIndex1714000013000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_discussion_threads_hot/);
    expect(sql).toMatch(/ON discussion_threads/);
    expect(sql).toMatch(/LOG\(GREATEST\(ABS\(score\),\s*1\)\)\s*\*\s*SIGN\(score\)/);
    expect(sql).toMatch(/EXTRACT\(EPOCH FROM last_activity_at\)\s*\/\s*45000/);
  });

  it('up: index 가 DESC + id DESC tie-break + WHERE is_deleted=FALSE', async () => {
    const m = new AddDiscussionHotIndex1714000013000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/DESC,\s*id DESC/);
    expect(sql).toMatch(/WHERE is_deleted = FALSE/);
  });

  it('down: IF EXISTS 로 멱등 drop', async () => {
    const m = new AddDiscussionHotIndex1714000013000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/DROP INDEX IF EXISTS idx_discussion_threads_hot/);
  });
});
