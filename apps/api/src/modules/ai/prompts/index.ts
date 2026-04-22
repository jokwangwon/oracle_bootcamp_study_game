import type { GameModeId } from '@oracle-game/shared';

import { BLANK_TYPING_GENERATION_PROMPT } from './blank-typing.prompt';
import { EVALUATION_FREE_FORM_SQL_PROMPT } from './evaluation-free-form-sql.prompt';
import { MULTIPLE_CHOICE_GENERATION_PROMPT } from './multiple-choice.prompt';
import { TERM_MATCH_GENERATION_PROMPT } from './term-match.prompt';
import type { PromptTemplate } from './types';

/**
 * 게임 모드 → 생성 프롬프트 매핑.
 *
 * 새 모드를 지원할 때는 여기에 추가하면 PromptManager가 자동으로 인식한다.
 */
export const GENERATION_PROMPTS_BY_MODE: Partial<
  Record<GameModeId, PromptTemplate>
> = {
  'blank-typing': BLANK_TYPING_GENERATION_PROMPT,
  'term-match': TERM_MATCH_GENERATION_PROMPT,
  'multiple-choice': MULTIPLE_CHOICE_GENERATION_PROMPT,
};

/**
 * 평가(Layer 3 LLM-judge) 전용 프롬프트 — 이름 기반 lookup.
 * 생성용 프롬프트와 namespace 분리.
 */
export const EVALUATION_PROMPTS_BY_NAME: Record<string, PromptTemplate> = {
  [EVALUATION_FREE_FORM_SQL_PROMPT.name]: EVALUATION_FREE_FORM_SQL_PROMPT,
};

export { EVALUATION_FREE_FORM_SQL_PROMPT };
export type { PromptTemplate } from './types';
