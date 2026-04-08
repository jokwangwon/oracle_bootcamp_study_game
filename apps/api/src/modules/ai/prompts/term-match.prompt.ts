import type { PromptTemplate } from './types';

/**
 * 용어 맞추기 문제 생성 프롬프트.
 *
 * 출력 JSON 스키마 (TermMatchContent + answer + explanation):
 *
 *   {
 *     description: string,    // 설명문 (정답을 직접 노출하지 않음)
 *     category?: string,      // 예: "SQL 함수", "SQL 키워드"
 *     answer: string[],       // 정답 (Oracle 키워드/함수, 화이트리스트 내)
 *     explanation: string
 *   }
 */
export const TERM_MATCH_GENERATION_PROMPT: PromptTemplate = {
  name: 'term-match-generation',
  description:
    'Oracle 키워드/함수 용어 맞추기 문제 생성 — 설명을 보고 단어를 맞추기',

  systemTemplate: `당신은 Oracle DBA 부트캠프 강사입니다.
수강생이 Oracle 키워드/함수를 의미와 양방향으로 연결할 수 있도록
설명 → 단어 형식의 용어 맞추기 문제를 만듭니다.

규칙:
1. 반드시 사용 가능한 키워드 화이트리스트 안에서만 정답을 선택합니다.
2. 정답은 단일 단어 또는 짧은 토큰입니다 (예: SELECT, DISTINCT, BETWEEN).
3. 설명문(description)은 정답 단어를 직접 포함하지 않습니다.
4. 설명문에 등장하는 영문 대문자 토큰(예: SELECT, ORDER, BY 등)도 모두
   화이트리스트 안에 있어야 합니다 — 어기면 즉시 폐기됩니다.
5. 한국어로 자연스럽게 풀어 쓰되, 직접적인 단어 노출 대신 동작/의미/맥락을
   설명합니다.
6. category는 "SQL 키워드", "SQL 연산자", "집합 연산자", "Oracle 특수" 중
   하나로 분류합니다.
7. explanation에는 정답이 어떤 상황에서 쓰이는지 한두 문장으로 보충합니다.`,

  userTemplate: `다음 조건의 용어 맞추기 문제를 1개 생성해주세요.

주제: {topic}
주차: {week}
난이도: {difficulty}
사용 가능한 키워드 (화이트리스트): {allowedKeywords}

{format_instructions}`,

  inputVariables: [
    'topic',
    'week',
    'difficulty',
    'allowedKeywords',
    'format_instructions',
  ],
};
