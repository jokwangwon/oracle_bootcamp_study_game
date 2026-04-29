import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * PR-12 §7 — Passport JWT 가드 + @Public() 옵셔널 인증 분기.
 *
 * 동작:
 *  - @Public() 미적용 → 기존 동작. 토큰 부재/invalid 시 UnauthorizedException.
 *  - @Public() 적용  → 토큰 valid 시 req.user attach, 부재/invalid 시 통과 +
 *    req.user = null (controller 가 비인증 분기 직접 처리).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.isPublic(context);
    if (!isPublic) return super.canActivate(context);
    // optional auth — strategy 가 throw 해도 통과
    return Promise.resolve(super.canActivate(context) as boolean | Promise<boolean>)
      .catch(() => false)
      .then(() => true);
  }

  override handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (this.isPublic(context)) {
      // @Public(): user truthy 면 그대로, 그 외(false/null) 는 null
      return (user || (null as unknown as TUser)) as TUser;
    }
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user as TUser;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }
}
