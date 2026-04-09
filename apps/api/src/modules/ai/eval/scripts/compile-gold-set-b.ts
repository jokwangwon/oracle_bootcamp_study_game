/**
 * Gold Set B compile 스크립트 (SDD v2 §4.2 + 단계 4 task #20).
 *
 * 입력: gold-set-b.candidates.md (사용자 검수 완료)
 * 출력:
 *   1. gold-set-b.ts                  — 30개 EvalDatasetEntry TypeScript 모듈
 *   2. gold-set-b.synthesis.log.md    — 합성/검수/자동선택 감사 로그
 *
 * 자동 선택 알고리즘:
 *   - 30개 목표 분포: easy 10 / medium 12 / hard 8 (SDD §4.2)
 *   - 모드 균형: bt 5/6/4 + tm 5/6/4 = 15 + 15 (50/50)
 *   - 채택 항목 중 카테고리별 quota만큼 앞에서부터 선택 (deterministic)
 *
 * 검증:
 *   - 모든 sql/description/answer가 1주차 화이트리스트 안 (validate-candidates와 동일)
 *   - 시드 30개와 정확히 동일한 sql/description 없음
 *   - 30개 entry 분포 검증
 *
 * 실행:
 *   cd apps/api
 *   npx tsx src/modules/ai/eval/scripts/compile-gold-set-b.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { extractOracleTokens } from '@oracle-game/shared';
import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';
import { WEEK1_SQL_BASICS_QUESTIONS } from '../../../content/seed/data/week1-sql-basics.questions';

// ─── 자동 선택 분포 (SDD §4.2) ────────────────────────────────────────────────
const QUOTA: Record<string, number> = {
  'blank-typing/EASY': 5,
  'blank-typing/MEDIUM': 6,
  'blank-typing/HARD': 4,
  'term-match/EASY': 5,
  'term-match/MEDIUM': 6,
  'term-match/HARD': 4,
};
// 합 30 = 10 easy + 12 medium + 8 hard

// ─── 후보 파싱 ────────────────────────────────────────────────────────────────
interface ParsedCandidate {
  candidateId: string;
  mode: 'blank-typing' | 'term-match';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  accepted: boolean;
  // blank-typing
  sql?: string;
  blanks?: Array<{ position: number; answer: string; hint?: string }>;
  // term-match
  description?: string;
  category?: string;
  // common
  answer: string[];
  explanation: string;
  noteVsSeeds: string;
}

function parseCandidatesMarkdown(md: string): ParsedCandidate[] {
  // 각 후보 블록은 #### 헤더로 시작. 다음 #### 또는 EOF/--- 까지가 한 블록.
  const blocks = md.split(/^#### /m).slice(1); // 첫 split은 헤더 이전
  const out: ParsedCandidate[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const candidateId = lines[0]!.trim();

    const accepted =
      lines.some((l) => /^- \[x\] \*\*채택/.test(l));
    const modeMatch = block.match(/^- \*\*mode\*\*: (.+)$/m);
    const difficultyMatch = block.match(/^- \*\*difficulty\*\*: (.+)$/m);
    const sqlMatch = block.match(/^- \*\*sql\*\*: `(.+)`$/m);
    const blanksMatch = block.match(/^- \*\*blanks\*\*: (.+)$/m);
    const descMatch = block.match(/^- \*\*description\*\*: (.+)$/m);
    const categoryMatch = block.match(/^- \*\*category\*\*: (.+)$/m);
    const answerMatch = block.match(/^- \*\*answer\*\*: `(.+)`$/m);
    const explanationMatch = block.match(/^- \*\*explanation\*\*: (.+)$/m);
    const noteMatch = block.match(/^- \*\*noteVsSeeds\*\*: (.+)$/m);

    if (
      !modeMatch ||
      !difficultyMatch ||
      !answerMatch ||
      !explanationMatch ||
      !noteMatch
    ) {
      console.warn(`[warn] ${candidateId}: 필수 필드 누락, 스킵`);
      continue;
    }

    const mode = modeMatch[1] as 'blank-typing' | 'term-match';
    const difficulty = difficultyMatch[1] as 'EASY' | 'MEDIUM' | 'HARD';
    const answer = answerMatch[1]!.split(',').map((s) => s.trim());
    const explanation = explanationMatch[1]!.trim();
    const noteVsSeeds = noteMatch[1]!.trim();

    let blanks: ParsedCandidate['blanks'];
    if (blanksMatch) {
      // 형식: "pos 0 → `SELECT` (hint: ...)" or 다중 빈칸 "pos 0 → `X` (...); pos 1 → `Y` (...)"
      const parsed: Array<{ position: number; answer: string; hint?: string }> = [];
      for (const part of blanksMatch[1]!.split(/;\s*/)) {
        const m = part.match(/pos (\d+) → `([^`]+)`(?: \(hint: ([^)]+)\))?/);
        if (!m) continue;
        const entry: { position: number; answer: string; hint?: string } = {
          position: Number.parseInt(m[1]!, 10),
          answer: m[2]!,
        };
        if (m[3] !== undefined) entry.hint = m[3];
        parsed.push(entry);
      }
      blanks = parsed;
    }

    out.push({
      candidateId,
      mode,
      difficulty,
      accepted,
      sql: sqlMatch?.[1],
      blanks,
      description: descMatch?.[1],
      category: categoryMatch?.[1],
      answer,
      explanation,
      noteVsSeeds,
    });
  }

  return out;
}

// ─── 자동 선택 (앞에서부터 quota만큼) ─────────────────────────────────────────
function autoSelect(
  candidates: ParsedCandidate[],
): { selected: ParsedCandidate[]; rejectedByQuota: ParsedCandidate[] } {
  const accepted = candidates.filter((c) => c.accepted);
  const buckets = new Map<string, ParsedCandidate[]>();
  for (const c of accepted) {
    const key = `${c.mode}/${c.difficulty}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }

  const selected: ParsedCandidate[] = [];
  const rejectedByQuota: ParsedCandidate[] = [];
  for (const [key, quota] of Object.entries(QUOTA)) {
    const bucket = buckets.get(key) ?? [];
    if (bucket.length < quota) {
      throw new Error(
        `${key} 채택 ${bucket.length}개 < quota ${quota}. 사용자 검수에서 더 많이 채택 필요.`,
      );
    }
    selected.push(...bucket.slice(0, quota));
    rejectedByQuota.push(...bucket.slice(quota));
  }
  return { selected, rejectedByQuota };
}

