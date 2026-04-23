import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-018 §5 + §10 Session 5 — `user_token_hash_salt_epochs` 원장 + `answer_history`
 * 에 `user_token_hash_epoch` 컬럼 추가.
 *
 * 본 migration 은 production/staging 환경에서 `npm run migration:run` 으로 수동 실행.
 * dev/test 환경은 `synchronize: true` + `migrationsRun: true` 로 부팅 시 자동 반영 (typeorm.config.ts).
 *
 * 되돌리기 (down):
 *  - `answer_history.user_token_hash_epoch` 컬럼 삭제
 *  - `user_token_hash_salt_epochs` 테이블 삭제
 *  - WORM 트리거 migration (1714000002000) 이후에는 REVOKE UPDATE 때문에 ALTER TABLE 이
 *    DDL 이라 영향 없음 (UPDATE 만 차단). 단 상위 migration 먼저 되돌려야 완전 복구.
 */
export class AddUserTokenHashSaltEpochs1714000001000 implements MigrationInterface {
  name = 'AddUserTokenHashSaltEpochs1714000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. user_token_hash_salt_epochs 테이블
    await queryRunner.query(`
      CREATE TABLE "user_token_hash_salt_epochs" (
        "epoch_id" SMALLSERIAL PRIMARY KEY,
        "salt_fingerprint" CHAR(8) NOT NULL,
        "activated_at" TIMESTAMPTZ NOT NULL,
        "deactivated_at" TIMESTAMPTZ NULL,
        "admin_id" UUID NOT NULL,
        "reason" VARCHAR(32) NOT NULL CHECK ("reason" IN ('scheduled', 'incident')),
        "note" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. 활성 salt 1건만 허용 — partial unique index (deactivated_at IS NULL)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_user_token_hash_salt_epochs_active"
        ON "user_token_hash_salt_epochs" ("activated_at")
        WHERE "deactivated_at" IS NULL
    `);

    // 3. answer_history.user_token_hash_epoch 컬럼 추가 (nullable, 기존 데이터 영향 0)
    await queryRunner.query(`
      ALTER TABLE "answer_history"
      ADD COLUMN "user_token_hash_epoch" SMALLINT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "answer_history" DROP COLUMN "user_token_hash_epoch"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "ux_user_token_hash_salt_epochs_active"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_token_hash_salt_epochs"
    `);
  }
}
