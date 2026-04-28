import { ExecutionContext, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OriginGuard, parseAllowedOrigins, SKIP_ORIGIN_CHECK_KEY } from './origin.guard';

/**
 * ADR-020 §4.2.1 E (consensus-011 갱신본) — OriginGuard 단위 테스트.
 *
 * 33 cases — Method 분기 5 / CORS_ORIGIN env 6 / startsWith bypass 4 /
 * 정규화 3 / Origin vs Referer 4 / Tailscale + invalid 4 / Skip+kill-switch 3 /
 * 에러 응답 + Report-Only 4.
 *
 * NestJS 부팅 회피 — pure CanActivate + ExecutionContext mock.
 */

type ReqShape = {
  method: string;
  url?: string;
  headers: Record<string, string | undefined>;
};

function buildContext(req: ReqShape, handler?: () => unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => handler ?? ((): undefined => undefined),
    getClass: () => OriginGuard,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function buildGuard(skip = false): OriginGuard {
  const reflector = { get: vi.fn().mockReturnValue(skip) } as unknown as Reflector;
  return new OriginGuard(reflector);
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  delete process.env.ORIGIN_GUARD_MODE;
  delete process.env.ORIGIN_GUARD_DISABLED;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('OriginGuard — A. Method 분기 (5)', () => {
  it('A1. GET → 통과 (Origin 미검증)', () => {
    const ctx = buildContext({ method: 'GET', headers: {} });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('A2. HEAD → 통과', () => {
    const ctx = buildContext({ method: 'HEAD', headers: {} });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('A3. OPTIONS → 통과 (CORS preflight 호환)', () => {
    const ctx = buildContext({ method: 'OPTIONS', headers: {} });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('A4. POST + 정상 origin → 통과', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('A5. POST without Origin/Referer → ForbiddenException (한국어)', () => {
    const ctx = buildContext({ method: 'POST', headers: {} });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
    try {
      buildGuard().canActivate(ctx);
    } catch (e) {
      expect((e as ForbiddenException).message).toContain('Origin 헤더가 필요합니다');
    }
  });
});

describe('OriginGuard — B. CORS_ORIGIN env 분기 (6, fail-closed CRITICAL #2)', () => {
  it('B1. CORS_ORIGIN 미설정 → InternalServerErrorException (fail-closed)', () => {
    delete process.env.CORS_ORIGIN;
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(InternalServerErrorException);
  });

  it('B2. CORS_ORIGIN 빈 문자열 → InternalServerErrorException', () => {
    process.env.CORS_ORIGIN = '';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(InternalServerErrorException);
  });

  it('B3. CORS_ORIGIN 단일 + 정확 일치 → 통과', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('B4. CORS_ORIGIN 단일 + 비일치 → ForbiddenException', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://evil.com' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('B5. CORS_ORIGIN 복수 + 첫번째 매치 → 통과', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000,http://100.102.41.122:3002';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('B6. CORS_ORIGIN 복수 + 두번째 매치 → 통과', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000,http://100.102.41.122:3002';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://100.102.41.122:3002' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });
});

describe('OriginGuard — C. startsWith bypass 방어 (4, CRITICAL #1)', () => {
  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  it('C1. `http://localhost:3000.attacker.com` → 차단 (URL host 다름)', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000.attacker.com' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('C2. `http://localhost:3000@attacker.com` → 차단 (URL userinfo 우회)', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000@attacker.com' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('C3. `http://localhost:30001` (port prefix 변경) → 차단', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:30001' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('C4. CORS_ORIGIN 에 path 포함 (`http://localhost:3000/path`) — origin 만 추출하여 비교', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000/some/path';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });
});

describe('OriginGuard — D. 정규화 (3)', () => {
  it('D1. CORS_ORIGIN 대소문자 변형 (`HTTP://Localhost:3000`) → lowercase 통과', () => {
    process.env.CORS_ORIGIN = 'HTTP://Localhost:3000';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('D2. CORS_ORIGIN trailing slash (`http://localhost:3000/`) → URL.origin 정규화 통과', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000/';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('D3. 요청 origin 대소문자 변형 (`HTTP://LOCALHOST:3000`) → 정규화 후 통과', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'HTTP://LOCALHOST:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });
});

describe('OriginGuard — E. Origin vs Referer (4)', () => {
  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  it('E1. Origin 우선 사용 (Referer 무시)', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000', referer: 'http://evil.com/page' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('E2. Origin 부재, Referer 존재 → fallback 통과', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { referer: 'http://localhost:3000/some/path?q=1' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('E3. Origin / Referer 둘 다 부재 → 차단', () => {
    const ctx = buildContext({ method: 'POST', headers: {} });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('E4. Origin: "null" (sandboxed iframe) → 차단', () => {
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'null' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('OriginGuard — F. Tailscale + invalid (4)', () => {
  it('F1. Tailscale IPv4 일치 → 통과', () => {
    process.env.CORS_ORIGIN = 'http://100.102.41.122:3002';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://100.102.41.122:3002' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });

  it('F2. Tailscale IPv4 다른 포트 → 차단', () => {
    process.env.CORS_ORIGIN = 'http://100.102.41.122:3002';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://100.102.41.122:3001' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('F3. invalid origin 형식 (`not-a-url`) → 차단 (URL parse throw)', () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'not-a-url' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('F4. CORS_ORIGIN 안에 invalid 항목 (`bad,http://localhost:3000`) — 유효한 항목만 사용', () => {
    process.env.CORS_ORIGIN = 'bad,http://localhost:3000';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });
});

describe('OriginGuard — G. SkipOriginCheck + kill-switch (3)', () => {
  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  it('G1. SkipOriginCheck metadata → POST 도 통과 (Origin 검증 skip)', () => {
    const ctx = buildContext({ method: 'POST', headers: {} });
    expect(buildGuard(true).canActivate(ctx)).toBe(true);
  });

  it('G2. metadata 없으면 정상 거부 (회귀 검증)', () => {
    const ctx = buildContext({ method: 'POST', headers: {} });
    expect(() => buildGuard(false).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('G3. ORIGIN_GUARD_DISABLED=true → 모든 요청 통과 (kill-switch)', () => {
    process.env.ORIGIN_GUARD_DISABLED = 'true';
    const ctx = buildContext({ method: 'POST', headers: { origin: 'http://evil.com' } });
    expect(buildGuard().canActivate(ctx)).toBe(true);
  });
});

describe('OriginGuard — H. 에러 응답 + Report-Only (4)', () => {
  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  it('H1. 한국어 메시지 (origin_missing — 학습 힌트 포함)', () => {
    const ctx = buildContext({ method: 'POST', headers: {} });
    try {
      buildGuard().canActivate(ctx);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toMatch(/Origin 헤더가 필요합니다/);
      expect((e as ForbiddenException).message).toMatch(/curl|Postman/);
    }
  });

  it('H2. 한국어 메시지 (origin_mismatch)', () => {
    const ctx = buildContext({ method: 'POST', headers: { origin: 'http://evil.com' } });
    try {
      buildGuard().canActivate(ctx);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toMatch(/허용되지 않은 Origin/);
    }
  });

  it('H3. ORIGIN_GUARD_MODE=report → 차단 대신 console.warn + 통과', () => {
    process.env.ORIGIN_GUARD_MODE = 'report';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ctx = buildContext({
      method: 'POST',
      url: '/api/discussion/threads',
      headers: { origin: 'http://evil.com' },
    });
    expect(buildGuard().canActivate(ctx)).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/OriginGuard:report/);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/POST/);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/http:\/\/evil\.com/);
  });

  it('H4. ORIGIN_GUARD_MODE=enforce (default) → 차단', () => {
    process.env.ORIGIN_GUARD_MODE = 'enforce';
    const ctx = buildContext({
      method: 'POST',
      headers: { origin: 'http://evil.com' },
    });
    expect(() => buildGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('parseAllowedOrigins helper', () => {
  it('미설정 / 빈 문자열 → 빈 배열', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
    expect(parseAllowedOrigins('   ')).toEqual([]);
  });

  it('단일 origin → URL.origin lowercase 1개', () => {
    expect(parseAllowedOrigins('http://localhost:3000')).toEqual(['http://localhost:3000']);
  });

  it('복수 origin + invalid 항목 무시', () => {
    expect(parseAllowedOrigins('http://localhost:3000, bad, http://100.102.41.122:3002 ')).toEqual([
      'http://localhost:3000',
      'http://100.102.41.122:3002',
    ]);
  });

  it('대소문자 / trailing slash 정규화', () => {
    expect(parseAllowedOrigins('HTTP://Localhost:3000/, HTTP://EVIL.COM/path')).toEqual([
      'http://localhost:3000',
      'http://evil.com',
    ]);
  });
});

describe('SkipOriginCheck decorator export', () => {
  it('SKIP_ORIGIN_CHECK_KEY symbol export', () => {
    expect(typeof SKIP_ORIGIN_CHECK_KEY).toBe('string');
    expect(SKIP_ORIGIN_CHECK_KEY.length).toBeGreaterThan(0);
  });
});
