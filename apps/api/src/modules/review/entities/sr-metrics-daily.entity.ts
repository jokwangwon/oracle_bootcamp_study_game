import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

/**
 * ADR-019 §6 PR-6 — SM-2 일별 집계 스냅샷.
 *
 * 성격: 파생/스냅샷 테이블. 분석 조회 전용, WORM 아님. 재생성은 가능하나 원본
 * (`review_queue` + `answer_history`) 리플레이는 시간 비용이 높아 snapshot 보존.
 *
 * 생성 주기: `@Cron('0 0 * * *')` 하루 1회 00:00 UTC. metric_date PK 로 멱등.
 *
 * ## 지표 (관리자 미공개 — ADR-019 §6.4)
 *
 *  - **Primary — 7일 retention**: `AVG(last_quality)` (repetition ≥ 2 AND
 *    last_reviewed_at >= asOf - 7d). 목표 ≥ 3.5.
 *  - **Secondary — 복습 완료율**: `completed_count / scheduled_count` where
 *    - scheduled = due_at <= asOf (누적 due)
 *    - completed = due_at <= asOf AND last_reviewed_at >= asOf - 24h. 목표 ≥ 0.7.
 *  - **Guard — quality 0~1 비율**: `low_quality_count / total_count`. 경보 > 0.2.
 *
 * 각 지표의 sample_size(분모) 를 함께 저장하여 희소성 판단에 활용.
 */
@Entity('sr_metrics_daily')
export class SrMetricsDailyEntity {
  /**
   * UTC 기준 날짜. snapshot 시점의 UTC 00:00. ISO date (e.g., '2026-04-24').
   * DATE 컬럼으로 저장하여 동일 날짜 중복 INSERT 는 멱등 (ON CONFLICT DO NOTHING).
   */
  @PrimaryColumn({ type: 'date', name: 'metric_date' })
  metricDate!: string;

  /**
   * Primary — 평균 last_quality (repetition ≥ 2 + last_reviewed_at 7일 이내).
   * sample_size=0 일 때 null.
   */
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    name: 'retention_avg_quality',
    nullable: true,
  })
  retentionAvgQuality!: string | null;

  @Column({ type: 'int', name: 'retention_sample_size', default: 0 })
  retentionSampleSize!: number;

  /**
   * Secondary — completion_rate = completed / scheduled. both 0 이면 null.
   */
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    name: 'completion_rate',
    nullable: true,
  })
  completionRate!: string | null;

  @Column({ type: 'int', name: 'completion_completed', default: 0 })
  completionCompleted!: number;

  @Column({ type: 'int', name: 'completion_scheduled', default: 0 })
  completionScheduled!: number;

  /**
   * Guard — quality 0~1 비율 = low_count / total_count. total=0 이면 null.
   */
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    name: 'guard_low_rate',
    nullable: true,
  })
  guardLowRate!: string | null;

  @Column({ type: 'int', name: 'guard_low_count', default: 0 })
  guardLowCount!: number;

  @Column({ type: 'int', name: 'guard_total', default: 0 })
  guardTotal!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
