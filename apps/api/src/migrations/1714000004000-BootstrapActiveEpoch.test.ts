import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BootstrapActiveEpoch1714000004000 } from './1714000004000-BootstrapActiveEpoch';

/**
 * consensus-007 CRITICAL-1 / ADR-018 §5 — bootstrap active epoch seed migration.
 *
 * DB 실 연결 없이 up()/down() 이 발행하는 SQL + params 를 inspect. fail-closed
 * 정책 (USER_TOKEN_HASH_SALT 부재 시 throw) + no-op (이미 active 존재) + fingerprint
 * 결정성을 계산적으로 확인.
 */

type Call = { sql: string; params?: readonly unknown[] };
type QueryHandler = (sql: string, params?: readonly unknown[]) => Promise<unknown>;

function createMockQueryRunner(handler?: QueryHandler): {
  queryRunner: { query: (sql: string, params?: readonly unknown[]) => Promise<unknown> };
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    queryRunner: {
      query: async (sql: string, params?: readonly unknown[]) => {
        calls.push({ sql, params });
        if (handler) return handler(sql, params);
        return [];
      },
    },
    calls,
  };
}

const SYSTEM_SENTINEL_UUID = '00000000-0000-0000-0000-000000000000';

describe('Migration: BootstrapActiveEpoch1714000004000', () => {
  const ORIGINAL_SALT = process.env.USER_TOKEN_HASH_SALT;

  beforeEach(() => {
    process.env.USER_TOKEN_HASH_SALT = 'bootstrap-test-salt-1234567890';
  });

  afterEach(() => {
    if (ORIGINAL_SALT === undefined) {
      delete process.env.USER_TOKEN_HASH_SALT;
    } else {
      process.env.USER_TOKEN_HASH_SALT = ORIGINAL_SALT;
    }
  });

  describe('up()', () => {
    it('active epoch 0건 — epoch row + ops_event_log 동시 INSERT', async () => {
      const { queryRunner, calls } = createMockQueryRunner(async (sql) => {
        if (sql.includes('COUNT(')) return [{ count: '0' }];
        return [];
      });
      const migration = new BootstrapActiveEpoch1714000004000();

      await migration.up(queryRunner as never);

      const countQuery = calls.find((c) => c.sql.includes('COUNT('));
      expect(countQuery).toBeDefined();
      expect(countQuery!.sql).toMatch(/FROM\s+"user_token_hash_salt_epochs"/);
      expect(countQuery!.sql).toMatch(/"deactivated_at"\s+IS\s+NULL/);

      const epochInsert = calls.find((c) =>
        c.sql.includes('INSERT INTO "user_token_hash_salt_epochs"'),
      );
      expect(epochInsert).toBeDefined();
      expect(epochInsert!.sql).toMatch(/"salt_fingerprint"/);
      expect(epochInsert!.sql).toMatch(/"activated_at"/);
      expect(epochInsert!.sql).toMatch(/"admin_id"/);
      expect(epochInsert!.sql).toMatch(/"reason"/);
      expect(epochInsert!.sql).toMatch(/"note"/);

      expect(epochInsert!.params).toBeDefined();
      expect(epochInsert!.params![0]).toMatch(/^[0-9a-f]{8}$/);
      expect(epochInsert!.params![1]).toBe(SYSTEM_SENTINEL_UUID);
      expect(epochInsert!.params![2]).toBe('scheduled');
      expect(epochInsert!.params![3]).toBe('bootstrap seed');

      const opsInsert = calls.find((c) => c.sql.includes('INSERT INTO "ops_event_log"'));
      expect(opsInsert).toBeDefined();
      expect(opsInsert!.sql).toMatch(/"kind"/);
      expect(opsInsert!.sql).toMatch(/"payload"/);
      expect(opsInsert!.params).toBeDefined();
      expect(opsInsert!.params![0]).toBe('salt_rotation');
      const payload = JSON.parse(opsInsert!.params![1] as string) as Record<string, unknown>;
      expect(payload.bootstrap).toBe(true);
      expect(payload.reason).toBe('scheduled');
      expect(payload.admin_id).toBe(SYSTEM_SENTINEL_UUID);
    });

    it('active epoch 이미 존재 — no-op (INSERT 호출 없음)', async () => {
      const { queryRunner, calls } = createMockQueryRunner(async (sql) => {
        if (sql.includes('COUNT(')) return [{ count: '1' }];
        return [];
      });
      const migration = new BootstrapActiveEpoch1714000004000();

      await migration.up(queryRunner as never);

      expect(
        calls.find((c) => c.sql.includes('INSERT INTO "user_token_hash_salt_epochs"')),
      ).toBeUndefined();
      expect(calls.find((c) => c.sql.includes('INSERT INTO "ops_event_log"'))).toBeUndefined();
    });

    it('USER_TOKEN_HASH_SALT env 누락 시 throw (fail-closed, ADR-018 §5)', async () => {
      delete process.env.USER_TOKEN_HASH_SALT;
      const { queryRunner } = createMockQueryRunner(async (sql) => {
        if (sql.includes('COUNT(')) return [{ count: '0' }];
        return [];
      });
      const migration = new BootstrapActiveEpoch1714000004000();

      await expect(migration.up(queryRunner as never)).rejects.toThrow(
        /USER_TOKEN_HASH_SALT/,
      );
    });

    it('fingerprint = sha256(salt).slice(0, 8) — 결정성', async () => {
      process.env.USER_TOKEN_HASH_SALT = 'deterministic-salt-for-fingerprint-test';
      const { queryRunner, calls } = createMockQueryRunner(async (sql) => {
        if (sql.includes('COUNT(')) return [{ count: '0' }];
        return [];
      });
      const migration = new BootstrapActiveEpoch1714000004000();

      await migration.up(queryRunner as never);

      const expectedFp = createHash('sha256')
        .update('deterministic-salt-for-fingerprint-test')
        .digest('hex')
        .slice(0, 8);

      const epochInsert = calls.find((c) =>
        c.sql.includes('INSERT INTO "user_token_hash_salt_epochs"'),
      );
      expect(epochInsert!.params![0]).toBe(expectedFp);
    });

    it('COUNT 결과 { count: 0 } (number) 형태여도 동작 — pg node driver 호환', async () => {
      const { queryRunner, calls } = createMockQueryRunner(async (sql) => {
        if (sql.includes('COUNT(')) return [{ count: 0 }];
        return [];
      });
      const migration = new BootstrapActiveEpoch1714000004000();

      await migration.up(queryRunner as never);

      expect(
        calls.find((c) => c.sql.includes('INSERT INTO "user_token_hash_salt_epochs"')),
      ).toBeDefined();
    });
  });

  describe('down()', () => {
    it('bootstrap seed row 만 DELETE — admin_id=system sentinel + note="bootstrap seed"', async () => {
      const { queryRunner, calls } = createMockQueryRunner(async () => []);
      const migration = new BootstrapActiveEpoch1714000004000();

      await migration.down(queryRunner as never);

      const del = calls.find((c) => c.sql.includes('DELETE FROM'));
      expect(del).toBeDefined();
      expect(del!.sql).toMatch(/DELETE FROM\s+"user_token_hash_salt_epochs"/);
      expect(del!.sql).toMatch(/"admin_id"\s*=/);
      expect(del!.sql).toMatch(/"note"\s*=/);
      expect(del!.params).toEqual([SYSTEM_SENTINEL_UUID, 'bootstrap seed']);
    });
  });

  it('migration name 프로퍼티는 파일명 timestamp 와 일치', () => {
    const migration = new BootstrapActiveEpoch1714000004000();
    expect(migration.name).toBe('BootstrapActiveEpoch1714000004000');
  });
});
