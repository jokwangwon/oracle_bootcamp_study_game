import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-10b §4.4 — self-vote 차단 plpgsql 트리거.
 *
 * 정책:
 *  - 1차 방어: DiscussionService.vote() 가 ForbiddenException 사전 차단 (UX 메시지).
 *  - 최후 방어: DB 트리거 — race / direct SQL / 잘못된 application 코드도 막음.
 *  - CHECK 제약은 JOIN 불가 → 트리거로 author_id 비교.
 *
 * 트리거: BEFORE INSERT OR UPDATE — INSERT 또는 vote 변경 시 모두 검증.
 *
 * 본 마이그레이션은 1714000011000 (3 테이블) 의 후속. 분리 이유:
 *  - 함수 본문이 길고 재배포 가능성이 있어 (CREATE OR REPLACE) 별도 관리.
 *  - up/down 이 독립적으로 검증 가능.
 */
export class AddDiscussionSelfVoteTrigger1714000012000 implements MigrationInterface {
  name = 'AddDiscussionSelfVoteTrigger1714000012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_discussion_self_vote() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.target_type = 'post' THEN
          IF NEW.user_id = (SELECT author_id FROM discussion_posts WHERE id = NEW.target_id) THEN
            RAISE EXCEPTION 'self-vote prohibited' USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        IF NEW.target_type = 'thread' THEN
          IF NEW.user_id = (SELECT author_id FROM discussion_threads WHERE id = NEW.target_id) THEN
            RAISE EXCEPTION 'self-vote prohibited' USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER tr_prevent_discussion_self_vote
        BEFORE INSERT OR UPDATE ON discussion_votes
        FOR EACH ROW EXECUTE FUNCTION prevent_discussion_self_vote()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS tr_prevent_discussion_self_vote ON discussion_votes`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_discussion_self_vote()`);
  }
}
