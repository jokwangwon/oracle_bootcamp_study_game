import type {
  EvalAggregate,
  EvalCallResult,
  EvalRoundResultV1,
  EvalProvider,
  EvalRoundMeta,
} from './schema.v1';

/**
 * 평가 결과 markdown 보고서 생성기 (SDD v2 §5.2 + §1.3 합격선).
 *
 * 본 모듈은 validated `EvalRoundResultV1`을 받아 ADR-010 합의 단계에 직접
 * 인용 가능한 markdown을 생성한다. 입력은 schema.v1.ts로 사전 검증된 객체.
 *
 * 출력 섹션 (단일 라운드):
 *   1. 헤더 (round id/label/시각)
 *   2. 환경 메타 (M-04: CUDA, driver, Ollama, prompt version, seed, temperature)
 *   3. Provider 식별 (id, model, baseUrl, ggufSha256)
 *   4. 합격선 평가표 (C1~C8 절대치 기준)
 *   5. Aggregate stats (메트릭별 pass rate + 95% bootstrap CI)
 *   6. Stratified breakdown (난이도 × 모드 bucket)
 *   7. Top failures (디버깅용 — 메트릭별 실패 reason 상위 N)
 *
 * 비교 보고서는 여러 라운드의 합격선 통과 수를 한 표로 비교 (선정 후보 식별).
 */

// SDD §1.3 절대치 합격선 (Phase 0 baseline 측정 후 patch 가능)
interface PassCriterion {
  id: string;
  label: string;
  metric: string;
  threshold: number;
  /** 'rate' (0..1) | 'latency-ms' (≤) */
  kind: 'rate' | 'latency-ms';
}

const PASS_CRITERIA: readonly PassCriterion[] = [
  { id: 'C1', label: 'JSON 파싱', metric: 'MT1', threshold: 0.95, kind: 'rate' },
  { id: 'C2', label: 'Zod 스키마', metric: 'MT2', threshold: 0.95, kind: 'rate' },
  { id: 'C3', label: '화이트리스트', metric: 'MT3', threshold: 0.9, kind: 'rate' },
  { id: 'C4', label: '빈칸 일관성', metric: 'MT4', threshold: 0.95, kind: 'rate' },
  { id: 'C7', label: '종단 지연 (60s)', metric: 'MT5', threshold: 60_000, kind: 'latency-ms' },
  { id: 'C8', label: '출력 sanitization', metric: 'MT8', threshold: 0.99, kind: 'rate' },
];

// ============================================================================
// 단일 라운드 보고서
// ============================================================================

