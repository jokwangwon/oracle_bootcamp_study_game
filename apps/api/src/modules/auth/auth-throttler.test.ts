import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { AuthController } from './auth.controller';

// @nestjs/throttler v6 의 named throttler 메타데이터 키 (per-name suffix).
// constants 모듈이 barrel 에서 re-export 안 되므로 stable 키를 하드코딩.
const THROTTLER_TTL_KEY = 'THROTTLER:TTL';
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';

/**
 * ADR-020 §4.3 / CRITICAL-B3 — auth brute-force 회귀.
 *
 *  - login   : 15분 / 5회
 *  - register: 60분 / 3회
 *
 * 본 프로젝트는 NestJS DI 통합 컨벤션이 없고 vitest+esbuild 는 emitDecoratorMetadata
 * 미지원이므로 통합 호출 e2e 는 별도 하네스 (PR-6 범위 외) 에서 검증.
 *
 * 본 테스트는 `@Throttle()` 데코레이터가 메서드 메타데이터에 정확한 ttl/limit
 * 으로 적용됐는지 + `@UseGuards(ThrottlerGuard)` 가 컨트롤러에 등록됐는지 검증.
 *
 * `@Throttle({name: {ttl, limit}})` 는 `Reflect.defineMetadata("THROTTLER:TTL"+name, ttl, ...)`
 * 형태로 named throttler 별 메타데이터 키를 분리 (v6 동작).
 */

const LOGIN_TTL_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const REGISTER_TTL_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 3;

function readNamed(handler: object, name: string) {
  return {
    ttl: Reflect.getMetadata(THROTTLER_TTL_KEY + name, handler),
    limit: Reflect.getMetadata(THROTTLER_LIMIT_KEY + name, handler),
  };
}

describe('AuthController @Throttle 메타데이터 (ADR-020 §4.3, CRITICAL-B3)', () => {
  it('AuthController.login 에 named throttler "login" {ttl:15min, limit:5} 적용', () => {
    const { ttl, limit } = readNamed(AuthController.prototype.login, 'login');
    expect(ttl).toBe(LOGIN_TTL_MS);
    expect(limit).toBe(LOGIN_LIMIT);
  });

  it('AuthController.register 에 named throttler "register" {ttl:60min, limit:3} 적용', () => {
    const { ttl, limit } = readNamed(
      AuthController.prototype.register,
      'register',
    );
    expect(ttl).toBe(REGISTER_TTL_MS);
    expect(limit).toBe(REGISTER_LIMIT);
  });

  it('login throttle 은 register 키를 가지지 않음 (독립 카운터)', () => {
    const cross = readNamed(AuthController.prototype.login, 'register');
    expect(cross.ttl).toBeUndefined();
    expect(cross.limit).toBeUndefined();
  });

  it('register throttle 은 login 키를 가지지 않음 (독립 카운터)', () => {
    const cross = readNamed(AuthController.prototype.register, 'login');
    expect(cross.ttl).toBeUndefined();
    expect(cross.limit).toBeUndefined();
  });

  it('AuthController 클래스 레벨에 ThrottlerGuard 등록', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController) as
      | Array<unknown>
      | undefined;
    expect(guards, 'AuthController class-level guards').toBeDefined();
    expect(guards).toContain(ThrottlerGuard);
  });
});
