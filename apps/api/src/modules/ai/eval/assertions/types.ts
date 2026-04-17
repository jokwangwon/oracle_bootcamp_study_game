/**
 * promptfoo assertion 공통 타입 (SDD v2 §5.2 + §3.1).
 *
 * 본 모듈은 의도적으로 promptfoo 패키지에 직접 의존하지 않는다.
 *  - assertion을 vitest에서 순수 함수로 단위 테스트할 수 있도록 격리
 *  - promptfoo 버전 변경 시 contract 변경 점만 본 파일에 한정
 *  - assertion 7개의 입력/출력 모양을 단일 진실 소스로 고정
 *
 * promptfoo 런타임이 호출 시 넘겨주는 context와 본 타입의 매핑:
 *   promptfoo `output: string`             → AssertionFn 인자 #1 (`output`)
 *   promptfoo `context.prompt: string`     → `AssertionContext.prompt`
 *   promptfoo `context.vars: object`       → `AssertionContext.vars` (Gold Set entry vars)
 *   promptfoo `context.latencyMs: number`  → `AssertionContext.latencyMs` (MT5)
 *
 * 반환 모양은 promptfoo `GradingResult`와 동일하게 유지한다.
 */

import type { Difficulty, GameModeId, Topic } from '@oracle-game/shared';

/**
 * Gold Set A/B의 EvalDatasetEntry.vars와 1:1 대응.
 * promptfoo가 testCase.vars로 assertion에 전달.
 */
export interface AssertionVars {
  topic: Topic;
  week: number;
  difficulty: Difficulty;
  /** 누적 화이트리스트 (대문자 보장) */
  allowedKeywords: string[];
  /** 시드 question.answer[0]. 평가 prompt가 중심 토큰으로 사용 */
  seedFocusKeyword: string;
  /**
   * gameMode는 EvalDatasetEntry의 최상위 필드지만 assertion에서도 자주 분기에
   * 필요해 vars에도 함께 주입한다. promptfoo 측 testCase 변환 시 채워준다.
   */
  gameMode: GameModeId;
}

export interface AssertionContext {
  prompt: string;
  vars: AssertionVars;
  /** MT5 latency assertion이 사용. promptfoo가 wall-clock 측정값을 채움 */
  latencyMs?: number;
}

/**
 * promptfoo `GradingResult`와 동일한 모양.
 *
 * - pass: 합격 여부
 * - score: 0..1. boolean assertion은 pass면 1, 아니면 0
 * - reason: 사람이 읽을 수 있는 짧은 설명 (실패 시 디버깅 핵심)
 */
export interface AssertionResult {
  pass: boolean;
  score: number;
  reason: string;
}

export type AssertionFn = (
  output: string,
  context: AssertionContext,
) => AssertionResult | Promise<AssertionResult>;
