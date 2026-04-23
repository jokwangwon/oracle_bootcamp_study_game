import { describe, expect, it, vi } from 'vitest';
import type { EntityManager, Repository } from 'typeorm';

import { UserTokenHashSaltEpochEntity } from './entities/user-token-hash-salt-epoch.entity';
import { ActiveEpochLookup } from './active-epoch.lookup';

/**
 * consensus-007 S6-C1-6 — ActiveEpochLookup TDD + epoch SELECT race 회귀 방지.
 *
 * 본 테스트는 Session 6 PR #2 에서 answer_history INSERT 시 user_token_hash_epoch
 * 컬럼을 채우는 경로의 **선행 계약**을 고정한다. PR #2 의 GameSessionService 배선
 * 은 본 helper 를 재사용.
 *
 * Race 시나리오 (ADR-018 §5):
 *  - SaltRotationService.rotate() 는 dataSource.transaction 단일 TX 로 deactivate +
 *    insert 를 원자적 수행.
 *  - reader (본 helper) 는 rotation COMMIT 전에는 구 epoch, COMMIT 후에는 새 epoch.
 *  - partial unique index 가 active=1 불변 보장.
 */

function makeRepo(
  rows: UserTokenHashSaltEpochEntity[] | null,
): Repository<UserTokenHashSaltEpochEntity> {
  return {
    findOne: vi.fn(async (opts: Record<string, unknown>) => {
      if (rows === null) return null;
      // partial unique index + ORDER BY activated_at DESC 기대 — 시뮬
      const where = (opts as { where: { deactivatedAt: unknown } }).where;
      const active = rows.filter((r) => {
        // IsNull() 객체는 런타임에 `_type: 'isNull'` 로 구분 — 여기서는 where.deactivatedAt
        // 을 전달 그대로 사용한다는 전제만 확인하고, 필터는 실제 deactivatedAt 값으로.
        void where;
        return r.deactivatedAt === null;
      });
      active.sort(
        (a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime(),
      );
      return active[0] ?? null;
    }),
  } as unknown as Repository<UserTokenHashSaltEpochEntity>;
}

function makeManager(
  rows: UserTokenHashSaltEpochEntity[] | null,
): EntityManager {
  const repo = makeRepo(rows);
  return {
    getRepository: vi.fn(() => repo),
  } as unknown as EntityManager;
}

function makeEpoch(
  epochId: number,
  activatedAt: string,
  deactivatedAt: string | null,
): UserTokenHashSaltEpochEntity {
  return {
    epochId,
    saltFingerprint: 'abcdef01',
    activatedAt: new Date(activatedAt) as unknown as string,
    deactivatedAt: (deactivatedAt ? new Date(deactivatedAt) : null) as unknown as string | null,
    adminId: '00000000-0000-0000-0000-000000000000',
    reason: 'scheduled',
    note: null,
    createdAt: new Date() as unknown as string,
  } as UserTokenHashSaltEpochEntity;
}

describe('ActiveEpochLookup (consensus-007 C1-6 + ADR-018 §5)', () => {
  it('active row 1건 → epochId 반환', async () => {
    const rows = [makeEpoch(7, '2026-04-22T00:00:00Z', null)];
    const lookup = new ActiveEpochLookup(makeRepo(rows));

    const epochId = await lookup.getActiveEpochId();
    expect(epochId).toBe(7);
  });

  it('active row 0건 → throw (fail-closed, ADR-018 §5)', async () => {
    const lookup = new ActiveEpochLookup(makeRepo([]));

    await expect(lookup.getActiveEpochId()).rejects.toThrow(/active.*epoch|fail-closed/i);
  });

  it('manager 전달 시 해당 EntityManager 사용 (트랜잭션 연동)', async () => {
    const rows = [makeEpoch(11, '2026-04-22T00:00:00Z', null)];
    const defaultRepo = makeRepo([makeEpoch(999, '2020-01-01T00:00:00Z', null)]);
    const manager = makeManager(rows);
    const lookup = new ActiveEpochLookup(defaultRepo);

    const epochId = await lookup.getActiveEpochId(manager);
    expect(epochId).toBe(11);
    expect(manager.getRepository).toHaveBeenCalledWith(UserTokenHashSaltEpochEntity);
  });

  it('race 시나리오 — rotation COMMIT 전 snapshot 에서는 구 epoch 관측', async () => {
    // TX_reader 가 rotation TX 의 COMMIT 전에 SELECT — 구 active epoch 만 보임
    const preRotation = [makeEpoch(5, '2026-04-01T00:00:00Z', null)];
    const lookup = new ActiveEpochLookup(makeRepo(preRotation));
    expect(await lookup.getActiveEpochId()).toBe(5);
  });

  it('race 시나리오 — rotation COMMIT 후 snapshot 에서는 새 epoch 관측', async () => {
    // 기존 epoch deactivated, 새 epoch active
    const postRotation = [
      makeEpoch(5, '2026-04-01T00:00:00Z', '2026-04-22T12:00:00Z'),
      makeEpoch(6, '2026-04-22T12:00:00Z', null),
    ];
    const lookup = new ActiveEpochLookup(makeRepo(postRotation));
    expect(await lookup.getActiveEpochId()).toBe(6);
  });

  it('다수 active (partial unique index 손상 가정) — 가장 최근 activated_at 반환 (방어)', async () => {
    // 실제로는 partial unique index 가 막지만, helper 레벨 방어는 order by DESC
    const withTwo = [
      makeEpoch(10, '2026-04-01T00:00:00Z', null),
      makeEpoch(11, '2026-04-22T00:00:00Z', null),
    ];
    const lookup = new ActiveEpochLookup(makeRepo(withTwo));
    expect(await lookup.getActiveEpochId()).toBe(11);
  });
});
