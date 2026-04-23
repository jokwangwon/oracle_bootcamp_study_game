import { describe, expect, it } from 'vitest';

import { AddAnswerHistoryWormTrigger1714000002000 } from './1714000002000-AddAnswerHistoryWormTrigger';

/**
 * ADR-016 §6 + ADR-018 §8 — WORM 트리거 migration 스모크 테스트.
 *
 * DB 실 연결 없이 발행되는 SQL 을 inspect 하여 규약 준수 확인.
 * (실제 UPDATE 차단 동작은 Session 5 이후 통합 환경에서 수동 검증)
 */

function createMockQueryRunner(): {
  queryRunner: { query: (sql: string) => Promise<void> };
  calls: string[];
} {
  const calls: string[] = [];
  return {
    queryRunner: {
      query: async (sql: string) => {
        calls.push(sql);
      },
    },
    calls,
  };
}

describe('Migration: AddAnswerHistoryWormTrigger1714000002000', () => {
  describe('up()', () => {
    it('plpgsql 함수 answer_history_worm_block 생성 — RAISE EXCEPTION 포함', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddAnswerHistoryWormTrigger1714000002000();

      await migration.up(queryRunner as never);

      const funcCall = calls.find((s) =>
        s.includes('FUNCTION answer_history_worm_block()'),
      );
      expect(funcCall).toBeDefined();
      expect(funcCall).toMatch(/RAISE\s+EXCEPTION/);
      expect(funcCall).toMatch(/append-only/);
      expect(funcCall).toMatch(/LANGUAGE\s+plpgsql/);
    });

    it('ADR-016 §6 + ADR-018 §8 reference 를 에러 메시지에 포함 — 운영자 디버깅용', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddAnswerHistoryWormTrigger1714000002000();

      await migration.up(queryRunner as never);

      const funcCall = calls.find((s) =>
        s.includes('FUNCTION answer_history_worm_block()'),
      );
      expect(funcCall).toMatch(/ADR-016.*§6/);
      expect(funcCall).toMatch(/ADR-018.*§8/);
    });

    it('BEFORE UPDATE 트리거 tr_answer_history_worm 설치', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddAnswerHistoryWormTrigger1714000002000();

      await migration.up(queryRunner as never);

      const trigger = calls.find((s) =>
        s.includes('CREATE TRIGGER tr_answer_history_worm'),
      );
      expect(trigger).toBeDefined();
      expect(trigger).toMatch(/BEFORE\s+UPDATE\s+ON\s+answer_history/);
      expect(trigger).toMatch(/FOR EACH ROW/);
      expect(trigger).toMatch(/EXECUTE\s+FUNCTION\s+answer_history_worm_block/);
    });

    it('INSERT/DELETE 는 트리거 대상 아님 — BEFORE UPDATE 만', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddAnswerHistoryWormTrigger1714000002000();

      await migration.up(queryRunner as never);

      const triggerDef = calls.find((s) =>
        s.includes('CREATE TRIGGER tr_answer_history_worm'),
      );
      expect(triggerDef).not.toMatch(/BEFORE\s+INSERT/);
      expect(triggerDef).not.toMatch(/BEFORE\s+DELETE/);
      expect(triggerDef).not.toMatch(/AFTER\s+/);
    });
  });

  describe('down()', () => {
    it('트리거 DROP 후 함수 DROP (역순)', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddAnswerHistoryWormTrigger1714000002000();

      await migration.down(queryRunner as never);

      expect(calls[0]).toMatch(/DROP TRIGGER.*tr_answer_history_worm/);
      expect(calls[1]).toMatch(/DROP FUNCTION.*answer_history_worm_block/);
    });

    it('IF EXISTS 가드 — 트리거/함수 부재 시 안전한 revert', async () => {
      const { queryRunner, calls } = createMockQueryRunner();
      const migration = new AddAnswerHistoryWormTrigger1714000002000();

      await migration.down(queryRunner as never);

      for (const call of calls) {
        expect(call).toMatch(/IF\s+EXISTS/);
      }
    });
  });

  it('migration name 프로퍼티 일치', () => {
    const migration = new AddAnswerHistoryWormTrigger1714000002000();
    expect(migration.name).toBe('AddAnswerHistoryWormTrigger1714000002000');
  });
});
