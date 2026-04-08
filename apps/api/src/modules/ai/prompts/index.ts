import type { GameModeId } from '@oracle-game/shared';

import { BLANK_TYPING_GENERATION_PROMPT } from './blank-typing.prompt';
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
};

export type { PromptTemplate } from './types';
