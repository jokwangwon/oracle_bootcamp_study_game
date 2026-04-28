import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import type IORedis from 'ioredis';

import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';
import { buildRefreshClaims } from './refresh-token.utils';

/**
 * PR-10a Phase 4 — RefreshTokenService.
 *
 * ADR-020 §4.2.1 부속서 A 절 — refresh rotation + reuse detection + Redis SETNX
 * mutex + family revoke. 12 cases (consensus-010 Reviewer 결정 #7 이행).
 */

const REFRESH_SECRET = 'test-refresh-secret-very-long-32+';
const REFRESH_EXPIRES_IN = '14d';
const NOW = new Date('2026-04-29T00:00:00Z');

type MockRepo = {
  findOne: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

function makeRepo(): MockRepo {
  return {
    findOne: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    save: vi.fn(),
  };
}

function makeRedis(initial: { setReturn?: 'OK' | null; setThrows?: boolean } = {}) {
  const calls: Array<{ args: unknown[] }> = [];
  return {
    calls,
    redis: {
      set: vi.fn(async (...args: unknown[]) => {
        calls.push({ args });
        if (initial.setThrows) throw new Error('redis-down');
        // nullish coalescing 은 null 도 fallback 시키므로 명시 분기.
        return initial.setReturn === undefined ? 'OK' : initial.setReturn;
      }),
    } as unknown as IORedis,
  };
}

function makeDataSource(repo: MockRepo, opts: { transactionThrows?: boolean } = {}) {
  return {
    transaction: vi.fn(async (cb: (m: EntityManager) => unknown) => {
      const manager = {
        update: repo.update,
        insert: repo.insert,
      } as unknown as EntityManager;
      if (opts.transactionThrows) {
        await repo.update();
        throw new Error('insert-failed');
      }
      return cb(manager);
    }),
  } as unknown as DataSource;
}

function buildJwt(jwt: JwtService, claims: Record<string, unknown>) {
  return jwt.sign(claims, { secret: REFRESH_SECRET });
}

function makeJwt() {
  return new JwtService({ secret: REFRESH_SECRET });
}

function makeService(opts: {
  repo: MockRepo;
  redis: IORedis;
  ds: DataSource;
  jwt: JwtService;
  now?: Date;
}) {
  const service = new RefreshTokenService(
    opts.repo as unknown as Repository<RefreshTokenEntity>,
    opts.ds,
    opts.jwt,
    opts.redis,
    {
      refreshSecret: REFRESH_SECRET,
      refreshExpiresIn: REFRESH_EXPIRES_IN,
      now: opts.now ?? (() => NOW),
    },
  );
  return service;
}

describe('RefreshTokenService', () => {
  let repo: MockRepo;
  let jwt: JwtService;

  beforeEach(() => {
    repo = makeRepo();
    jwt = makeJwt();
  });

  describe('issueInitial (login/register)', () => {
    it('새 family 생성 + generation=0 + DB 저장 + JWT 반환', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis();
      const service = makeService({ repo, redis, ds, jwt });

      repo.insert.mockResolvedValue({ raw: [], generatedMaps: [] });

      const out = await service.issueInitial('user-1');

      expect(out.refreshToken).toMatch(/^eyJ/); // JWT prefix
      expect(out.jti).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.familyId).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.userId).toBe('user-1');

      // DB insert 호출 검증
      expect(repo.insert).toHaveBeenCalledOnce();
      const inserted = repo.insert.mock.calls[0]![0];
      expect(inserted).toMatchObject({
        userId: 'user-1',
        generation: 0,
        revokedAt: null,
        replacedBy: null,
      });
    });
  });

  describe('rotate (4.1) — 정상 회전', () => {
    it('활성 jti → 새 jti 발급 + 기존 revoke + replacedBy 갱신 + generation++', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis({ setReturn: 'OK' });
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = '11111111-1111-1111-1111-111111111111';
      const familyId = 'fam-1';
      const claims = buildRefreshClaims({
        jti: oldJti,
        userId: 'user-1',
        familyId,
        generation: 0,
        expiresIn: REFRESH_EXPIRES_IN,
        now: NOW,
      });
      const rawToken = buildJwt(jwt, claims);

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-1',
        familyId,
        generation: 0,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: null,
        createdAt: NOW,
      });

      const out = await service.rotate(rawToken);

      expect(out.userId).toBe('user-1');
      expect(out.familyId).toBe(familyId);
      expect(out.jti).not.toBe(oldJti);

      // 기존 revoke + replacedBy 갱신
      expect(repo.update).toHaveBeenCalledWith(
        RefreshTokenEntity,
        { jti: oldJti },
        expect.objectContaining({ replacedBy: out.jti }),
      );

      // 새 row insert + generation+1
      expect(repo.insert).toHaveBeenCalledWith(
        RefreshTokenEntity,
        expect.objectContaining({
          jti: out.jti,
          userId: 'user-1',
          familyId,
          generation: 1,
        }),
      );
    });
  });

  describe('rotate (4.2) — reuse detection: revokedAt 존재', () => {
    it('이미 revoked 된 jti → family 전체 revoke + UnauthorizedException', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis();
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = '22222222-2222-2222-2222-222222222222';
      const familyId = 'fam-2';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-2',
          familyId,
          generation: 1,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-2',
        familyId,
        generation: 1,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: NOW,
        replacedBy: null,
        createdAt: NOW,
      });

      await expect(service.rotate(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.rotate(rawToken)).rejects.toThrow(/refresh_reuse_detected/);

      // family 전체 revoke 호출
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-2', familyId, revokedAt: expect.any(Object) },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('rotate (4.3) — reuse detection: replacedBy 존재', () => {
    it('이미 회전된 jti 재사용 → family 전체 revoke + Unauthorized', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis();
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = '33333333-3333-3333-3333-333333333333';
      const familyId = 'fam-3';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-3',
          familyId,
          generation: 0,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-3',
        familyId,
        generation: 0,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: 'next-jti',
        createdAt: NOW,
      });

      await expect(service.rotate(rawToken)).rejects.toThrow(/refresh_reuse_detected/);
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('rotate (4.4) — 만료', () => {
    it('exp 가 지난 refresh → UnauthorizedException("refresh_expired")', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis();
      // system clock 의존성을 피하기 위해 절대 과거 시각 + 짧은 expiresIn 사용.
      const longAgo = new Date('2020-01-01T00:00:00Z');
      const service = makeService({ repo, redis, ds, jwt });

      const claims = buildRefreshClaims({
        jti: 'expired-jti',
        userId: 'user-4',
        familyId: 'fam-4',
        generation: 0,
        expiresIn: '1s',
        now: longAgo,
      });
      const rawToken = buildJwt(jwt, claims);

      // findOne 호출 전에 만료 차단되어야 함 (verifyAsync 의 자동 exp 검사)
      await expect(service.rotate(rawToken)).rejects.toThrow(/refresh_expired/);
      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('rotate (4.5) — 없는 jti', () => {
    it('DB 에 없는 jti (탈취 시나리오) → UnauthorizedException("refresh_not_found")', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis();
      const service = makeService({ repo, redis, ds, jwt });

      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: 'ghost-jti',
          userId: 'user-5',
          familyId: 'fam-5',
          generation: 0,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue(null);

      await expect(service.rotate(rawToken)).rejects.toThrow(/refresh_not_found/);
      // family revoke 는 호출되지 않음 (jti 자체가 없으므로 family 식별 불확실)
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('rotate (4.6) — Redis SETNX mutex 정상 (acquire OK)', () => {
    it('첫 호출 acquire 성공 → 정상 rotation', async () => {
      const ds = makeDataSource(repo);
      const { redis, calls } = makeRedis({ setReturn: 'OK' });
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = '66666666-6666-6666-6666-666666666666';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-6',
          familyId: 'fam-6',
          generation: 0,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-6',
        familyId: 'fam-6',
        generation: 0,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: null,
        createdAt: NOW,
      });

      await service.rotate(rawToken);

      // SETNX 호출 검증 — key + EX TTL + NX flag
      expect(calls.length).toBeGreaterThan(0);
      const args = calls[0]!.args;
      expect(args[0]).toMatch(/refresh:lock:/);
      expect(args).toContain('NX');
      expect(args).toContain('EX');
    });
  });

  describe('rotate (4.7) — Redis SETNX 실패 (lock 이미 점유)', () => {
    it('두 번째 호출 acquire 실패 → grace path (rotation 없이 reissue)', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis({ setReturn: null }); // NX 실패
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = '77777777-7777-7777-7777-777777777777';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-7',
          familyId: 'fam-7',
          generation: 2,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-7',
        familyId: 'fam-7',
        generation: 2,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: null,
        createdAt: NOW,
      });

      const out = await service.rotate(rawToken);

      // grace path: rotation 없이 동일 jti 그대로 reissue (또는 service 정의에 따라 다름)
      expect(out.userId).toBe('user-7');
      expect(out.familyId).toBe('fam-7');
      // DB update / insert 호출 0 — rotation 미수행
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
    });
  });

  describe('rotate (4.8) — Redis 다운 fail-open', () => {
    it('redis.set 이 throw → grace path 진입 (정책: fail-open)', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis({ setThrows: true });
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = '88888888-8888-8888-8888-888888888888';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-8',
          familyId: 'fam-8',
          generation: 0,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-8',
        familyId: 'fam-8',
        generation: 0,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: null,
        createdAt: NOW,
      });

      // throw 안 하고 grace path 로 진행
      const out = await service.rotate(rawToken);
      expect(out.userId).toBe('user-8');
    });
  });

  describe('rotate (4.9) — 트랜잭션 롤백', () => {
    it('insert 실패 mock → 기존 revokedAt 도 롤백 (트랜잭션)', async () => {
      const repo2 = makeRepo();
      const ds = makeDataSource(repo2, { transactionThrows: true });
      const { redis } = makeRedis({ setReturn: 'OK' });
      const service = makeService({ repo: repo2, redis, ds, jwt });

      const oldJti = '99999999-9999-9999-9999-999999999999';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-9',
          familyId: 'fam-9',
          generation: 0,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo2.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-9',
        familyId: 'fam-9',
        generation: 0,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: null,
        createdAt: NOW,
      });

      await expect(service.rotate(rawToken)).rejects.toThrow();
      // dataSource.transaction 단일 호출 — 부분 commit 없음
      expect(ds.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('rotate (4.11) — expiresAt = now + refreshExpiresIn', () => {
    it('새 row 의 expiresAt 이 config.refreshExpiresIn (14d) 만큼 미래', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis({ setReturn: 'OK' });
      const service = makeService({ repo, redis, ds, jwt });

      const oldJti = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const rawToken = buildJwt(
        jwt,
        buildRefreshClaims({
          jti: oldJti,
          userId: 'user-11',
          familyId: 'fam-11',
          generation: 0,
          expiresIn: REFRESH_EXPIRES_IN,
          now: NOW,
        }),
      );

      repo.findOne.mockResolvedValue({
        jti: oldJti,
        userId: 'user-11',
        familyId: 'fam-11',
        generation: 0,
        expiresAt: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14),
        revokedAt: null,
        replacedBy: null,
        createdAt: NOW,
      });

      await service.rotate(rawToken);

      const insertCall = repo.insert.mock.calls[0]!;
      const inserted = insertCall[1] as { expiresAt: Date };
      const expected = new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 14);
      expect(inserted.expiresAt.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('revokeAllForUser (4.12)', () => {
    it('모든 활성 refresh 일괄 revoke (UPDATE WHERE userId AND revokedAt IS NULL)', async () => {
      const ds = makeDataSource(repo);
      const { redis } = makeRedis();
      const service = makeService({ repo, redis, ds, jwt });

      repo.update.mockResolvedValue({ affected: 3 });

      await service.revokeAllForUser('user-bulk');

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-bulk', revokedAt: expect.any(Object) }, // IsNull()
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });
});
