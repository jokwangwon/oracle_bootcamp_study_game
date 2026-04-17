import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT_MC — 객관식 옵션 일관성 (ADR-012 §구현 범위 7 + ADR-017).
 *
 * multiple-choice 모드 전용 계산적 게이트. AiQuestionGenerator의 3중 검증
 * (options id 고유 + correctOptionIds ⊆ options id + allowMultiple 제약)과
 * 동일한 논리를 평가 단계에서 재사용해 운영/평가 일관성을 보장한다.
 *
 * 검증 항목:
 *  1. options.length >= 2
 *  2. options[].id 고유
 *  3. correctOptionIds.length >= 1
 *  4. correctOptionIds ⊆ options[].id
 *  5. allowMultiple=false(또는 미지정) 시 correctOptionIds.length === 1
 *
 * multiple-choice 이외 모드는 본 메트릭 비대상 — 자동 pass.
 *
 * **distractor 품질(명백 오답 금지, 길이 균등)은 별도 assertion으로 후속 추가**
 * (ADR-017 §주의사항 — Agent C 제안). 본 assertion은 구조적 무결성만 검증.
 */

interface OptionShape {
  id?: unknown;
  text?: unknown;
}

export default async function mcOptionConsistencyAssertion(
  output: string,
  context: AssertionContext,
): Promise<AssertionResult> {
  const gameMode = context.vars.gameMode;
  if (gameMode !== 'multiple-choice') {
    return {
      pass: true,
      score: 1,
      reason: `MT_MC skip — ${gameMode}는 본 메트릭 비대상`,
    };
  }

  const parsed = extractJson(output);
  if (!parsed.ok) {
    return {
      pass: false,
      score: 0,
      reason: `MT_MC fail — JSON 파싱 실패 (${parsed.reason})`,
    };
  }

  const value = parsed.value as Record<string, unknown>;
  const options = value.options;
  const correctOptionIds = value.correctOptionIds;
  const allowMultiple = Boolean(value.allowMultiple);

  if (!Array.isArray(options) || options.length < 2) {
    return {
      pass: false,
      score: 0,
      reason: `MT_MC fail — options 길이 ${Array.isArray(options) ? options.length : 'N/A'} < 2`,
    };
  }

  const ids: string[] = [];
  for (const o of options as OptionShape[]) {
    if (typeof o.id !== 'string' || typeof o.text !== 'string') {
      return {
        pass: false,
        score: 0,
        reason: 'MT_MC fail — options[]의 id/text가 문자열이 아님',
      };
    }
    ids.push(o.id);
  }

  if (new Set(ids).size !== ids.length) {
    return {
      pass: false,
      score: 0,
      reason: `MT_MC fail — options[].id 중복 (${ids.join(',')})`,
    };
  }

  if (!Array.isArray(correctOptionIds) || correctOptionIds.length < 1) {
    return {
      pass: false,
      score: 0,
      reason: 'MT_MC fail — correctOptionIds가 비어있거나 배열이 아님',
    };
  }

  for (const id of correctOptionIds) {
    if (typeof id !== 'string' || !ids.includes(id)) {
      return {
        pass: false,
        score: 0,
        reason: `MT_MC fail — correctOptionIds에 options에 없는 id: ${String(id)}`,
      };
    }
  }

  if (!allowMultiple && correctOptionIds.length !== 1) {
    return {
      pass: false,
      score: 0,
      reason: `MT_MC fail — allowMultiple=false인데 단일 정답 아님 (정답 ${correctOptionIds.length}개)`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: `MT_MC pass — options ${ids.length}개 + 정답 ${correctOptionIds.length}개 일관성 OK`,
  };
}
