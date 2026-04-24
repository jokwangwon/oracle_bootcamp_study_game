import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR #16 (consensus-007 사후 검증 Agent B HIGH / Q2=b 이행) —
 * `ops_event_log` 에 `user_token_hash` + `user_token_hash_epoch` 컬럼 추가.
 *
 * 배경:
 *  - `answer_history` 는 C2-6 에서 `user_token_hash` + `user_token_hash_epoch` 를
 *    채우지만 `ops_event_log` 는 `user_id` 평문만 저장. 두 테이블이 비대칭이라
 *    MT6/MT8 집계 쿼리가 평문 `user_id` 쪽으로 수렴할 위험. ADR-018 §4 D3 Hybrid
 *    정신 (분석 테이블은 hash) 과 충돌.
 *
 * 정책:
 *  - `user_id` 컬럼은 **유지** (관리자 직접 조회·이의제기 처리용 FK).
 *  - `user_token_hash` 는 **분석 집계 쿼리의 권장 축** — 이후 쿼리들은 본 컬럼 사용.
 *  - 기존 행 backfill 불필요 (nullable). 신규 이벤트는 GradingMeasurementService 가
 *    자동으로 채운다.
 *
 * WORM 트리거 (1714000002000) 는 `answer_history` 한정 — 본 테이블엔 미적용.
 *
 * IF NOT EXISTS 로 synchronize 선행 실행 환경에서도 충돌 없음.
 */
export class AddOpsEventLogUserTokenHash1714000006000 implements MigrationInterface {
  name = 'AddOpsEventLogUserTokenHash1714000006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ops_event_log
        ADD COLUMN IF NOT EXISTS user_token_hash varchar(32),
        ADD COLUMN IF NOT EXISTS user_token_hash_epoch smallint
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ops_event_log
        DROP COLUMN IF EXISTS user_token_hash_epoch,
        DROP COLUMN IF EXISTS user_token_hash
    `);
  }
}
