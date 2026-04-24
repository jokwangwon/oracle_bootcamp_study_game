import { Inject, Injectable, Optional } from '@nestjs/common';

import { AnswerSanitizer } from './answer-sanitizer';
import { LlmJudgeTimeoutError } from './graders/llm-judge.grader';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import type {
  GradingLayerPath,
  GradingMethod,
  GradingResult,
  GradingVerdict,
  LayerVerdict,
} from './grading.types';

/**
 * ADR-013 — 역피라미드 3단 채점 오케스트레이터.
 *
 * 현재 상태 (MVP-B Session 2):
 *  - Layer 2 (Keyword) 는 실 구현 연결
 *  - Layer 1 (AST) 와 Layer 3 (LLM) 은 DI 토큰으로 주입 받되, 미구현 시
 *    기본 구현이 UNKNOWN 반환 → 자연스럽게 Layer 2 / held 로 이관
 *  - 후속 세션에서 실제 AstCanonicalGrader / LlmJudgeGrader 교체 시 본 API 변경 없음
 *
 * 순서 (ADR-013):
 *   sanitize → Layer 1 → (UNKNOWN 시) Layer 2 → (UNKNOWN 시) Layer 3
 *   → (모두 UNKNOWN 시) gradingMethod='held'
 *
 * 반환 GradingResult는 answer_history의 채점 메타 컬럼 4개와 1:1 대응.
 */

export const ORCHESTRATOR_VERSION = 'orchestrator-v1';

export const LAYER_1_GRADER = Symbol('LAYER_1_GRADER');
export const LAYER_3_GRADER = Symbol('LAYER_3_GRADER');

export interface GradeInput {
  studentAnswer: string;
  expected: readonly string[];
  /** 주차 화이트리스트 (대문자 정규화 권장) */
  allowlist: readonly string[];
  /**
   * ADR-016 §7 + ADR-018 §4 D3 Hybrid + consensus-007 C2-1.
   *
   * Layer 3 LLM-judge 호출 시 Langfuse trace metadata 의 `session_id` 키로 전파.
   * Layer 1/2 는 LLM 을 호출하지 않으므로 사용하지 않는다.
   */
  sessionId?: string;
}

export interface Layer1Grader {
  grade(input: {
    studentAnswer: string;
    expected: readonly string[];
  }): LayerVerdict | Promise<LayerVerdict>;
}

export interface Layer3Grader {
  grade(input: {
    studentAnswer: string;
    expected: readonly string[];
    sanitizationFlags: readonly string[];
    sessionId?: string;
  }): Promise<LayerVerdict>;
}

/**
 * Layer 1/3 기본 구현 — 모두 UNKNOWN 반환. 후속 세션에서 실제 구현 주입.
 */
export const DEFAULT_LAYER_1_GRADER: Layer1Grader = {
  grade: () => ({
    verdict: 'UNKNOWN',
    rationale: 'Layer 1 AST grader not implemented (MVP-B pending)',
    graderDigest: 'ast-not-implemented',
  }),
};

export const DEFAULT_LAYER_3_GRADER: Layer3Grader = {
  grade: async () => ({
    verdict: 'UNKNOWN',
    rationale: 'Layer 3 LLM judge not implemented (MVP-B pending)',
    graderDigest: 'llm-not-implemented',
  }),
};

@Injectable()
export class GradingOrchestrator {
  constructor(
    private readonly sanitizer: AnswerSanitizer,
    private readonly keywordGrader: KeywordCoverageGrader,
    @Optional()
    @Inject(LAYER_1_GRADER)
    private readonly layer1: Layer1Grader = DEFAULT_LAYER_1_GRADER,
    @Optional()
    @Inject(LAYER_3_GRADER)
    private readonly layer3: Layer3Grader = DEFAULT_LAYER_3_GRADER,
  ) {}

