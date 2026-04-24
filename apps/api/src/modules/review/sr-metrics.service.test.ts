import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SrMetricBreachPayload } from '../ops/entities/ops-event-log.entity';
import {
  DEFAULT_SR_METRIC_THRESHOLDS,
  evaluateSrMetricBreaches,
  SrMetricsService,
  toIsoDate,
  type SrComputedMetrics,
} from './sr-metrics.service';

/**
 * ADR-019 §6 PR-6 — SrMetricsService TDD.
 *
 * 검증 범위:
 *  - `evaluateSrMetricBreaches` pure function (3 지표 threshold 비교)
 *  - `toIsoDate` UTC 날짜 포맷
 *  - `computeMetrics` — 3개 QueryBuilder 순차 호출, rawOne 매핑
 *  - `snapshotDaily` — metricsRepo.upsert + breach 시 eventRepo.save
 *  - `runDaily` cron 엔트리: snapshotDaily 실패 시 에러 삼키기 (fail-safe)
 */

type QbMock = {
  select: ReturnType<typeof vi.fn>;
  addSelect: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  setParameters: ReturnType<typeof vi.fn>;
  getRawOne: ReturnType<typeof vi.fn>;
};

function makeQb(returned: unknown): QbMock {
  const qb: QbMock = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    setParameters: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue(returned),
  };
  return qb;
}

function makeRqRepo(
  retentionRaw: unknown,
  completionRaw: unknown,
  guardRaw: unknown,
) {
  const qb1 = makeQb(retentionRaw);
  const qb2 = makeQb(completionRaw);
  const qb3 = makeQb(guardRaw);
  return {
    createQueryBuilder: vi
      .fn()
      .mockReturnValueOnce(qb1)
      .mockReturnValueOnce(qb2)
      .mockReturnValueOnce(qb3),
    _qbs: [qb1, qb2, qb3] as const,
  };
}

function makeMetricsRepo() {
  return {
    upsert: vi.fn().mockResolvedValue({}),
  };
}

function makeEventRepo() {
  return {
    save: vi.fn().mockResolvedValue({}),
  };
}

describe('toIsoDate', () => {
  it("UTC 00:00 경계에서 YYYY-MM-DD 반환", () => {
    expect(toIsoDate(new Date('2026-04-24T00:00:00.000Z'))).toBe('2026-04-24');
    expect(toIsoDate(new Date('2026-04-24T23:59:59.999Z'))).toBe('2026-04-24');
  });
});