// ─── 검증 ─────────────────────────────────────────────────────────────────────
function validate(selected: ParsedCandidate[]): void {
  const whitelist = new Set(
    WEEK1_SQL_BASICS_SCOPE.keywords.map((k) => k.toUpperCase()),
  );
  const seedSqlSet = new Set<string>();
  const seedDescSet = new Set<string>();
  for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
    if (q.content.type === 'blank-typing') seedSqlSet.add(q.content.sql);
    if (q.content.type === 'term-match') seedDescSet.add(q.content.description);
  }

  const violations: string[] = [];
  for (const c of selected) {
    if (c.sql) {
      const tokens = extractOracleTokens(c.sql);
      for (const tok of tokens) {
        if (!whitelist.has(tok.toUpperCase())) {
          violations.push(`[${c.candidateId}] sql 화이트리스트 위반: ${tok}`);
        }
      }
      if (seedSqlSet.has(c.sql)) {
        violations.push(`[${c.candidateId}] 시드와 동일한 sql`);
      }
    }
    if (c.description) {
      const tokens = extractOracleTokens(c.description);
      for (const tok of tokens) {
        if (!whitelist.has(tok.toUpperCase())) {
          violations.push(
            `[${c.candidateId}] description 화이트리스트 위반: ${tok}`,
          );
        }
      }
      if (seedDescSet.has(c.description)) {
        violations.push(`[${c.candidateId}] 시드와 동일한 description`);
      }
    }
    for (const a of c.answer) {
      if (!whitelist.has(a.toUpperCase())) {
        violations.push(`[${c.candidateId}] answer 화이트리스트 위반: ${a}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(`❌ ${violations.length}개 검증 위반:`);
    for (const v of violations) console.error('  ' + v);
    throw new Error('검증 실패 — 컴파일 중단');
  }
}

// ─── gold-set-b.ts 출력 ──────────────────────────────────────────────────────
function renderGoldSetBModule(selected: ParsedCandidate[]): string {
  // 모드별 카운터로 id 부여 (gold-b-bt-01, gold-b-tm-01 등)
  const blankCounter = { n: 0 };
  const termCounter = { n: 0 };

  const entries = selected.map((c) => {
    const counter = c.mode === 'blank-typing' ? blankCounter : termCounter;
    counter.n += 1;
    const idPrefix = c.mode === 'blank-typing' ? 'bt' : 'tm';
    const id = `gold-b-${idPrefix}-${String(counter.n).padStart(2, '0')}`;
    // 시드와 동일하게 answer[0]를 seedFocusKeyword로 사용 (의미: 평가 prompt가 사용할 핵심 토큰)
    const focus = c.answer[0]!;
    return `  {
    id: '${id}',
    candidateId: '${c.candidateId}',
    gameMode: '${c.mode}',
    topic: 'sql-basics',
    week: 1,
    difficulty: '${c.difficulty}',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: '${c.difficulty}',
      allowedKeywords: WEEK1_SQL_BASICS_SCOPE.keywords,
      seedFocusKeyword: '${focus.replace(/'/g, "\\'")}',
    },
  },`;
  });

  return `import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';
import type { EvalDatasetEntry } from './gold-set-a';

/**
 * Gold Set B — 신규 평가셋 30문제 (Generalization 검증, SDD v2 §4.2).
 *
 * 합성 → 사용자 검수 → 자동 선택(quota 기반) 파이프라인으로 만들어진 30개.
 * 합성 출처와 검수 결과는 \`gold-set-b.synthesis.log.md\`에 기록되어 있다.
 *
 * 분포 (SDD v2 §4.2):
 *   - 모드: blank-typing 15 + term-match 15
 *   - 난이도: easy 10 + medium 12 + hard 8
 *
 * 평가 정의: Gold Set A와 동일한 EvalDatasetEntry 형태로 제공되며,
 * 시드(week1-sql-basics)와는 다른 주제 조합으로 작성됨 → 모델의 일반화 능력 측정.
 *
 * **이 파일은 \`compile-gold-set-b.ts\`가 생성한다. 직접 수정하지 말고
 * candidates.md를 수정한 후 컴파일을 다시 실행하라.**
 */

export interface GoldSetBEntry extends EvalDatasetEntry {
  /** 합성 시점의 candidate ID (감사용). compile 후에는 id가 gold-b-* 형식으로 재부여됨. */
  candidateId: string;
}

export const goldSetB: readonly GoldSetBEntry[] = Object.freeze([
${entries.join('\n')}
]);
`;
}

// ─── synthesis.log.md 출력 ────────────────────────────────────────────────────
function renderSynthesisLog(
  candidates: ParsedCandidate[],
  selected: ParsedCandidate[],
  rejectedByQuota: ParsedCandidate[],
): string {
  const accepted = candidates.filter((c) => c.accepted);
  const rejectedByUser = candidates.filter((c) => !c.accepted);
  const ts = new Date().toISOString();

  const lines: string[] = [];
  lines.push('# Gold Set B 합성/검수/컴파일 감사 로그');
  lines.push('');
  lines.push('> SDD: docs/architecture/oss-model-evaluation-design.md v2 §4.2 + Q2 결정 + 단계 4');
  lines.push('');
  lines.push('## 1. 합성 단계 (작성자: Claude)');
  lines.push('');
  lines.push('| 항목 | 값 |');
  lines.push('|---|---|');
  lines.push('| 작성자 | Claude opus-4-6 (1M context) |');
  lines.push('| 합성 방식 | Anthropic API 호출 대신 본 Claude Code 세션에서 직접 작성 (크레딧 잔액 부족 우회, 동등 품질, 동일 모델) |');
  lines.push('| 합성 batch | 6 (mode × difficulty: bt easy/medium/hard + tm easy/medium/hard) |');
  lines.push('| 후보 분포 | bt 14/14/12 + tm 14/14/12 = 80 |');
  lines.push('| 자체 검증 | validate-candidates.ts → 화이트리스트 + 시드 중복 통과 (5개 description 메타 단어 patch 후) |');
  lines.push('| 산출물 | apps/api/src/modules/ai/eval/datasets/gold-set-b.candidates.md |');
  lines.push('');
  lines.push('## 2. 검수 단계 (검수자: 사용자)');
  lines.push('');
  lines.push('> 작성/검수 분리 원칙(SDD §4.2 + B-MED): 작성자=Claude, 검수자=사용자');
  lines.push('');
  lines.push('| 결과 | 카테고리 | 카운트 |');
  lines.push('|---|---|---|');
  lines.push(`| **사용자 채택** | 전체 | ${accepted.length} / 80 |`);
  lines.push(`| **사용자 거절** | 전체 | ${rejectedByUser.length} / 80 |`);
  lines.push('');
  lines.push('### 거절된 후보 (사용자가 명시 거절)');
  lines.push('');
  if (rejectedByUser.length === 0) {
    lines.push('(없음)');
  } else {
    for (const c of rejectedByUser) {
      lines.push(`- \`${c.candidateId}\` (${c.mode}/${c.difficulty})`);
    }
  }
  lines.push('');
  lines.push('## 3. 자동 선택 단계 (compile-gold-set-b.ts)');
  lines.push('');
  lines.push('> SDD §4.2 분포 권장(easy 10 / medium 12 / hard 8 = 30) + 모드 균형(bt 15 + tm 15)에 맞춰');
  lines.push('> 채택 항목 중 카테고리별 quota만큼 앞에서부터 결정론적으로 선택.');
  lines.push('');
  lines.push('| 카테고리 | quota | 채택 | 선택 | quota 초과 (운영 시드 후보) |');
  lines.push('|---|---|---|---|---|');
  for (const [key, quota] of Object.entries(QUOTA)) {
    const cAccepted = accepted.filter((c) => `${c.mode}/${c.difficulty}` === key).length;
    const cSelected = selected.filter((c) => `${c.mode}/${c.difficulty}` === key).length;
    const cOver = rejectedByQuota.filter((c) => `${c.mode}/${c.difficulty}` === key).length;
    lines.push(`| ${key} | ${quota} | ${cAccepted} | ${cSelected} | ${cOver} |`);
  }
  lines.push(`| **합** | **30** | **${accepted.length}** | **${selected.length}** | **${rejectedByQuota.length}** |`);
  lines.push('');
  lines.push('### quota 초과 (선택되지 않은 채택 항목)');
  lines.push('');
  lines.push('아래 항목들은 사용자가 채택했지만 30개 quota를 초과해 본 평가셋에는 포함되지 않았다.');
  lines.push('이들은 별도 작업(예: 운영 시드 추가, 새 주차 분리)으로 활용 가능하다.');
  lines.push('');
  if (rejectedByQuota.length === 0) {
    lines.push('(없음)');
  } else {
    for (const c of rejectedByQuota) {
      lines.push(`- \`${c.candidateId}\` (${c.mode}/${c.difficulty})`);
    }
  }
  lines.push('');
  lines.push('## 4. 컴파일 단계');
  lines.push('');
  lines.push('| 항목 | 값 |');
  lines.push('|---|---|');
  lines.push(`| 컴파일 시각 | ${ts} |`);
  lines.push('| 출력 | apps/api/src/modules/ai/eval/datasets/gold-set-b.ts |');
  lines.push('| 검증 | 화이트리스트 + 시드 중복 + 분포 (vitest gold-set-b.test.ts) |');
  lines.push('');
  lines.push('## 5. 후속 작업');
  lines.push('');
  lines.push(`- quota 초과 ${rejectedByQuota.length}개 + 거절 ${rejectedByUser.length}개 = ${rejectedByQuota.length + rejectedByUser.length}개를 운영 시드(week1-sql-basics)에 추가하거나 새 주차로 분리`);
  lines.push('- 트랜잭션/읽기 일관성 학습 영역은 새 주차(week2-transactions) 시드 + 화이트리스트로 분리 (단계 4 외부 작업)');
  lines.push('');
  return lines.join('\n');
}

