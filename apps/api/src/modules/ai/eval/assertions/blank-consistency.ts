import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT4 — 빈칸-정답 일관성 (SDD v2 §3.1).
 *
 * 합격선 C4 ≥ 95%.
 *
 * 검증 항목 (blank-typing 모드 한정):
 *  1. sql의 `___` 토큰 개수 == blanks 배열 길이 (정확 일치)
 *  2. top-level answer 배열 길이 == blanks 길이 (시드 컨벤션)
 *  3. blanks 길이 ≥ 1 (빈칸 0개는 빈칸 문제가 아님)
 *  4. 각 blanks[i].answer가 문자열 타입
 *
 * **화이트리스트 검증은 MT3(scope-whitelist)의 단일 책임으로 이관**
 * (rationale/oss-eval-failure-analysis-2026-04-14.md — 옵션 2, 3+1 합의).
 * 빈칸 정답은 "=", ">", "10", "SAL DESC" 같은 리터럴/연산자가 자연스러우며,
 * MT3가 sql 본문 + top-level answer를 이미 검사하므로 중복 검증만 발생했음.
 *
 * term-match 모드는 본 메트릭의 적용 대상이 아니므로 자동 pass.
 */

const TRIPLE_UNDERSCORE = /___/g;

interface BlankShape {
  position?: unknown;
  answer?: unknown;
  hint?: unknown;
}

export default async function blankConsistencyAssertion(
  output: string,
  context: AssertionContext,
): Promise<AssertionResult> {
  const gameMode = context.vars.gameMode;

  // term-match는 본 메트릭 비대상 — 자동 pass
  if (gameMode !== 'blank-typing') {
    return {
      pass: true,
      score: 1,
      reason: `MT4 skip — ${gameMode}는 본 메트릭 비대상`,
    };
  }

  const parsed = extractJson(output);
  if (!parsed.ok) {
    return {
      pass: false,
      score: 0,
      reason: `MT4 fail — JSON 파싱 실패 (${parsed.reason})`,
    };
  }

  const value = parsed.value as Record<string, unknown>;
  const sql = value.sql;
  const blanks = value.blanks;
  const answer = value.answer;

  if (typeof sql !== 'string') {
    return { pass: false, score: 0, reason: 'MT4 fail — sql 필드가 문자열이 아님' };
  }
  if (!Array.isArray(blanks)) {
    return { pass: false, score: 0, reason: 'MT4 fail — blanks 필드가 배열이 아님' };
  }
  if (blanks.length < 1) {
    return { pass: false, score: 0, reason: 'MT4 fail — blanks가 비어있음 (빈칸 문제가 아님)' };
  }

  // 1. ___ 토큰 개수 == blanks 길이
  const underscoreMatches = sql.match(TRIPLE_UNDERSCORE) ?? [];
  if (underscoreMatches.length !== blanks.length) {
    return {
      pass: false,
      score: 0,
      reason: `MT4 fail — sql의 ___ ${underscoreMatches.length}개 != blanks ${blanks.length}개`,
    };
  }

  // 2. blanks[i].answer가 문자열인지만 검증 (화이트리스트 검증은 MT3가 단일 책임)
  for (const b of blanks as BlankShape[]) {
    if (typeof b.answer !== 'string') {
      return { pass: false, score: 0, reason: 'MT4 fail — blanks[].answer가 문자열이 아님' };
    }
  }

  // 3. top-level answer 길이 == blanks 길이
  if (!Array.isArray(answer) || answer.length !== blanks.length) {
    return {
      pass: false,
      score: 0,
      reason: `MT4 fail — top-level answer 길이(${Array.isArray(answer) ? answer.length : 'N/A'}) != blanks 길이(${blanks.length})`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: `MT4 pass — ___ ${blanks.length}개 + 정답 일관성 OK`,
  };
}
