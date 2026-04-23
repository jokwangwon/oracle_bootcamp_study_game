import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-016 §6 + ADR-018 §8 금지 1 — `answer_history` WORM 트리거 설치.
 *
 * 목적:
 *  - 채점 이력(answer_history) 을 append-only 로 강제. UPDATE 시도 시 `RAISE EXCEPTION`.
 *  - ADR-018 §8 "재계산 migration 금지" 의 DB 레벨 시행체.
 *  - 관리자 override 는 `grading_appeals` 신규 레코드 INSERT 로 처리 (S5-C3).
 *
 * 구현:
 *  - PL/pgSQL 함수 `answer_history_worm_block()` — 모든 UPDATE 시도를 exception 으로 차단.
 *  - BEFORE UPDATE 트리거 `tr_answer_history_worm` 가 함수 호출.
 *  - `REVOKE UPDATE` 는 role 을 아직 운영 환경에 두지 않으므로 **본 migration 에서는 트리거만**
 *    설치. role 기반 REVOKE 는 production 배포 시 별도 운영 스크립트 (ADR-018 §10 Session 5
 *    이후 운영 환경 준비 시). 트리거만으로 DB 레벨 append-only 는 이미 강제됨.
 *
 * 되돌리기 (down):
 *  - 트리거 DROP → 함수 DROP. INSERT/DELETE 는 영향 없음.
 *
 * 주의:
 *  - INSERT 에는 트리거 미동작. UPDATE 만 차단.
 *  - SUPERUSER 는 SESSION_REPLICATION_ROLE=replica 로 트리거 우회 가능. 마이그레이션 시
 *    임시 우회가 필요하면 개별 migration 내 `SET session_replication_role` 사용 (본 migration
 *    은 해당 없음).
 */
export class AddAnswerHistoryWormTrigger1714000002000 implements MigrationInterface {
  name = 'AddAnswerHistoryWormTrigger1714000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. append-only 강제 함수
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION answer_history_worm_block()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'answer_history is append-only (ADR-016 §6 + ADR-018 §8). UPDATE blocked on row id=%', OLD.id
          USING ERRCODE = 'check_violation';
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. BEFORE UPDATE 트리거
    await queryRunner.query(`
      CREATE TRIGGER tr_answer_history_worm
        BEFORE UPDATE ON answer_history
        FOR EACH ROW
        EXECUTE FUNCTION answer_history_worm_block();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS tr_answer_history_worm ON answer_history;
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS answer_history_worm_block();
    `);
  }
}