// ─── main ────────────────────────────────────────────────────────────────────
function main() {
  const mdPath = 'src/modules/ai/eval/datasets/gold-set-b.candidates.md';
  const md = readFileSync(mdPath, 'utf8');

  console.log(`reading ${mdPath}...`);
  const candidates = parseCandidatesMarkdown(md);
  console.log(`parsed ${candidates.length} candidates`);

  const accepted = candidates.filter((c) => c.accepted);
  const rejected = candidates.filter((c) => !c.accepted);
  console.log(`accepted: ${accepted.length}, rejected by user: ${rejected.length}`);

  const { selected, rejectedByQuota } = autoSelect(candidates);
  console.log(`auto-selected: ${selected.length}, rejected by quota: ${rejectedByQuota.length}`);

  console.log('validating selected entries against whitelist + seed dup...');
  validate(selected);
  console.log('✅ 검증 통과');

  const tsModule = renderGoldSetBModule(selected);
  const tsPath = 'src/modules/ai/eval/datasets/gold-set-b.ts';
  writeFileSync(tsPath, tsModule);
  console.log(`written ${tsPath}`);

  const log = renderSynthesisLog(candidates, selected, rejectedByQuota);
  const logPath = 'src/modules/ai/eval/datasets/gold-set-b.synthesis.log.md';
  writeFileSync(logPath, log);
  console.log(`written ${logPath}`);

  console.log();
  console.log('=== 분포 요약 ===');
  for (const [key, quota] of Object.entries(QUOTA)) {
    const n = selected.filter((c) => `${c.mode}/${c.difficulty}` === key).length;
    console.log(`  ${key}: ${n} / quota ${quota}`);
  }
  console.log(`total: ${selected.length}`);
}

main();
