import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-019 — `review_queue` 테이블 신설 (SM-2 Spaced Repetition 상태).
 *
 * 성격: 파생/캐시 테이블 (ADR-019 §4.1). WORM 트리거 설치 금지.
 *
 * 주요 컬럼:
 *  - `(user_id, question_id)` PK — UPSERT 축
 *  - `ease_factor numeric(4,3)` default 2.500 — SM-2 canonical + SM-2-lite clamp
 *  - `interval_days int`, `repetition int`
 *  - `due_at timestamptz` nullable, `last_reviewed_at timestamptz` nullable
 *  - `last_quality smallint` nullable (관측용)
 *  - `algorithm_version varchar(16)` default 'sm2-v1' — FSRS 전환 대비
 *  - `user_token_hash varchar(32)` / `user_token_hash_epoch smallint` — ADR-018 §4 D3 대칭
 *
 * 인덱스:
 *  - `idx_review_queue_user_due (user_id, due_at) WHERE due_at IS NOT NULL` —
 *    `GET /api/solo/review-queue` 쿼리 optimizer path.
 *
 * `IF NOT EXISTS` 로 synchronize 와 병행 안전.
 */
export class AddReviewQueue1714000007000 implements MigrationInterface {
  name = 'AddReviewQueue1714000007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS review_queue (
        user_id               UUID         NOT NULL,
        question_id           UUID         NOT NULL,
        ease_factor           NUMERIC(4,3) NOT NULL DEFAULT 2.500,
        interval_days         INT          NOT NULL DEFAULT 0,
        repetition            INT          NOT NULL DEFAULT 0,
        due_at                TIMESTAMPTZ,
        last_reviewed_at      TIMESTAMPTZ,
        last_quality          SMALLINT,
        algorithm_version     VARCHAR(16)  NOT NULL DEFAULT 'sm2-v1',
        user_token_hash       VARCHAR(32),
        user_token_hash_epoch SMALLINT,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, question_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_review_queue_user_due
        ON review_queue (user_id, due_at)
        WHERE due_at IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * 주의: `review_queue` 는 파생 테이블이라 DROP 후에도 `answer_history` 를
     * 시간순 replay 하면 재생성 가능 (ADR-019 §4.1-2). 단 운영 중인 학습자의
     * 현재 SM-2 상태는 소실되므로, 프로덕션 rollback 전에 `answer_history` 로부터
     * rebuild CLI 가 준비되어야 한다 (Session 8+).
     */
    await queryRunner.query(`DROP INDEX IF EXISTS idx_review_queue_user_due`);
    await queryRunner.query(`DROP TABLE IF EXISTS review_queue`);
  }
}
