import {
  blankTypingOutputSchema,
  termMatchOutputSchema,
} from '../output-schemas';
import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT2 — Zod 스키마 통과율 (SDD v2 §3.1).
 *
 * 합격선 C2 ≥ 95%. promptfoo가 단일 호출 결과를 집계.
 *
 * 운영 일관성 — 본 assertion은 `eval/output-schemas.ts`의 동일 schema를
 * `AiQuestionGenerator`(운영)와 공유한다. 평가에서 fail이면 운영 코드도 reject.
 */
export default async function zodSchemaAssertion(
  output: string,
  context: AssertionContext,
): Promise<AssertionResult> {
  const parsed = extractJson(output);
  if (!parsed.ok) {
    return {
      pass: false,
      score: 0,
      reason: `MT2 fail — ${parsed.reason}`,
    };
  }

  const gameMode = context.vars.gameMode;
  const schema =
    gameMode === 'blank-typing'
      ? blankTypingOutputSchema
      : gameMode === 'term-match'
        ? termMatchOutputSchema
        : null;

  if (schema === null) {
    return {
      pass: false,
      score: 0,
      reason: `MT2 fail — 지원하지 않는 게임 모드: ${gameMode}`,
    };
  }

  const result = schema.safeParse(parsed.value);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    return {
      pass: false,
      score: 0,
      reason: `MT2 fail — Zod 검증 실패 (${issues})`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: 'MT2 pass — Zod 스키마 통과',
  };
}
