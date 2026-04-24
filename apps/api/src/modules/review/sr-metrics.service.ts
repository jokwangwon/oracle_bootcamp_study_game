import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type SrMetricBreachPayload,
} from '../ops/entities/ops-event-log.entity';
import { ReviewQueueEntity } from './entities/review-queue.entity';
import { SrMetricsDailyEntity } from './entities/sr-metrics-daily.entity';

/**
 * ADR-019 §6 PR-6 — SM-2 일별 집계 + breach 감지.
 *
 * 지표 (관리자 전용, 학생 미공개 — §6.4):
 *  - Primary retention: 7일 평균 last_quality (repetition ≥ 2). 목표 ≥ 3.5.
 *  - Secondary completion: completed/scheduled. 목표 ≥ 0.7.
 *  - Guard low_rate: quality ≤ 1 비율. 경보 ≥ 0.2.
 */

export interface SrComputedMetrics {
  metricDate: string;
  retention: { avgQuality: number | null; sampleSize: number };
  completion: { rate: number | null; completed: number; scheduled: number };
  guard: { lowRate: number | null; lowCount: number; total: number };
}

export interface SrMetricThresholds {
  retentionMinQuality: number;
  completionMinRate: number;
  guardMaxLowRate: number;
}

export const DEFAULT_SR_METRIC_THRESHOLDS: SrMetricThresholds = {
  retentionMinQuality: 3.5,
  completionMinRate: 0.7,
  guardMaxLowRate: 0.2,
};

const DAY_MS = 86_400_000;

export function toIsoDate(asOf: Date): string {
  return asOf.toISOString().slice(0, 10);
}

/**
 * Pure function — 3대 지표에 대해 threshold breach 를 계산. sampleSize=0 인
 * 지표는 평가하지 않는다 (데이터 부족으로 판단 보류).
 */
export function evaluateSrMetricBreaches(
  metrics: SrComputedMetrics,
  thresholds: SrMetricThresholds = DEFAULT_SR_METRIC_THRESHOLDS,
): SrMetricBreachPayload[] {
  const breaches: SrMetricBreachPayload[] = [];
  if (
    metrics.retention.avgQuality !== null &&
    metrics.retention.sampleSize > 0 &&
    metrics.retention.avgQuality < thresholds.retentionMinQuality
  ) {
    breaches.push({
      metric: 'retention_avg_quality',
      observed: metrics.retention.avgQuality,
      threshold: thresholds.retentionMinQuality,
      sampleSize: metrics.retention.sampleSize,
      metricDate: metrics.metricDate,
    });
  }
  if (
    metrics.completion.rate !== null &&
    metrics.completion.scheduled > 0 &&
    metrics.completion.rate < thresholds.completionMinRate
  ) {
    breaches.push({
      metric: 'completion_rate',
      observed: metrics.completion.rate,
      threshold: thresholds.completionMinRate,
      sampleSize: metrics.completion.scheduled,
      metricDate: metrics.metricDate,
    });
  }
  if (
    metrics.guard.lowRate !== null &&
    metrics.guard.total > 0 &&
    metrics.guard.lowRate >= thresholds.guardMaxLowRate
  ) {
    breaches.push({
      metric: 'guard_low_rate',
      observed: metrics.guard.lowRate,
      threshold: thresholds.guardMaxLowRate,
      sampleSize: metrics.guard.total,
      metricDate: metrics.metricDate,
    });
  }
  return breaches;
}

@Injectable()
export class SrMetricsService {
  private readonly logger = new Logger(SrMetricsService.name);
  private readonly thresholds: SrMetricThresholds = DEFAULT_SR_METRIC_THRESHOLDS;

  constructor(
    @InjectRepository(ReviewQueueEntity)
    private readonly rqRepo: Repository<ReviewQueueEntity>,
    @InjectRepository(SrMetricsDailyEntity)
    private readonly metricsRepo: Repository<SrMetricsDailyEntity>,
    @Optional()
    @InjectRepository(OpsEventLogEntity)
    private readonly eventRepo?: Repository<OpsEventLogEntity>,
  ) {}

