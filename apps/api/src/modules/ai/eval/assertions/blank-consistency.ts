import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT4 — 빈칸-정답 일관성 (SDD v2 §3.1).
 *
 * 합격선 C4 ≥ 95%.
 *
 * 검증 항목 (blank-typing 모드 한정):
 *  1. sql의 `___` 토큰 개수 == blanks 배열 길이 (정확 일치)
 *  2. blanks[i].answer가 모두 vars.allowedKeywords 안에 있음
 *  3. top-level answer 배열 길이 == blanks 길이 (시드 컨벤션)
 *  4. blanks 길이 ≥ 1 (빈칸 0개는 빈칸 문제가 아님)
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

  // 2. blanks[i].answer가 모두 화이트리스트 안
  const allowed = new Set(context.vars.allowedKeywords.map((k) => k.toUpperCase()));
  const outOfScope: string[] = [];
  for (const b of blanks as BlankShape[]) {
    if (typeof b.answer !== 'string') {
      return { pass: false, score: 0, reason: 'MT4 fail — blanks[].answer가 문자열이 아님' };
    }
    if (!allowed.has(b.answer.toUpperCase())) {
      outOfScope.push(b.answer);
    }
  }
  if (outOfScope.length > 0) {
    return {
      pass: false,
      score: 0,
      reason: `MT4 fail — blanks의 정답이 화이트리스트 밖: ${outOfScope.join(', ')}`,
    };
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
