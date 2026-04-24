import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * consensus-007 S6-C2-6 — `answer_history` 에 3단 채점 추가 메타 컬럼.
 *
 * 기존 컬럼 (Session 3 도입):
 *  - grading_method / grader_digest / grading_layers_used / partial_score
 *  - user_token_hash / user_token_hash_epoch (Session 5/6)
 *
 * 신규 (본 migration):
 *  - rationale (text nullable) — Orchestrator 조립 사람-가독 근거
 *  - sanitization_flags (jsonb nullable) — AnswerSanitizer 플래그
 *  - ast_failure_reason (varchar(32) nullable) — Layer 1 UNKNOWN 분류
 *
 * WORM 트리거 (1714000002000) 와 호환:
 *  - ALTER TABLE ADD COLUMN 은 UPDATE 가 아니라 DDL 이므로 트리거 미동작.
 *  - 신규 컬럼 모두 nullable — 기존 행 backfill 불필요.
 *  - IF NOT EXISTS 로 synchronize(dev) 선행 실행 시 재실행 안전.
 */
export class AddAnswerHistoryGradingMeta1714000005000 implements MigrationInterface {
  name = 'AddAnswerHistoryGradingMeta1714000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE answer_history
        ADD COLUMN IF NOT EXISTS rationale text,
        ADD COLUMN IF NOT EXISTS sanitization_flags jsonb,
        ADD COLUMN IF NOT EXISTS ast_failure_reason varchar(32)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE answer_history
        DROP COLUMN IF EXISTS ast_failure_reason,
        DROP COLUMN IF EXISTS sanitization_flags,
        DROP COLUMN IF EXISTS rationale
    `);
  }
}
