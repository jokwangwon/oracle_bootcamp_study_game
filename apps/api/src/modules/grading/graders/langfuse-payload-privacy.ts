/**
 * consensus-007 S6-C2-7 — Langfuse trace payload 학생 식별자 누출 검증 pure helper.
 *
 * ADR-018 §8 금지 6 의 **negative assertion**:
 *   "Langfuse trace/generation/metadata 어디에도 userId 파생정보가 없어야 한다"
 *
 * 사용처:
 *  - **단위 테스트**: 특정 payload 예시에 대해 위반 패턴 리스트를 확정적으로 검증.
 *  - **E2E nightly (OLLAMA_INTEGRATION=true)**: 실 Ollama 호출 시 Langfuse super 에게
 *    전달된 payload 전수 캡처 → assertNoUserIdentifiers → 0건.
 *
 * 본 함수는 "정상 텍스트가 우연히 패턴에 맞는 false positive" 보다 "회귀 시 놓치는
 * false negative" 쪽을 더 경계한다. 식별 가능성이 있는 모든 패턴을 폭넓게 검출.
 */

const USER_IDENTIFIER_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: 'user_token_hash-key', regex: /user[_-]?token[_-]?hash/i },
  { name: 'userTokenHash-camel', regex: /userTokenHash/ },
  { name: 'userId-key', regex: /user[_-]?id\s*[:=]/i },
  { name: 'userid-equals', regex: /\buserId\s*=/ },
  // 전형적 userId 토큰: user-{숫자/hex} 시퀀스
  { name: 'user-dash-token', regex: /\buser-[a-zA-Z0-9]{3,}\b/ },
  // 32 hex chars 연속 — raw sha256 의 앞/뒤 절반. 16 hex (hashUserToken 결과) 도 포함 가능
  // 하지만 일반 uuid 도 12 hex 블록이 있으므로 최소 32 만 탐지.
  { name: 'hex-32', regex: /\b[a-f0-9]{32}\b/ },
  // email 패턴
  { name: 'email', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];

export interface PrivacyViolation {
  pattern: string;
  matchedSnippet: string;
}

/**
 * 하나 이상의 텍스트 blob 에서 학생 식별자 패턴을 찾아 반환.
 * 반환 배열이 비어있으면 privacy-safe. 비어있지 않으면 Langfuse 전송 금지.
 */
export function findUserIdentifierLeaks(textBlobs: readonly string[]): PrivacyViolation[] {
  const violations: PrivacyViolation[] = [];
  for (const blob of textBlobs) {
    if (typeof blob !== 'string' || blob.length === 0) continue;
    for (const { name, regex } of USER_IDENTIFIER_PATTERNS) {
      const m = regex.exec(blob);
      if (m) {
        const start = Math.max(0, (m.index ?? 0) - 10);
        const end = Math.min(blob.length, (m.index ?? 0) + m[0].length + 10);
        violations.push({
          pattern: name,
          matchedSnippet: blob.slice(start, end),
        });
      }
    }
  }
  return violations;
}

/**
 * 편의 wrapper — 위반이 있으면 throw. E2E 테스트에서 assert 용.
 */
export function assertNoUserIdentifiers(textBlobs: readonly string[]): void {
  const violations = findUserIdentifierLeaks(textBlobs);
  if (violations.length > 0) {
    const summary = violations
      .map((v) => `${v.pattern}: "${v.matchedSnippet}"`)
      .join('; ');
    throw new Error(
      `Langfuse payload privacy violation (ADR-018 §8 금지 6): ${summary}`,
    );
  }
}
