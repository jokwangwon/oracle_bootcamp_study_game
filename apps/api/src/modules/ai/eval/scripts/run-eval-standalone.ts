#!/usr/bin/env tsx
/**
 * standalone 평가 스크립트 — promptfoo CLI를 우회하고 직접 Ollama 호출.
 *
 * 사용법 (프로젝트 루트에서):
 *   npx tsx apps/api/src/modules/ai/eval/scripts/run-eval-standalone.ts \
 *     --model exaone4:32b --label "M1 — EXAONE 4.0 32B"
 *
 * .env 파일의 LANGFUSE_*, OLLAMA_BASE_URL을 자동 로드합니다.
 * 호스트 환경(Docker 외부)에서는 LANGFUSE_HOST와 OLLAMA_BASE_URL을
 * 127.0.0.1 주소로 오버라이드합니다.
 *
 * 옵션:
 *   --model <name>      Ollama 모델명 (필수)
 *   --label <label>     리포트에 표시할 라벨 (기본: model명)
 *   --first-n <N>       처음 N개 testCase만 실행 (smoke test용)
 *   --out-dir <path>    결과 저장 디렉토리 (기본: apps/api/eval-results)
 *
 * 설계:
 *   - 기존 assertion 7개, schema.v1, report-generator를 그대로 재사용
 *   - LlmClient (LangChain + Langfuse callback) 경유 — ADR-009 정합
 *   - promptfoo 의존 없이 터미널에서 직접 실행
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

// .env 로드 (프로젝트 루트 기준) — process.env에 없는 키만 채움
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// 호스트 환경 오버라이드: Docker 내부 hostname → localhost
if (!process.env.LANGFUSE_HOST || process.env.LANGFUSE_HOST.includes('langfuse:')) {
  process.env.LANGFUSE_HOST = `http://127.0.0.1:${process.env.LANGFUSE_PORT ?? '3010'}`;
}
if (!process.env.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL.includes('ollama:')) {
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${process.env.OLLAMA_PORT ?? '11434'}`;
}

import { ConfigService } from '@nestjs/config';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { LlmClient } from '../../llm-client';
import { renderEvalMessages } from '../prompts/build-eval-prompt';
import { buildPromptfooTestCases, type PromptfooTestCase } from '../datasets/promptfoo-testcases';
import type { AssertionContext, AssertionResult } from '../assertions/types';
import type { EvalAssertionResult, EvalMetric, EvalRoundMeta, EvalProvider } from '../reports/schema.v1';
import { EVAL_RESULT_SCHEMA_VERSION } from '../reports/schema.v1';
import type { RawCallRecord } from '../reports/promptfoo-adapter';
import { buildRoundFromRecords } from '../reports/promptfoo-adapter';
import { generateRoundReport } from '../reports/report-generator';
import { defaultTagsFetcher, loadPins, verifyApprovedModel } from '../pins/verify';

// Assertion imports
import jsonParseAssertion from '../assertions/json-parse';
import zodSchemaAssertion from '../assertions/zod-schema';
import scopeWhitelistAssertion from '../assertions/scope-whitelist';
import blankConsistencyAssertion from '../assertions/blank-consistency';
import latencyAssertion from '../assertions/latency';
import sanitizationAssertion from '../assertions/sanitization';
import koreanFeaturesAssertion from '../assertions/korean-features';

// ============================================================================
// CLI argument parsing
// ============================================================================

function parseArgs(): {
  model: string;
  label: string;
  firstN: number | null;
  outDir: string;
  skipPinCheck: boolean;
} {
  const args = process.argv.slice(2);
  let model = '';
  let label = '';
  let firstN: number | null = null;
  let outDir = '';
  let skipPinCheck = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model':
        model = args[++i] ?? '';
        break;
      case '--label':
        label = args[++i] ?? '';
        break;
      case '--first-n':
        firstN = parseInt(args[++i] ?? '0', 10);
        break;
      case '--out-dir':
        outDir = args[++i] ?? '';
        break;
      case '--skip-pin-check':
        skipPinCheck = true;
        break;
    }
  }

  if (!model) {
    console.error('ERROR: --model is required');
    console.error('Usage: npx tsx apps/api/src/modules/ai/eval/scripts/run-eval-standalone.ts --model exaone4:32b [--label "M1"] [--first-n 5] [--skip-pin-check]');
    process.exit(1);
  }

  return {
    model,
    label: label || model,
    firstN,
    outDir: outDir || path.join(projectRoot, 'eval-results'),
    skipPinCheck,
  };
}

// ============================================================================
// Assertion runner
// ============================================================================

interface AssertionEntry {
  metric: EvalMetric;
  fn: (output: string, ctx: AssertionContext) => Promise<AssertionResult>;
}

const ASSERTIONS: AssertionEntry[] = [
  { metric: 'MT1', fn: jsonParseAssertion },
  { metric: 'MT2', fn: zodSchemaAssertion },
  { metric: 'MT3', fn: scopeWhitelistAssertion },
  { metric: 'MT4', fn: blankConsistencyAssertion },
  { metric: 'MT5', fn: latencyAssertion },
  { metric: 'MT8', fn: sanitizationAssertion },
  { metric: 'MT6-aux', fn: koreanFeaturesAssertion },
];

async function runAssertions(
  output: string,
  tc: PromptfooTestCase,
  latencyMs: number,
): Promise<EvalAssertionResult[]> {
  const ctx: AssertionContext = {
    prompt: '',
    vars: {
      topic: tc.vars.topic as any,
      week: tc.vars.week,
      difficulty: tc.vars.difficulty as any,
      allowedKeywords: tc.vars.allowedKeywords,
      seedFocusKeyword: tc.vars.seedFocusKeyword,
      gameMode: tc.vars.gameMode as any,
    },
    latencyMs,
  };

  const results: EvalAssertionResult[] = [];
  for (const { metric, fn } of ASSERTIONS) {
    const r = await fn(output, ctx);
    results.push({ metric, pass: r.pass, score: r.score, reason: r.reason });
  }
  return results;
}

// ============================================================================
// Single test case execution
// ============================================================================

async function executeTestCase(
  client: LlmClient,
  tc: PromptfooTestCase,
  index: number,
  total: number,
): Promise<RawCallRecord> {
  const { system, user } = renderEvalMessages({
    topic: tc.vars.topic,
    week: tc.vars.week,
    difficulty: tc.vars.difficulty,
    allowedKeywords: tc.vars.allowedKeywords,
    seedFocusKeyword: tc.vars.seedFocusKeyword,
    gameMode: tc.vars.gameMode,
  });

  const messages = [new SystemMessage(system), new HumanMessage(user)];

  console.log(`  [${index + 1}/${total}] ${tc.vars.entryId} (${tc.vars.gameMode}, ${tc.vars.difficulty})...`);

  const startMs = Date.now();
  let rawOutput = '';
  let error: string | undefined;

  try {
    const response = await client.invoke(messages);
    rawOutput = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.log(`    ⚠ ERROR: ${error}`);
  }

  const latencyMs = Date.now() - startMs;
  const assertions = error ? [] : await runAssertions(rawOutput, tc, latencyMs);

  const passCount = assertions.filter((a) => a.pass).length;
  const totalAssertions = assertions.length;
  const latencyStr = (latencyMs / 1000).toFixed(1);

  if (!error) {
    console.log(`    ✓ ${passCount}/${totalAssertions} pass | ${latencyStr}s`);
  }

  return {
    testCase: {
      entryId: tc.vars.entryId,
      goldSet: tc.vars.goldSet,
      gameMode: tc.vars.gameMode,
      topic: tc.vars.topic,
      week: tc.vars.week,
      difficulty: tc.vars.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
    },
    runIndex: 0,
    rawOutput,
    latencyMs,
    assertions,
    ...(error !== undefined ? { error } : {}),
  };
}

// ============================================================================
// Pin gate (ADR-011 #2)
// ============================================================================

async function runPinGate(model: string, skip: boolean): Promise<void> {
  if (skip) {
    console.warn('⚠️  --skip-pin-check: digest drift verification bypassed. Use only for unpinned R&D runs.\n');
    return;
  }
  const pinsFile = path.resolve(__dirname, '..', 'pins', 'approved-models.json');
  const pins = loadPins(pinsFile);
  const result = await verifyApprovedModel(model, pins, defaultTagsFetcher());
  if (result.ok) {
    console.log(`✅ Pin verified: ${model} digest=${result.currentDigest.slice(0, 16)}... (round=${result.pin.evalRound ?? 'n/a'})\n`);
    return;
  }
  console.error(`❌ Pin verification failed: ${result.reason}`);
  console.error(`   ${result.message}`);
  if (result.reason === 'not-pinned') {
    console.error('   → Run: npx tsx apps/api/src/modules/ai/eval/scripts/pin-model.ts --model ' + model);
  }
  console.error('   Use --skip-pin-check to bypass (R&D only).\n');
  process.exit(4);
}

// ============================================================================
// Environment metadata
// ============================================================================

async function getEnvironment(modelName: string): Promise<{
  cudaVersion: string;
  nvidiaDriverVersion: string;
  ollamaVersion: string;
  ollamaImageDigest: string;
  promptVersion: string;
  seed: number;
  temperature: number;
}> {
  let cudaVersion = 'unknown';
  let nvidiaDriverVersion = 'unknown';
  try {
    const { execSync } = await import('node:child_process');
    const nvidiaSmi = execSync('nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    nvidiaDriverVersion = nvidiaSmi || 'unknown';

    const nvcc = execSync('nvcc --version 2>/dev/null | grep "release" | sed "s/.*release //" | sed "s/,.*//"', {
      encoding: 'utf-8',
    }).trim();
    cudaVersion = nvcc || 'unknown';
  } catch {
    // nvidia tools not available
  }

  let ollamaVersion = 'unknown';
  try {
    const resp = await fetch(`${process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'}/api/version`);
    const data = (await resp.json()) as { version?: string };
    ollamaVersion = data.version ?? 'unknown';
  } catch {
    // ollama not reachable
  }

  // ADR-011 조건 #2: ollamaImageDigest 필드에 "평가 대상 모델의 digest"를 기록한다.
  // 이전 구현은 Docker 컨테이너 이미지 digest(sudo 필요)였으나, 재현성 관점에서
  // 실제로 중요한 것은 서빙 모델의 digest이므로 `/api/tags`로 전환한다.
  let ollamaImageDigest = 'unknown';
  try {
    const tags = await defaultTagsFetcher()();
    const m = tags.models.find((x) => x.name === modelName);
    if (m) ollamaImageDigest = `${modelName}@${m.digest}`;
  } catch {
    ollamaImageDigest = 'unknown';
  }

  return {
    cudaVersion,
    nvidiaDriverVersion,
    ollamaVersion,
    ollamaImageDigest,
    promptVersion: 'build-eval-prompt.ts v1',
    seed: 42,
    temperature: 0.2,
  };
}

