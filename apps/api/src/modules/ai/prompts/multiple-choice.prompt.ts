import type { PromptTemplate } from './types';

/**
 * 객관식 문제 생성 프롬프트 (ADR-012 Mode 6).
 *
 * 출력은 StructuredOutputParser 를 통해 다음 JSON 스키마와 일치해야 한다
 * (multipleChoiceOutputSchema):
 *
 *   {
 *     stem: string,                    // 문제 지문 (Korean, SQL 단편 포함 가능)
 *     options: [{ id, text }],         // 4개 기본, id는 'A'|'B'|'C'|'D'
 *     correctOptionIds: string[],      // 정답 option id 목록
 *     allowMultiple?: boolean,         // 기본 false
 *     explanation: string              // 해설
 *   }
 *
 * StructuredOutputParser 가 자동으로 format instruction 을 주입하므로
 * 프롬프트 본문에는 형식을 직접 명시하지 않는다.
 *
 * distractor 품질 (ADR-017 §주의사항 — Agent C 제안):
 *  - 명백 오답(의미 없는 문자열, 관련 없는 용어) 금지
 *  - 길이를 비슷하게 맞춰 정답 길이 단서 차단
 *  - 화이트리스트 외 용어 금지
 */
export const MULTIPLE_CHOICE_GENERATION_PROMPT: PromptTemplate = {
  name: 'multiple-choice-generation',
  description:
    'Oracle SQL/DBA 객관식 문제 생성 — 4지선다 기본, stem + options + correctOptionIds',

  systemTemplate: `당신은 Oracle DBA 부트캠프 강사입니다.
SQLD 시험 대비 객관식 문제를 만듭니다.

규칙:
1. 반드시 주어진 키워드 화이트리스트 안에서만 문제를 작성합니다.
2. 화이트리스트 외의 함수/키워드/테이블/컬럼명을 절대 사용하지 마십시오.
3. SQL 식별자는 모두 대문자로 작성합니다.
4. stem(문제 지문)은 한국어로 작성하며, 필요한 경우에만 SQL 단편을 포함합니다.
5. options는 **정확히 4개** 생성하고, id는 'A', 'B', 'C', 'D'를 순서대로 사용합니다.
6. 정답(correctOptionIds)은 기본적으로 **1개**입니다. 복수 정답이 필요한 경우에만
   allowMultiple을 true로 설정하고 2~3개를 지정합니다.
7. distractor(오답 보기) 품질 규칙:
   - 명백한 오답(의미 없는 문자열, 관련 없는 용어) 금지
   - 각 보기의 길이를 비슷하게 맞춰 길이로 정답을 유추하지 못하게 합니다
   - 자주 혼동되는 개념/구문을 distractor로 사용합니다
   - 모든 보기 텍스트가 화이트리스트 안에 있어야 합니다
8. explanation은 정답이 왜 정답인지, 그리고 주요 오답이 왜 오답인지 간결히 설명합니다.
9. 난이도에 따라 조절합니다:
   - EASY: 단일 키워드/개념 식별
   - MEDIUM: 문법 적용, 두 개념 비교
   - HARD: 실행 결과 예측, 여러 개념 통합`,

  userTemplate: `다음 조건의 객관식 문제를 1개 생성해주세요.

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
