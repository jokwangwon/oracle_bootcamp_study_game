import { describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { EvalAdminGuard } from './eval-admin.guard';

/**
 * EvalAdminGuard 단위 테스트.
 *
 * 정책 (단계 7):
 *  - JWT는 별도 JwtAuthGuard가 처리. 본 가드는 req.user.username이
 *    EVAL_ADMIN_USERNAMES (comma-separated) 화이트리스트에 포함되는지 확인
 *  - whitelist가 비어있거나 환경변수 미설정 → 모든 요청 차단 (fail-closed)
 *  - 운영 안전성을 위해 username 매칭은 정확 일치 (trim, case-sensitive 후 비교)
 *
 * 인증과 인가 분리:
 *  - 인증 실패 (req.user 없음) → ForbiddenException — JwtAuthGuard가 먼저 401을
 *    던졌어야 정상이지만, 본 가드는 단독으로도 안전하게 거절한다 (defense in depth)
 */

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('EvalAdminGuard', () => {
  it('whitelist에 있는 username은 통과', () => {
    const guard = new EvalAdminGuard('admin1,admin2');
    const ctx = makeContext({ sub: 'u-1', username: 'admin1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('whitelist에 없는 username은 ForbiddenException', () => {
    const guard = new EvalAdminGuard('admin1,admin2');
    const ctx = makeContext({ sub: 'u-3', username: 'attacker' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('빈 whitelist는 모든 요청 거절 (fail-closed)', () => {
    const guard = new EvalAdminGuard('');
    const ctx = makeContext({ sub: 'u-1', username: 'admin1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('undefined whitelist (환경변수 미설정)도 fail-closed', () => {
    const guard = new EvalAdminGuard(undefined);
    const ctx = makeContext({ sub: 'u-1', username: 'admin1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('req.user 없으면 ForbiddenException (defense in depth)', () => {
    const guard = new EvalAdminGuard('admin1');
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('req.user.username 없으면 ForbiddenException', () => {
    const guard = new EvalAdminGuard('admin1');
    const ctx = makeContext({ sub: 'u-1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('whitelist 항목 주변 공백은 무시 (admin1 , admin2)', () => {
    const guard = new EvalAdminGuard('  admin1 ,  admin2  ');
    const ctx = makeContext({ sub: 'u-2', username: 'admin2' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('case-sensitive 비교 (Admin1 ≠ admin1)', () => {
    const guard = new EvalAdminGuard('admin1');
    const ctx = makeContext({ sub: 'u-1', username: 'Admin1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('whitelist에 빈 토큰이 섞여 있어도 정상 (",,admin1,,")', () => {
    const guard = new EvalAdminGuard(',,admin1,,');
    const ctx = makeContext({ sub: 'u-1', username: 'admin1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('빈 토큰만 있는 whitelist (",,") 는 fail-closed', () => {
    const guard = new EvalAdminGuard(',,');
    const ctx = makeContext({ sub: 'u-1', username: 'admin1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
