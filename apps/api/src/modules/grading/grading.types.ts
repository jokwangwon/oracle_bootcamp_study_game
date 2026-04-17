/**
 * ADR-013 — 역피라미드 3단 채점 타입.
 *
 * Layer 1 AST → Layer 2 Keyword → Layer 3 LLM-judge. 상위 Layer에서 결정되면
 * 하위 Layer 호출은 skip. 모든 grader는 다음 verdict 중 하나를 반환:
 *   - PASS: 확정 정답
 *   - FAIL: 확정 오답
 *   - UNKNOWN: 이 Layer로는 판정 불가 → 다음 Layer 호출
 *
 * 최종 결과(GradingResult)는 GradingOrchestrator가 여러 Layer 결과를 합쳐 조립.
 *
 * 주의:
 *  - grading_method 'llm-v{N}' 은 Langfuse prompt 버전 바뀔 때마다 증가
 *  - grader_digest: AST/keyword는 harness_version 문자열, LLM은 모델 sha256
 *    (ADR-011 pin 재사용)
 */

export type GradingVerdict = 'PASS' | 'FAIL' | 'UNKNOWN';

export type GradingMethod =
  | 'ast'
  | 'keyword'
  | 'llm'
  | 'held'
  | 'admin-override';

/** 역피라미드 경로. Layer 1만 사용 시 [1], Layer 3까지 사용 시 [1,2,3]. */
export type GradingLayerPath = number[];

/**
 * Layer 1 AST 파싱이 UNKNOWN을 반환한 구조적 사유.
 * Session 3: 기록만(행동 분기 없음). Session 4+ Rewriter/에러 분기 때 행동 분기에 사용.
 *   - dialect_unsupported: 파서가 Oracle 전용 구문(CONNECT BY/(+)/LISTAGG/MERGE 등)으로 throw
 *   - truly_invalid_syntax: Oracle 방언 의심 키워드 없이 파싱 실패 (진짜 문법 오류 의심)
 *   - empty_answer: 공백·주석 제거 후 의미 있는 SQL 토큰이 없음
 *   - non_sql_block: PL/SQL 블록(BEGIN...END;) 등 채점 범위 외
 */
export type AstFailureReason =
  | 'dialect_unsupported'
  | 'truly_invalid_syntax'
  | 'empty_answer'
  | 'non_sql_block';

/**
 * 단일 Layer의 판정 결과 (Orchestrator가 합성 전).
 */
export interface LayerVerdict {
  verdict: GradingVerdict;
  /** 0.0 ~ 1.0. UNKNOWN이면 undefined 허용 */
  confidence?: number;
  /** 디버깅용 짧은 사람 가독 근거 */
  rationale: string;
  /** 이 Layer가 적용된 harness 버전 또는 모델 digest */
  graderDigest: string;
  /** Layer 1 AST grader가 UNKNOWN 반환 시 분류. 다른 Layer는 undefined. */
  astFailureReason?: AstFailureReason;
}

/**
 * Orchestrator가 반환하는 최종 채점 결과. answer_history 컬럼과 1:1 매핑.
 */
export interface GradingResult {
  isCorrect: boolean;
  /** 0.0 ~ 1.0. all-or-nothing Layer는 1.0 또는 0.0 */
  partialScore: number;
  gradingMethod: GradingMethod;
  graderDigest: string;
  gradingLayersUsed: GradingLayerPath;
  /** 사람 가독 근거. 복수 Layer 결합 시 '|'로 연결 */
  rationale: string;
  /** Sanitizer 플래그 (의심 입력/truncated 등). 감사용 */
  sanitizationFlags?: string[];
  /**
   * Layer 1 AST grader가 UNKNOWN을 반환해 Layer 2/3로 강등됐을 때의 사유.
   * MT8 집계 필터 및 감사 로그에서 "파서 한계" 샘플을 분리하는 용도.
   */
  astFailureReason?: AstFailureReason;
}
