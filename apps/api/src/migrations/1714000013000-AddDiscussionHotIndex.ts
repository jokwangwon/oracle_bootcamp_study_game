import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-12 §5.3 — discussion_threads 의 hot 정렬 expression index.
 *
 * SDD §5.2 의 hot 공식 (`LOG(GREATEST(ABS(score),1)) * SIGN(score) +
 * EXTRACT(EPOCH FROM last_activity_at)/45000`) 와 1:1 매칭. is_deleted=false
 * 행만 인덱싱 (partial index 로 인덱스 크기 절감).
 *
 * synchronize:true 환경 (dev) 에서는 expression index 가 자동 생성되지 않으므로
 * 본 마이그레이션을 명시 실행하거나, dev 부팅 시 별도 SQL 적용을 권장.
 */
export class AddDiscussionHotIndex1714000013000 implements MigrationInterface {
  name = 'AddDiscussionHotIndex1714000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_discussion_threads_hot
        ON discussion_threads (
          (LOG(GREATEST(ABS(score), 1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000) DESC,
          id DESC
        )
        WHERE is_deleted = FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_discussion_threads_hot;`);
  }
}
