import {
  bootstrapPassRateCi,
  mean,
  percentile,
} from './aggregate';
import {
  evalRoundResultV1Schema,
  type EvalAggregate,
  type EvalAssertionResult,
  type EvalCallResult,
  type EvalMetric,
  type EvalProvider,
  type EvalRoundMeta,
  type EvalRoundResultV1,
  type EvalTestCase,
} from './schema.v1';

/**
 * promptfoo 어댑터 (SDD v2 §5.2 + N-05).
 *
 * 두 가지 역할:
 *  1. promptfoo-agnostic 한 RawCallRecord[]를 받아 EvalRoundResultV1로 조립
 *     (`aggregateCallRecords` + `buildRoundFromRecords`) — 본 모듈의 핵심
 *  2. promptfoo CLI의 JSON 출력을 RawCallRecord[]로 변환
 *     (`parsePromptfooRawJson`) — 단계 8 R0에서 실제 출력으로 재검증 필요
 *
 * 설계 의도:
 *  - promptfoo 패키지에 직접 의존하지 않음 (input은 unknown으로 받아 자체 가드)
 *  - promptfoo 버전 변경 위험을 본 어댑터 한 곳에 격리
 *  - 핵심 로직(aggregation/build)은 promptfoo와 무관 → 다른 평가 도구로
 *    교체해도 본 모듈 일부만 갱신하면 된다
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §5.2 + §10.3)
 */

// ============================================================================
// Internal neutral shape — promptfoo-agnostic
// ============================================================================

export interface RawCallRecord {
  testCase: EvalTestCase;
  runIndex: number;
  rawOutput: string;
  latencyMs: number;
  assertions: EvalAssertionResult[];
  error?: string;
}

// ============================================================================
// Aggregation
// ============================================================================

const ALL_METRICS: readonly EvalMetric[] = ['MT1', 'MT2', 'MT3', 'MT4', 'MT5', 'MT8', 'MT6-aux'];

/**
 * RawCallRecord[]를 받아 EvalAggregate를 계산.
 *
 * - 각 메트릭의 단순 pass rate
 * - mean / p95 latency (모든 records 기준, error 포함)
 * - error count
 * - 난이도 × 모드 stratified breakdown
 * - 메트릭별 bootstrap 95% CI (seed=42 결정론)
 *
 * error가 있는 record는 메트릭 집계에서 제외 (assertions가 비어있을 것이므로
 * 자연스럽게 빠지지만, total counter에서도 빼서 rate 분모 왜곡을 막는다).
 */
export function aggregateCallRecords(records: readonly RawCallRecord[]): EvalAggregate {
  const totalCalls = records.length;

  const errorCount = records.filter((r) => r.error !== undefined).length;
  const successRecords = records.filter((r) => r.error === undefined);

  // 메트릭별 pass / total 카운트 (error record는 제외)
  const counts: Record<string, { passes: number; total: number }> = {};
  for (const record of successRecords) {
    for (const a of record.assertions) {
      const c = counts[a.metric] ?? { passes: 0, total: 0 };
      c.total += 1;
      if (a.pass) c.passes += 1;
      counts[a.metric] = c;
    }
  }

  const passRatePerMetric: EvalAggregate['passRatePerMetric'] = {};
  for (const [metric, c] of Object.entries(counts)) {
    passRatePerMetric[metric] = {
      passes: c.passes,
      total: c.total,
      rate: c.total === 0 ? 0 : c.passes / c.total,
    };
  }

  // latency
  const latencies = records.map((r) => r.latencyMs);
  const meanLatencyMs = mean(latencies);
  const p95LatencyMs = percentile(latencies, 95);

  // stratified buckets
  const stratified = computeStratified(successRecords);

  // bootstrap CI per metric
  const bootstrapCi: EvalAggregate['bootstrapCi'] = {};
  for (const [metric, c] of Object.entries(counts)) {
    bootstrapCi[metric] = bootstrapPassRateCi(c.passes, c.total, { samples: 1000, seed: 42 });
  }

  return {
    totalCalls,
    passRatePerMetric,
    meanLatencyMs,
    p95LatencyMs,
    errorCount,
    stratified,
    bootstrapCi,
  };
}

interface BucketKey {
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  gameMode: 'blank-typing' | 'term-match' | 'multiple-choice';
}

function computeStratified(records: readonly RawCallRecord[]): EvalAggregate['stratified'] {
  // bucket 키 → records로 그룹화
  const groups = new Map<string, { key: BucketKey; records: RawCallRecord[] }>();
  for (const r of records) {
    const key: BucketKey = {
      difficulty: r.testCase.difficulty,
      gameMode: r.testCase.gameMode,
    };
    const id = `${key.difficulty}|${key.gameMode}`;
    const g = groups.get(id);
    if (g) {
      g.records.push(r);
    } else {
      groups.set(id, { key, records: [r] });
    }
  }

  const buckets: EvalAggregate['stratified'] = [];
  for (const { key, records: bucketRecords } of groups.values()) {
    const counts: Record<string, { passes: number; total: number }> = {};
    for (const r of bucketRecords) {
      for (const a of r.assertions) {
        const c = counts[a.metric] ?? { passes: 0, total: 0 };
        c.total += 1;
        if (a.pass) c.passes += 1;
        counts[a.metric] = c;
      }
    }
    const metricRates: Record<string, number> = {};
    for (const [m, c] of Object.entries(counts)) {
      metricRates[m] = c.total === 0 ? 0 : c.passes / c.total;
    }
    buckets.push({
      difficulty: key.difficulty,
      gameMode: key.gameMode,
      total: bucketRecords.length,
      metricRates,
    });
  }
  return buckets;
}

// ============================================================================
// Round assembly
// ============================================================================

