#!/usr/bin/env tsx
/**
 * Layer 0.5 — 정답 템플릿 seed CI 사전검증 게이트 (ADR-013, MVP-B Session 3 커밋 2).
 *
 * 3+1 합의 결과로 추가된 하네스. `answerFormat='free-form'` 시드 중 Layer 1 AST
 * 파서가 전혀 처리할 수 없는 정답 템플릿을 CI 단계에서 차단한다. 현재 시드
 * (week1 sql-basics / week2 transactions) 는 blank-typing / term-match 위주이므로
 * free-form 후보는 대부분 skip 되나, 향후 MVP-B §10 에서 free-form 문제가 추가되면
 * 자동 검증된다.
 *
 * 사용법 (apps/api 에서):
 *   npx tsx src/scripts/validate-free-form-seeds.ts
 *
 * 종료 코드:
 *   0 — 전체 free-form 시드가 Layer 1 파서로 파싱 가능
 *   1 — 하나라도 파싱 불가 (상세는 stderr)
 */
import {
  formatReport,
  validateFreeFormSeeds,
  type FreeFormSeedCandidate,
} from '../modules/grading/validate-free-form-seeds';
import { AstCanonicalGrader } from '../modules/grading/graders/ast-canonical.grader';
import { WEEK1_SQL_BASICS_QUESTIONS } from '../modules/content/seed/data/week1-sql-basics.questions';
import { WEEK2_TRANSACTIONS_QUESTIONS } from '../modules/content/seed/data/week2-transactions.questions';

function main(): void {
  const all: FreeFormSeedCandidate[] = [
    ...WEEK1_SQL_BASICS_QUESTIONS,
    ...WEEK2_TRANSACTIONS_QUESTIONS,
  ].map((q, i) => ({
    id: `week${q.week}-${q.gameMode}-${i}`,
    answerFormat: q.answerFormat,
    answer: q.answer,
  }));

  const grader = new AstCanonicalGrader();
  const report = validateFreeFormSeeds(grader, all);

  if (report.failed.length === 0) {
    // eslint-disable-next-line no-console
    console.log(formatReport(report));
    process.exit(0);
  }
  // eslint-disable-next-line no-console
  console.error(formatReport(report));
  process.exit(1);
}

main();
