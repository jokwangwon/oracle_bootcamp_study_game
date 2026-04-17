import type { AnswerFormat } from '@oracle-game/shared';

import type { AstCanonicalGrader } from './graders/ast-canonical.grader';
import type { AstFailureReason } from './grading.types';

/**
 * ADR-013 Layer 0.5 — 정답 템플릿 seed CI 사전검증 게이트.
 *
 * 3+1 합의(MVP-B Session 3): free-form 답안 시드의 모든 expected 중 최소 1개 이상이
 * Layer 1 AST 파서로 파싱 가능해야 한다. 모두 UNKNOWN 이면 런타임 채점 편향이
 * 발생하므로 CI 에서 사전 차단한다.
 *
 * 설계:
 *  - 순수 함수(Nest DI 무관) — CLI 스크립트(`scripts/validate-free-form-seeds.ts`)
 *    와 SeedService 부팅 훅에서 재사용
 *  - `answerFormat !== 'free-form'` 은 skip (기본 'single-token' 포함)
 *  - 각 answer 를 `grader.grade(studentAnswer=answer, expected=[answer])` 로
 *    호출해 파싱 가능성만 확인 — verdict='PASS' 면 파싱 OK, UNKNOWN 이면 실패 사유
 *    (`astFailureReason`) 을 수집
 *  - 한 question 의 answer[] 중 하나라도 파싱 가능 → pass (Session 4+ Rewriter
 *    도입 시엔 이 기준을 더 엄격하게 상향 가능)
 */

export const FREE_FORM_SEED_VALIDATOR_VERSION = 'free-form-seed-validator-v1';

export interface FreeFormSeedCandidate {
  id?: string;
  answerFormat?: AnswerFormat;
  answer: readonly string[];
}

export type FreeFormSeedFailureReason =
  | 'empty_answer_list'
  | 'all_answers_unparseable';

export interface FreeFormSeedFinding {
  questionId: string;
  reason: FreeFormSeedFailureReason;
  /** 각 answer[]별 Layer 1 실패 사유. empty_answer_list 인 경우 빈 배열. */
  perAnswerReasons: AstFailureReason[];
}

export interface FreeFormSeedReport {
  checked: number;
  passed: number;
  failed: FreeFormSeedFinding[];
}

export function validateFreeFormSeeds(
  grader: AstCanonicalGrader,
  candidates: readonly FreeFormSeedCandidate[],
): FreeFormSeedReport {
  const report: FreeFormSeedReport = { checked: 0, passed: 0, failed: [] };

  candidates.forEach((cand, idx) => {
    if (cand.answerFormat !== 'free-form') return;
    report.checked += 1;
    const questionId = cand.id ?? `idx-${idx}`;

    if (cand.answer.length === 0) {
      report.failed.push({
        questionId,
        reason: 'empty_answer_list',
        perAnswerReasons: [],
      });
      return;
    }

    const perAnswerReasons: AstFailureReason[] = [];
    let anyParseable = false;

    for (const answer of cand.answer) {
      const v = grader.grade({ studentAnswer: answer, expected: [answer] });
      if (v.verdict === 'PASS') {
        anyParseable = true;
        continue;
      }
      if (v.astFailureReason) perAnswerReasons.push(v.astFailureReason);
    }

    if (anyParseable) {
      report.passed += 1;
    } else {
      report.failed.push({
        questionId,
        reason: 'all_answers_unparseable',
        perAnswerReasons,
      });
    }
  });

  return report;
}

export function formatReport(report: FreeFormSeedReport): string {
  const header = `[free-form seed validator ${FREE_FORM_SEED_VALIDATOR_VERSION}] checked=${report.checked} passed=${report.passed} failed=${report.failed.length}`;
  if (report.failed.length === 0) return header;
  const lines = report.failed.map(
    (f) =>
      `  - ${f.questionId}: reason=${f.reason} perAnswer=[${f.perAnswerReasons.join(',')}]`,
  );
  return [header, ...lines].join('\n');
}
