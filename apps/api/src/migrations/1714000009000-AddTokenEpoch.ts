import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-10a §4.2.1 B 절 — `users.token_epoch` 컬럼 신설 (logout/revoke 즉시 무효화 카운터).
 *
 * 배경:
 *  - Session 12 합의 (consensus-010) Reviewer 결정 #8 — Agent B G1 "logout 후 access
 *    1~14분 유효" CRITICAL 갭 해소. ADR-018 active_epoch 패턴 재사용 → 신규 인프라 0.
 *
 * 정책:
 *  - JWT payload 에 `epoch` claim 포함. JwtAuthGuard 가 매 요청 사용자의 현재
 *    `token_epoch` 와 비교 → 불일치 시 401.
 *  - logout / 비밀번호 변경 / 강제 revoke 시 `incrementTokenEpoch(userId)` 호출 →
 *    기존 access JWT 전체 즉시 무효화.
 *  - DEFAULT 0 / NOT NULL — 기존 user 행은 0 으로 backfill (signed JWT 의 epoch 누락
 *    시 기본 0 fallback 으로 호환).
 *
 * `ADD COLUMN IF NOT EXISTS` 로 synchronize 선행 실행 환경에서도 충돌 없음.
 */
export class AddTokenEpoch1714000009000 implements MigrationInterface {
  name = 'AddTokenEpoch1714000009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS token_epoch INTEGER NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS token_epoch
    `);
  }
}
