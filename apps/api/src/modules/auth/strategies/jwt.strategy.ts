import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  username: string;
  /**
   * PR-10a §4.2.1 B 절. logout/revoke 시 incrementTokenEpoch — 이후 발급된 access JWT
   * 의 epoch claim 이 갱신됨. legacy token 은 epoch 누락 — db.epoch === 0 일 때만 허용.
   */
  epoch?: number;
}

interface AuthenticatedUser {
  sub: string;
  username: string;
}

const ACCESS_COOKIE = 'access';

/** cookie 'access' (httpOnly) 우선 → Bearer header fallback. cookie-parser middleware 가 req.cookies 채움. */
function extractFromCookieOrBearer(): (req: Request) => string | null {
  const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();
  return (req: Request): string | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cookies = (req as any)?.cookies as Record<string, string> | undefined;
    const fromCookie = cookies?.[ACCESS_COOKIE];
    if (typeof fromCookie === 'string' && fromCookie.length > 0) {
      return fromCookie;
    }
    return bearerExtractor(req);
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: extractFromCookieOrBearer(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    let dbEpoch: number;
    try {
      dbEpoch = await this.usersService.getTokenEpoch(payload.sub);
    } catch {
      // user not found / DB error → 401 (token 의 sub 가 삭제된 user 시나리오 포함)
      throw new UnauthorizedException('user_not_found');
    }

    // legacy token (epoch claim 누락) — db.epoch === 0 일 때만 호환 허용
    const tokenEpoch = payload.epoch ?? 0;

    if (tokenEpoch !== dbEpoch) {
      throw new UnauthorizedException('token_revoked');
    }

    return { sub: payload.sub, username: payload.username };
  }
}
