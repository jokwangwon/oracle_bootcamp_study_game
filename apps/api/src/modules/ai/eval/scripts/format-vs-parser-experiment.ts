/**
 * format: 'json' vs StructuredOutputParser 실증 비교 스크립트.
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md v2 §7.2 + §14 미해결 #9 (C-02)
 *
 * 목적:
 *   ChatOllama 사용 시 (a) Ollama native `format: 'json'` 모드와
 *   (b) LangChain StructuredOutputParser 중 어느 쪽이 평가 라운드에서 더 안정적인지
 *   작은 샘플로 실증 비교한다. 결과는 SDD §7.2에 v2.3 patch로 반영하고
 *   §14 미해결 #9를 해소한다.
 *
 * 방법:
 *   - 모델: M4 Qwen2.5-Coder:32b (sanity 17s, 가장 빠름)
 *   - 동일 prompt × 10 샘플 × 2 옵션 = 20 호출
 *   - 메트릭: (1) JSON 파싱 성공률 (2) 평균 latency (3) 본문 길이
 *
 * 실행:
 *   docker compose up -d ollama
 *   cd apps/api
 *   npx tsx src/modules/ai/eval/scripts/format-vs-parser-experiment.ts
 *
 * 출력:
 *   - 콘솔 표 + apps/api/eval-results/format-vs-parser-{ts}.json
 *
 * 본 스크립트는 단계 3 실증 1회 실행 + SDD patch 후에는 다시 실행하지 않아도 된다
 * (재현용으로 남겨둠).
 */

import { ChatOllama } from '@langchain/ollama';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.EVAL_MODEL ?? 'qwen2.5-coder:32b';
const SAMPLES = Number.parseInt(process.env.EVAL_SAMPLES ?? '10', 10);

// 단순한 quiz schema — blank-typing 미니 버전
const quizSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answer: z.string().min(1),
});

// AiQuestionGenerator와 동일 — fromZodSchema의 generic이 깊어 ZodObject를 그대로 넘기면
// TS2589 발생. 평가 스크립트는 getFormatInstructions/parse 두 메서드만 사용하므로
// any 우회 후 narrow interface로 좁힌다.
const parser = StructuredOutputParser.fromZodSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quizSchema as any,
) as {
  getFormatInstructions(): string;
  parse(text: string): Promise<unknown>;
};

interface SampleResult {
  index: number;
  latencyMs: number;
  rawLength: number;
  parsed: boolean;
  parseError?: string;
}

interface ConfigResult {
  config: 'format-json' | 'parser-only';
  samples: SampleResult[];
  successRate: number;
  meanLatencyMs: number;
  meanRawLength: number;
}

async function runOne(
  client: ChatOllama,
  prompt: string,
  parseFn: (raw: string) => Promise<unknown>,
  index: number,
): Promise<SampleResult> {
  const start = Date.now();
  let raw = '';
  let parsed = false;
  let parseError: string | undefined;
  try {
    const res = await client.invoke([new HumanMessage(prompt)]);
    raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    await parseFn(raw);
    parsed = true;
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }
  return {
    index,
    latencyMs: Date.now() - start,
    rawLength: raw.length,
    parsed,
    parseError,
  };
}

async function runConfig(
  config: ConfigResult['config'],
  client: ChatOllama,
  prompt: string,
  parseFn: (raw: string) => Promise<unknown>,
): Promise<ConfigResult> {
  const samples: SampleResult[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    process.stdout.write(`  [${config}] sample ${i + 1}/${SAMPLES} ... `);
    const r = await runOne(client, prompt, parseFn, i);
    samples.push(r);
    process.stdout.write(`${r.parsed ? 'OK' : 'FAIL'} (${r.latencyMs}ms)\n`);
  }
  const success = samples.filter((s) => s.parsed).length;
  return {
    config,
    samples,
    successRate: success / samples.length,
    meanLatencyMs:
      samples.reduce((acc, s) => acc + s.latencyMs, 0) / samples.length,
    meanRawLength:
      samples.reduce((acc, s) => acc + s.rawLength, 0) / samples.length,
  };
}

async function main() {
  console.log('='.repeat(72));
  console.log('format: json vs StructuredOutputParser 실증 비교');
  console.log('='.repeat(72));
  console.log(`model       : ${MODEL}`);
  console.log(`base url    : ${OLLAMA_BASE_URL}`);
  console.log(`samples     : ${SAMPLES} per config`);
  console.log(`temperature : 0.2 (SDD v2 §10.2)`);
  console.log();

  const formatInstructions = parser.getFormatInstructions();
  // 동일 prompt를 두 옵션 모두에 사용 — 차이는 ChatOllama 측 format 옵션뿐
  const prompt = [
    'Generate a single Oracle SQL multiple-choice quiz item in JSON.',
    '',
    formatInstructions,
    '',
    'Topic: SELECT 문 기본 (FROM, WHERE, ORDER BY)',
    'Make sure the JSON is valid and the answer matches one of the options.',
  ].join('\n');

  // (a) format: 'json' (Ollama native JSON mode)
  const clientFormatJson = new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: MODEL,
    temperature: 0.2,
    format: 'json',
  });
  // 'json' 모드에서는 모델이 JSON.parse 가능한 raw text를 반환하므로
  // JSON.parse만 검증하면 충분 (parser format instruction은 prompt에 그대로 두되,
  // 추가 schema validation은 zod로 별도 검증)
  const parseAsJson = async (raw: string) => {
    const obj = JSON.parse(raw);
    quizSchema.parse(obj);
    return obj;
  };

  // (b) StructuredOutputParser only (format 미지정)
  const clientParserOnly = new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: MODEL,
    temperature: 0.2,
  });
  const parseWithStructured = async (raw: string) => parser.parse(raw);

  console.log('--- (a) format: "json" (Ollama native) ---');
  const aResult = await runConfig(
    'format-json',
    clientFormatJson,
    prompt,
    parseAsJson,
  );

  console.log();
  console.log('--- (b) StructuredOutputParser only (format 미지정) ---');
  const bResult = await runConfig(
    'parser-only',
    clientParserOnly,
    prompt,
    parseWithStructured,
  );

  console.log();
  console.log('='.repeat(72));
  console.log('요약');
  console.log('='.repeat(72));
  for (const r of [aResult, bResult]) {
    console.log(
      `${r.config.padEnd(14)} success=${(r.successRate * 100).toFixed(0)}%  meanLatency=${r.meanLatencyMs.toFixed(0)}ms  meanLen=${r.meanRawLength.toFixed(0)}b`,
    );
  }
  console.log();

  // JSON 결과 파일 저장
  const outDir = join(process.cwd(), 'eval-results');
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = join(outDir, `format-vs-parser-${ts}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        meta: {
          model: MODEL,
          baseUrl: OLLAMA_BASE_URL,
          samples: SAMPLES,
          temperature: 0.2,
          timestamp: new Date().toISOString(),
        },
        results: [aResult, bResult],
      },
      null,
      2,
    ),
  );
  console.log(`결과 → ${outFile}`);

  // exit code: 두 옵션 중 하나라도 100% 미만이면 1 (단, 비교가 의미있을 때만)
  const allPassed = aResult.successRate === 1 && bResult.successRate === 1;
  process.exit(allPassed ? 0 : 0); // 비교는 결과만 중요, 어느쪽이 실패해도 분석할 가치가 있으므로 exit 0
}

main().catch((err) => {
  console.error('실험 실패:', err);
  process.exit(1);
});
