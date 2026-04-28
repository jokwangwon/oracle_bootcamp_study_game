import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from './auth.service';
import type { RefreshTokenService } from './refresh-token.service';
import type { UsersService } from '../users/users.service';

/**
 * PR-10a Phase 6 — AuthService 리팩토링.
 *
 * ADR-020 §4.2.1 B 절 — access JWT 에 epoch claim 포함, refresh 동시 발급,
 * refresh 시 epoch 동기화, logout 시 incrementTokenEpoch + revokeAllForUser.
 */

const ACCESS_SECRET = 'test-access-secret-very-long-32++';

function makeJwt() {
  return new JwtService({
    secret: ACCESS_SECRET,
    signOptions: { expiresIn: '15m' },
  });
}

function makeUsersService() {
  return {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    getTokenEpoch: vi.fn(),
    incrementTokenEpoch: vi.fn(),
  } as unknown as UsersService & Record<string, ReturnType<typeof vi.fn>>;
}

function makeRefreshService() {
  return {
    issueInitial: vi.fn(),
    rotate: vi.fn(),
    revokeAllForUser: vi.fn(),
  } as unknown as RefreshTokenService & Record<string, ReturnType<typeof vi.fn>>;
}

describe('AuthService (PR-10a)', () => {
  let jwt: JwtService;
  let users: ReturnType<typeof makeUsersService>;
  let refreshSvc: ReturnType<typeof makeRefreshService>;
  let auth: AuthService;

  beforeEach(() => {
    jwt = makeJwt();
    users = makeUsersService();
    refreshSvc = makeRefreshService();
    auth = new AuthService(users, jwt, refreshSvc);
  });

  it('login — access JWT 에 epoch claim 포함 + refresh 동시 발급', async () => {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('pw1234567', 12);

    users.findByEmail.mockResolvedValue({
      id: 'u-1',
      username: 'user1',
      email: 'a@b.c',
      passwordHash,
      role: 'player',
      tokenEpoch: 7,
      createdAt: new Date(),
    });
    users.getTokenEpoch.mockResolvedValue(7);
    refreshSvc.issueInitial.mockResolvedValue({
      refreshToken: 'rfk-token',
      jti: 'rfk-jti',
      userId: 'u-1',
      familyId: 'rfk-fam',
      generation: 0,
    });

    const out = await auth.login('a@b.c', 'pw1234567');

    expect(out.accessToken).toMatch(/^eyJ/);
    expect(out.refreshToken).toBe('rfk-token');
    expect(out.refreshJti).toBe('rfk-jti');
    expect(out.refreshFamilyId).toBe('rfk-fam');

    // access JWT decode → epoch claim 검증
    const decoded = jwt.decode(out.accessToken) as { sub: string; username: string; epoch: number };
    expect(decoded.sub).toBe('u-1');
    expect(decoded.username).toBe('user1');
    expect(decoded.epoch).toBe(7);

    expect(refreshSvc.issueInitial).toHaveBeenCalledWith('u-1');
  });

  it('register — access JWT 에 epoch claim 포함 + refresh 동시 발급', async () => {
    users.create.mockResolvedValue({
      id: 'u-new',
      username: 'fresh',
      email: 'f@f.f',
      passwordHash: 'h',
      role: 'player',
      tokenEpoch: 0,
      createdAt: new Date(),
    });
    users.getTokenEpoch.mockResolvedValue(0);
    refreshSvc.issueInitial.mockResolvedValue({
      refreshToken: 'r-new',
      jti: 'j-new',
      userId: 'u-new',
      familyId: 'fam-new',
      generation: 0,
    });

    const out = await auth.register({
      username: 'fresh',
      email: 'f@f.f',
      password: 'pw1234567',
    });

    expect(out.accessToken).toMatch(/^eyJ/);
    expect(out.refreshToken).toBe('r-new');
    const decoded = jwt.decode(out.accessToken) as { sub: string; epoch: number };
    expect(decoded.sub).toBe('u-new');
    expect(decoded.epoch).toBe(0);

    expect(refreshSvc.issueInitial).toHaveBeenCalledWith('u-new');
  });

  it('refresh — rotate 호출 + 새 access JWT 의 epoch 가 현재 token_epoch 동기화', async () => {
    refreshSvc.rotate.mockResolvedValue({
      refreshToken: 'r-rot',
      jti: 'j-rot',
      userId: 'u-rot',
      familyId: 'fam-rot',
      generation: 3,
    });
    users.findById.mockResolvedValue({
      id: 'u-rot',
      username: 'rotter',
      tokenEpoch: 12,
    });
    users.getTokenEpoch.mockResolvedValue(12);

    const out = await auth.refresh('raw-token-input');

    expect(out.accessToken).toMatch(/^eyJ/);
    expect(out.refreshToken).toBe('r-rot');
    expect(out.refreshJti).toBe('j-rot');
    expect(out.refreshFamilyId).toBe('fam-rot');

    const decoded = jwt.decode(out.accessToken) as { sub: string; username: string; epoch: number };
    expect(decoded.sub).toBe('u-rot');
    expect(decoded.username).toBe('rotter');
    expect(decoded.epoch).toBe(12);

    expect(refreshSvc.rotate).toHaveBeenCalledWith('raw-token-input');
  });

  it('logout — incrementTokenEpoch + revokeAllForUser 모두 호출 (병렬)', async () => {
    users.incrementTokenEpoch.mockResolvedValue(8);
    refreshSvc.revokeAllForUser.mockResolvedValue(undefined);

    await auth.logout('u-logout');

    expect(users.incrementTokenEpoch).toHaveBeenCalledWith('u-logout');
    expect(refreshSvc.revokeAllForUser).toHaveBeenCalledWith('u-logout');
  });
});