// ============================================================================
// Round ID
// ============================================================================

function makeRoundId(): string {
  return `R-${new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')}`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { model, label, firstN, outDir, skipPinCheck } = parseArgs();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  OSS Model Evaluation — standalone runner`);
  console.log(`  Model: ${model}`);
  console.log(`  Label: ${label}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // 0. Verify digest pin (ADR-011 채택 조건 #2, fail-closed)
  await runPinGate(model, skipPinCheck);

  // 1. Load test cases
  let testCases = buildPromptfooTestCases();
  if (firstN !== null && firstN > 0) {
    testCases = testCases.slice(0, firstN);
    console.log(`⚡ Smoke test mode: first ${firstN} of 60 test cases\n`);
  } else {
    console.log(`📋 Full evaluation: ${testCases.length} test cases\n`);
  }

  // 2. Create LlmClient
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const config = new ConfigService(process.env);
  const client = new LlmClient(config, {
    provider: 'ollama',
    model,
    baseUrl,
    temperature: 0.2,
  });

  // 3. Execute all test cases sequentially
  const startedAt = new Date().toISOString();
  const records: RawCallRecord[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const record = await executeTestCase(client, testCases[i]!, i, testCases.length);
    records.push(record);
  }

  const finishedAt = new Date().toISOString();

  // 4. Build round result
  const roundId = makeRoundId();
  const env = await getEnvironment(model);

  const meta: EvalRoundMeta = {
    schemaVersion: EVAL_RESULT_SCHEMA_VERSION,
    roundId,
    roundLabel: `${label} standalone eval`,
    startedAt,
    finishedAt,
    environment: env,
  };

  const provider: EvalProvider = {
    id: label,
    provider: 'ollama',
    model,
    baseUrl,
  };

  const round = buildRoundFromRecords(meta, provider, records);

  // 5. Save results
  const roundDir = path.join(outDir, roundId);
  fs.mkdirSync(roundDir, { recursive: true });

  const resultPath = path.join(roundDir, 'result.json');
  const reportPath = path.join(roundDir, 'report.md');

  fs.writeFileSync(resultPath, JSON.stringify(round, null, 2), 'utf-8');

  const report = generateRoundReport(round);
  fs.writeFileSync(reportPath, report, 'utf-8');

  // 6. Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  EVALUATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Round ID:   ${roundId}`);
  console.log(`  Model:      ${model}`);
  console.log(`  Test cases: ${testCases.length}`);
  console.log(`  Errors:     ${round.aggregate?.errorCount ?? 0}`);
  console.log('');

  if (round.aggregate) {
    console.log('  Pass rates:');
    for (const [metric, rate] of Object.entries(round.aggregate.passRatePerMetric)) {
      const pct = (rate.rate * 100).toFixed(1);
      const status = rate.rate >= 0.9 ? '✓' : '✗';
      console.log(`    ${status} ${metric}: ${pct}% (${rate.passes}/${rate.total})`);
    }
    console.log(`\n  Latency: mean=${(round.aggregate.meanLatencyMs / 1000).toFixed(1)}s, p95=${(round.aggregate.p95LatencyMs / 1000).toFixed(1)}s`);
  }

  console.log(`\n  Results:  ${resultPath}`);
  console.log(`  Report:   ${reportPath}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
