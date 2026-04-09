import { z } from 'zod';

/**
 * 결과 JSON schema v1 — 감사용 고정 양식 (SDD v2 §5.2 + N-05).
 *
 * 본 schema는 평가 라운드 결과를 promptfoo 버전이나 LLM 응답 형식 변경에
 * 무관하게 동일한 모양으로 보존하는 단일 진실 소스다. ADR-010 합의/감사
 * 단계에서 직접 인용 가능하도록 모든 메타 필드를 명시.
 *
 * 버전 정책:
 *  - v1 → v2 변경 시 본 파일을 복제하여 schema.v2.ts를 만들고
 *    EVAL_RESULT_SCHEMA_VERSION을 그쪽에서 2로 다시 정의한다.
 *  - 어댑터(promptfoo-adapter.ts)와 generator(report-generator.ts)는
 *    schemaVersion 필드를 보고 적절한 schema를 dispatch한다.
 *  - 한번 commit된 v1은 절대 수정하지 않음 — 과거 라운드 결과의 호환성 보장.
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §5.2 + §10)
 */

export const EVAL_RESULT_SCHEMA_VERSION = 1 as const;

// ============================================================================
// 라운드 메타 (M-04: 재현성 보장용)
// ============================================================================

export const evalEnvironmentSchema = z.object({
  /** GB10 CUDA 버전 (예: '13.0') */
  cudaVersion: z.string().min(1),
  /** NVIDIA 드라이버 버전 (예: '580.126.09') */
  nvidiaDriverVersion: z.string().min(1),
  /** Ollama 컨테이너 버전 (예: '0.20.4') */
  ollamaVersion: z.string().min(1),
  /** Ollama 이미지 digest (M-05 — pin) */
  ollamaImageDigest: z.string().min(1),
  /** prompt 버전 — Langfuse versioned prompt 또는 'local-fallback-v1' */
  promptVersion: z.string().min(1),
  /** Ollama seed (결정론, SDD §10.2) */
  seed: z.number().int(),
  /** 추론 temperature (결정론, SDD §10.2) */
  temperature: z.number().min(0).max(2),
});

export const evalRoundMetaSchema = z.object({
  /** schema 버전 — v1 고정. 어댑터가 dispatch할 때 확인 */
  schemaVersion: z.literal(EVAL_RESULT_SCHEMA_VERSION),
  /** 라운드 id — 'R{n}-{timestamp}' 형식 (예: 'R1-2026-04-09T20-00-00Z') */
  roundId: z.string().min(1),
  /** 사람이 읽을 수 있는 라운드 라벨 (예: 'R1 — Tier 1 Gold A') */
  roundLabel: z.string().min(1),
  /** ISO 8601 시작 시각 */
  startedAt: z.string().datetime(),
  /** ISO 8601 종료 시각 (라운드 진행 중이면 어댑터가 마지막 call의 시각) */
  finishedAt: z.string().datetime(),
  environment: evalEnvironmentSchema,
});

// ============================================================================
// Provider 메타 (모델 식별)
// ============================================================================

export const evalProviderSchema = z.object({
  /** promptfoo provider id (예: 'M2 — EXAONE 3.5 32B') */
  id: z.string().min(1),
  /** LLM provider 종류 — anthropic 또는 ollama */
  provider: z.enum(['anthropic', 'ollama']),
  /** 모델 식별자 (예: 'exaone3.5:32b', 'claude-opus-4-6') */
  model: z.string().min(1),
  /** ollama baseUrl (있을 때) */
  baseUrl: z.string().url().optional(),
  /** GGUF SHA256 (M1 EXAONE 4.0처럼 GGUF import한 경우, M-04) */
  ggufSha256: z.string().optional(),
});

// ============================================================================
// TestCase 메타 (Gold Set entry)
// ============================================================================

