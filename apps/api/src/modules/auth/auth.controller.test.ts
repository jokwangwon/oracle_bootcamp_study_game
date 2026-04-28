import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import type { AuthService, IssuedTokens } from './auth.service';

/**
 * PR-10a Phase 8 — AuthController endpoint 동작.
 *
 * Cookie set/clear + refresh body/cookie dual-source + logout JwtAuthGuard 보호.
 * E2E (HTTP 통합) 는 Phase 11.
 */

function tokens(): IssuedTokens {
  return {
    accessToken: 'acc-token',
    refreshToken: 'ref-token',
    refreshJti: 'jti',
    refreshFamilyId: 'fam',
  };
}

function makeRes() {
  const calls = { cookie: [] as Array<{ name: string; value: string; opts: unknown }> };
  const res = {
    cookie: vi.fn((name: string, value: string, opts: unknown) => {
      calls.cookie.push({ name, value, opts });
      return res;
    }),
    clearCookie: vi.fn((name: string, opts: unknown) => {
      calls.cookie.push({ name, value: '', opts });
      return res;
    }),
  } as unknown as Response;
  return { res, calls };
}

function makeAuth() {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  } as unknown as AuthService & Record<string, ReturnType<typeof vi.fn>>;
}

describe('AuthController (PR-10a Phase 8)', () => {
  let auth: ReturnType<typeof makeAuth>;
  let controller: AuthController;

  beforeEach(() => {
    auth = makeAuth();
    controller = new AuthController(auth);
    process.env.NODE_ENV = 'test';
    delete process.env.COOKIE_DOMAIN;
  });

  describe('register', () => {
    it('cookie set (access + refresh) + body 토큰 반환', async () => {
      auth.register.mockResolvedValue(tokens());
      const { res, calls } = makeRes();

      const out = await controller.register(
        { username: 'u', email: 'e@e', password: 'pw1234567' } as never,
        res,
      );

      expect(out).toEqual({ accessToken: 'acc-token', refreshToken: 'ref-token' });
      expect(calls.cookie).toHaveLength(2);
      expect(calls.cookie[0]!.name).toBe('access');
      expect(calls.cookie[0]!.value).toBe('acc-token');
      expect(calls.cookie[1]!.name).toBe('refresh');
      expect(calls.cookie[1]!.value).toBe('ref-token');
    });

    it('cookie httpOnly + sameSite=lax + path=/', async () => {
      auth.register.mockResolvedValue(tokens());
      const { res, calls } = makeRes();
      await controller.register({ username: 'u', email: 'e@e', password: 'pw1234567' } as never, res);

      const opts = calls.cookie[0]!.opts as Record<string, unknown>;
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
    });

    it('NODE_ENV !== production → secure:false + Domain 없음', async () => {
      auth.register.mockResolvedValue(tokens());
      process.env.NODE_ENV = 'development';
      process.env.COOKIE_DOMAIN = 'example.com';
      const { res, calls } = makeRes();
      await controller.register({ username: 'u', email: 'e@e', password: 'pw1234567' } as never, res);

      const opts = calls.cookie[0]!.opts as Record<string, unknown>;
      expect(opts.secure).toBe(false);
      expect(opts.domain).toBeUndefined();
    });

    it('NODE_ENV === production + COOKIE_DOMAIN 있음 → secure:true + domain 설정', async () => {
      auth.register.mockResolvedValue(tokens());
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = 'example.com';
      const { res, calls } = makeRes();
      await controller.register({ username: 'u', email: 'e@e', password: 'pw1234567' } as never, res);

      const opts = calls.cookie[0]!.opts as Record<string, unknown>;
      expect(opts.secure).toBe(true);
      expect(opts.domain).toBe('example.com');
    });
  });

  describe('login', () => {
    it('AuthService.login 호출 + cookie set', async () => {
      auth.login.mockResolvedValue(tokens());
      const { res, calls } = makeRes();
      const out = await controller.login({ email: 'e@e', password: 'pw' } as never, res);

      expect(auth.login).toHaveBeenCalledWith('e@e', 'pw');
      expect(out.accessToken).toBe('acc-token');
      expect(calls.cookie).toHaveLength(2);
    });
  });

  describe('refresh', () => {
    it('cookie 우선 (req.cookies.refresh) → AuthService.refresh', async () => {
      auth.refresh.mockResolvedValue(tokens());
      const { res } = makeRes();
      const req = { cookies: { refresh: 'cookie-rf' } } as unknown as Request;

      await controller.refresh(req, {} as never, res);
      expect(auth.refresh).toHaveBeenCalledWith('cookie-rf');
    });

    it('cookie 없으면 body.refreshToken fallback', async () => {
      auth.refresh.mockResolvedValue(tokens());
      const { res } = makeRes();
      const req = { cookies: {} } as unknown as Request;

      await controller.refresh(req, { refreshToken: 'body-rf' } as never, res);
      expect(auth.refresh).toHaveBeenCalledWith('body-rf');
    });

    it('cookie + body 모두 없음 → BadRequestException("refresh_token_missing")', async () => {
      const { res } = makeRes();
      const req = { cookies: {} } as unknown as Request;

      await expect(controller.refresh(req, {} as never, res)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(controller.refresh(req, {} as never, res)).rejects.toThrow(/refresh_token_missing/);
    });

    it('성공 시 새 cookie set', async () => {
      auth.refresh.mockResolvedValue(tokens());
      const { res, calls } = makeRes();
      const req = { cookies: { refresh: 'old-cookie' } } as unknown as Request;

      await controller.refresh(req, {} as never, res);
      expect(calls.cookie).toHaveLength(2);
      expect(calls.cookie[0]!.value).toBe('acc-token');
      expect(calls.cookie[1]!.value).toBe('ref-token');
    });
  });

  describe('logout', () => {
    it('AuthService.logout(user.sub) 호출 + cookie clear', async () => {
      auth.logout.mockResolvedValue(undefined);
      const { res, calls } = makeRes();
      const req = { user: { sub: 'user-x' } } as unknown as Request;

      const out = await controller.logout(req, res);

      expect(auth.logout).toHaveBeenCalledWith('user-x');
      expect(out).toEqual({ ok: true });
      // clearCookie 는 'access' + 'refresh' 두 번
      expect(calls.cookie.length).toBeGreaterThanOrEqual(2);
      const names = calls.cookie.map((c) => c.name);
      expect(names).toContain('access');
      expect(names).toContain('refresh');
    });
  });
});
