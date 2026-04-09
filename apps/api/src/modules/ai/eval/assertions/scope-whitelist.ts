import { extractOracleTokens } from '@oracle-game/shared';

import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT3 — 화이트리스트 통과율 (SDD v2 §3.1).
 *
 * 합격선 C3 ≥ 90%.
 *
 * 운영의 ScopeValidatorService(DB-backed, async)와 동일한 정책을 pure 함수로
 * 재현한다:
 *  1. 검사 대상 텍스트(sql/description + answer)에서 Oracle 토큰 추출
 *     (단계 0의 공유 utils `oracle-tokens.ts`)
 *  2. 토큰이 모두 vars.allowedKeywords(누적 화이트리스트)에 있으면 pass
 *  3. 비교는 대문자 정규화 후 Set 매칭 — 운영 코드와 동일
 *
 * 본 assertion이 ScopeValidatorService를 직접 호출하지 않는 이유:
 *  - assertion은 promptfoo 런타임에서 vitest 없이 단독 실행 가능해야 한다
 *  - 운영 service는 NestJS DI + TypeORM Repository에 묶여 있어 mock 비용이 큼
 *  - vars.allowedKeywords가 dataset 빌드 시점에 이미 같은 source(WeeklyScopeEntity)
 *    에서 채워지므로, 두 경로의 진실은 동일
 */
export default async function scopeWhitelistAssertion(
  output: string,
  context: AssertionContext,
): Promise<AssertionResult> {
  const parsed = extractJson(output);
  if (!parsed.ok) {
    return {
      pass: false,
      score: 0,
      reason: `MT3 fail — JSON 파싱 실패 (${parsed.reason})`,
    };
  }

  const value = parsed.value as Record<string, unknown>;
  const gameMode = context.vars.gameMode;

  // 검사 대상 텍스트 결정 — 운영 AQG와 동일
  const textsToValidate: string[] = [];
  if (gameMode === 'blank-typing') {
    if (typeof value.sql === 'string') {
      textsToValidate.push(value.sql);
    }
  } else if (gameMode === 'term-match') {
    if (typeof value.description === 'string') {
      textsToValidate.push(value.description);
    }
  }
  if (Array.isArray(value.answer)) {
    textsToValidate.push(value.answer.filter((a): a is string => typeof a === 'string').join(' '));
  }

  if (textsToValidate.length === 0) {
    return {
      pass: false,
      score: 0,
      reason: 'MT3 fail — 검사 대상 텍스트(sql/description/answer)를 찾지 못함',
    };
  }

  const allowed = new Set(context.vars.allowedKeywords.map((k) => k.toUpperCase()));

  const outOfScope = new Set<string>();
  for (const text of textsToValidate) {
    const tokens = extractOracleTokens(text);
    for (const token of tokens) {
      if (!allowed.has(token)) {
        outOfScope.add(token);
      }
    }
  }

  if (outOfScope.size > 0) {
    return {
      pass: false,
      score: 0,
      reason: `MT3 fail — 화이트리스트 위반: ${[...outOfScope].join(', ')}`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: 'MT3 pass — 화이트리스트 통과',
  };
}
