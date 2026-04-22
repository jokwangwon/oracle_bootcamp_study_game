import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-016 §추가 이의제기 파이프라인 — `grading_appeals` 테이블 신설.
 *
 * answer_history WORM 원칙에 따라 관리자 override 는 `grading_appeals` 에 새 레코드
 * INSERT + `admin_reviewer` / `resolved_at` 으로 추적. answer_history 자체는 수정 금지.
 */
export class AddGradingAppeals1714000003000 implements MigrationInterface {
  name = 'AddGradingAppeals1714000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "grading_appeals" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "answer_history_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "reason" VARCHAR(32) NOT NULL CHECK ("reason" IN ('incorrect_grading','scope_dispute','technical_error','other')),
        "note" TEXT,
        "status" VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','resolved','rejected')),
        "admin_reviewer" UUID NULL,
        "resolution" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "resolved_at" TIMESTAMPTZ NULL,
        CONSTRAINT fk_grading_appeals_answer_history FOREIGN KEY ("answer_history_id")
          REFERENCES "answer_history"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_grading_appeals_user_created"
        ON "grading_appeals" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_grading_appeals_answer_status"
        ON "grading_appeals" ("answer_history_id", "status")
    `);

    // 같은 (answer_history, user) 에 대해 pending 인 appeal 은 1건만 허용 — 중복 차단.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_grading_appeals_pending_unique"
        ON "grading_appeals" ("answer_history_id", "user_id")
        WHERE "status" = 'pending'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_grading_appeals_pending_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_grading_appeals_answer_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_grading_appeals_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grading_appeals"`);
  }
}
