/**
 * Gold Set B 합성 스크립트 (SDD v2 §4.2 + Q2 절충안 30문제).
 *
 * 목적:
 *   1주차 sql-basics 화이트리스트 안에서, **시드 30문제와 다른 주제 조합**으로
 *   80개 후보를 합성한다 (작성자=Claude, 검수자=사용자, 작성/검수 분리 보장).
 *
 *   합성 결과는 사용자가 markdown에서 직접 검수 가능한 형태로
 *   `apps/api/src/modules/ai/eval/datasets/gold-set-b.candidates.md`에 출력한다.
 *
 *   사용자는 각 후보의 `- [ ]` 체크박스를 `- [x]`로 채워 채택,
 *   비워두면 거절. 검수 후 `compile-gold-set-b.ts` 후속 스크립트가 ✅만 골라
 *   `gold-set-b.ts`로 코드화한다 (단계 4 task #20).
 *
 * 분포 (합성 80 → 검수 후 30 목표):
 *   - blank-typing: easy 14 / medium 14 / hard 12 = 40
 *   - term-match  : easy 14 / medium 14 / hard 12 = 40
 *   - 검수 후 분포: easy 10 / medium 12 / hard 8 = 30
 *
 * 결정론:
 *   - 합성 단계는 결정론 불요. 다양성 우선(temperature 0.9).
 *   - 평가 라운드만 0.2 고정 (SDD §10.2).
 *
 * 실행:
 *   docker compose up -d  # langfuse trace를 받으려면
 *   cd apps/api
 *   LLM_API_KEY=sk-... npx tsx src/modules/ai/eval/scripts/synthesize-gold-set-b.ts
 *
 * 출력:
 *   - apps/api/src/modules/ai/eval/datasets/gold-set-b.candidates.md
 *   - apps/api/eval-results/gold-set-b-synthesis-{ts}.json (raw, 감사용)
 *
 * 본 스크립트는 합성 1회 실행 후에는 다시 실행하지 않아도 된다 (재합성 시 결과
 * 파일이 덮어써지므로 사용자가 검수 중이면 주의).
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CallbackHandler } from 'langfuse-langchain';
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { WEEK1_SQL_BASICS_QUESTIONS } from '../../../content/seed/data/week1-sql-basics.questions';
import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';

// ─── 환경 ────────────────────────────────────────────────────────────────────
const LLM_API_KEY = process.env.LLM_API_KEY ?? '';
const LLM_MODEL = process.env.LLM_MODEL ?? 'claude-opus-4-6';
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_HOST = process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com';

if (!LLM_API_KEY) {
  console.error('LLM_API_KEY 환경변수가 필요합니다 (Claude API key)');
  process.exit(1);
}

// ─── 출력 schema (LLM 강제) ──────────────────────────────────────────────────
const blankTypingItemSchema = z.object({
  candidateId: z.string().min(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  sql: z.string().min(5),
  blanks: z
    .array(
      z.object({
        position: z.number().int().nonnegative(),
        answer: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .min(1),
  answer: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  noteVsSeeds: z
    .string()
    .min(1)
    .describe('이 후보가 시드 30문제와 어떻게 다른 주제 조합인지 1문장'),
});

const termMatchItemSchema = z.object({
  candidateId: z.string().min(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  description: z.string().min(1),
  category: z.string().min(1),
  answer: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  noteVsSeeds: z.string().min(1),
});

const blankBatchSchema = z.object({
  items: z.array(blankTypingItemSchema).min(1),
});
const termBatchSchema = z.object({
  items: z.array(termMatchItemSchema).min(1),
});

type BlankItem = z.infer<typeof blankTypingItemSchema>;
type TermItem = z.infer<typeof termMatchItemSchema>;

// ─── batch 정의 ──────────────────────────────────────────────────────────────
type Batch =
  | { mode: 'blank-typing'; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; count: number }
  | { mode: 'term-match'; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; count: number };

const BATCHES: Batch[] = [
  { mode: 'blank-typing', difficulty: 'EASY', count: 14 },
  { mode: 'blank-typing', difficulty: 'MEDIUM', count: 14 },
  { mode: 'blank-typing', difficulty: 'HARD', count: 12 },
  { mode: 'term-match', difficulty: 'EASY', count: 14 },
  { mode: 'term-match', difficulty: 'MEDIUM', count: 14 },
  { mode: 'term-match', difficulty: 'HARD', count: 12 },
];
// 합 80

// ─── prompt 빌더 ─────────────────────────────────────────────────────────────
function seedSnapshotForPrompt(): string {
  // 시드 30문제를 prompt에 압축해서 주입 → "다른 주제 조합" 강제용
  const lines: string[] = [];
  for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
    if (q.gameMode === 'blank-typing' && q.content.type === 'blank-typing') {
      lines.push(`- [BT] ${q.content.sql}  (answer: ${q.answer.join(', ')})`);
    } else if (q.gameMode === 'term-match' && q.content.type === 'term-match') {
      lines.push(`- [TM] ${q.content.description}  (answer: ${q.answer.join(', ')})`);
    }
  }
  return lines.join('\n');
}

function buildSystemPrompt(): string {
  return [
    '당신은 Oracle DBA 부트캠프 1주차 학습용 퀴즈 출제자입니다.',
    '',
    '강제 사항:',
    '1. 모든 SQL 식별자/키워드는 아래 화이트리스트 안에 있어야 합니다 (대문자 매칭).',
    '2. 시드 30문제와 SQL 또는 설명이 거의 동일한 후보는 만들지 마세요. 다른 주제 조합을 선택하세요.',
    '3. blank-typing은 1~3개의 빈칸, term-match는 정확히 1개의 정답 단어를 갖습니다.',
    '4. 빈칸 정답과 용어 정답은 모두 화이트리스트의 한 단어여야 합니다.',
    '5. explanation은 한국어 1~2문장으로 학습자가 이해 가능하게 작성합니다.',
    '6. noteVsSeeds 필드에 이 후보가 시드와 어떻게 다른지 1문장을 적습니다.',
    '',
    `화이트리스트 키워드 (${WEEK1_SQL_BASICS_SCOPE.keywords.length}개):`,
    WEEK1_SQL_BASICS_SCOPE.keywords.join(', '),
    '',
    '시드 30문제 (이것들과 다른 주제 조합으로 만들 것):',
    seedSnapshotForPrompt(),
  ].join('\n');
}

function buildUserPrompt(batch: Batch, formatInstructions: string): string {
  const modeKo =
    batch.mode === 'blank-typing' ? '빈칸 타이핑' : '용어 맞추기';
  return [
    `다음 조건의 ${modeKo} 후보 ${batch.count}개를 합성해 주세요.`,
    '',
    `- 게임 모드: ${batch.mode}`,
    `- 난이도: ${batch.difficulty}`,
    `- 1주차 sql-basics 주제`,
    `- 시드 30문제와 다른 조합`,
    '',
    'candidateId는 다음 형식으로 매겨주세요:',
    `  - blank-typing: bt-${batch.difficulty.toLowerCase()}-01, bt-${batch.difficulty.toLowerCase()}-02, ...`,
    `  - term-match  : tm-${batch.difficulty.toLowerCase()}-01, tm-${batch.difficulty.toLowerCase()}-02, ...`,
    '',
    formatInstructions,
  ].join('\n');
}

// ─── LLM client ──────────────────────────────────────────────────────────────
// CallbackHandler[]로 명시 — Callbacks union type 회피 (length/iter 접근 위함)
function makeCallbacks(): CallbackHandler[] {
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    return [];
  }
  return [
    new CallbackHandler({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_HOST,
    }),
  ];
}

const llm = new ChatAnthropic({
  model: LLM_MODEL,
  apiKey: LLM_API_KEY,
  // 합성은 결정론 불요 — 다양성 우선
  temperature: 0.9,
  maxTokens: 4096,
});

const callbacks = makeCallbacks();

// ─── 합성 실행 ────────────────────────────────────────────────────────────────
async function synthesizeBatch(
  batch: Batch,
): Promise<Array<BlankItem | TermItem>> {
  // generic이 깊으면 TS2589 — AiQuestionGenerator/format-vs-parser와 동일 패턴
  const schema =
    batch.mode === 'blank-typing' ? blankBatchSchema : termBatchSchema;
  const parser = StructuredOutputParser.fromZodSchema(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
  ) as {
    getFormatInstructions(): string;
    parse(text: string): Promise<{ items: Array<BlankItem | TermItem> }>;
  };

  const formatInstructions = parser.getFormatInstructions();
  const sys = buildSystemPrompt();
  const usr = buildUserPrompt(batch, formatInstructions);

  const start = Date.now();
  const res = await llm.invoke(
    [new SystemMessage(sys), new HumanMessage(usr)],
    { callbacks },
  );
  const raw =
    typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  const parsed = await parser.parse(raw);
  const elapsed = Date.now() - start;
  console.log(
    `  [${batch.mode}/${batch.difficulty}] ${parsed.items.length}/${batch.count}개 합성 (${elapsed}ms)`,
  );
  return parsed.items;
}

// ─── markdown 출력 ────────────────────────────────────────────────────────────
function renderItemMarkdown(
  item: BlankItem | TermItem,
  mode: 'blank-typing' | 'term-match',
): string {
  const lines: string[] = [];
  lines.push(`#### ${item.candidateId}`);
  lines.push('');
  lines.push(`- [ ] **채택** — 채택하려면 \`[ ]\`를 \`[x]\`로 변경`);
  lines.push(`- **mode**: ${mode}`);
  lines.push(`- **difficulty**: ${item.difficulty}`);
  if ('sql' in item) {
    lines.push(`- **sql**: \`${item.sql}\``);
    lines.push(
      `- **blanks**: ${item.blanks
        .map((b) => `pos ${b.position} → \`${b.answer}\`${b.hint ? ` (${b.hint})` : ''}`)
        .join('; ')}`,
    );
  } else {
    lines.push(`- **description**: ${item.description}`);
    lines.push(`- **category**: ${item.category}`);
  }
  lines.push(`- **answer**: \`${item.answer.join(', ')}\``);
  lines.push(`- **explanation**: ${item.explanation}`);
  lines.push(`- **noteVsSeeds**: ${item.noteVsSeeds}`);
  lines.push('');
  return lines.join('\n');
}

function buildCandidatesMarkdown(
  results: Array<{ batch: Batch; items: Array<BlankItem | TermItem> }>,
): string {
  const ts = new Date().toISOString();
  const totalCount = results.reduce((acc, r) => acc + r.items.length, 0);
  const lines: string[] = [];
  lines.push(`# Gold Set B candidates`);
  lines.push('');
  lines.push(`> 합성 시각: ${ts}`);
  lines.push(`> 합성 모델: ${LLM_MODEL}`);
  lines.push(`> 합성 batch: ${BATCHES.length} (mode × difficulty)`);
  lines.push(`> 총 후보 수: ${totalCount} (목표 80)`);
  lines.push('');
  lines.push('## 검수 안내 (사용자 작업)');
  lines.push('');
  lines.push('1. 각 후보 항목의 `- [ ] **채택**`을 `- [x] **채택**`으로 변경하면 채택됩니다.');
  lines.push(
    '2. 부적합/중복은 그대로 두면 거절됩니다. 거절 사유를 메모하려면 항목 아래에 한국어로 적어주세요 (감사 로그용).',
  );
  lines.push('3. 최종 30개 채택 시 **분포 권장**: easy 10 / medium 12 / hard 8 (SDD v2 §4.2).');
  lines.push(
    '4. 작성/검수 분리 원칙: 본 후보는 Claude가 합성했으므로 Claude는 본 검수에 관여하지 않습니다 (검수자 = 사용자).',
  );
  lines.push(
    '5. 검수 완료 후 `compile-gold-set-b.ts` 후속 스크립트를 실행하면 채택 항목이 `gold-set-b.ts`로 컴파일됩니다.',
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const { batch, items } of results) {
    lines.push(`## ${batch.mode} / ${batch.difficulty} (${items.length}/${batch.count})`);
    lines.push('');
    for (const item of items) {
      lines.push(renderItemMarkdown(item, batch.mode));
    }
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(72));
  console.log('Gold Set B 합성 (SDD v2 §4.2)');
  console.log('='.repeat(72));
  console.log(`model       : ${LLM_MODEL}`);
  console.log(`temperature : 0.9 (다양성 우선)`);
  console.log(`langfuse    : ${callbacks.length > 0 ? 'enabled' : 'disabled'}`);
  console.log(`batches     : ${BATCHES.length}`);
  console.log();

  const results: Array<{ batch: Batch; items: Array<BlankItem | TermItem> }> = [];
  for (const batch of BATCHES) {
    try {
      const items = await synthesizeBatch(batch);
      results.push({ batch, items });
    } catch (err) {
      console.error(
        `  [${batch.mode}/${batch.difficulty}] 합성 실패:`,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  console.log();
  const total = results.reduce((acc, r) => acc + r.items.length, 0);
  console.log(`총 ${total}개 합성 완료 (목표 80)`);
  console.log();

  // markdown 출력
  const md = buildCandidatesMarkdown(results);
  const mdPath = join(
    process.cwd(),
    'src/modules/ai/eval/datasets/gold-set-b.candidates.md',
  );
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, md);
  console.log(`markdown → ${mdPath}`);

  // raw JSON 감사 로그
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = join(
    process.cwd(),
    `eval-results/gold-set-b-synthesis-${ts}.json`,
  );
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        meta: {
          model: LLM_MODEL,
          temperature: 0.9,
          timestamp: new Date().toISOString(),
          batches: BATCHES,
          totalSynthesized: total,
        },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`raw json → ${jsonPath}`);

  console.log();
  console.log(
    '다음 단계: 사용자가 markdown에서 30개 채택 → compile-gold-set-b.ts 실행',
  );

  // langfuse callback flush (callbacks가 있을 때)
  for (const cb of callbacks) {
    if (cb && typeof cb.shutdownAsync === 'function') {
      await cb.shutdownAsync();
    }
  }
}

main().catch((err) => {
  console.error('합성 실패:', err);
  process.exit(1);
});