/**
 * RawCallRecord[] + meta + provider → EvalRoundResultV1.
 *
 * 본 함수는 schema 검증을 통과하는 객체만 반환한다 (잘못된 입력은 throw).
 * 호출자는 throw를 잡아 사용자에게 노출하거나 로그한다.
 */
export function buildRoundFromRecords(
  meta: EvalRoundMeta,
  provider: EvalProvider,
  records: readonly RawCallRecord[],
): EvalRoundResultV1 {
  const calls: EvalCallResult[] = records.map((r) => ({
    testCase: r.testCase,
    runIndex: r.runIndex,
    rawOutput: r.rawOutput,
    latencyMs: r.latencyMs,
    assertions: r.assertions,
    error: r.error,
  }));

  const round: EvalRoundResultV1 = {
    meta,
    provider,
    calls,
    aggregate: aggregateCallRecords(records),
  };

  // schema 검증 — 어댑터의 출력이 항상 v1 호환임을 보장
  const result = evalRoundResultV1Schema.safeParse(round);
  if (!result.success) {
    throw new Error(
      `buildRoundFromRecords: schema 검증 실패 — ${JSON.stringify(result.error.issues)}`,
    );
  }
  return result.data;
}

// ============================================================================
// promptfoo CLI raw JSON 파싱
// ============================================================================

/**
 * promptfoo CLI 출력 file path → 우리 metric 식별자 매핑.
 *
 * 본 매핑은 promptfoo의 file:// reference가 우리 assertion 파일을 가리키므로
 * 유효. 단계 8 R0 첫 실행 시 실제 출력의 assertion.value 형식을 확인하고
 * 필요 시 patch한다 (확장자/경로 포맷 차이).
 */
const ASSERTION_FILE_TO_METRIC: Record<string, EvalMetric> = {
  'json-parse': 'MT1',
  'zod-schema': 'MT2',
  'scope-whitelist': 'MT3',
  'blank-consistency': 'MT4',
  'latency': 'MT5',
  'sanitization': 'MT8',
  'korean-features': 'MT6-aux',
};

function metricFromAssertionPath(value: unknown): EvalMetric | null {
  if (typeof value !== 'string') return null;
  // file://./assertions/json-parse.ts → 'json-parse'
  const match = value.match(/assertions\/([\w-]+)(?:\.ts|\.js)?$/);
  if (!match) return null;
  return ASSERTION_FILE_TO_METRIC[match[1]!] ?? null;
}

/**
 * promptfoo eval JSON output → RawCallRecord[].
 *
 * 단계 8 R0 첫 실행 시 promptfoo의 실제 JSON shape를 확인 후 본 함수 patch.
 * 현재 구현은 promptfoo 0.x 표준 shape를 가정.
 *
 * 잘못된 입력은 빈 배열 반환 (어댑터가 침묵 fail하지 않도록 호출자가 record 수
 * 0을 보고 에러로 판단).
 */
export function parsePromptfooRawJson(raw: unknown): RawCallRecord[] {
  if (raw === null || typeof raw !== 'object') return [];
  const root = raw as Record<string, unknown>;
  const results = root.results;
  if (results === null || typeof results !== 'object') return [];
  const innerResults = (results as Record<string, unknown>).results;
  if (!Array.isArray(innerResults)) return [];

  const records: RawCallRecord[] = [];
  // run index counter per (entryId) — promptfoo는 동일 testCase 반복 시 별도 entry로 생성
  const runIndexByEntry = new Map<string, number>();

  for (const item of innerResults) {
    if (item === null || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;

    const vars = it.vars as Record<string, unknown> | undefined;
    if (!vars) continue;

    const entryId = vars.entryId;
    const goldSet = vars.goldSet;
    const gameMode = vars.gameMode;
    const topic = vars.topic;
    const week = vars.week;
    const difficulty = vars.difficulty;
    if (
      typeof entryId !== 'string' ||
      (goldSet !== 'A' && goldSet !== 'B') ||
      (gameMode !== 'blank-typing' && gameMode !== 'term-match') ||
      typeof topic !== 'string' ||
      typeof week !== 'number' ||
      (difficulty !== 'EASY' && difficulty !== 'MEDIUM' && difficulty !== 'HARD')
    ) {
      continue;
    }

    const response = it.response as Record<string, unknown> | undefined;
    const rawOutput = typeof response?.output === 'string' ? response.output : '';
    const latencyMs = typeof response?.latencyMs === 'number' ? response.latencyMs : 0;
    const error = typeof response?.error === 'string' ? response.error : undefined;

    // assertions: gradingResult.componentResults
    const grading = it.gradingResult as Record<string, unknown> | undefined;
    const components = Array.isArray(grading?.componentResults) ? grading.componentResults : [];
    const assertions: EvalAssertionResult[] = [];
    for (const comp of components) {
      if (comp === null || typeof comp !== 'object') continue;
      const c = comp as Record<string, unknown>;
      const assertion = c.assertion as Record<string, unknown> | undefined;
      const metric = metricFromAssertionPath(assertion?.value);
      if (metric === null) continue;   // unknown assertion file → drop (방어적)
      assertions.push({
        metric,
        pass: c.pass === true,
        score: typeof c.score === 'number' ? c.score : c.pass === true ? 1 : 0,
        reason: typeof c.reason === 'string' ? c.reason : '',
      });
    }

    const runIdx = runIndexByEntry.get(entryId) ?? 0;
    runIndexByEntry.set(entryId, runIdx + 1);

    records.push({
      testCase: { entryId, goldSet, gameMode, topic, week, difficulty },
      runIndex: runIdx,
      rawOutput,
      latencyMs,
      assertions,
      ...(error !== undefined ? { error } : {}),
    });
  }

  return records;
}
