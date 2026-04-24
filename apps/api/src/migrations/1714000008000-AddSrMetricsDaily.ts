import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-019 §6 PR-6 — `sr_metrics_daily` 테이블 신설 (SM-2 일별 집계 스냅샷).
 *
 * 성격: 분석 전용 파생 테이블. WORM 아님 (metric_date PK 멱등 UPSERT).
 * 스냅샷 데이터이므로 재실행 가능 (review_queue 로부터 리플레이).
 *
 * 컬럼:
 *  - `metric_date DATE` PK (UTC 기준 스냅샷 날짜)
 *  - `retention_avg_quality NUMERIC(4,3)` nullable — Primary 지표
 *  - `retention_sample_size INT` default 0
 *  - `completion_rate NUMERIC(4,3)` nullable — Secondary 지표
 *  - `completion_completed INT`, `completion_scheduled INT`
 *  - `guard_low_rate NUMERIC(4,3)` nullable — Guard 지표
 *  - `guard_low_count INT`, `guard_total INT`
 *  - `created_at TIMESTAMPTZ` default NOW()
 *
 * `IF NOT EXISTS` 로 synchronize 와 병행 안전.
 */
export class AddSrMetricsDaily1714000008000 implements MigrationInterface {
  name = 'AddSrMetricsDaily1714000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sr_metrics_daily (
        metric_date           DATE         NOT NULL PRIMARY KEY,
        retention_avg_quality NUMERIC(4,3),
        retention_sample_size INT          NOT NULL DEFAULT 0,
        completion_rate       NUMERIC(4,3),
        completion_completed  INT          NOT NULL DEFAULT 0,
        completion_scheduled  INT          NOT NULL DEFAULT 0,
        guard_low_rate        NUMERIC(4,3),
        guard_low_count       INT          NOT NULL DEFAULT 0,
        guard_total           INT          NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sr_metrics_daily');
  }
}
