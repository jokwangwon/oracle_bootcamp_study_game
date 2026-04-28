import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-10a §4.2.1 A 절 — `refresh_tokens` 테이블 신설 (rotation + reuse detection 저장소).
 *
 * 배경:
 *  - Session 12 합의 (consensus-010) Reviewer 결정 #7. Agent B 의 "refresh rotation
 *    reuse detection 알고리즘 미정 (placeholder)" CRITICAL 갭 해소.
 *  - JWT stateless 이지만 refresh 는 server-side 추적 필요 (rotation chain + reuse
 *    detection). Redis 만으로 부족 — DB 영속성 + family revoke 필요.
 *
 * 테이블 구조:
 *  - `jti` UUID PK — JWT JTI claim 과 1:1 매핑
 *  - `user_id` UUID FK (ON DELETE CASCADE) — 사용자 삭제 시 자동 정리
 *  - `family_id` UUID — rotation chain 식별자 (login 시 신규 family 생성, refresh 시 상속)
 *  - `generation` INT — chain 안 회전 카운터 (login=0, 첫 refresh=1, ...)
 *  - `expires_at` TIMESTAMPTZ — refresh 만료 (Q-R3 결정 14d)
 *  - `revoked_at` TIMESTAMPTZ nullable — rotation/logout 시 채움
 *  - `replaced_by` UUID nullable — 회전 후 새 jti 추적 (reuse detection 용)
 *  - `created_at` TIMESTAMPTZ DEFAULT NOW()
 *
 * 인덱스:
 *  - `idx_refresh_tokens_user_family (user_id, family_id)` — reuse detection 시
 *    family 전체 revoke 쿼리 경로 (`UPDATE ... WHERE user_id = $1 AND family_id = $2`).
 *
 * `IF NOT EXISTS` 로 synchronize 와 병행 안전.
 */
export class AddRefreshTokens1714000010000 implements MigrationInterface {
  name = 'AddRefreshTokens1714000010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        jti          UUID         NOT NULL PRIMARY KEY,
        user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_id    UUID         NOT NULL,
        generation   INTEGER      NOT NULL DEFAULT 0,
        expires_at   TIMESTAMPTZ  NOT NULL,
        revoked_at   TIMESTAMPTZ,
        replaced_by  UUID,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_family
        ON refresh_tokens (user_id, family_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_user_family`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
  }
}
