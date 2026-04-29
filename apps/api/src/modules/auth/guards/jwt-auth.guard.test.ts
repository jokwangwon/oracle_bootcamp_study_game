import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * PR-12 §7 — JwtAuthGuard 의 IS_PUBLIC_KEY 분기 단위 검증.
 *
 * canActivate 의 super 호출 (passport-jwt strategy) 은 통합 테스트 영역.
 * 본 unit 은 handleRequest 의 옵셔널 통과 로직을 검증.
 */

function makeReflector(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: vi.fn(() => isPublic),
  } as unknown as Reflector;
}

function makeContext(): ExecutionContext {
  return {
    getHandler: vi.fn(() => () => undefined),
    getClass: vi.fn(() => class Cls {}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard.handleRequest (Phase 3c)', () => {
  it('@Public() + user 부재 → null 반환 (통과)', () => {
    const guard = new JwtAuthGuard(makeReflector(true));
    const out = guard.handleRequest(null, false, null, makeContext());
    expect(out).toBeNull();
  });

  it('@Public() + user 존재 → 그대로 attach (옵셔널 인증)', () => {
    const guard = new JwtAuthGuard(makeReflector(true));
    const user = { sub: 'u1' };
    const out = guard.handleRequest(null, user, null, makeContext());
    expect(out).toEqual(user);
  });

  it('비@Public() + user 부재 → UnauthorizedException', () => {
    const guard = new JwtAuthGuard(makeReflector(false));
    expect(() =>
      guard.handleRequest(null, false, null, makeContext()),
    ).toThrow(UnauthorizedException);
  });

  it('비@Public() + user 존재 → 그대로 attach', () => {
    const guard = new JwtAuthGuard(makeReflector(false));
    const user = { sub: 'u1' };
    const out = guard.handleRequest(null, user, null, makeContext());
    expect(out).toEqual(user);
  });
});
