import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddRefreshTokens1714000010000 } from './1714000010000-AddRefreshTokens';

/**
 * PR-10a Phase 1.2 — `refresh_tokens` 테이블 신설 (rotation + reuse detection 저장소).
 *
 * ADR-020 §4.2.1 A 절. 컬럼:
 *  - jti uuid PK
 *  - user_id uuid FK (CASCADE)
 *  - family_id uuid (rotation chain — reuse detection 시 family 전체 revoke)
 *  - generation int (chain 증가 카운터)
 *  - expires_at, revoked_at, replaced_by, created_at
 *
 * 인덱스:
 *  - (user_id, family_id) — reuse detection · family revoke 쿼리 path
 *  - (expires_at) WHERE revoked_at IS NULL — TTL 청소용 (선택)
 *
 * 실 Postgres 없이 SQL 문자열만 assert (1714000007/008 패턴 재사용).
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

describe('AddRefreshTokens1714000010000', () => {
  it('migration 이름이 고정된다 (migration history 일관성)', () => {
    const m = new AddRefreshTokens1714000010000();
    expect(m.name).toBe('AddRefreshTokens1714000010000');
  });

  it('up: refresh_tokens CREATE TABLE IF NOT EXISTS + jti uuid PK (1.4)', async () => {
    const m = new AddRefreshTokens1714000010000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+refresh_tokens/);
    expect(sql).toMatch(/jti\s+UUID\s+NOT NULL PRIMARY KEY/);
  });

  it('up: rotation chain 컬럼 (family_id / generation / replaced_by / revoked_at)', async () => {
    const m = new AddRefreshTokens1714000010000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/family_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/generation\s+INTEGER\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/expires_at\s+TIMESTAMPTZ\s+NOT NULL/);
    expect(sql).toMatch(/revoked_at\s+TIMESTAMPTZ/);
    expect(sql).toMatch(/replaced_by\s+UUID/);
    expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL DEFAULT NOW\(\)/);
  });

  it('up: user_id FK + ON DELETE CASCADE (1.5)', async () => {
    const m = new AddRefreshTokens1714000010000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/user_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/REFERENCES\s+users\s*\(\s*id\s*\)\s+ON DELETE CASCADE/);
  });

  it('up: (user_id, family_id) 인덱스 존재 (1.6)', async () => {
    const m = new AddRefreshTokens1714000010000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const indexSql = queries[1]!;
    expect(indexSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_family/);
    expect(indexSql).toMatch(/ON refresh_tokens\s*\(\s*user_id\s*,\s*family_id\s*\)/);
  });

  it('down: index 먼저 drop → 테이블 drop (IF EXISTS) (1.7)', async () => {
    const m = new AddRefreshTokens1714000010000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatch(/DROP INDEX IF EXISTS idx_refresh_tokens_user_family/);
    expect(queries[1]).toMatch(/DROP TABLE IF EXISTS refresh_tokens/);
  });

  it('up 과 down 이 서로 반대 순서로 DDL 을 실행 (재진입성)', async () => {
    const m = new AddRefreshTokens1714000010000();
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