export function generateRoundReport(round: EvalRoundResultV1): string {
  const lines: string[] = [];

  lines.push(...renderHeader(round.meta));
  lines.push(...renderEnvironment(round.meta));
  lines.push(...renderProvider(round.provider));

  if (round.aggregate === null) {
    lines.push('## 라운드 진행 중');
    lines.push('');
    lines.push(`현재까지 ${round.calls.length}개 call 수집됨. aggregate은 라운드 종료 시 채워집니다.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(...renderPassCriteria(round.aggregate));
  lines.push(...renderAggregateTable(round.aggregate));
  lines.push(...renderStratifiedTable(round.aggregate));
  lines.push(...renderTopFailures(round.calls));

  return lines.join('\n');
}

function renderHeader(meta: EvalRoundMeta): string[] {
  return [
    `# 평가 라운드 보고서`,
    '',
    `- **라운드 id**: \`${meta.roundId}\``,
    `- **라벨**: ${meta.roundLabel}`,
    `- **시작**: ${meta.startedAt}`,
    `- **종료**: ${meta.finishedAt}`,
    `- **schema**: v${meta.schemaVersion}`,
    '',
  ];
}

function renderEnvironment(meta: EvalRoundMeta): string[] {
  const env = meta.environment;
  return [
    '## 환경 메타 (M-04)',
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| CUDA | ${env.cudaVersion} |`,
    `| NVIDIA Driver | ${env.nvidiaDriverVersion} |`,
    `| Ollama 버전 | ${env.ollamaVersion} |`,
    `| Ollama 이미지 digest | \`${env.ollamaImageDigest}\` |`,
    `| Prompt version | ${env.promptVersion} |`,
    `| Seed | ${env.seed} |`,
    `| Temperature | ${env.temperature} |`,
    '',
  ];
}

function renderProvider(provider: EvalProvider): string[] {
  const lines = [
    '## Provider',
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| id | ${provider.id} |`,
    `| 종류 | ${provider.provider} |`,
    `| 모델 | \`${provider.model}\` |`,
  ];
  if (provider.baseUrl !== undefined) {
    lines.push(`| baseUrl | ${provider.baseUrl} |`);
  }
  if (provider.ggufSha256 !== undefined) {
    // 짧게 표시 (8자) + 풀 hash는 코드 블록
    lines.push(`| GGUF SHA256 | \`${provider.ggufSha256.slice(0, 8)}...\` |`);
  }
  lines.push('');
  return lines;
}

function renderPassCriteria(agg: EvalAggregate): string[] {
  const lines = [
    '## 합격선 평가 (SDD §1.3 절대치 게이트)',
    '',
    '| 항목 | 메트릭 | 임계 | 측정값 | 결과 |',
    '|---|---|---|---|---|',
  ];

  for (const c of PASS_CRITERIA) {
    if (c.kind === 'rate') {
      const r = agg.passRatePerMetric[c.metric];
      if (r === undefined) {
        lines.push(`| ${c.id} | ${c.label} | ≥ ${(c.threshold * 100).toFixed(0)}% | (미측정) | — |`);
        continue;
      }
      const pct = (r.rate * 100).toFixed(1);
      const pass = r.rate >= c.threshold;
      lines.push(
        `| ${c.id} | ${c.label} | ≥ ${(c.threshold * 100).toFixed(0)}% | ${pct}% (${r.passes}/${r.total}) | ${pass ? '✅ PASS' : '❌ FAIL'} |`,
      );
    } else {
      // latency: p95 사용 (SDD §1.3 C7는 단일 라운드 종단 지연 — 본 보고서는 p95로 표현)
      const pass = agg.p95LatencyMs <= c.threshold;
      lines.push(
        `| ${c.id} | ${c.label} | ≤ 60s | p95 ${(agg.p95LatencyMs / 1000).toFixed(1)}s (mean ${(agg.meanLatencyMs / 1000).toFixed(1)}s) | ${pass ? '✅ PASS' : '❌ FAIL'} |`,
      );
    }
  }

  lines.push('');
  return lines;
}

function renderAggregateTable(agg: EvalAggregate): string[] {
  const lines = [
    '## Aggregate stats',
    '',
    `- 총 call: ${agg.totalCalls}`,
    `- 평균 latency: ${agg.meanLatencyMs}ms`,
    `- p95 latency: ${agg.p95LatencyMs}ms`,
    `- 에러 count: ${agg.errorCount}`,
    '',
    '### 메트릭별 pass rate',
    '',
    '| 메트릭 | passes / total | rate | 95% CI (bootstrap) |',
    '|---|---|---|---|',
  ];

  const metricKeys = Object.keys(agg.passRatePerMetric).sort();
  for (const metric of metricKeys) {
    const r = agg.passRatePerMetric[metric]!;
    const ci = agg.bootstrapCi[metric];
    const ciStr = ci
      ? `[${(ci.lower * 100).toFixed(1)}%, ${(ci.upper * 100).toFixed(1)}%]`
      : '(미산출)';
    lines.push(
      `| ${metric} | ${r.passes} / ${r.total} | ${(r.rate * 100).toFixed(1)}% | ${ciStr} |`,
    );
  }

  lines.push('');
  return lines;
}

function renderStratifiedTable(agg: EvalAggregate): string[] {
  if (agg.stratified.length === 0) {
    return [];
  }

  const lines = [
    '## Stratified breakdown (난이도 × 모드)',
    '',
    '| 난이도 | 모드 | 표본 | 메트릭별 rate |',
    '|---|---|---|---|',
  ];

  for (const bucket of agg.stratified) {
    const rates = Object.entries(bucket.metricRates)
      .map(([m, v]) => `${m}=${(v * 100).toFixed(0)}%`)
      .join(', ');
    lines.push(`| ${bucket.difficulty} | ${bucket.gameMode} | ${bucket.total} | ${rates} |`);
  }
  lines.push('');
  return lines;
}

function renderTopFailures(calls: readonly EvalCallResult[]): string[] {
  const failures: Array<{ entryId: string; metric: string; reason: string }> = [];
  const errorCalls: Array<{ entryId: string; error: string }> = [];

  for (const call of calls) {
    if (call.error !== undefined) {
      errorCalls.push({ entryId: call.testCase.entryId, error: call.error });
    }
    for (const a of call.assertions) {
      if (!a.pass) {
        failures.push({ entryId: call.testCase.entryId, metric: a.metric, reason: a.reason });
      }
    }
  }

  if (failures.length === 0 && errorCalls.length === 0) {
    return [];
  }

  const lines = ['## Top failures (디버깅)', ''];

  if (errorCalls.length > 0) {
    lines.push('### Provider 에러');
    lines.push('');
    lines.push('| entryId | error |');
    lines.push('|---|---|');
    for (const e of errorCalls.slice(0, 10)) {
      lines.push(`| ${e.entryId} | ${escapeMd(e.error)} |`);
    }
    lines.push('');
  }

  if (failures.length > 0) {
    lines.push('### Assertion 실패');
    lines.push('');
    lines.push('| entryId | metric | reason |');
    lines.push('|---|---|---|');
    for (const f of failures.slice(0, 20)) {
      lines.push(`| ${f.entryId} | ${f.metric} | ${escapeMd(f.reason)} |`);
    }
    lines.push('');
  }

  return lines;
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ============================================================================
// 다중 라운드 비교 보고서
// ============================================================================

export function generateComparisonReport(rounds: readonly EvalRoundResultV1[]): string {
  if (rounds.length === 0) {
    return '## 비교 결과\n\n비교할 라운드가 없습니다.\n';
  }

  const lines: string[] = ['# 평가 라운드 비교 보고서', ''];

  lines.push('## 합격선 통과 요약', '');
  lines.push('| Provider | 모델 | 합격 메트릭 / 전체 | 평균 latency | p95 latency | error |');
  lines.push('|---|---|---|---|---|---|');

  for (const round of rounds) {
    const passedCount = countPassedCriteria(round);
    const totalCount = PASS_CRITERIA.length;
    if (round.aggregate === null) {
      lines.push(
        `| ${round.provider.id} | \`${round.provider.model}\` | (진행 중) | — | — | — |`,
      );
      continue;
    }
    lines.push(
      `| ${round.provider.id} | \`${round.provider.model}\` | ${passedCount} / ${totalCount} | ${round.aggregate.meanLatencyMs}ms | ${round.aggregate.p95LatencyMs}ms | ${round.aggregate.errorCount} |`,
    );
  }
  lines.push('');

  lines.push('## 라운드별 상세', '');
  for (const round of rounds) {
    lines.push(`### ${round.provider.id}`, '');
    lines.push(generateRoundReport(round));
    lines.push('');
  }

  return lines.join('\n');
}

function countPassedCriteria(round: EvalRoundResultV1): number {
  if (round.aggregate === null) return 0;
  let passed = 0;
  for (const c of PASS_CRITERIA) {
    if (c.kind === 'rate') {
      const r = round.aggregate.passRatePerMetric[c.metric];
      if (r !== undefined && r.rate >= c.threshold) passed += 1;
    } else if (round.aggregate.p95LatencyMs <= c.threshold) {
      passed += 1;
    }
  }
  return passed;
}
