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

  function baseInput(overrides: Partial<AggregateInput> = {}): AggregateInput {
    return {
      mt3Rate: 0.99,
      mt4Rate: 0.95,
      p95LatencyMs: 30000,
      studentReportRate: 0.02,
      windowSize: 50,
      mt6Rate: null,
      mt7Violations: 0,
      mt8Rate: null,
      ...overrides,
    };
  }

  it('전 지표 통과 → breaches 빈 배열', () => {
    expect(evaluateGates(baseInput(), t)).toEqual([]);
  });

  it('mt3 미달 단독 breach', () => {
    const breaches = evaluateGates(baseInput({ mt3Rate: 0.9 }), t);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.metric).toBe('mt3_rate');
    expect(breaches[0]!.observed).toBe(0.9);
    expect(breaches[0]!.threshold).toBe(0.95);
  });

  it('p95 + 신고율 동시 breach → 2건', () => {
    const breaches = evaluateGates(
      baseInput({ p95LatencyMs: 75000, studentReportRate: 0.08 }),
      t,
    );
    expect(breaches.map((b) => b.metric).sort()).toEqual([
      'p95_latency',
      'student_report_rate',
    ]);
  });

  it('mt4Rate=null (해당 없음) → mt4 검사 skip', () => {
    const breaches = evaluateGates(baseInput({ mt4Rate: null }), t);
    expect(breaches).toEqual([]);
  });

  it('windowSize=0 → 어떤 breach도 발생하지 않음 (집계 의미 없음)', () => {
    const breaches = evaluateGates(
      baseInput({
        mt3Rate: 0,
        mt4Rate: 0,
        p95LatencyMs: 999999,
        studentReportRate: 1,
        windowSize: 0,
      }),
      t,
    );
    expect(breaches).toEqual([]);
  });

  describe('MT6 — free-form canonical match (ADR-017)', () => {
    it('mt6Rate=null (free-form 샘플 없음) → skip', () => {
      expect(evaluateGates(baseInput({ mt6Rate: null }), t)).toEqual([]);
    });

    it('mt6Rate가 임계(60%)를 초과하면 통과', () => {
      expect(evaluateGates(baseInput({ mt6Rate: 0.8 }), t)).toEqual([]);
    });

    it('mt6Rate < 60% → mt6_canonical_match_rate breach', () => {
      const breaches = evaluateGates(baseInput({ mt6Rate: 0.4 }), t);
      expect(breaches).toHaveLength(1);
      expect(breaches[0]!.metric).toBe('mt6_canonical_match_rate');
      expect(breaches[0]!.observed).toBe(0.4);
      expect(breaches[0]!.threshold).toBe(0.6);
    });
  });

  describe('MT7 — capstone step DAG 위반 (ADR-017)', () => {
    it('mt7Violations=0 → 통과', () => {
      expect(evaluateGates(baseInput({ mt7Violations: 0 }), t)).toEqual([]);
    });

    it('mt7Violations >= 1 → 즉시 breach (무결성 지표)', () => {
      const breaches = evaluateGates(baseInput({ mt7Violations: 1 }), t);
      expect(breaches).toHaveLength(1);
      expect(breaches[0]!.metric).toBe('mt7_capstone_violations');
      expect(breaches[0]!.observed).toBe(1);
    });
  });

  describe('MT8 — LLM-judge 호출률 (ADR-017)', () => {
    it('mt8Rate=null (채점 샘플 없음) → skip', () => {
      expect(evaluateGates(baseInput({ mt8Rate: null }), t)).toEqual([]);
    });

    it('mt8Rate가 임계(15%) 이하 → 통과', () => {
      expect(evaluateGates(baseInput({ mt8Rate: 0.08 }), t)).toEqual([]);
    });

    it('mt8Rate > 15% → mt8_llm_judge_ratio breach', () => {
      const breaches = evaluateGates(baseInput({ mt8Rate: 0.2 }), t);
      expect(breaches).toHaveLength(1);
      expect(breaches[0]!.metric).toBe('mt8_llm_judge_ratio');
      expect(breaches[0]!.observed).toBe(0.2);
      expect(breaches[0]!.threshold).toBe(0.15);
    });
  });

  it('MT3/MT6/MT8 동시 breach → 3건', () => {
    const breaches = evaluateGates(
      baseInput({ mt3Rate: 0.9, mt6Rate: 0.4, mt8Rate: 0.2 }),
      t,
    );
    expect(breaches.map((b) => b.metric).sort()).toEqual([
      'mt3_rate',
      'mt6_canonical_match_rate',
      'mt8_llm_judge_ratio',
    ]);
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
    free_form_total?: number;
    free_form_layer1_resolved?: number;
    llm_judge_calls?: number;
    graded_total?: number;
    parser_dialect_skipped?: number;
  }) {
    const filled = {
      free_form_total: 0,
      free_form_layer1_resolved: 0,
      llm_judge_calls: 0,
      graded_total: 0,
      parser_dialect_skipped: 0,
      ...raw,
    };
    return {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue(filled),
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

  describe('MT6/MT8 집계 (ADR-017)', () => {
    it('free-form 샘플이 있고 Layer1 해소율이 낮으면 mt6_breach 이벤트 발행', async () => {
      measureRepo = {
        createQueryBuilder: vi.fn().mockReturnValue(
          makeBuilder({
            window_size: 50,
            mt3_pass_count: 50,
            mt4_eligible_count: 30,
            mt4_pass_count: 30,
            p95_ms: 30000,
            free_form_total: 20,
            free_form_layer1_resolved: 8, // 8/20 = 40% < 60%
            llm_judge_calls: 0,
            graded_total: 50,
          }),
        ),
      };
      const service = new OpsAggregationService(
        measureRepo as never,
        eventRepo as never,
        writer as never,
      );

      await service.runAggregation();

      expect(eventRepo.save).toHaveBeenCalledOnce();
      const evt = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
      expect(evt.kind).toBe('mt6_breach');
      expect((evt.payload as { metric: string }).metric).toBe(
        'mt6_canonical_match_rate',
      );
    });

    it('LLM-judge 호출률이 15% 초과하면 mt8_breach 이벤트 발행', async () => {
      measureRepo = {
        createQueryBuilder: vi.fn().mockReturnValue(
          makeBuilder({
            window_size: 50,
            mt3_pass_count: 50,
            mt4_eligible_count: 30,
            mt4_pass_count: 30,
            p95_ms: 30000,
            graded_total: 50,
            llm_judge_calls: 12, // 12/50 = 24% > 15%
          }),
        ),
      };
      const service = new OpsAggregationService(
        measureRepo as never,
        eventRepo as never,
        writer as never,
      );

      await service.runAggregation();

      expect(eventRepo.save).toHaveBeenCalledOnce();
      const evt = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
      expect(evt.kind).toBe('mt8_breach');
      expect((evt.payload as { metric: string }).metric).toBe(
        'mt8_llm_judge_ratio',
      );
    });

    it('free-form 샘플 0 → MT6 skip (breach 발생하지 않음)', async () => {
      measureRepo = {
        createQueryBuilder: vi.fn().mockReturnValue(
          makeBuilder({
            window_size: 50,
            mt3_pass_count: 50,
            mt4_eligible_count: 30,
            mt4_pass_count: 30,
            p95_ms: 30000,
            free_form_total: 0,
            free_form_layer1_resolved: 0,
          }),
        ),
      };
      const service = new OpsAggregationService(
        measureRepo as never,
        eventRepo as never,
        writer as never,
      );

      await service.runAggregation();

      expect(eventRepo.save).not.toHaveBeenCalled();
    });

    it('파서 한계(parser_dialect_skipped) 건수가 window-1 리포트에 투명 표기된다 (ADR-013 Session 3 보정)', async () => {
      measureRepo = {
        createQueryBuilder: vi.fn().mockReturnValue(
          makeBuilder({
            window_size: 100,
            mt3_pass_count: 99,
            mt4_eligible_count: 60,
            mt4_pass_count: 58,
            p95_ms: 44900,
            free_form_total: 30,
            free_form_layer1_resolved: 25,
            graded_total: 100,
            llm_judge_calls: 5,
            parser_dialect_skipped: 7,
          }),
        ),
      };
      const service = new OpsAggregationService(
        measureRepo as never,
        eventRepo as never,
        writer as never,
      );

      await service.runAggregation();

      const [, content] = writer.write.mock.calls[0]!;
      expect(content).toContain('ADR-013 Session 3 보정');
      expect(content).toContain('**7건**');
    });

    it('파서 한계 샘플 0건이면 리포트에 "0건"으로 표기', async () => {
      measureRepo = {
        createQueryBuilder: vi.fn().mockReturnValue(
          makeBuilder({
            window_size: 100,
            mt3_pass_count: 99,
            mt4_eligible_count: 60,
            mt4_pass_count: 58,
            p95_ms: 44900,
            free_form_total: 30,
            free_form_layer1_resolved: 25,
            graded_total: 100,
            llm_judge_calls: 5,
          }),
        ),
      };
      const service = new OpsAggregationService(
        measureRepo as never,
        eventRepo as never,
        writer as never,
      );

      await service.runAggregation();

      const [, content] = writer.write.mock.calls[0]!;
      expect(content).toContain('**0건**');
    });

    it('window-1 리포트에 MT6/MT7/MT8 행이 포함된다', async () => {
      measureRepo = {
        createQueryBuilder: vi.fn().mockReturnValue(
          makeBuilder({
            window_size: 100,
            mt3_pass_count: 99,
            mt4_eligible_count: 60,
            mt4_pass_count: 58,
            p95_ms: 44900,
            free_form_total: 30,
            free_form_layer1_resolved: 25,
            graded_total: 100,
            llm_judge_calls: 5,
          }),
        ),
      };
      const service = new OpsAggregationService(
        measureRepo as never,
        eventRepo as never,
        writer as never,
      );

      await service.runAggregation();

      const [, content] = writer.write.mock.calls[0]!;
      expect(content).toContain('MT6 (free-form canonical)');
      expect(content).toContain('MT7 (캡스톤 DAG 위반)');
      expect(content).toContain('MT8 (LLM-judge 호출률)');
      expect(content).toContain('25/30');
      expect(content).toContain('5/100');
    });
  });
});