  /**
   * 채점 메인 진입점 — 역피라미드 3단.
   *
   * ## throw 계약 (PR #15 consensus-007 사후 검증 H3)
   *
   * **정상 경로는 항상 GradingResult 를 반환** (Layer 1/2/3 어떤 조합도
   * `held` 까지 포함하여 resolve). 다음 경우에만 throw:
   *
   *  - `LlmJudgeTimeoutError` — Layer 3 `LLM_JUDGE_TIMEOUT_MS` 초과.
   *    본 Orchestrator 가 `sanitizationFlags` 를 에러에 첨부하여 상위에서
   *    held row 를 완전 감사 체인으로 기록할 수 있도록 한다.
   *
   * 호출자 (현재는 `GameSessionService.gradeFreeForm` 단일) 는 반드시
   * `LlmJudgeTimeoutError` 를 catch 해서:
   *  1. `answer_history` 에 `gradingMethod='held'` row 기록 (ADR-016 §6 WORM)
   *  2. `ops_event_log(kind='llm_timeout')` 기록 (ADR-016 §추가)
   *  3. HTTP 503 응답 (consensus-007 Q3=B)
   *
   * 그 외 모든 예외 (네트워크·파싱 실패 등) 는 grader 내부에서 UNKNOWN
   * verdict 로 흡수되어 Layer 2/3 / held 로 자연스럽게 이관된다.
   */
  async grade(input: GradeInput): Promise<GradingResult> {
    const sanitized = this.sanitizer.sanitize(input.studentAnswer);
    const clean = sanitized.clean;
    const flags = sanitized.flags;

    // Layer 1 (AST) — 항상 호출
    const l1 = await this.layer1.grade({
      studentAnswer: clean,
      expected: input.expected,
    });
    if (l1.verdict !== 'UNKNOWN') {
      return terminal(l1, 'ast', [1], flags);
    }

    // Layer 2 (Keyword) — Layer 1이 UNKNOWN일 때만
    const l2 = this.keywordGrader.grade({
      studentAnswer: clean,
      expected: input.expected,
      allowlist: input.allowlist,
    });
    if (l2.verdict !== 'UNKNOWN') {
      return terminal(l2, 'keyword', [1, 2], flags, l1.rationale, l1.astFailureReason);
    }

    // Layer 3 (LLM) — Layer 1/2가 UNKNOWN일 때만.
    // consensus-007 C2-1: sessionId 전파 — Langfuse metadata.session_id 로만 사용.
    // PR #15 H3: LlmJudgeTimeoutError 는 flags 첨부 후 re-throw (감사 체인 유지).
    let l3: LayerVerdict;
    try {
      l3 = await this.layer3.grade({
        studentAnswer: clean,
        expected: input.expected,
        sanitizationFlags: flags,
        sessionId: input.sessionId,
      });
    } catch (err) {
      if (err instanceof LlmJudgeTimeoutError) {
        err.sanitizationFlags = flags;
      }
      throw err;
    }
    if (l3.verdict !== 'UNKNOWN') {
      return terminal(
        l3,
        'llm',
        [1, 2, 3],
        flags,
        `${l1.rationale} | ${l2.rationale}`,
        l1.astFailureReason,
      );
    }

    // 모두 UNKNOWN → held (관리자 큐 이관)
    return {
      isCorrect: false,
      partialScore: l2.confidence ?? 0,
      gradingMethod: 'held',
      graderDigest: ORCHESTRATOR_VERSION,
      gradingLayersUsed: [1, 2, 3],
      rationale: `${l1.rationale} | ${l2.rationale} | ${l3.rationale} | held for admin review`,
      sanitizationFlags: flags.length > 0 ? flags : undefined,
      astFailureReason: l1.astFailureReason,
    };
  }
}

function terminal(
  verdict: LayerVerdict,
  method: GradingMethod,
  layers: GradingLayerPath,
  flags: string[],
  prevRationale?: string,
  astFailureReason?: LayerVerdict['astFailureReason'],
): GradingResult {
  const isCorrect = isPass(verdict.verdict);
  const partial = resolvePartialScore(verdict.verdict, verdict.confidence);
  const rationale = prevRationale
    ? `${prevRationale} | ${verdict.rationale}`
    : verdict.rationale;
  return {
    isCorrect,
    partialScore: partial,
    gradingMethod: method,
    graderDigest: verdict.graderDigest,
    gradingLayersUsed: layers,
    rationale,
    sanitizationFlags: flags.length > 0 ? flags : undefined,
    astFailureReason,
  };
}

function isPass(v: GradingVerdict): boolean {
  return v === 'PASS';
}

function resolvePartialScore(
  verdict: GradingVerdict,
  confidence: number | undefined,
): number {
  if (verdict === 'PASS') return confidence ?? 1;
  if (verdict === 'FAIL') return confidence ?? 0;
  return confidence ?? 0;
}
