import { describe, expect, it } from 'vitest';

import {
  configValidationSchema,
  uniqueCharRatio,
} from './env.validation';

/**
 * ADR-018 §7 — env.validation refinement 4종 TDD.
 *
 * production 에서 엄격하게 차단되는 시나리오 중심.
 */

const BASE: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  LANGFUSE_PUBLIC_KEY: 'pk_test',
  LANGFUSE_SECRET_KEY: 'sk_test',
  USER_TOKEN_HASH_SALT: 'prod-real-random-abcdef-1234567890',
  // ADR-020 §4.2.1 E·K (consensus-011) — production CORS_ORIGIN 필수 (fail-closed)
  CORS_ORIGIN: 'http://localhost:3000',
};

describe('env.validation refinement (ADR-018 §7)', () => {
  it('기본 production config → 통과', () => {
    expect(() => configValidationSchema(BASE)).not.toThrow();
  });

  describe('refinement 1 — placeholder 거부 (production 만)', () => {
    for (const value of ['changeme', 'testonly-abcdef-1234567', 'dev-salt-1234567-xx', 'placeholder-xyz']) {
      it(`'${value}' 거부 (production)`, () => {
        expect(() =>
          configValidationSchema({ ...BASE, USER_TOKEN_HASH_SALT: value.padEnd(16, 'x') }),
        ).toThrow(/placeholder/i);
      });
    }

    it('development 환경에서는 placeholder 허용', () => {
      expect(() =>
        configValidationSchema({
          ...BASE,
          NODE_ENV: 'development',
          USER_TOKEN_HASH_SALT: 'dev-salt-1234567890-abcd',
        }),
      ).not.toThrow();
    });
  });

  describe('refinement 2 — PREV 와 동일값 거부', () => {
    it('USER_TOKEN_HASH_SALT === USER_TOKEN_HASH_SALT_PREV → 거부', () => {
      expect(() =>
        configValidationSchema({
          ...BASE,
          USER_TOKEN_HASH_SALT_PREV: BASE.USER_TOKEN_HASH_SALT,
        }),
      ).toThrow(/의미 없는 rotation/);
    });

    it('PREV 가 미설정이면 통과 (아직 rotation 안 된 상태)', () => {
      expect(() => configValidationSchema(BASE)).not.toThrow();
    });

    it('PREV 가 다른 값이면 통과', () => {
      expect(() =>
        configValidationSchema({
          ...BASE,
          USER_TOKEN_HASH_SALT_PREV: 'prev-salt-different-value-xyzzy-000',
        }),
      ).not.toThrow();
    });
  });

  describe('refinement 3 — secret 재사용 거부', () => {
    it('USER_TOKEN_HASH_SALT === LANGFUSE_SALT → 거부', () => {
      expect(() =>
        configValidationSchema({
          ...BASE,
          LANGFUSE_SALT: BASE.USER_TOKEN_HASH_SALT,
        }),
      ).toThrow(/재사용 금지/);
    });

    it('USER_TOKEN_HASH_SALT === JWT_SECRET → 거부', () => {
      const shared = 'shared-secret-very-long-value-xyz-999999';
      expect(() =>
        configValidationSchema({
          ...BASE,
          JWT_SECRET: shared,
          USER_TOKEN_HASH_SALT: shared,
        }),
      ).toThrow(/JWT_SECRET|재사용/);
    });
  });

  describe('refinement 4 — 엔트로피 하한 (production 만)', () => {
    it('반복 문자열 "aaaa..." → 거부 (production)', () => {
      expect(() =>
        configValidationSchema({
          ...BASE,
          USER_TOKEN_HASH_SALT: 'a'.repeat(32),
        }),
      ).toThrow(/엔트로피 부족/);
    });

    it('충분히 다양한 문자열 → 통과', () => {
      expect(() => configValidationSchema(BASE)).not.toThrow();
    });

    it('development 에서는 저엔트로피도 허용', () => {
      expect(() =>
        configValidationSchema({
          ...BASE,
          NODE_ENV: 'development',
          USER_TOKEN_HASH_SALT: 'a'.repeat(16),
        }),
      ).not.toThrow();
    });
  });

  describe('uniqueCharRatio 순수 함수', () => {
    it('반복 문자열 "aaaa" → 0.25', () => {
      expect(uniqueCharRatio('aaaa')).toBe(0.25);
    });

    it('완전 유일 "abcd" → 1.0', () => {
      expect(uniqueCharRatio('abcd')).toBe(1);
    });

    it('빈 문자열 → 0', () => {
      expect(uniqueCharRatio('')).toBe(0);
    });

    it('랜덤 base64-like 문자열은 0.5 이상', () => {
      expect(
        uniqueCharRatio('XkJ4mN8qPz2Ws7Yr5Tv1aB9cD6eF3gH0'),
      ).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ADR-020 §4.2.1 E·K (consensus-011) — CORS_ORIGIN refine 회귀
  describe('CORS_ORIGIN refine (consensus-011 CRITICAL #2)', () => {
    it('production + CORS_ORIGIN 미설정 → 거부 (fail-closed)', () => {
      const { CORS_ORIGIN, ...withoutCors } = BASE;
      expect(() => configValidationSchema(withoutCors)).toThrow(/CORS_ORIGIN/);
    });

    it('production + CORS_ORIGIN 빈 문자열 → 거부', () => {
      expect(() => configValidationSchema({ ...BASE, CORS_ORIGIN: '' })).toThrow(/CORS_ORIGIN/);
    });

    it('production + CORS_ORIGIN 공백 → 거부', () => {
      expect(() => configValidationSchema({ ...BASE, CORS_ORIGIN: '   ' })).toThrow(/CORS_ORIGIN/);
    });

    it('development + CORS_ORIGIN 미설정 → 통과 (runtime 안전망 위임)', () => {
      const { CORS_ORIGIN, ...withoutCors } = BASE;
      expect(() => configValidationSchema({ ...withoutCors, NODE_ENV: 'development' })).not.toThrow();
    });

    it('production + CORS_ORIGIN 정상 값 → 통과', () => {
      expect(() => configValidationSchema(BASE)).not.toThrow();
    });
  });
});
