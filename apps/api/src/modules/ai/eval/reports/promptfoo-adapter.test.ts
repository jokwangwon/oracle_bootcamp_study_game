import { describe, expect, it } from 'vitest';

import {
  aggregateCallRecords,
  buildRoundFromRecords,
  parsePromptfooRawJson,
  type RawCallRecord,
} from './promptfoo-adapter';
import { evalRoundResultV1Schema } from './schema.v1';

/**
 * promptfoo-adapter 단위 테스트.
 *
 * 본 어댑터는 두 가지 역할:
 *  1. promptfoo-agnostic 한 RawCallRecord[]를 받아 EvalRoundResultV1로 조립
 *     (aggregateCallRecords + buildRoundFromRecords)
 *  2. promptfoo CLI의 JSON 출력을 RawCallRecord[]로 변환
 *     (parsePromptfooRawJson — 단계 8 R0에서 실제 출력으로 재검증 필요)
 *
 * 단계 6에서는 (1)을 완전 검증하고, (2)는 promptfoo 표준 shape를 가정한
 * fixture로 테스트한다. 실제 promptfoo 출력과 차이가 있으면 단계 8에서 patch.
 */

const ENV = {
  cudaVersion: '13.0',
  nvidiaDriverVersion: '580.126.09',
  ollamaVersion: '0.20.4',
  ollamaImageDigest: 'sha256:abc',
  promptVersion: 'local-fallback-v1',
  seed: 42,
  temperature: 0.2,
};

const META = {
  schemaVersion: 1 as const,
  roundId: 'R1-test',
  roundLabel: 'R1 — Tier 1 Gold A',
  startedAt: '2026-04-09T20:00:00Z',
  finishedAt: '2026-04-09T21:00:00Z',
  environment: ENV,
};

const PROVIDER = {
  id: 'M2 — EXAONE 3.5 32B',
  provider: 'ollama' as const,
  model: 'exaone3.5:32b',
  baseUrl: 'http://ollama:11434',
};

function makeRecord(overrides: Partial<RawCallRecord> = {}): RawCallRecord {
  return {
    testCase: {
      entryId: 'gold-a-blank-typing-01',
      goldSet: 'A',
      gameMode: 'blank-typing',
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
    },
    runIndex: 0,
    rawOutput: '{"sql":"SELECT * FROM EMP","blanks":[],"answer":[],"explanation":""}',
    latencyMs: 10_000,
    assertions: [
      { metric: 'MT1', pass: true, score: 1, reason: 'pass' },
      { metric: 'MT2', pass: true, score: 1, reason: 'pass' },
      { metric: 'MT3', pass: true, score: 1, reason: 'pass' },
      { metric: 'MT4', pass: true, score: 1, reason: 'pass' },
      { metric: 'MT5', pass: true, score: 1, reason: 'pass' },
      { metric: 'MT8', pass: true, score: 1, reason: 'pass' },
    ],
    ...overrides,
  };
}

describe('aggregateCallRecords', () => {
  it('빈 records는 0으로 집계', () => {
    const agg = aggregateCallRecords([]);
    expect(agg.totalCalls).toBe(0);
    expect(agg.meanLatencyMs).toBe(0);
    expect(agg.errorCount).toBe(0);
  });

  it('단일 record의 메트릭별 pass rate', () => {
    const agg = aggregateCallRecords([makeRecord()]);
    expect(agg.totalCalls).toBe(1);
    expect(agg.passRatePerMetric.MT1?.rate).toBe(1.0);
    expect(agg.passRatePerMetric.MT1?.passes).toBe(1);
    expect(agg.passRatePerMetric.MT1?.total).toBe(1);
  });

  it('일부 record가 fail이면 rate가 그만큼 감소', () => {
    const records = [
      makeRecord(),
      makeRecord({
        runIndex: 1,
        assertions: [{ metric: 'MT1', pass: false, score: 0, reason: 'fail' }],
      }),
      makeRecord({ runIndex: 2 }),
    ];
    const agg = aggregateCallRecords(records);
    // MT1은 3개 중 2개 pass
    expect(agg.passRatePerMetric.MT1?.rate).toBeCloseTo(2 / 3);
  });

  it('error가 있는 record는 errorCount + 어떤 메트릭도 추가하지 않음', () => {
    const records = [
      makeRecord(),
      makeRecord({
        runIndex: 1,
        rawOutput: '',
        assertions: [],
        error: 'connection refused',
      }),
    ];
    const agg = aggregateCallRecords(records);
    expect(agg.errorCount).toBe(1);
    // 첫 record만 카운트
    expect(agg.passRatePerMetric.MT1?.total).toBe(1);
  });

  it('mean/p95 latency 계산', () => {
    const records = [
      makeRecord({ latencyMs: 5_000 }),
      makeRecord({ runIndex: 1, latencyMs: 10_000 }),
      makeRecord({ runIndex: 2, latencyMs: 15_000 }),
      makeRecord({ runIndex: 3, latencyMs: 100_000 }),  // outlier
    ];
    const agg = aggregateCallRecords(records);
    expect(agg.meanLatencyMs).toBeCloseTo((5_000 + 10_000 + 15_000 + 100_000) / 4);
    // p95: nearest-rank — 4 elements, ceil(0.95*4)=4 → idx 3 → 100000
    expect(agg.p95LatencyMs).toBe(100_000);
  });

  it('stratified buckets — 난이도 × 모드별 분리 집계', () => {
    const records = [
      makeRecord(),
      makeRecord({ runIndex: 1 }),
      makeRecord({
        runIndex: 0,
        testCase: {
          entryId: 'gold-a-term-match-01',
          goldSet: 'A',
          gameMode: 'term-match',
          topic: 'sql-basics',
          week: 1,
          difficulty: 'EASY',
        },
      }),
    ];
    const agg = aggregateCallRecords(records);
    expect(agg.stratified.length).toBeGreaterThanOrEqual(2);
    const blankBucket = agg.stratified.find(
      (b) => b.gameMode === 'blank-typing' && b.difficulty === 'EASY',
    );
    const termBucket = agg.stratified.find(
      (b) => b.gameMode === 'term-match' && b.difficulty === 'EASY',
    );
    expect(blankBucket?.total).toBe(2);
    expect(termBucket?.total).toBe(1);
  });

  it('bootstrapCi가 메트릭별로 채워짐 (deterministic)', () => {
    const records = [
      makeRecord(),
      makeRecord({ runIndex: 1 }),
      makeRecord({
        runIndex: 2,
        assertions: [{ metric: 'MT1', pass: false, score: 0, reason: 'fail' }],
      }),
    ];
    const agg = aggregateCallRecords(records);
    expect(agg.bootstrapCi.MT1).toBeDefined();
    expect(agg.bootstrapCi.MT1?.mean).toBeGreaterThanOrEqual(0);
    expect(agg.bootstrapCi.MT1?.upper).toBeLessThanOrEqual(1);
  });
});

