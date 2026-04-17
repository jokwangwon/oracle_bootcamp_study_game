import { Injectable } from '@nestjs/common';
import { extractOracleTokens } from '@oracle-game/shared';

import type { LayerVerdict } from '../grading.types';

/**
 * ADR-013 Layer 2 — Keyword/Token Coverage grader.
 *
 * Oracle 식별자 토큰 집합 비교로 PASS/FAIL/UNKNOWN을 판정한다.
 * 상위 Layer 1(AST)이 UNKNOWN 반환 시 호출되며, UNKNOWN 반환 시 Layer 3(LLM).
 *
 * 알고리즘 (ADR-013 §Layer 2):
 *   T_expected = union( extractOracleTokens(e) for e in expected )
 *   T_student  = extractOracleTokens(studentAnswer)
 *   coverage   = |T_expected ∩ T_student| / |T_expected|
 *   extra_over_allowlist = |T_student \ allowlist|
 *   partial    = max(0, coverage - extra_over_allowlist * PENALTY_PER_EXTRA)
 *
 * 판정:
 *   partial ≥ PASS_THRESHOLD (0.95)     → PASS
 *   partial < FAIL_THRESHOLD (0.3)      → FAIL
 *   그 외                                → UNKNOWN (Layer 3로 이관)
 *
 * 관찰성:
 *  - graderDigest = KEYWORD_GRADER_VERSION. 알고리즘 변경 시 버전 bump.
 *  - rationale에 coverage / penalty 수치 기록 (감사 로그 및 운영 디버깅)
 */

export const KEYWORD_GRADER_VERSION = 'keyword-v1';

export const PASS_THRESHOLD = 0.95;
export const FAIL_THRESHOLD = 0.3;
export const PENALTY_PER_EXTRA_TOKEN = 0.05;

export interface KeywordGradeInput {
  studentAnswer: string;
  expected: readonly string[];
  /** 주차 화이트리스트 (대문자 정규화된 토큰) */
  allowlist: readonly string[];
}

@Injectable()
export class KeywordCoverageGrader {
  grade(input: KeywordGradeInput): LayerVerdict {
    if (!input.expected || input.expected.length === 0) {
      throw new Error('KeywordCoverageGrader: expected는 최소 1개 이상 필요');
    }

    const expectedTokens = uniq(
      input.expected.flatMap((e) => extractOracleTokens(e)),
    );

    if (expectedTokens.size === 0) {
      return {
        verdict: 'UNKNOWN',
        rationale:
          'Layer 2 UNKNOWN — 정답에서 Oracle 토큰을 추출할 수 없음 (예: 숫자/리터럴만)',
        graderDigest: KEYWORD_GRADER_VERSION,
      };
    }

    const studentTokens = uniq(extractOracleTokens(input.studentAnswer));
    const allowSet = new Set(input.allowlist.map((k) => k.toUpperCase()));

    let intersect = 0;
    for (const t of studentTokens) {
      if (expectedTokens.has(t)) intersect += 1;
    }
    const coverage = intersect / expectedTokens.size;

    let extraOver = 0;
    for (const t of studentTokens) {
      if (!allowSet.has(t)) extraOver += 1;
    }
    const penalty = extraOver * PENALTY_PER_EXTRA_TOKEN;
    const partial = Math.max(0, coverage - penalty);

    const rationale = `Layer 2 coverage=${fmt(coverage)} penalty=${fmt(penalty)} partial=${fmt(partial)} (T_expected=${expectedTokens.size}, T_student=${studentTokens.size}, extra=${extraOver})`;

    if (partial >= PASS_THRESHOLD) {
      return {
        verdict: 'PASS',
        confidence: partial,
        rationale,
        graderDigest: KEYWORD_GRADER_VERSION,
      };
    }
    if (partial < FAIL_THRESHOLD) {
      return {
        verdict: 'FAIL',
        confidence: partial,
        rationale,
        graderDigest: KEYWORD_GRADER_VERSION,
      };
    }
    return {
      verdict: 'UNKNOWN',
      confidence: partial,
      rationale,
      graderDigest: KEYWORD_GRADER_VERSION,
    };
  }
}

function uniq(tokens: string[]): Set<string> {
  return new Set(tokens);
}

function fmt(n: number): string {
  return n.toFixed(1);
}
