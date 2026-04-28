import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';

import { AuthService, type IssuedTokens } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * ADR-020 §4.3 / CRITICAL-B3 — auth brute-force 차단 (Session 10).
 * ADR-020 §4.2.1 — httpOnly cookie + refresh rotation + logout revoke (PR-10a).
 *
 * Endpoints:
 *  - POST /auth/register — cookie set + body 토큰 (dual-mode 1주일)
 *  - POST /auth/login    — cookie set + body 토큰 (dual-mode)
 *  - POST /auth/refresh  — cookie 또는 body 의 refreshToken 으로 회전 (dual-mode)
 *  - POST /auth/logout   — JwtAuthGuard 보호. cookie clear + revoke + epoch++
 */

const LOGIN_TTL_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const REGISTER_TTL_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 3;

const ACCESS_COOKIE = 'access';
const REFRESH_COOKIE = 'refresh';
const ACCESS_MAX_AGE_MS = 30 * 60 * 1000; // 30m (Q-R3)
const REFRESH_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14d (Q-R3)

class RegisterDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class RefreshDto {
  @IsString()
  refreshToken?: string;
}

interface JwtUser {
  sub: string;
}

function buildCookieOpts(maxAgeMs: number): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const opts: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
  // dev/staging (Tailscale IP) 에서는 Domain 미설정 — host-only cookie (RFC 6265 §4.1.2.3).
  // production 만 명시 도메인 (subdomain hijack 방어 — Agent B G2).
  if (isProd && process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }
  return opts;
}

function setAuthCookies(res: Response, tokens: IssuedTokens) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, buildCookieOpts(ACCESS_MAX_AGE_MS));
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, buildCookieOpts(REFRESH_MAX_AGE_MS));
}

function clearAuthCookies(res: Response) {
  // clearCookie 는 maxAge 무시 — Path / Domain 만 일치하면 OK.
  const base = buildCookieOpts(0);
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ register: { ttl: REGISTER_TTL_MS, limit: REGISTER_LIMIT } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.authService.register(dto);
    setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('login')
  @Throttle({ login: { ttl: LOGIN_TTL_MS, limit: LOGIN_LIMIT } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.authService.login(dto.email, dto.password);
    setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Body() body: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cookies = (req as any)?.cookies as Record<string, string> | undefined;
    const raw = cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
    if (!raw) {
      throw new BadRequestException('refresh_token_missing');
    }
    const tokens = await this.authService.refresh(raw);
    setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const user = req.user as JwtUser;
    await this.authService.logout(user.sub);
    clearAuthCookies(res);
    return { ok: true };
  }
}