describe('buildRoundFromRecords', () => {
  it('records로부터 EvalRoundResultV1을 조립하고 schema 검증 통과', () => {
    const round = buildRoundFromRecords(META, PROVIDER, [makeRecord(), makeRecord({ runIndex: 1 })]);
    const result = evalRoundResultV1Schema.safeParse(round);
    expect(result.success).toBe(true);
  });

  it('빈 records도 valid round (aggregate 0)', () => {
    const round = buildRoundFromRecords(META, PROVIDER, []);
    expect(round.aggregate?.totalCalls).toBe(0);
    expect(evalRoundResultV1Schema.safeParse(round).success).toBe(true);
  });
});

describe('parsePromptfooRawJson', () => {
  it('표준 promptfoo shape에서 RawCallRecord[] 추출', () => {
    const raw = {
      results: {
        results: [
          {
            provider: { id: 'M2 — EXAONE 3.5 32B' },
            vars: {
              entryId: 'gold-a-blank-typing-01',
              goldSet: 'A',
              gameMode: 'blank-typing',
              topic: 'sql-basics',
              week: 1,
              difficulty: 'EASY',
            },
            response: {
              output: '{"sql":"SELECT","blanks":[],"answer":[],"explanation":""}',
              latencyMs: 12_500,
            },
            gradingResult: {
              componentResults: [
                {
                  pass: true,
                  score: 1,
                  reason: 'MT1 pass',
                  assertion: { type: 'javascript', value: 'file://assertions/json-parse.ts' },
                },
                {
                  pass: false,
                  score: 0,
                  reason: 'MT2 fail — schema',
                  assertion: { type: 'javascript', value: 'file://assertions/zod-schema.ts' },
                },
              ],
            },
          },
        ],
      },
    };
    const records = parsePromptfooRawJson(raw);
    expect(records).toHaveLength(1);
    expect(records[0]?.testCase.entryId).toBe('gold-a-blank-typing-01');
    expect(records[0]?.latencyMs).toBe(12_500);
    expect(records[0]?.assertions).toHaveLength(2);
    expect(records[0]?.assertions[0]?.metric).toBe('MT1');
    expect(records[0]?.assertions[1]?.metric).toBe('MT2');
    expect(records[0]?.assertions[1]?.pass).toBe(false);
  });

  it('error response도 RawCallRecord에 error 필드로 전달', () => {
    const raw = {
      results: {
        results: [
          {
            provider: { id: 'M2 — EXAONE 3.5 32B' },
            vars: {
              entryId: 'gold-a-blank-typing-01',
              goldSet: 'A',
              gameMode: 'blank-typing',
              topic: 'sql-basics',
              week: 1,
              difficulty: 'EASY',
            },
            response: { output: '', error: 'connection refused', latencyMs: 100 },
            gradingResult: { componentResults: [] },
          },
        ],
      },
    };
    const records = parsePromptfooRawJson(raw);
    expect(records[0]?.error).toBe('connection refused');
  });

  it('unknown assertion file path는 무시 (방어적)', () => {
    const raw = {
      results: {
        results: [
          {
            provider: { id: 'X' },
            vars: {
              entryId: 'gold-a-blank-typing-01',
              goldSet: 'A',
              gameMode: 'blank-typing',
              topic: 'sql-basics',
              week: 1,
              difficulty: 'EASY',
            },
            response: { output: 'x', latencyMs: 100 },
            gradingResult: {
              componentResults: [
                {
                  pass: true,
                  score: 1,
                  reason: 'unknown',
                  assertion: { type: 'javascript', value: 'file://assertions/unknown.ts' },
                },
              ],
            },
          },
        ],
      },
    };
    const records = parsePromptfooRawJson(raw);
    expect(records[0]?.assertions).toHaveLength(0);   // unknown은 dropped
  });

  it('잘못된 raw 입력은 빈 배열', () => {
    expect(parsePromptfooRawJson(null)).toEqual([]);
    expect(parsePromptfooRawJson({})).toEqual([]);
    expect(parsePromptfooRawJson({ results: 'not-an-object' })).toEqual([]);
  });
});
