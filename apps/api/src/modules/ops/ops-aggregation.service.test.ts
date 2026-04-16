import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  OpsAggregationService,
  evaluateGates,
  type AggregateInput,
  type GateThresholds,
  DEFAULT_GATE_THRESHOLDS,
} from './ops-aggregation.service';
import type { Repository } from 'typeorm';
import type { OpsQuestionMeasurementEntity } from './entities/ops-question-measurement.entity';
import type { OpsEventLogEntity } from './entities/ops-event-log.entity';

describe('evaluateGates (pure)', () => {
  const t: GateThresholds = DEFAULT_GATE_THRESHOLDS;

  it('전 지표 통과 → breaches 빈 배열', () => {
    const input: AggregateInput = {
      mt3Rate: 0.99,
      mt4Rate: 0.95,
      p95LatencyMs: 30000,
      studentReportRate: 0.02,
      windowSize: 50,
    };
    expect(evaluateGates(input, t)).toEqual([]);
  });

  it('mt3 미달 단독 breach', () => {
    const breaches = evaluateGates(
      { mt3Rate: 0.9, mt4Rate: 0.95, p95LatencyMs: 30000, studentReportRate: 0.02, windowSize: 50 },
      t,
    );
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.metric).toBe('mt3_rate');
    expect(breaches[0]!.observed).toBe(0.9);
    expect(breaches[0]!.threshold).toBe(0.95);
  });

  it('p95 + 신고율 동시 breach → 2건', () => {
    const breaches = evaluateGates(
      { mt3Rate: 0.99, mt4Rate: 0.95, p95LatencyMs: 75000, studentReportRate: 0.08, windowSize: 50 },
      t,
    );
    expect(breaches.map((b) => b.metric).sort()).toEqual(['p95_latency', 'student_report_rate']);
  });

  it('mt4Rate=null (해당 없음) → mt4 검사 skip', () => {
    const breaches = evaluateGates(
      { mt3Rate: 0.99, mt4Rate: null, p95LatencyMs: 30000, studentReportRate: 0.02, windowSize: 50 },
      t,
    );
    expect(breaches).toEqual([]);
  });

  it('windowSize=0 → 어떤 breach도 발생하지 않음 (집계 의미 없음)', () => {
    const breaches = evaluateGates(
      { mt3Rate: 0, mt4Rate: 0, p95LatencyMs: 999999, studentReportRate: 1, windowSize: 0 },
      t,
    );
    expect(breaches).toEqual([]);
  });
});

describe('OpsAggregationService.runAggregation', () => {
  let measureRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let eventRepo: { save: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  let writer: { write: ReturnType<typeof vi.fn>; exists: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventRepo = {
      save: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0), // student reports
    };
    writer = {
      write: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockReturnValue(false),
    };
  });

  /** measureRepo의 raw query 결과를 받는 fake builder */
  function makeBuilder(raw: {
    window_size: number;
    mt3_pass_count: number;
    mt4_eligible_count: number;
    mt4_pass_count: number;
    p95_ms: number;
  }) {
    return {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue(raw),
    };
  }

  it('전 지표 통과 시 gate_breach 이벤트 미발행', async () => {
    measureRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        makeBuilder({
          window_size: 50,
          mt3_pass_count: 50,
          mt4_eligible_count: 30,
          mt4_pass_count: 30,
          p95_ms: 30000,
        }),
      ),
    };
    const service = new OpsAggregationService(measureRepo as never, eventRepo as never, writer as never);

    await service.runAggregation();

    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('mt4 미달 → gate_breach 이벤트 1건 INSERT', async () => {
    measureRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        makeBuilder({
          window_size: 50,
          mt3_pass_count: 50,
          mt4_eligible_count: 30,
          mt4_pass_count: 25, // 25/30 = 0.833 < 0.93
          p95_ms: 30000,
        }),
      ),
    };
    const service = new OpsAggregationService(measureRepo as never, eventRepo as never, writer as never);

    await service.runAggregation();

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const evt = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(evt.kind).toBe('gate_breach');
    expect((evt.payload as { metric: string }).metric).toBe('mt4_rate');
  });

  it('window_size=100 도달 시 monitoring-window-1 리포트 작성 (멱등 — 미존재만)', async () => {
    measureRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        makeBuilder({
          window_size: 100,
          mt3_pass_count: 99,
          mt4_eligible_count: 60,
          mt4_pass_count: 58,
          p95_ms: 44900,
        }),
      ),
    };
    const service = new OpsAggregationService(measureRepo as never, eventRepo as never, writer as never);

    await service.runAggregation();

    expect(writer.exists).toHaveBeenCalled();
    expect(writer.write).toHaveBeenCalledOnce();
    const [, content] = writer.write.mock.calls[0]!;
    expect(content).toContain('window-1');
    expect(content).toContain('99/100'); // mt3 99 of 100
  });

  it('window-1 리포트가 이미 존재하면 다시 쓰지 않음', async () => {
    measureRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        makeBuilder({ window_size: 100, mt3_pass_count: 99, mt4_eligible_count: 60, mt4_pass_count: 58, p95_ms: 44900 }),
      ),
    };
    writer.exists = vi.fn().mockReturnValue(true);
    const service = new OpsAggregationService(measureRepo as never, eventRepo as never, writer as never);

    await service.runAggregation();

    expect(writer.write).not.toHaveBeenCalled();
  });

  it('window_size=0 (측정 데이터 없음) → 모든 처리 skip, 이벤트도 리포트도 없음', async () => {
    measureRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        makeBuilder({ window_size: 0, mt3_pass_count: 0, mt4_eligible_count: 0, mt4_pass_count: 0, p95_ms: 0 }),
      ),
    };
    const service = new OpsAggregationService(measureRepo as never, eventRepo as never, writer as never);

    await service.runAggregation();

    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('학생 신고율 > 5% → gate_breach 추가', async () => {
    measureRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        makeBuilder({ window_size: 50, mt3_pass_count: 50, mt4_eligible_count: 30, mt4_pass_count: 30, p95_ms: 30000 }),
      ),
    };
    eventRepo.count = vi.fn().mockResolvedValue(4); // 4건 / 50 = 8%
    const service = new OpsAggregationService(measureRepo as never, eventRepo as never, writer as never);

    await service.runAggregation();

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const evt = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect((evt.payload as { metric: string }).metric).toBe('student_report_rate');
  });
});
