import { describe, expect, it } from 'vitest';

import {
  generateRoundReport,
  generateComparisonReport,
} from './report-generator';
import type { EvalRoundResultV1 } from './schema.v1';

/**
 * report-generator 단위 테스트.
 *
 * 검증 목표:
 *  - 단일 라운드 markdown이 핵심 섹션(헤더/환경/provider/aggregate/합격선)을 모두 포함
 *  - 다중 라운드 비교 보고서가 모델 간 합격 메트릭 수를 정확히 비교
 *  - 합격선 평가가 SDD §1.3 절대치 게이트(C1~C8)와 일치
 *  - aggregate가 null인 in-progress 라운드도 깨지지 않고 안내 섹션 출력
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

function makeRound(overrides: Partial<EvalRoundResultV1> = {}): EvalRoundResultV1 {
  return {
    meta: {
      schemaVersion: 1,
      roundId: 'R1-2026-04-09T20-00-00Z',
      roundLabel: 'R1 — Tier 1 Gold A',
      startedAt: '2026-04-09T20:00:00Z',
      finishedAt: '2026-04-09T21:00:00Z',
      environment: ENV,
    },
    provider: {
      id: 'M2 — EXAONE 3.5 32B',
      provider: 'ollama',
      model: 'exaone3.5:32b',
      baseUrl: 'http://ollama:11434',
    },
    calls: [
      {
        testCase: {
          entryId: 'gold-a-blank-typing-01',
          goldSet: 'A',
          gameMode: 'blank-typing',
          topic: 'sql-basics',
          week: 1,
          difficulty: 'EASY',
        },
        runIndex: 0,
        rawOutput: '{"sql":"SELECT * FROM EMP","blanks":[{"position":0,"answer":"SELECT"}],"answer":["SELECT"],"explanation":"..."}',
        latencyMs: 12_500,
        assertions: [
          { metric: 'MT1', pass: true, score: 1, reason: 'MT1 pass' },
          { metric: 'MT2', pass: true, score: 1, reason: 'MT2 pass' },
          { metric: 'MT3', pass: true, score: 1, reason: 'MT3 pass' },
          { metric: 'MT4', pass: true, score: 1, reason: 'MT4 pass' },
          { metric: 'MT5', pass: true, score: 1, reason: 'MT5 pass' },
          { metric: 'MT8', pass: true, score: 1, reason: 'MT8 pass' },
        ],
      },
    ],
    aggregate: {
      totalCalls: 1,
      passRatePerMetric: {
        MT1: { passes: 1, total: 1, rate: 1.0 },
        MT2: { passes: 1, total: 1, rate: 1.0 },
        MT3: { passes: 1, total: 1, rate: 1.0 },
        MT4: { passes: 1, total: 1, rate: 1.0 },
        MT5: { passes: 1, total: 1, rate: 1.0 },
        MT8: { passes: 1, total: 1, rate: 1.0 },
      },
      meanLatencyMs: 12_500,
      p95LatencyMs: 12_500,
      errorCount: 0,
      stratified: [
        { difficulty: 'EASY', gameMode: 'blank-typing', total: 1, metricRates: { MT1: 1.0, MT2: 1.0 } },
      ],
      bootstrapCi: {
        MT1: { mean: 1.0, lower: 1.0, upper: 1.0 },
      },
    },
    ...overrides,
  };
}

describe('generateRoundReport', () => {
  it('헤더에 라운드 id/라벨/시각 포함', () => {
    const md = generateRoundReport(makeRound());
    expect(md).toContain('R1-2026-04-09T20-00-00Z');
    expect(md).toContain('R1 — Tier 1 Gold A');
    expect(md).toContain('2026-04-09T20:00:00Z');
  });

  it('환경 메타(M-04: CUDA, driver, Ollama 버전, prompt version, seed, temperature)를 모두 노출', () => {
    const md = generateRoundReport(makeRound());
    expect(md).toContain('CUDA');
    expect(md).toContain('13.0');
    expect(md).toContain('580.126.09');
    expect(md).toContain('0.20.4');
    expect(md).toContain('local-fallback-v1');
    expect(md).toContain('42');
    expect(md).toContain('0.2');
  });

  it('provider 식별 정보 노출 (id/model/baseUrl)', () => {
    const md = generateRoundReport(makeRound());
    expect(md).toContain('M2 — EXAONE 3.5 32B');
    expect(md).toContain('exaone3.5:32b');
    expect(md).toContain('ollama:11434');
  });

  it('GGUF SHA256가 있는 provider는 표에 sha 노출 (M1 EXAONE 4.0)', () => {
    const round = makeRound({
      provider: {
        id: 'M1 — EXAONE 4.0 32B',
        provider: 'ollama',
        model: 'exaone4:32b',
        baseUrl: 'http://ollama:11434',
        ggufSha256: '358d0ad399cfab7fca296674cc4b2d367030cbf261d3dc59cff969517253a94c',
      },
    });
    const md = generateRoundReport(round);
    expect(md).toContain('358d0ad3');
  });

  it('aggregate가 null이면 "라운드 진행 중" 안내 + aggregate 섹션 생략', () => {
    const round = makeRound({ aggregate: null });
    const md = generateRoundReport(round);
    expect(md).toContain('진행 중');
    expect(md).not.toContain('| MT1 |');
  });

  it('합격선 평가표에 C1~C8 절대치(95% / 90% / 60s / 99%)가 표시', () => {
    const md = generateRoundReport(makeRound());
    expect(md).toContain('C1');
    expect(md).toContain('95%');
    expect(md).toContain('C3');
    expect(md).toContain('90%');
    expect(md).toContain('C7');
    expect(md).toContain('60');
    expect(md).toContain('C8');
    expect(md).toContain('99%');
  });

  it('모두 통과한 라운드는 합격선 평가에 ✅ 마크', () => {
    const md = generateRoundReport(makeRound());
    expect(md).toMatch(/✅|PASS/);
  });

  it('일부 메트릭이 합격선 미달이면 ❌/FAIL 마크', () => {
    const round = makeRound({
      aggregate: {
        totalCalls: 30,
        passRatePerMetric: {
          MT1: { passes: 25, total: 30, rate: 0.833 }, // < 95%
          MT2: { passes: 30, total: 30, rate: 1.0 },
          MT3: { passes: 30, total: 30, rate: 1.0 },
          MT4: { passes: 30, total: 30, rate: 1.0 },
          MT5: { passes: 30, total: 30, rate: 1.0 },
          MT8: { passes: 30, total: 30, rate: 1.0 },
        },
        meanLatencyMs: 12_500,
        p95LatencyMs: 25_000,
        errorCount: 0,
        stratified: [],
        bootstrapCi: {},
      },
    });
    const md = generateRoundReport(round);
    expect(md).toMatch(/❌|FAIL/);
  });

  it('top failures 섹션에 실패한 call의 reason이 노출 (디버깅용)', () => {
    const round = makeRound({
      calls: [
        {
          testCase: {
            entryId: 'gold-a-blank-typing-01',
            goldSet: 'A',
            gameMode: 'blank-typing',
            topic: 'sql-basics',
            week: 1,
            difficulty: 'EASY',
          },
          runIndex: 0,
          rawOutput: 'invalid json',
          latencyMs: 5_000,
          assertions: [
            { metric: 'MT1', pass: false, score: 0, reason: 'MT1 fail — JSON.parse 실패' },
          ],
        },
      ],
    });
    const md = generateRoundReport(round);
    expect(md).toContain('JSON.parse');
    expect(md).toContain('gold-a-blank-typing-01');
  });

  it('error가 있는 call도 표에 노출 (provider 오류)', () => {
    const round = makeRound({
      calls: [
        {
          testCase: {
            entryId: 'gold-a-blank-typing-01',
            goldSet: 'A',
            gameMode: 'blank-typing',
            topic: 'sql-basics',
            week: 1,
            difficulty: 'EASY',
          },
          runIndex: 0,
          rawOutput: '',
          latencyMs: 100,
          assertions: [],
          error: 'connection refused',
        },
      ],
    });
    const md = generateRoundReport(round);
    expect(md).toContain('connection refused');
  });
});

describe('generateComparisonReport', () => {
  it('빈 배열은 빈 결과 안내', () => {
    const md = generateComparisonReport([]);
    expect(md).toContain('비교할 라운드');
  });

  it('여러 모델의 합격선 통과 메트릭 수를 비교 표로 노출', () => {
    const r1 = makeRound({
      provider: { id: 'M2 — EXAONE 3.5 32B', provider: 'ollama', model: 'exaone3.5:32b' },
    });
    const r2 = makeRound({
      provider: { id: 'M4 — Qwen2.5-Coder 32B', provider: 'ollama', model: 'qwen2.5-coder:32b' },
      aggregate: {
        totalCalls: 30,
        passRatePerMetric: {
          MT1: { passes: 30, total: 30, rate: 1.0 },
          MT2: { passes: 25, total: 30, rate: 0.833 }, // < 95%
          MT3: { passes: 30, total: 30, rate: 1.0 },
          MT4: { passes: 30, total: 30, rate: 1.0 },
          MT5: { passes: 30, total: 30, rate: 1.0 },
          MT8: { passes: 30, total: 30, rate: 1.0 },
        },
        meanLatencyMs: 8_000,
        p95LatencyMs: 15_000,
        errorCount: 0,
        stratified: [],
        bootstrapCi: {},
      },
    });
    const md = generateComparisonReport([r1, r2]);
    expect(md).toContain('M2 — EXAONE 3.5 32B');
    expect(md).toContain('M4 — Qwen2.5-Coder 32B');
    // 합격 메트릭 수 컬럼이 있어야 함
    expect(md).toMatch(/합격|메트릭/);
  });
});
