import { describe, expect, it } from 'vitest';

import { AddUserTokenHashSaltEpochs1714000001000 } from './1714000001000-AddUserTokenHashSaltEpochs';

/**
 * ADR-018 §10 Session 5 — migration DDL 스모크 테스트.
 *
 * DB 실 연결 없이 up()/down() 이 발행하는 SQL 을 inspect 하여 ADR-018 §5 규약
 * (fingerprint CHAR(8), reason CHECK, partial unique index, answer_history 컬럼 추가)
 * 을 계산적으로 확인.
 */

type Call = string;

function createMockQueryRunner(): { queryRunner: { query: (sql: string) => Promise<void> }; calls: Call[] } {
  const calls: Call[] = [];
  return {
    queryRunner: {
      query: async (sql: string) => {
        calls.push(sql);
      },
    },
    calls,
  };
}

describe('Migration: AddUserTokenHashSaltEpochs1714000001000', () => {
  describe('up()', () => {
    it('user_token_hash_salt_epochs 테이블 CREATE — 모든 컬럼 + CHECK 제약 포함', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddUserTokenHashSaltEpochs1714000001000();

      await migration.up(queryRunner as never);

      const createTable = calls.find((s) => s.includes('CREATE TABLE "user_token_hash_salt_epochs"'));
      expect(createTable).toBeDefined();
      expect(createTable).toMatch(/"epoch_id"\s+SMALLSERIAL\s+PRIMARY KEY/);
      expect(createTable).toMatch(/"salt_fingerprint"\s+CHAR\(8\)\s+NOT NULL/);
      expect(createTable).toMatch(/"activated_at"\s+TIMESTAMPTZ\s+NOT NULL/);
      expect(createTable).toMatch(/"deactivated_at"\s+TIMESTAMPTZ\s+NULL/);
      expect(createTable).toMatch(/"admin_id"\s+UUID\s+NOT NULL/);
      expect(createTable).toMatch(/"reason"\s+VARCHAR\(32\)\s+NOT NULL/);
      expect(createTable).toMatch(/CHECK\s*\(\s*"reason"\s+IN\s*\(\s*'scheduled',\s*'incident'\s*\)\s*\)/);
      expect(createTable).toMatch(/"note"\s+TEXT/);
      expect(createTable).toMatch(/"created_at"\s+TIMESTAMPTZ/);
    });

    it('활성 salt 1건 partial unique index — WHERE deactivated_at IS NULL', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddUserTokenHashSaltEpochs1714000001000();

      await migration.up(queryRunner as never);

      const idxCall = calls.find((s) =>
        s.includes('ux_user_token_hash_salt_epochs_active'),
      );
      expect(idxCall).toBeDefined();
      expect(idxCall).toMatch(/CREATE\s+UNIQUE\s+INDEX/);
      expect(idxCall).toMatch(/WHERE\s+"deactivated_at"\s+IS\s+NULL/);
    });

    it('answer_history.user_token_hash_epoch SMALLINT NULL 컬럼 추가', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddUserTokenHashSaltEpochs1714000001000();

      await migration.up(queryRunner as never);

      const alterCall = calls.find((s) =>
        s.includes('ALTER TABLE "answer_history"'),
      );
      expect(alterCall).toBeDefined();
      expect(alterCall).toMatch(
        /ADD COLUMN\s+"user_token_hash_epoch"\s+SMALLINT\s+NULL/,
      );
    });
  });

  describe('down()', () => {
    it('컬럼 DROP + 인덱스 DROP + 테이블 DROP (역순)', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddUserTokenHashSaltEpochs1714000001000();

      await migration.down(queryRunner as never);

      expect(calls[0]).toMatch(/ALTER TABLE "answer_history".*DROP COLUMN "user_token_hash_epoch"/);
      expect(calls[1]).toMatch(/DROP INDEX.*"ux_user_token_hash_salt_epochs_active"/);
      expect(calls[2]).toMatch(/DROP TABLE.*"user_token_hash_salt_epochs"/);
    });
  });

  it('migration name 프로퍼티는 파일명 timestamp 와 일치', () => {
    const migration = new AddUserTokenHashSaltEpochs1714000001000();
    expect(migration.name).toBe('AddUserTokenHashSaltEpochs1714000001000');
  });
});
