/**
 * Gold Set B candidates 자체 검증 스크립트.
 *
 * 사용자 검수 전에 합성 결과(80개)가 화이트리스트와 시드 중복 정합성을
 * 만족하는지 자동 검증한다. 본 스크립트는 검수 후 compile 단계에서도
 * 재사용한다.
 *
 * 실행:
 *   cd apps/api
 *   npx tsx src/modules/ai/eval/scripts/validate-candidates.ts
 */

import { readFileSync } from 'node:fs';
import { extractOracleTokens } from '@oracle-game/shared';
import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';
import { WEEK1_SQL_BASICS_QUESTIONS } from '../../../content/seed/data/week1-sql-basics.questions';

const md = readFileSync(
  'src/modules/ai/eval/datasets/gold-set-b.candidates.md',
  'utf8',
);

const whitelist = new Set(
  WEEK1_SQL_BASICS_SCOPE.keywords.map((k) => k.toUpperCase()),
);

// 시드 sql/description 수집
const seedSqlSet = new Set<string>();
const seedDescSet = new Set<string>();
for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
  if (q.content.type === 'blank-typing') seedSqlSet.add(q.content.sql);
  if (q.content.type === 'term-match') seedDescSet.add(q.content.description);
}

const sqlMatches = [...md.matchAll(/^- \*\*sql\*\*: `(.+)`$/gm)].map((m) => m[1]!);
const descMatches = [...md.matchAll(/^- \*\*description\*\*: (.+)$/gm)].map(
  (m) => m[1]!,
);
const answerMatches = [...md.matchAll(/^- \*\*answer\*\*: `(.+)`$/gm)].map(
  (m) => m[1]!,
);
const candidateIds = [...md.matchAll(/^#### (\S+)$/gm)].map((m) => m[1]!);

console.log(`candidate ids: ${candidateIds.length}`);
console.log(`sql blocks   : ${sqlMatches.length}`);
console.log(`desc blocks  : ${descMatches.length}`);
console.log(`answer blocks: ${answerMatches.length}`);
console.log();

const violations: string[] = [];

sqlMatches.forEach((sql, i) => {
  const tokens = extractOracleTokens(sql);
  for (const tok of tokens) {
    if (!whitelist.has(tok.toUpperCase())) {
      violations.push(
        `[SQL ${i + 1}] 화이트리스트 위반: ${tok} in "${sql.slice(0, 80)}"`,
      );
    }
  }
});

descMatches.forEach((desc, i) => {
  const tokens = extractOracleTokens(desc);
  for (const tok of tokens) {
    if (!whitelist.has(tok.toUpperCase())) {
      violations.push(
        `[DESC ${i + 1}] 화이트리스트 위반: ${tok} in "${desc.slice(0, 80)}..."`,
      );
    }
  }
});

answerMatches.forEach((ans, i) => {
  const parts = ans.split(',').map((s) => s.trim());
  for (const part of parts) {
    if (!whitelist.has(part.toUpperCase())) {
      violations.push(`[ANSWER ${i + 1}] 화이트리스트 위반: ${part}`);
    }
  }
});

sqlMatches.forEach((sql, i) => {
  if (seedSqlSet.has(sql)) {
    violations.push(`[DUP-SQL ${i + 1}] 시드와 동일한 SQL: ${sql}`);
  }
});
descMatches.forEach((desc, i) => {
  if (seedDescSet.has(desc)) {
    violations.push(
      `[DUP-DESC ${i + 1}] 시드와 동일한 description: ${desc}`,
    );
  }
});

if (violations.length === 0) {
  console.log('✅ 모든 검증 통과 (화이트리스트 + 시드 중복 없음)');
} else {
  console.log(`❌ ${violations.length}개 위반:`);
  for (const v of violations) console.log('  ' + v);
  process.exit(1);
}
