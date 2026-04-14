/**
 * Oracle SQL 식별자(키워드, 함수명, 컬럼/타입) 추출 유틸.
 *
 * 사용처:
 *  1. apps/api/src/modules/content/services/scope-validator.service.ts
 *     — 런타임 화이트리스트 검증 (학습 범위 이탈 차단)
 *  2. apps/api/src/modules/content/seed/seed.data.test.ts
 *     — 시드 데이터 빌드 전 정합성 검증
 *  3. apps/api/src/modules/ai/eval/assertions/blank-consistency.ts
 *     — OSS 모델 평가 메트릭 MT4 (SDD v2 §3.1)
 *
 * 세 곳에서 동일한 규칙을 써야 하므로 본 모듈로 단일화한다.
 *
 * 정책:
 *  - 첫 글자가 대문자(`A-Z`)이고
 *  - 그 뒤가 대문자/숫자/언더스코어 1자 이상
 *  - 즉 2글자 이상의 대문자 식별자만 후보로 본다
 *  - **문자열 리터럴(`'...'`, `"..."`) 내부는 토큰 추출 대상에서 제외**
 *    (Oracle에서 작은따옴표는 문자열, 큰따옴표는 대소문자 보존 식별자. 둘 다
 *    "학습 범위 검증" 대상이 아닌 데이터/특수 케이스이므로 제외.)
 *
 * 통과 예: SELECT, FROM, ROW_NUMBER, VARCHAR2, T1
 * 미통과 예: select(소문자), I(1글자), SelectStatement(camelCase), 가나다(한글),
 *           'MANAGER'(문자열 리터럴 내부), '1980-01-01'(동)
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §3.1 MT4 + 단계 0)
 */
export const ORACLE_TOKEN_REGEX = /\b[A-Z][A-Z_0-9]{1,}\b/g;

const STRING_LITERAL_REGEX = /'[^']*'|"[^"]*"/g;

/**
 * 텍스트에서 Oracle 식별자 후보를 모두 추출한다.
 *
 * @param text 검사 대상 문자열 (SQL, 설명문, 정답 등)
 * @returns 추출된 토큰 배열. 중복은 제거하지 않는다 — 호출 측이 필요에 따라 Set 사용.
 *
 * @example
 * extractOracleTokens('SELECT name FROM users')
 * // → ['SELECT', 'FROM']
 */
export function extractOracleTokens(text: string): string[] {
  const withoutLiterals = text.replace(STRING_LITERAL_REGEX, '');
  return withoutLiterals.match(ORACLE_TOKEN_REGEX) ?? [];
}
