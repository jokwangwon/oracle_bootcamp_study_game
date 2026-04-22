import { describe, expect, it } from 'vitest';

import {
  USER_TOKEN_HASH_LENGTH,
  hashUserToken,
} from './user-token-hash';

/**
 * ADR-016 §7 + consensus-005 §커밋2 TDD.
 */
describe('hashUserToken (ADR-016 §7 / consensus-005 §커밋2)', () => {
  const SALT_A = 'dev-salt-1234567890-abcd'; // 24 chars
  const SALT_B = 'prod-salt-0987654321-wxyz'; // 25 chars

  it(`반환 hash 길이는 ${USER_TOKEN_HASH_LENGTH} chars 고정`, () => {
    const h = hashUserToken('user-1', SALT_A);
    expect(h).toHaveLength(USER_TOKEN_HASH_LENGTH);
  });

  it('hex (0-9, a-f) 문자만 포함', () => {
    const h = hashUserToken('user-abcdef', SALT_A);
    expect(h).toMatch(/^[a-f0-9]+$/);
  });

  it('결정적 — 동일 (userId, salt) 입력은 같은 hash 반환 (5회 호출)', () => {
    const results = Array.from({ length: 5 }, () =>
      hashUserToken('user-42', SALT_A),
    );
    expect(new Set(results).size).toBe(1);
  });

  it('서로 다른 userId 는 서로 다른 hash', () => {
    const a = hashUserToken('user-a', SALT_A);
    const b = hashUserToken('user-b', SALT_A);
    expect(a).not.toBe(b);
  });

  it('동일 userId 라도 salt 가 다르면 hash 다름 (환경 격리)', () => {
    const dev = hashUserToken('user-42', SALT_A);
    const prod = hashUserToken('user-42', SALT_B);
    expect(dev).not.toBe(prod);
  });

  describe('fail-closed 경계', () => {
    it('salt 가 빈 문자열이면 throw', () => {
      expect(() => hashUserToken('user-1', '')).toThrow(/salt/);
    });

    it('salt 가 16자 미만이면 throw (rainbow 공격 방어)', () => {
      expect(() => hashUserToken('user-1', 'short')).toThrow(/salt/);
    });

    it('userId 가 빈 문자열이면 throw', () => {
      expect(() => hashUserToken('', SALT_A)).toThrow(/userId/);
    });

    it('salt 가 undefined 이면 throw', () => {
      expect(() => hashUserToken('user-1', undefined as unknown as string)).toThrow();
    });
  });
});
