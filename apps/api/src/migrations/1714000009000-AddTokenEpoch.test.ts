import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddTokenEpoch1714000009000 } from './1714000009000-AddTokenEpoch';

/**
 * PR-10a Phase 1.1 — `users.token_epoch` 컬럼 추가 (logout/revoke 즉시 무효화 카운터).
 *
 * ADR-020 §4.2.1 B 절. ADR-018 epoch 패턴 재사용 — JwtAuthGuard 가 매 요청
 * 사용자의 현재 token_epoch 와 JWT payload epoch 비교 → 불일치 시 401.
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

describe('AddTokenEpoch1714000009000', () => {
  it('migration 이름이 고정된다 (migration history 일관성)', () => {
    const m = new AddTokenEpoch1714000009000();
    expect(m.name).toBe('AddTokenEpoch1714000009000');
  });

  it('up: users.token_epoch 컬럼 추가 + INTEGER NOT NULL DEFAULT 0 (1.1 + 1.3)', async () => {
    const m = new AddTokenEpoch1714000009000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/ALTER TABLE\s+users/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+token_epoch\s+INTEGER\s+NOT NULL\s+DEFAULT 0/);
  });

  it('up: IF NOT EXISTS 로 synchronize 병행 안전', async () => {
    const m = new AddTokenEpoch1714000009000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    expect(queries[0]).toMatch(/IF NOT EXISTS/);
  });

  it('down: token_epoch 컬럼 제거 (IF EXISTS) (1.2)', async () => {
    const m = new AddTokenEpoch1714000009000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/ALTER TABLE\s+users/);
    expect(queries[0]).toMatch(/DROP COLUMN IF EXISTS\s+token_epoch/);
  });
});
