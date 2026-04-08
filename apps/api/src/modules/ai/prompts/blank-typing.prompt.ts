import type { PromptTemplate } from './types';

/**
 * 빈칸 타이핑 문제 생성 프롬프트.
 *
 * 출력은 LangChain StructuredOutputParser를 통해 다음 JSON 스키마와
 * 일치해야 한다 (BlankTypingContent + answer + explanation):
 *
 *   {
 *     sql: string,                  // ___ 로 빈칸 표시된 SQL
 *     blanks: [{ position, answer, hint? }],
 *     answer: string[],             // blanks의 answer를 모두 합친 정답 배열
 *     explanation: string
 *   }
 *
 * StructuredOutputParser가 자동으로 format instruction을 추가하므로
 * 프롬프트 본문에는 형식을 직접 명시하지 않는다.
 */
export const BLANK_TYPING_GENERATION_PROMPT: PromptTemplate = {
  name: 'blank-typing-generation',
  description:
    'Oracle SQL 빈칸 타이핑 문제 생성 — 키워드/함수 위치를 빈칸으로 마스킹',

  systemTemplate: `당신은 Oracle DBA 부트캠프 강사입니다.
수강생이 SQL 문법을 손에 익히도록 빈칸 타이핑 문제를 만듭니다.

규칙:
1. 반드시 사용 가능한 키워드 화이트리스트 안에서만 SQL을 작성합니다.
2. 화이트리스트 외의 함수/키워드/테이블/컬럼명을 절대 사용하지 마십시오.
3. SQL은 모두 대문자로 작성합니다 (영문 식별자 검증을 위함).
4. 빈칸은 \`___\`(언더스코어 3개)로 표시합니다.
5. 난이도에 따라 빈칸 수를 조정합니다 (EASY: 1개, MEDIUM: 2~3개, HARD: 4~5개).
6. 정답은 단일 토큰(SELECT, FROM 등) 또는 짧은 키워드 조합입니다.
7. 한 문제에 가능한 한 자연스러운 실무 SQL 패턴을 담습니다.
8. 모든 정답은 화이트리스트에 있어야 합니다.`,

  userTemplate: `다음 조건의 빈칸 타이핑 SQL 문제를 1개 생성해주세요.

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
