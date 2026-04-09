import { StructuredOutputParser } from '@langchain/core/output_parsers';

import { BLANK_TYPING_GENERATION_PROMPT } from '../../prompts/blank-typing.prompt';
import { TERM_MATCH_GENERATION_PROMPT } from '../../prompts/term-match.prompt';
import {
  blankTypingOutputSchema,
  termMatchOutputSchema,
} from '../output-schemas';

/**
 * 평가 prompt 빌더 (SDD v2 §4.1 + §5.3).
 *
 * 책임:
 *   Gold Set entry vars(topic/week/difficulty/allowedKeywords/seedFocusKeyword/gameMode)를
 *   받아 운영 코드(`AiQuestionGenerator`)와 동일한 system+user 메시지 prompt를
 *   JSON-encoded multi-message 문자열로 반환한다.
 *
 * promptfoo 사용 예:
 *   prompts:
 *     - id: eval-prompt
 *       file: file://prompts/build-eval-prompt.ts
 *       function: buildEvalPromptForPromptfoo
 *
 * 반환 형식 — `langfuse-wrapped.ts`의 parsePromptToMessages가 자동 파싱:
 *   '[{"role":"system","content":"..."},{"role":"user","content":"..."}]'
 *
 * 운영 일관성 (SDD v2 §7.2 v2.3):
 *  - 동일 PromptTemplate (BLANK_TYPING_GENERATION_PROMPT / TERM_MATCH_GENERATION_PROMPT)
 *  - 동일 StructuredOutputParser format_instructions
 *  - 동일 변수 치환 ({topic}, {week}, {difficulty}, {allowedKeywords}, {format_instructions})
 *  - **차이점**: 평가는 운영의 자유 생성에 더해 `seedFocusKeyword`로 중심 토큰을 강제.
 *    평가 환경에서 모델이 "어떤 키워드든 골라서" 문제를 만들면 라운드 간 비교가 불가능해
 *    운영보다 한 줄을 추가해 중심 토큰을 명시한다 (SDD v2 §4.1 Recall 트랙 정의).
 */

export interface EvalPromptVars {
  topic: string;
  week: number;
  difficulty: string;
  allowedKeywords: readonly string[];
  seedFocusKeyword: string;
  gameMode: 'blank-typing' | 'term-match';
}

// format_instructions는 schema에만 의존하므로 모듈 로드 시점에 1회 계산.
// StructuredOutputParser는 fromZodSchema가 깊은 generic을 만들어 TS2589
// 위험이 있으므로 AQG와 동일하게 any 캐스팅으로 우회 (오직 generic만 회피).
function makeFormatInstructions(gameMode: 'blank-typing' | 'term-match'): string {
  const schema =
    gameMode === 'blank-typing' ? blankTypingOutputSchema : termMatchOutputSchema;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = StructuredOutputParser.fromZodSchema(schema as any);
  return parser.getFormatInstructions();
}

const FORMAT_INSTRUCTIONS_BY_MODE = {
  'blank-typing': makeFormatInstructions('blank-typing'),
  'term-match': makeFormatInstructions('term-match'),
} as const;

function getPromptTemplate(gameMode: 'blank-typing' | 'term-match') {
  return gameMode === 'blank-typing'
    ? BLANK_TYPING_GENERATION_PROMPT
    : TERM_MATCH_GENERATION_PROMPT;
}

/**
 * 변수 치환 — LangChain ChatPromptTemplate의 {var} 문법과 동일하게.
 * promptfoo는 자체 mustache를 가지지만 본 함수는 LangChain 호환 단순 치환을
 * 직접 수행해 LangChain 의존을 피한다.
 */
function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`build-eval-prompt: 미정의 변수 '${key}' (template 변수와 vars 불일치)`);
    }
    return value;
  });
}

/**
 * 운영 system/user prompt를 평가용으로 렌더링한다.
 * 반환: { system: string; user: string }
 */
export function renderEvalMessages(vars: EvalPromptVars): {
  system: string;
  user: string;
} {
  const tpl = getPromptTemplate(vars.gameMode);
  const formatInstructions = FORMAT_INSTRUCTIONS_BY_MODE[vars.gameMode];

  const system = tpl.systemTemplate;

  const userBase = substitute(tpl.userTemplate, {
    topic: vars.topic,
    week: String(vars.week),
    difficulty: vars.difficulty,
    allowedKeywords: vars.allowedKeywords.join(', '),
    format_instructions: formatInstructions,
  });

  // 평가 차이점: 중심 토큰 강제 (SDD §4.1)
  const focusLine =
    vars.gameMode === 'blank-typing'
      ? `\n\n*** 평가 지시 ***\n이번 문제의 정답에는 반드시 \`${vars.seedFocusKeyword}\`가 포함되어야 합니다.`
      : `\n\n*** 평가 지시 ***\n이번 용어 문제의 정답은 반드시 \`${vars.seedFocusKeyword}\`이어야 합니다.`;

  return { system, user: userBase + focusLine };
}

/**
 * promptfoo가 호출하는 entry point.
 *
 * promptfoo는 prompt function을 다음 시그니처로 호출한다:
 *   (context: { vars: Record<string, unknown> }) => string | Promise<string>
 *
 * 반환은 JSON-encoded message array — `parsePromptToMessages`가 자동 파싱.
 */
export default function buildEvalPromptForPromptfoo(context: {
  vars: Record<string, unknown>;
}): string {
  const v = context.vars as Partial<EvalPromptVars>;
  if (
    typeof v.topic !== 'string' ||
    typeof v.week !== 'number' ||
    typeof v.difficulty !== 'string' ||
    !Array.isArray(v.allowedKeywords) ||
    typeof v.seedFocusKeyword !== 'string' ||
    (v.gameMode !== 'blank-typing' && v.gameMode !== 'term-match')
  ) {
    throw new Error(
      `build-eval-prompt: vars 필수 필드 누락/오류 — received keys: ${Object.keys(v).join(', ')}`,
    );
  }
  const { system, user } = renderEvalMessages({
    topic: v.topic,
    week: v.week,
    difficulty: v.difficulty,
    allowedKeywords: v.allowedKeywords as string[],
    seedFocusKeyword: v.seedFocusKeyword,
    gameMode: v.gameMode,
  });
  return JSON.stringify([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
}
