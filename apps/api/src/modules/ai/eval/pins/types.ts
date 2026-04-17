/**
 * Ollama 모델 digest pin 관련 타입.
 *
 * ADR-011 채택 조건 #2 — primary/secondary 모델의 digest를 파일로 고정하여
 * 평가 재현성과 운영 배포 무결성을 보장한다.
 */

export interface OllamaTagsModel {
  name: string;
  digest: string;
  modified_at?: string;
  size?: number;
}

export interface OllamaTagsResponse {
  models: OllamaTagsModel[];
}

export interface ModelPin {
  /** Ollama 모델명 (예: "qwen3-coder-next:latest") */
  model: string;
  /** `/api/tags`가 반환하는 전체 digest (sha256 hex, 접두사 없음) */
  digest: string;
  /** manifest config layer sha256 (선택, `docker exec` 또는 registry로 조회) */
  manifestConfigDigest?: string;
  /** model blob layer sha256 (선택) */
  blobDigest?: string;
  /** pin이 기록된 UTC ISO 시각 */
  addedAt: string;
  /** 근거 평가 라운드 ID (예: "R-2026-04-14T11-32-26Z") */
  evalRound?: string;
  /** 운영자 주석 (ADR 참조 등) */
  notes?: string;
}

export type VerifyResult =
  | { ok: true; pin: ModelPin; currentDigest: string }
  | {
      ok: false;
      reason: 'digest-mismatch' | 'not-pinned' | 'not-found-in-ollama';
      model: string;
      pin?: ModelPin;
      currentDigest?: string;
      message: string;
    };
