import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT1 — JSON 파싱 성공률 (SDD v2 §3.1).
 *
 * 합격선 C1 ≥ 95% (전체 라운드 비율). 본 함수는 단일 호출에 대한 boolean을
 * 반환하고, 비율 집계는 promptfoo 측에서 수행한다.
 *
 * 본 assertion은 LangChain StructuredOutputParser와 동일한 fenced-block
 * 추출 규칙을 따른다 (`extract-json.ts`). 운영 일관성 — AQG가 사용하는
 * parser 경로와 평가 경로가 동일해야 평가 결과가 운영 동작을 그대로 예측한다.
 *
 * 책임 분리:
 *  - MT1: JSON.parse 성공 여부만 확인 (배열/숫자 등도 valid JSON으로 본다)
 *  - MT2: 파싱된 객체가 zod 스키마를 통과하는지 (zod-schema.ts)
 *  - MT3: 출력 텍스트의 Oracle 토큰이 화이트리스트에 있는지 (scope-whitelist.ts)
 *  - MT4: blank-typing의 ___ 개수와 답 일관성 (blank-consistency.ts)
 */
export default async function jsonParseAssertion(
  output: string,
  _context: AssertionContext,
): Promise<AssertionResult> {
  const parsed = extractJson(output);
  if (!parsed.ok) {
    return {
      pass: false,
      score: 0,
      reason: `MT1 fail — ${parsed.reason}`,
    };
  }
  return {
    pass: true,
    score: 1,
    reason: 'MT1 pass — JSON 파싱 성공',
  };
}
