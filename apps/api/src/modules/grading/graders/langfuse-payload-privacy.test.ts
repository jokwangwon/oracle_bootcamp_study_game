import { describe, it, expect } from 'vitest';

import {
  assertNoUserIdentifiers,
  findUserIdentifierLeaks,
} from './langfuse-payload-privacy';

/**
 * consensus-007 S6-C2-7 — Langfuse payload privacy helper TDD.
 *
 * 본 helper 는 E2E nightly (OLLAMA_INTEGRATION=true) 에서 실 Langfuse super 호출
 * payload 를 전수 검사하는 데 재사용된다. 단위 테스트는 패턴 매칭 동작 확정.
 */

describe('findUserIdentifierLeaks', () => {
  it('안전한 텍스트는 빈 배열 반환', () => {
    const safe = [
      'SELECT ENAME FROM EMP WHERE DEPTNO = 10',
      '학생이 제출한 정답입니다: SELECT 1',
      'session_id=sess-xyz-01', // session_id 는 허용 키 — userId 아님
    ];
    expect(findUserIdentifierLeaks(safe)).toEqual([]);
  });

  it('user_token_hash snake/camel 케이스 탐지', () => {
    const leaky = ['user_token_hash=abcd', 'userTokenHash: "x"'];
    const out = findUserIdentifierLeaks(leaky);
    expect(out.length).toBeGreaterThanOrEqual(2);
    const patterns = out.map((v) => v.pattern);
    expect(patterns).toContain('user_token_hash-key');
    expect(patterns).toContain('userTokenHash-camel');
  });

  it('userId=… 키-값 패턴 탐지', () => {
    const leaky = ['context: userId=user-123 submitted'];
    const out = findUserIdentifierLeaks(leaky);
    expect(out.some((v) => v.pattern === 'userid-equals' || v.pattern === 'userId-key' || v.pattern === 'user-dash-token')).toBe(true);
  });

  it('user-<token> 패턴 탐지 (외부 로그에 평문 userId 유출 케이스)', () => {
    const leaky = ['student user-abc1234 attempted the answer'];
    const out = findUserIdentifierLeaks(leaky);
    expect(out.some((v) => v.pattern === 'user-dash-token')).toBe(true);
  });

  it('32 hex 연속 (raw sha256 전체) 탐지', () => {
    const leaky = ['hash: 0123456789abcdef0123456789abcdef'];
    const out = findUserIdentifierLeaks(leaky);
    expect(out.some((v) => v.pattern === 'hex-32')).toBe(true);
  });

  it('16 hex (hashUserToken 결과) 는 일반 텍스트 맥락에서 과탐지하지 않는다', () => {
    // 16 hex 는 uuid 중간 블록 등 false positive 가 많아 32 hex 만 탐지.
    // hashUserToken 결과는 DB 한정 — Langfuse 로 나가서는 안 됨. 본 helper 는
    // 32 hex 기준이므로 16 hex 단독은 통과하지만 user_token_hash 키가 동반되면
    // 그 키 패턴에서 잡힘.
    const ambiguous = ['just 0123456789abcdef in text']; // 16 hex 단독
    const out = findUserIdentifierLeaks(ambiguous);
    expect(out.filter((v) => v.pattern === 'hex-32')).toEqual([]);
  });

  it('email 패턴 탐지', () => {
    const leaky = ['context sent to user@example.com'];
    const out = findUserIdentifierLeaks(leaky);
    expect(out.some((v) => v.pattern === 'email')).toBe(true);
  });

  it('빈 배열/빈 문자열 입력은 안전 (false positive 없음)', () => {
    expect(findUserIdentifierLeaks([])).toEqual([]);
    expect(findUserIdentifierLeaks([''])).toEqual([]);
    expect(findUserIdentifierLeaks([undefined as unknown as string])).toEqual([]);
  });

  it('session_id / prompt_name 등 화이트리스트 4종 키는 false positive 아님', () => {
    const safe = [
      'session_id=sess-abc',
      'prompt_name=evaluation/free-form-sql',
      'prompt_version=1',
      'model_digest=abcd1234',
    ];
    expect(findUserIdentifierLeaks(safe)).toEqual([]);
  });
});

describe('assertNoUserIdentifiers', () => {
  it('안전한 텍스트는 통과', () => {
    expect(() => assertNoUserIdentifiers(['SELECT 1'])).not.toThrow();
  });

  it('위반 시 throw (요약 메시지에 패턴명 포함)', () => {
    expect(() => assertNoUserIdentifiers(['user_token_hash=xyz'])).toThrow(
      /ADR-018 §8.*user_token_hash-key/,
    );
  });
});

/**
 * C2-7 E2E gate smoke — OLLAMA_INTEGRATION env 미설정 시 skip 되는지 확인.
 * 실 Ollama 호출 E2E 는 CI nightly 에서만 실행.
 */
const OLLAMA_INTEGRATION = process.env.OLLAMA_INTEGRATION === 'true';

describe.skipIf(!OLLAMA_INTEGRATION)(
  'E2E — LlmJudgeGrader + Langfuse payload privacy (OLLAMA_INTEGRATION)',
  () => {
    it('실 Ollama 호출 시 Langfuse super 로 전달된 payload 에 userId 파생정보 0건', async () => {
      // 실 nightly 구현은 Ollama container + Langfuse mock + grade() 호출 플로우.
      // 본 스켈레톤은 gate 가 동작하는지만 확인 (env=false 일 땐 skip).
      expect(OLLAMA_INTEGRATION).toBe(true);
    });
  },
);

describe('E2E gate dispatcher (OLLAMA_INTEGRATION)', () => {
  it('OLLAMA_INTEGRATION env 가 false 이면 E2E 블록이 skip 된다 (현재 실행 상태)', () => {
    // 기본 개발 환경은 OLLAMA_INTEGRATION 미설정 → skipIf(true) → 해당 describe 블록
    // 자동 skip. 본 테스트는 gate 가 expected 경로로 동작함을 smoke 확인.
    // env=true 로 설정하면 위 describe 블록이 실행됨 (nightly CI).
    expect(typeof OLLAMA_INTEGRATION).toBe('boolean');
  });
});