describe('evaluateSrMetricBreaches (pure)', () => {
  const baseDate = '2026-04-24';

  function metrics(partial: Partial<SrComputedMetrics>): SrComputedMetrics {
    return {
      metricDate: baseDate,
      retention: { avgQuality: null, sampleSize: 0 },
      completion: { rate: null, completed: 0, scheduled: 0 },
      guard: { lowRate: null, lowCount: 0, total: 0 },
      ...partial,
    };
  }

  it('전 지표 sampleSize=0 이면 breach 없음 (판단 보류)', () => {
    expect(evaluateSrMetricBreaches(metrics({}))).toEqual([]);
  });

  it('retention 3.4 + sample=5 → retention breach (< 3.5)', () => {
    const result = evaluateSrMetricBreaches(
      metrics({ retention: { avgQuality: 3.4, sampleSize: 5 } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.metric).toBe('retention_avg_quality');
    expect(result[0]!.observed).toBe(3.4);
    expect(result[0]!.threshold).toBe(3.5);
    expect(result[0]!.sampleSize).toBe(5);
    expect(result[0]!.metricDate).toBe(baseDate);
  });

  it('retention 3.5 정확값 → breach 없음 (경계값 포함)', () => {
    const result = evaluateSrMetricBreaches(
      metrics({ retention: { avgQuality: 3.5, sampleSize: 5 } }),
    );
    expect(result).toEqual([]);
  });

  it('completion 0.65 + scheduled=20 → completion breach (< 0.7)', () => {
    const result = evaluateSrMetricBreaches(
      metrics({ completion: { rate: 0.65, completed: 13, scheduled: 20 } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.metric).toBe('completion_rate');
    expect(result[0]!.observed).toBe(0.65);
    expect(result[0]!.threshold).toBe(0.7);
    expect(result[0]!.sampleSize).toBe(20);
  });

  it('guard 0.21 + total=100 → guard breach (>= 0.2)', () => {
    const result = evaluateSrMetricBreaches(
      metrics({ guard: { lowRate: 0.21, lowCount: 21, total: 100 } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.metric).toBe('guard_low_rate');
    expect(result[0]!.observed).toBe(0.21);
    expect(result[0]!.threshold).toBe(0.2);
    expect(result[0]!.sampleSize).toBe(100);
  });

  it('guard 0.199 → breach 없음', () => {
    const result = evaluateSrMetricBreaches(
      metrics({ guard: { lowRate: 0.199, lowCount: 20, total: 101 } }),
    );
    expect(result).toEqual([]);
  });

  it('3 지표 모두 breach 시 3건 반환', () => {
    const result = evaluateSrMetricBreaches(
      metrics({
        retention: { avgQuality: 3.2, sampleSize: 5 },
        completion: { rate: 0.6, completed: 6, scheduled: 10 },
        guard: { lowRate: 0.25, lowCount: 25, total: 100 },
      }),
    );
    expect(result).toHaveLength(3);
    expect(result.map((b) => b.metric)).toEqual([
      'retention_avg_quality',
      'completion_rate',
      'guard_low_rate',
    ]);
  });

  it('커스텀 threshold 반영', () => {
    const result = evaluateSrMetricBreaches(
      metrics({ retention: { avgQuality: 3.6, sampleSize: 5 } }),
      { retentionMinQuality: 4.0, completionMinRate: 0.7, guardMaxLowRate: 0.2 },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.threshold).toBe(4.0);
  });
});

describe('SrMetricsService.computeMetrics', () => {
  const asOf = new Date('2026-04-24T12:00:00.000Z');

  it('모든 샘플 0 → avg/rate null, sample=0 반환', async () => {
    const rq = makeRqRepo(
      { avg: null, sample: 0 },
      { completed: 0, scheduled: 0 },
      { low: 0, total: 0 },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
      makeEventRepo() as never,
    );

    const m = await service.computeMetrics(asOf);
    expect(m.metricDate).toBe('2026-04-24');
    expect(m.retention.avgQuality).toBeNull();
    expect(m.retention.sampleSize).toBe(0);
    expect(m.completion.rate).toBeNull();
    expect(m.completion.scheduled).toBe(0);
    expect(m.guard.lowRate).toBeNull();
    expect(m.guard.total).toBe(0);
  });

  it('retention: avg=4.2, sample=15 → Number 변환', async () => {
    const rq = makeRqRepo(
      { avg: '4.2', sample: '15' },
      { completed: 0, scheduled: 0 },
      { low: 0, total: 0 },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );

    const m = await service.computeMetrics(asOf);
    expect(m.retention.avgQuality).toBe(4.2);
    expect(m.retention.sampleSize).toBe(15);
  });

  it('completion rate 계산: completed/scheduled 소수 (1.0 상한)', async () => {
    const rq = makeRqRepo(
      { avg: null, sample: 0 },
      { completed: '8', scheduled: '10' },
      { low: 0, total: 0 },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );

    const m = await service.computeMetrics(asOf);
    expect(m.completion.rate).toBe(0.8);
    expect(m.completion.completed).toBe(8);
    expect(m.completion.scheduled).toBe(10);
  });

  it('completion rate 상한 1.0 (completed > scheduled 시 min 적용)', async () => {
    const rq = makeRqRepo(
      { avg: null, sample: 0 },
      { completed: '15', scheduled: '10' },
      { low: 0, total: 0 },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );
    const m = await service.computeMetrics(asOf);
    expect(m.completion.rate).toBe(1);
  });

  it('guard low_rate 계산: low/total', async () => {
    const rq = makeRqRepo(
      { avg: null, sample: 0 },
      { completed: 0, scheduled: 0 },
      { low: '3', total: '30' },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );
    const m = await service.computeMetrics(asOf);
    expect(m.guard.lowRate).toBe(0.1);
    expect(m.guard.lowCount).toBe(3);
    expect(m.guard.total).toBe(30);
  });

  it('retention QueryBuilder: where repetition>=2 + 7일 전 시점 + last_quality NOT NULL', async () => {
    const rq = makeRqRepo(
      { avg: '4.0', sample: '10' },
      { completed: 0, scheduled: 0 },
      { low: 0, total: 0 },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );
    await service.computeMetrics(asOf);

    const qb = rq._qbs[0];
    expect(qb.where).toHaveBeenCalledWith('rq.repetition >= 2');
    expect(qb.andWhere).toHaveBeenCalledWith('rq.last_reviewed_at >= :since', {
      since: new Date('2026-04-17T12:00:00.000Z'),
    });
    expect(qb.andWhere).toHaveBeenCalledWith('rq.last_quality IS NOT NULL');
  });

  it('completion QueryBuilder: asOf + 24h 파라미터 세팅', async () => {
    const rq = makeRqRepo(
      { avg: null, sample: 0 },
      { completed: '0', scheduled: '0' },
      { low: 0, total: 0 },
    );
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );
    await service.computeMetrics(asOf);

    const qb = rq._qbs[1];
    expect(qb.setParameters).toHaveBeenCalledWith({
      asOf,
      oneDay: new Date('2026-04-23T12:00:00.000Z'),
    });
  });
});

describe('SrMetricsService.snapshotDaily', () => {
  const asOf = new Date('2026-04-24T00:00:00.000Z');

  it('정상 지표 → upsert 1건 + breach 없음 → eventRepo.save 호출 없음', async () => {
    const rq = makeRqRepo(
      { avg: '4.0', sample: '10' }, // retention 4.0 ≥ 3.5
      { completed: '9', scheduled: '10' }, // completion 0.9 ≥ 0.7
      { low: '1', total: '20' }, // guard 0.05 < 0.2
    );
    const metricsRepo = makeMetricsRepo();
    const eventRepo = makeEventRepo();
    const service = new SrMetricsService(
      rq as never,
      metricsRepo as never,
      eventRepo as never,
    );
    await service.snapshotDaily(asOf);

    expect(metricsRepo.upsert).toHaveBeenCalledOnce();
    const [row, conflict] = metricsRepo.upsert.mock.calls[0]!;
    expect(conflict).toEqual(['metricDate']);
    expect(row.metricDate).toBe('2026-04-24');
    expect(row.retentionAvgQuality).toBe('4.000');
    expect(row.retentionSampleSize).toBe(10);
    expect(row.completionRate).toBe('0.900');
    expect(row.completionCompleted).toBe(9);
    expect(row.completionScheduled).toBe(10);
    expect(row.guardLowRate).toBe('0.050');
    expect(row.guardLowCount).toBe(1);
    expect(row.guardTotal).toBe(20);
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('retention breach → eventRepo.save(sr_metric_breach) 1건', async () => {
    const rq = makeRqRepo(
      { avg: '3.2', sample: '10' }, // retention < 3.5
      { completed: '10', scheduled: '10' }, // completion 1.0 ≥ 0.7
      { low: '0', total: '10' }, // guard 0 < 0.2
    );
    const metricsRepo = makeMetricsRepo();
    const eventRepo = makeEventRepo();
    const service = new SrMetricsService(
      rq as never,
      metricsRepo as never,
      eventRepo as never,
    );
    await service.snapshotDaily(asOf);

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const saved = eventRepo.save.mock.calls[0]![0];
    expect(saved.kind).toBe('sr_metric_breach');
    const payload = saved.payload as unknown as SrMetricBreachPayload;
    expect(payload.metric).toBe('retention_avg_quality');
    expect(payload.observed).toBe(3.2);
    expect(payload.threshold).toBe(3.5);
  });

  it('null 지표 → null 문자열 저장 (toFixed 스킵)', async () => {
    const rq = makeRqRepo(
      { avg: null, sample: 0 },
      { completed: 0, scheduled: 0 },
      { low: 0, total: 0 },
    );
    const metricsRepo = makeMetricsRepo();
    const service = new SrMetricsService(rq as never, metricsRepo as never);
    await service.snapshotDaily(asOf);

    const [row] = metricsRepo.upsert.mock.calls[0]!;
    expect(row.retentionAvgQuality).toBeNull();
    expect(row.completionRate).toBeNull();
    expect(row.guardLowRate).toBeNull();
  });

  it('eventRepo 미주입 시에도 upsert 는 성공 (optional 의존성)', async () => {
    const rq = makeRqRepo(
      { avg: '3.0', sample: '5' }, // breach
      { completed: 0, scheduled: 0 },
      { low: 0, total: 0 },
    );
    const metricsRepo = makeMetricsRepo();
    const service = new SrMetricsService(rq as never, metricsRepo as never);
    await expect(service.snapshotDaily(asOf)).resolves.toBeUndefined();
    expect(metricsRepo.upsert).toHaveBeenCalledOnce();
  });
});

describe('SrMetricsService.runDaily (cron fail-safe)', () => {
  it('snapshotDaily throw → 에러 삼키기 (cron 다음 실행 보존)', async () => {
    const rq = {
      createQueryBuilder: vi.fn(() => {
        throw new Error('db down');
      }),
    };
    const service = new SrMetricsService(
      rq as never,
      makeMetricsRepo() as never,
    );
    await expect(service.runDaily()).resolves.toBeUndefined();
  });
});

describe('default thresholds', () => {
  it('기본값이 ADR-019 §6 스펙과 일치', () => {
    expect(DEFAULT_SR_METRIC_THRESHOLDS).toEqual({
      retentionMinQuality: 3.5,
      completionMinRate: 0.7,
      guardMaxLowRate: 0.2,
    });
  });
});
