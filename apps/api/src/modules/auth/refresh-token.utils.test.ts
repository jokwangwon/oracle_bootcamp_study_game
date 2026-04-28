import { describe, it, expect } from 'vitest';

import {
  buildRefreshClaims,
  computeRefreshExpiry,
  isRefreshExpired,
  parseRefreshClaims,
} from './refresh-token.utils';

/**
 * PR-10a Phase 3 — refresh-token 순수 헬퍼.
 *
 * ADR-020 §4.2.1 부속서. JwtService 와 분리된 deterministic 함수 — Phase 4
 * RefreshTokenService 가 본 헬퍼 + jwtService.signAsync 조합.
 */

describe('refresh-token.utils', () => {
  describe('computeRefreshExpiry (3.3)', () => {
    const NOW = new Date('2026-04-29T00:00:00Z');

    it('"14d" → +14일', () => {
      const exp = computeRefreshExpiry(NOW, '14d');
      expect(exp.toISOString()).toBe('2026-05-13T00:00:00.000Z');
    });

    it('"30m" → +30분', () => {
      const exp = computeRefreshExpiry(NOW, '30m');
      expect(exp.toISOString()).toBe('2026-04-29T00:30:00.000Z');
    });

    it('"2h" / "60s" 도 허용', () => {
      expect(computeRefreshExpiry(NOW, '2h').toISOString()).toBe('2026-04-29T02:00:00.000Z');
      expect(computeRefreshExpiry(NOW, '60s').toISOString()).toBe('2026-04-29T00:01:00.000Z');
    });

    it('잘못된 포맷 → throw (s/m/h/d 단위 외)', () => {
      expect(() => computeRefreshExpiry(NOW, '14days')).toThrow(/invalid duration/i);
      expect(() => computeRefreshExpiry(NOW, '14')).toThrow(/invalid duration/i);
      expect(() => computeRefreshExpiry(NOW, '')).toThrow(/invalid duration/i);
    });
  });

  describe('buildRefreshClaims (3.1)', () => {
    const NOW = new Date('2026-04-29T00:00:00Z');

    it('정상 입력 시 sub / familyId / generation / iat / exp / jti 정확 반환', () => {
      const claims = buildRefreshClaims({
        jti: '11111111-1111-1111-1111-111111111111',
        userId: '22222222-2222-2222-2222-222222222222',
        familyId: '33333333-3333-3333-3333-333333333333',
        generation: 0,
        expiresIn: '14d',
        now: NOW,
      });

      expect(claims.jti).toBe('11111111-1111-1111-1111-111111111111');
      expect(claims.sub).toBe('22222222-2222-2222-2222-222222222222');
      expect(claims.familyId).toBe('33333333-3333-3333-3333-333333333333');
      expect(claims.generation).toBe(0);
      expect(claims.iat).toBe(Math.floor(NOW.getTime() / 1000));
      expect(claims.exp).toBe(Math.floor(NOW.getTime() / 1000) + 14 * 24 * 60 * 60);
    });

    it('generation 증가 시 iat/exp 동일 (now 기준)', () => {
      const a = buildRefreshClaims({
        jti: 'a',
        userId: 'u',
        familyId: 'f',
        generation: 0,
        expiresIn: '14d',
        now: NOW,
      });
      const b = buildRefreshClaims({
        jti: 'b',
        userId: 'u',
        familyId: 'f',
        generation: 5,
        expiresIn: '14d',
        now: NOW,
      });
      expect(b.iat).toBe(a.iat);
      expect(b.exp).toBe(a.exp);
      expect(b.generation).toBe(5);
    });
  });

  describe('parseRefreshClaims (3.2)', () => {
    const validPayload = {
      jti: '11111111-1111-1111-1111-111111111111',
      sub: '22222222-2222-2222-2222-222222222222',
      familyId: '33333333-3333-3333-3333-333333333333',
      generation: 0,
      iat: 1000000000,
      exp: 1001000000,
    };

    it('정상 payload → typed return', () => {
      const parsed = parseRefreshClaims(validPayload);
      expect(parsed).toEqual(validPayload);
    });

    it('필드 누락 → throw', () => {
      expect(() => parseRefreshClaims({ ...validPayload, jti: undefined })).toThrow();
      expect(() => parseRefreshClaims({ ...validPayload, sub: undefined })).toThrow();
      expect(() => parseRefreshClaims({ ...validPayload, familyId: undefined })).toThrow();
      expect(() => parseRefreshClaims({ ...validPayload, generation: undefined })).toThrow();
      expect(() => parseRefreshClaims({ ...validPayload, exp: undefined })).toThrow();
    });

    it('null / undefined / non-object → throw', () => {
      expect(() => parseRefreshClaims(null)).toThrow();
      expect(() => parseRefreshClaims(undefined)).toThrow();
      expect(() => parseRefreshClaims('not-an-object')).toThrow();
      expect(() => parseRefreshClaims(123)).toThrow();
    });

    it('잘못된 타입 (generation 문자열) → throw', () => {
      expect(() => parseRefreshClaims({ ...validPayload, generation: '0' })).toThrow();
    });
  });

  describe('isRefreshExpired (3.4)', () => {
    const NOW = new Date('2026-04-29T00:00:00Z');
    const nowSec = Math.floor(NOW.getTime() / 1000);

    it('exp < now → true (만료)', () => {
      expect(isRefreshExpired({ exp: nowSec - 1 }, NOW)).toBe(true);
    });

    it('exp > now → false (유효)', () => {
      expect(isRefreshExpired({ exp: nowSec + 1 }, NOW)).toBe(false);
    });

    it('exp == now → true (경계는 만료로 간주, 시계 skew 안전 측)', () => {
      expect(isRefreshExpired({ exp: nowSec }, NOW)).toBe(true);
    });
  });
});
