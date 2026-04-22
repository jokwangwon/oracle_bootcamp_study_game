import type { DataSource, EntityManager, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEventLogEntity } from './entities/ops-event-log.entity';
import { UserTokenHashSaltEpochEntity } from './entities/user-token-hash-salt-epoch.entity';
import {
  SaltRotationService,
  saltFingerprint,
} from './salt-rotation.service';

/**
 * ADR-018 §3·§6·§11 — SaltRotationService TDD.
 */

const SALT_A = 'dev-salt-1234567890-aaaa'; // 24 chars
const SALT_B = 'prod-salt-0987654321-bbbb'; // 25 chars
const ADMIN = '11111111-2222-3333-4444-555555555555';

function fp(salt: string): string {
  return saltFingerprint(salt);
}

interface MockCtx {
  service: SaltRotationService;
  epochSave: ReturnType<typeof vi.fn>;
  opsSave: ReturnType<typeof vi.fn>;
  findActive: ReturnType<typeof vi.fn>;
  saved: UserTokenHashSaltEpochEntity[];
}

function makeService(opts: {
  activeEpoch?: UserTokenHashSaltEpochEntity | null;
} = {}): MockCtx {
  const saved: UserTokenHashSaltEpochEntity[] = [];
  const findActive = vi.fn(async () => opts.activeEpoch ?? null);
  const epochSave = vi.fn(
    async (e: UserTokenHashSaltEpochEntity) => {
      const id = e.epochId ?? saved.length + 1;
      const result = { ...e, epochId: id };
      saved.push(result);
      return result;
    },
  );
  const epochRepo = {
    findOne: findActive,
    save: epochSave,
    create: (e: Partial<UserTokenHashSaltEpochEntity>) => ({ ...e }),
  } as unknown as Repository<UserTokenHashSaltEpochEntity>;

  const opsSave = vi.fn(async (e: OpsEventLogEntity) => e);
  const opsRepo = {
    create: (e: Partial<OpsEventLogEntity>) => ({ ...e }),
    save: opsSave,
  } as unknown as Repository<OpsEventLogEntity>;

  const manager = {
    getRepository: (target: unknown) => {
      if (target === UserTokenHashSaltEpochEntity) return epochRepo;
      if (target === OpsEventLogEntity) return opsRepo;
      throw new Error('unexpected repo target');
    },
  } as EntityManager;

  const dataSource = {
    transaction: vi.fn(async <T,>(cb: (m: EntityManager) => Promise<T>) => cb(manager)),
  } as unknown as DataSource;

  const service = new SaltRotationService(epochRepo, opsRepo, dataSource);
  return { service, epochSave, opsSave, findActive, saved };
}

describe('SaltRotationService (ADR-018 §3·§6·§11)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('최초 rotation (prev=null) → epoch 1 INSERT + ops_event_log 기록', async () => {
    const ctx = makeService();
    const result = await ctx.service.rotate({
      newSalt: SALT_A,
      prevSalt: null,
      adminId: ADMIN,
      reason: 'scheduled',
      adminAck: `none:${fp(SALT_A)}`,
    });

    expect(result.newFingerprint).toBe(fp(SALT_A));
    expect(result.prevFingerprint).toBeNull();
    expect(ctx.epochSave).toHaveBeenCalledOnce();
    expect(ctx.opsSave).toHaveBeenCalledOnce();

    const opsArg = ctx.opsSave.mock.calls[0][0];
    expect(opsArg.kind).toBe('salt_rotation');
    expect(opsArg.userId).toBe(ADMIN);
    expect(opsArg.payload).toEqual({
      prevFingerprint: null,
      newFingerprint: fp(SALT_A),
      rotatedBy: ADMIN,
      reason: 'scheduled',
    });
  });

  it('두 번째 rotation — 기존 active 비활성화 + 새 epoch INSERT', async () => {
    const active: UserTokenHashSaltEpochEntity = {
      epochId: 1,
      saltFingerprint: fp(SALT_A),
      activatedAt: new Date('2026-01-01'),
      deactivatedAt: null,
      adminId: ADMIN,
      reason: 'scheduled',
      note: null,
      createdAt: new Date('2026-01-01'),
    };
    const ctx = makeService({ activeEpoch: active });

    await ctx.service.rotate({
      newSalt: SALT_B,
      prevSalt: SALT_A,
      adminId: ADMIN,
      reason: 'incident',
      note: 'suspected leak',
      adminAck: `${fp(SALT_A)}:${fp(SALT_B)}`,
    });

    // active epoch 가 deactivated 로 update 되고, 새 epoch 도 save
    expect(ctx.epochSave).toHaveBeenCalledTimes(2);
    const firstSave = ctx.epochSave.mock.calls[0][0];
    expect(firstSave.epochId).toBe(1);
    expect(firstSave.deactivatedAt).toBeInstanceOf(Date);

    const secondSave = ctx.epochSave.mock.calls[1][0];
    expect(secondSave.saltFingerprint).toBe(fp(SALT_B));
    expect(secondSave.reason).toBe('incident');
    expect(secondSave.note).toBe('suspected leak');
    expect(secondSave.deactivatedAt).toBeNull();
  });

  it('ADMIN_ACK_SALT_ROTATION mismatch → throw (§11 step 3)', async () => {
    const ctx = makeService();
    await expect(
      ctx.service.rotate({
        newSalt: SALT_A,
        prevSalt: null,
        adminId: ADMIN,
        reason: 'scheduled',
        adminAck: 'none:wrong',
      }),
    ).rejects.toThrow(/ADMIN_ACK_SALT_ROTATION mismatch/);
  });

  it('prev fingerprint === new fingerprint → no-op rejected (§7 refinement 2)', async () => {
    const ctx = makeService();
    await expect(
      ctx.service.rotate({
        newSalt: SALT_A,
        prevSalt: SALT_A,
        adminId: ADMIN,
        reason: 'scheduled',
        adminAck: `${fp(SALT_A)}:${fp(SALT_A)}`,
      }),
    ).rejects.toThrow(/identical/);
  });

  it('newSalt 16자 미만 → throw', async () => {
    const ctx = makeService();
    await expect(
      ctx.service.rotate({
        newSalt: 'short',
        adminId: ADMIN,
        reason: 'scheduled',
        adminAck: 'none:xxx',
      }),
    ).rejects.toThrow(/16자/);
  });

  it('reason 이 enum 외 → throw', async () => {
    const ctx = makeService();
    await expect(
      ctx.service.rotate({
        newSalt: SALT_A,
        adminId: ADMIN,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reason: 'bogus' as any,
        adminAck: `none:${fp(SALT_A)}`,
      }),
    ).rejects.toThrow(/invalid reason/);
  });

  it('saltFingerprint: 동일 salt → 동일 hex 8자, 서로 다른 salt → 다름', () => {
    const a = saltFingerprint(SALT_A);
    const a2 = saltFingerprint(SALT_A);
    const b = saltFingerprint(SALT_B);
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-f0-9]{8}$/);
  });
});
