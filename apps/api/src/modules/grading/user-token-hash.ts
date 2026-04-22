import { createHmac } from 'node:crypto';

/**
 * ADR-016 §7 + consensus-005 §커밋2 — `user_token_hash` 생성 유틸.
 *
 * HMAC-SHA256(salt, userId) → hex 16 chars.
 *
 * 목적:
 *  - Langfuse trace metadata 에 평문 userId 저장 금지. 대신 salted hash 저장
 *    → 외부 SaaS 에 학생 식별자 직접 노출 방지
 *  - HMAC (not bare sha256) — rainbow table 공격 방어 (Agent B 지적)
 *  - per-env salt — 개발/스테이징/운영 트레이스 교차 추적 차단
 *
 * 비목적:
 *  - userId 자체 암호화 (복호화 필요 없음 — 한 방향 해시)
 *  - 장기 저장(DB) — 운영자가 salt rotation 하면 과거 hash 무효화 가능(ADR-018 예정).
 *    장기 저장은 `answer_history.user_token_hash` 에 저장하되 rotation 시점 명시.
 *
 * fail-closed:
 *  - salt 가 비어있거나 undefined → throw. 실수로 빈 salt 로 해시하면
 *    여러 환경의 동일 userId 가 같은 hash 를 얻어 격리가 깨진다.
 */
export const USER_TOKEN_HASH_LENGTH = 16;

export function hashUserToken(userId: string, salt: string): string {
  if (typeof salt !== 'string' || salt.length < 16) {
    throw new Error(
      'hashUserToken: salt 은 최소 16자 이상 문자열이어야 합니다 (ADR-016 §7 fail-closed).',
    );
  }
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('hashUserToken: userId 가 비어있습니다.');
  }
  return createHmac('sha256', salt)
    .update(userId)
    .digest('hex')
    .slice(0, USER_TOKEN_HASH_LENGTH);
}