  /**
   * 세 집계 쿼리 실행 후 구조화된 수치를 반환. DB I/O 만 발생 — 외부 부작용 없음.
   * `asOf` 는 테스트를 위해 주입 가능 (cron 실행 시 new Date()).
   */
  async computeMetrics(asOf: Date = new Date()): Promise<SrComputedMetrics> {
    const sevenDaysAgo = new Date(asOf.getTime() - 7 * DAY_MS);
    const oneDayAgo = new Date(asOf.getTime() - DAY_MS);

    // Primary — retention (repetition >= 2 + 7d)
    const retentionQb = this.rqRepo
      .createQueryBuilder('rq')
      .select('AVG(rq.last_quality)', 'avg')
      .addSelect('COUNT(*)', 'sample')
      .where('rq.repetition >= 2')
      .andWhere('rq.last_reviewed_at >= :since', { since: sevenDaysAgo })
      .andWhere('rq.last_quality IS NOT NULL');
    const retentionRaw = (await retentionQb.getRawOne()) as
      | { avg: string | null; sample: string | number | null }
      | undefined;
    const retentionSample = Number(retentionRaw?.sample ?? 0);
    const retentionAvg =
      retentionSample > 0 && retentionRaw?.avg != null
        ? Number(retentionRaw.avg)
        : null;

    // Secondary — completion (scheduled: due_at <= asOf ; completed: same + last_reviewed 24h)
    const completionQb = this.rqRepo
      .createQueryBuilder('rq')
      .select(
        'COUNT(*) FILTER (WHERE rq.due_at <= :asOf AND rq.last_reviewed_at >= :oneDay)',
        'completed',
      )
      .addSelect('COUNT(*) FILTER (WHERE rq.due_at <= :asOf)', 'scheduled')
      .setParameters({ asOf, oneDay: oneDayAgo });
    const completionRaw = (await completionQb.getRawOne()) as
      | { completed: string | number | null; scheduled: string | number | null }
      | undefined;
    const scheduled = Number(completionRaw?.scheduled ?? 0);
    const completed = Number(completionRaw?.completed ?? 0);
    const completionRate = scheduled > 0 ? Math.min(1, completed / scheduled) : null;

    // Guard — low_rate (quality <= 1 비율)
    const guardQb = this.rqRepo
      .createQueryBuilder('rq')
      .select('COUNT(*) FILTER (WHERE rq.last_quality <= 1)', 'low')
      .addSelect(
        'COUNT(*) FILTER (WHERE rq.last_quality IS NOT NULL)',
        'total',
      );
    const guardRaw = (await guardQb.getRawOne()) as
      | { low: string | number | null; total: string | number | null }
      | undefined;
    const guardTotal = Number(guardRaw?.total ?? 0);
    const guardLow = Number(guardRaw?.low ?? 0);
    const guardLowRate = guardTotal > 0 ? guardLow / guardTotal : null;

    return {
      metricDate: toIsoDate(asOf),
      retention: { avgQuality: retentionAvg, sampleSize: retentionSample },
      completion: { rate: completionRate, completed, scheduled },
      guard: { lowRate: guardLowRate, lowCount: guardLow, total: guardTotal },
    };
  }

  /**
   * `computeMetrics` 결과를 `sr_metrics_daily` 에 upsert 하고 threshold breach 에 대해
   * `ops_event_log(kind='sr_metric_breach')` 이벤트를 기록한다.
   *
   * metric_date PK 로 멱등 — 같은 날 여러 번 실행해도 최신 스냅샷으로 업데이트.
   */
  async snapshotDaily(asOf: Date = new Date()): Promise<void> {
    const m = await this.computeMetrics(asOf);

    await this.metricsRepo.upsert(
      {
        metricDate: m.metricDate,
        retentionAvgQuality:
          m.retention.avgQuality !== null
            ? m.retention.avgQuality.toFixed(3)
            : null,
        retentionSampleSize: m.retention.sampleSize,
        completionRate:
          m.completion.rate !== null ? m.completion.rate.toFixed(3) : null,
        completionCompleted: m.completion.completed,
        completionScheduled: m.completion.scheduled,
        guardLowRate:
          m.guard.lowRate !== null ? m.guard.lowRate.toFixed(3) : null,
        guardLowCount: m.guard.lowCount,
        guardTotal: m.guard.total,
      } as Partial<SrMetricsDailyEntity>,
      ['metricDate'],
    );

    const breaches = evaluateSrMetricBreaches(m, this.thresholds);
    for (const b of breaches) {
      if (this.eventRepo) {
        await this.eventRepo.save({
          kind: 'sr_metric_breach',
          questionId: null,
          userId: null,
          payload: b as unknown as Record<string, unknown>,
          resolvedAt: null,
        } as OpsEventLogEntity);
      }
      this.logger.warn(
        `sr_metric_breach ${b.metric}: observed=${b.observed} threshold=${b.threshold} sample=${b.sampleSize} date=${b.metricDate}`,
      );
    }
  }

  /**
   * 매일 00:00 UTC 스냅샷. fail-safe — 단일 날짜 실패가 다음 날 실행을 막지 않도록
   * catch 후 error 로그만. metric_date PK 로 동일 날짜 재실행 멱등.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'sr-metrics-daily' })
  async runDaily(): Promise<void> {
    try {
      await this.snapshotDaily();
    } catch (err) {
      this.logger.error(
        `sr-metrics-daily snapshot 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
