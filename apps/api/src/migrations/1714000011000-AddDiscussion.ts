import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-10b §5.1 / §4.4 — R4 토론 3-테이블 신설.
 *
 * 테이블:
 *  - discussion_threads — 질문(question) 단위 thread.
 *  - discussion_posts — thread 안의 답변/댓글 (parent_id NULL = 답변, NOT NULL = 1-level nested 댓글).
 *  - discussion_votes — thread/post 양쪽 vote 통합 (target_type discriminator).
 *
 * 정책:
 *  - vote 무결성: PRIMARY KEY (user_id, target_type, target_id) + CHECK value IN (-1,1) +
 *    target_type CHECK ('thread'|'post'). UNIQUE 는 PK 가 자동 부여.
 *  - 자기 vote 차단은 1714000012000 trigger 로 별도 (CHECK 제약은 JOIN 불가).
 *  - score 캐시: posts/threads 의 score 컬럼은 sum(votes.value) 로 service 가 동기 갱신.
 *
 * `IF NOT EXISTS` 로 synchronize 와 병행 안전.
 */
export class AddDiscussion1714000011000 implements MigrationInterface {
  name = 'AddDiscussion1714000011000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // pgcrypto 확장 (gen_random_uuid) — 다른 마이그레이션에서 이미 활성됐을 가능성 큼.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discussion_threads (
        id                  UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id         UUID         NOT NULL,
        author_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title               VARCHAR(200) NOT NULL,
        body                TEXT         NOT NULL,
        score               INTEGER      NOT NULL DEFAULT 0,
        post_count          INTEGER      NOT NULL DEFAULT 0,
        last_activity_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discussion_posts (
        id                  UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id           UUID         NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
        author_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id           UUID,
        body                TEXT         NOT NULL,
        score               INTEGER      NOT NULL DEFAULT 0,
        is_accepted         BOOLEAN      NOT NULL DEFAULT FALSE,
        is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
        related_question_id UUID,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discussion_votes (
        user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('thread', 'post')),
        target_id   UUID        NOT NULL,
        value       SMALLINT    NOT NULL CHECK (value IN (-1, 1)),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, target_type, target_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_discussion_threads_question_activity
        ON discussion_threads (question_id, last_activity_at DESC)
        WHERE is_deleted = FALSE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_discussion_posts_thread_created
        ON discussion_posts (thread_id, created_at)
        WHERE is_deleted = FALSE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_discussion_posts_thread_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_discussion_threads_question_activity`);
    await queryRunner.query(`DROP TABLE IF EXISTS discussion_votes`);
    await queryRunner.query(`DROP TABLE IF EXISTS discussion_posts`);
    await queryRunner.query(`DROP TABLE IF EXISTS discussion_threads`);
  }
}