export const evalTestCaseSchema = z.object({
  /** Gold Set entry id (예: 'gold-a-blank-typing-01') */
  entryId: z.string().min(1),
  /** 'A' (Recall) 또는 'B' (Generalization) */
  goldSet: z.enum(['A', 'B']),
  gameMode: z.enum(['blank-typing', 'term-match']),
  topic: z.string().min(1),
  week: z.number().int().positive(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
});

// ============================================================================
// 단일 호출의 assertion 결과
// ============================================================================

/** SDD §3.1 + §3.2의 7개 메트릭 (계산적 6 + 한국어 보조 1) */
export const evalMetricSchema = z.enum([
  'MT1', // JSON 파싱 성공률
  'MT2', // Zod 스키마 통과율
  'MT3', // 화이트리스트 통과율
  'MT4', // 빈칸-정답 일관성
  'MT5', // 종단 지연
  'MT8', // 출력 sanitization
  'MT6-aux', // MT6 한국어 자연스러움 계산적 보조
]);

export type EvalMetric = z.infer<typeof evalMetricSchema>;

export const evalAssertionResultSchema = z.object({
  metric: evalMetricSchema,
  pass: z.boolean(),
  score: z.number().min(0).max(1),
  reason: z.string(),
});

// ============================================================================
// 단일 LLM 호출 결과 (한 testCase × 한 run)
// ============================================================================

export const evalCallResultSchema = z.object({
  testCase: evalTestCaseSchema,
  /** 같은 testCase의 몇 번째 run (5 run이면 0~4) */
  runIndex: z.number().int().nonnegative(),
  /** LLM raw 출력 (감사용 — 100% 보존) */
  rawOutput: z.string(),
  /** wall-clock 지연 (ms) */
  latencyMs: z.number().nonnegative(),
  /** 7개 assertion 중 적용된 것의 결과 */
  assertions: z.array(evalAssertionResultSchema),
  /** 호출 자체가 실패한 경우 (provider error 등) */
  error: z.string().optional(),
});

// ============================================================================
// Aggregate 통계 (라운드 종료 시 계산)
// ============================================================================

const passRateSchema = z.object({
  passes: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1),
});

const stratifiedBucketSchema = z.object({
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  gameMode: z.enum(['blank-typing', 'term-match']),
  total: z.number().int().nonnegative(),
  /** 각 메트릭의 bucket 내 pass rate */
  metricRates: z.record(z.string(), z.number().min(0).max(1)),
});

const bootstrapCiSchema = z.object({
  mean: z.number().min(0).max(1),
  lower: z.number().min(0).max(1),
  upper: z.number().min(0).max(1),
});

export const evalAggregateSchema = z.object({
  totalCalls: z.number().int().nonnegative(),
  /** 메트릭별 단순 pass rate (전체 평균) */
  passRatePerMetric: z.record(z.string(), passRateSchema),
  meanLatencyMs: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  /** 난이도 × 모드 bucket별 stratified breakdown (SDD §3.3 macro stratified) */
  stratified: z.array(stratifiedBucketSchema),
  /** 메트릭별 bootstrap 95% CI (SDD §10.3) */
  bootstrapCi: z.record(z.string(), bootstrapCiSchema),
});

// ============================================================================
// 최상위: 라운드 결과
// ============================================================================

export const evalRoundResultV1Schema = z.object({
  meta: evalRoundMetaSchema,
  provider: evalProviderSchema,
  calls: z.array(evalCallResultSchema),
  /** 라운드 진행 중이면 null, 종료 시 채워짐 */
  aggregate: evalAggregateSchema.nullable(),
});

export type EvalEnvironment = z.infer<typeof evalEnvironmentSchema>;
export type EvalRoundMeta = z.infer<typeof evalRoundMetaSchema>;
export type EvalProvider = z.infer<typeof evalProviderSchema>;
export type EvalTestCase = z.infer<typeof evalTestCaseSchema>;
export type EvalAssertionResult = z.infer<typeof evalAssertionResultSchema>;
export type EvalCallResult = z.infer<typeof evalCallResultSchema>;
export type EvalAggregate = z.infer<typeof evalAggregateSchema>;
export type EvalRoundResultV1 = z.infer<typeof evalRoundResultV1Schema>;
