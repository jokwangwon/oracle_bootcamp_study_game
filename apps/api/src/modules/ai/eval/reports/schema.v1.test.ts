import { describe, expect, it } from 'vitest';

import {
  EVAL_RESULT_SCHEMA_VERSION,
  evalRoundResultV1Schema,
  type EvalRoundResultV1,
} from './schema.v1';

/**
 * 결과 JSON schema v1 단위 테스트.
 *
 * 본 schema는 감사용 고정 양식 (SDD v2 §5.2 + N-05). 라운드 결과를
 * promptfoo 버전이나 LLM 응답 형식 변경에 무관하게 동일한 모양으로
 * 보존하기 위한 단일 진실 소스다.
 *
 * 요구사항:
 *  - SCHEMA_VERSION 상수가 export되어 있고 immutable
 *  - 모든 필수 메타(M-04: GGUF SHA256, Ollama digest, CUDA, prompt version 등)
 *    가 누락되면 schema가 reject
 *  - 단일 call result에 7개 assertion(MT1~MT5/MT8 + MT6 보조)이 모두 들어갈 수 있음
 *  - aggregate stats가 null/undefined일 수 있음(라운드 진행 중일 때)
 */

const VALID_ROUND_META = {
  schemaVersion: 1 as const,
  roundId: 'R1-2026-04-09T20-00-00Z',
  roundLabel: 'R1 — Tier 1 Gold A',
  startedAt: '2026-04-09T20:00:00Z',
  finishedAt: '2026-04-09T21:00:00Z',
  environment: {
    cudaVersion: '13.0',
    nvidiaDriverVersion: '580.126.09',
    ollamaVersion: '0.20.4',
    ollamaImageDigest: 'sha256:abc123',
    promptVersion: 'local-fallback-v1',
    seed: 42,
    temperature: 0.2,
  },
};

const VALID_PROVIDER = {
  id: 'M2 — EXAONE 3.5 32B',
  provider: 'ollama' as const,
  model: 'exaone3.5:32b',
  baseUrl: 'http://ollama:11434',
  ggufSha256: '358d0ad399cfab7fca296674cc4b2d367030cbf261d3dc59cff969517253a94c',
};

const VALID_TESTCASE = {
  entryId: 'gold-a-blank-typing-01',
  goldSet: 'A' as const,
  gameMode: 'blank-typing' as const,
  topic: 'sql-basics',
  week: 1,
  difficulty: 'EASY' as const,
};

const VALID_ASSERTION = {
  metric: 'MT1' as const,
  pass: true,
  score: 1,
  reason: 'MT1 pass — JSON 파싱 성공',
};

const VALID_CALL = {
  testCase: VALID_TESTCASE,
  runIndex: 0,
  rawOutput: '{"sql":"SELECT * FROM EMP","blanks":[{"position":0,"answer":"SELECT"}],"answer":["SELECT"],"explanation":"..."}',
  latencyMs: 12_500,
  assertions: [VALID_ASSERTION],
};

const VALID_ROUND: EvalRoundResultV1 = {
  meta: VALID_ROUND_META,
  provider: VALID_PROVIDER,
  calls: [VALID_CALL],
  aggregate: null,
};

describe('EVAL_RESULT_SCHEMA_VERSION', () => {
  it('현재 schema는 v1', () => {
    expect(EVAL_RESULT_SCHEMA_VERSION).toBe(1);
  });

  it('SCHEMA_VERSION은 const assertion으로 immutable', () => {
    // TypeScript 차원의 immutability — 런타임에서는 readonly가 강제되지 않으나
    // 본 테스트는 의도적인 const 사용을 문서화한다
    expect(typeof EVAL_RESULT_SCHEMA_VERSION).toBe('number');
  });
});

describe('evalRoundResultV1Schema', () => {
  describe('valid input', () => {
    it('완전한 라운드 객체는 통과', () => {
      const result = evalRoundResultV1Schema.safeParse(VALID_ROUND);
      expect(result.success).toBe(true);
    });

    it('aggregate stats가 채워진 라운드도 통과', () => {
      const round = {
        ...VALID_ROUND,
        aggregate: {
          totalCalls: 30,
          passRatePerMetric: {
            MT1: { passes: 30, total: 30, rate: 1.0 },
            MT2: { passes: 28, total: 30, rate: 0.933 },
            MT3: { passes: 27, total: 30, rate: 0.9 },
            MT4: { passes: 29, total: 30, rate: 0.967 },
            MT5: { passes: 30, total: 30, rate: 1.0 },
            MT8: { passes: 30, total: 30, rate: 1.0 },
            'MT6-aux': { passes: 25, total: 30, rate: 0.833 },
          },
          meanLatencyMs: 12_500,
          p95LatencyMs: 25_000,
          errorCount: 0,
          stratified: [
            { difficulty: 'EASY', gameMode: 'blank-typing', total: 5, metricRates: { MT1: 1.0 } },
          ],
          bootstrapCi: {
            MT1: { mean: 1.0, lower: 0.95, upper: 1.0 },
          },
        },
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(true);
    });

    it('여러 call이 있는 라운드도 통과', () => {
      const round = {
        ...VALID_ROUND,
        calls: [
          VALID_CALL,
          { ...VALID_CALL, runIndex: 1 },
          {
            ...VALID_CALL,
            runIndex: 2,
            rawOutput: 'invalid',
            assertions: [{ metric: 'MT1', pass: false, score: 0, reason: 'fail' }],
            error: 'parse failed',
          },
        ],
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid input', () => {
    it('schemaVersion이 1이 아니면 fail', () => {
      const round = { ...VALID_ROUND, meta: { ...VALID_ROUND_META, schemaVersion: 2 } };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });

    it('environment 필수 필드(cudaVersion) 누락 시 fail', () => {
      const round = {
        ...VALID_ROUND,
        meta: {
          ...VALID_ROUND_META,
          environment: { ...VALID_ROUND_META.environment, cudaVersion: undefined },
        },
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });

    it('provider.provider가 ollama|anthropic 외면 fail', () => {
      const round = {
        ...VALID_ROUND,
        provider: { ...VALID_PROVIDER, provider: 'openai' },
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });

    it('assertion.metric이 정의된 7개 외면 fail', () => {
      const round = {
        ...VALID_ROUND,
        calls: [
          {
            ...VALID_CALL,
            assertions: [{ metric: 'MT99', pass: true, score: 1, reason: '' }],
          },
        ],
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });

    it('runIndex가 음수면 fail', () => {
      const round = {
        ...VALID_ROUND,
        calls: [{ ...VALID_CALL, runIndex: -1 }],
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });

    it('latencyMs가 음수면 fail', () => {
      const round = {
        ...VALID_ROUND,
        calls: [{ ...VALID_CALL, latencyMs: -1 }],
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });

    it('passRate가 0..1 범위 밖이면 fail', () => {
      const round = {
        ...VALID_ROUND,
        aggregate: {
          totalCalls: 30,
          passRatePerMetric: {
            MT1: { passes: 35, total: 30, rate: 1.16 },
          },
          meanLatencyMs: 100,
          p95LatencyMs: 200,
          errorCount: 0,
          stratified: [],
          bootstrapCi: {},
        },
      };
      const result = evalRoundResultV1Schema.safeParse(round);
      expect(result.success).toBe(false);
    });
  });
});
