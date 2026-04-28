import { describe, expect, it, beforeEach } from 'vitest';

import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';
import { UserProgressEntity } from './entities/user-progress.entity';

/**
 * UsersService 단위 테스트.
 *
 * Repository를 in-memory fake로 대체. ScopeValidatorService 테스트와
 * 동일한 패턴 (DB 없이 비즈니스 로직만 검증).
 *
 * 주된 검증 대상: recordSessionProgress() — 솔로 세션 종료 시 user_progress
 * upsert 로직.
 */

class FakeUserRepo {
  users: UserEntity[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(input: any): UserEntity {
    return {
      id: 'u-fake',
      createdAt: new Date(),
      tokenEpoch: 0,
      ...input,
    } as UserEntity;
  }

  async save(u: UserEntity): Promise<UserEntity> {
    const existing = this.users.find((x) => x.id === u.id);
    if (existing) {
      Object.assign(existing, u);
      return existing;
    }
    this.users.push(u);
    return u;
  }

  async findOne({ where }: { where: Partial<UserEntity> }): Promise<UserEntity | null> {
    return (
      this.users.find((u) =>
        Object.entries(where).every(([k, v]) => (u as Record<string, unknown>)[k] === v),
      ) ?? null
    );
  }

  /** Repository.increment 모방 — atomic UPDATE SET col = col + value WHERE ... */
  async increment(
    where: Partial<UserEntity>,
    propertyPath: keyof UserEntity,
    value: number,
  ): Promise<{ affected: number }> {
    const user = this.users.find((u) =>
      Object.entries(where).every(([k, v]) => (u as Record<string, unknown>)[k] === v),
    );
    if (!user) return { affected: 0 };
    const current = (user as unknown as Record<string, number>)[propertyPath as string] ?? 0;
    (user as unknown as Record<string, number>)[propertyPath as string] = current + value;
    return { affected: 1 };
  }
}

class FakeProgressRepo {
  progresses: UserProgressEntity[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(input: any): UserProgressEntity {
    return {
      id: `p-${this.progresses.length + 1}`,
      lastPlayedAt: new Date(),
      totalScore: 0,
      gamesPlayed: 0,
      accuracy: 0,
      streak: 0,
      ...input,
    } as UserProgressEntity;
  }

  async save(p: UserProgressEntity): Promise<UserProgressEntity> {
    const existing = this.progresses.find(
      (x) => x.userId === p.userId && x.topic === p.topic && x.week === p.week,
    );
    if (existing) {
      Object.assign(existing, p);
      return existing;
    }
    if (!p.id) {
      p.id = `p-${this.progresses.length + 1}`;
    }
    this.progresses.push(p);
    return p;
  }

  async findOne({
    where,
  }: {
    where: { userId: string; topic: string; week: number };
  }): Promise<UserProgressEntity | null> {
    return (
      this.progresses.find(
        (p) => p.userId === where.userId && p.topic === where.topic && p.week === where.week,
      ) ?? null
    );
  }

  async find({ where }: { where: { userId: string } }): Promise<UserProgressEntity[]> {
    return this.progresses.filter((p) => p.userId === where.userId);
  }
}

function makeService() {
  const userRepo = new FakeUserRepo();
  const progressRepo = new FakeProgressRepo();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new UsersService(userRepo as any, progressRepo as any);
  return { service, userRepo, progressRepo };
}

describe('UsersService.recordSessionProgress', () => {
  let svc: UsersService;
  let progressRepo: FakeProgressRepo;
  const USER_ID = 'user-1';

  beforeEach(() => {
    const built = makeService();
    svc = built.service;
    progressRepo = built.progressRepo;
  });

  it('진도가 없으면 신규 INSERT 한다', async () => {
    const result = await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 10,
      correctCount: 8,
      sessionScore: 5000,
    });

    expect(result.totalScore).toBe(5000);
    expect(result.gamesPlayed).toBe(1);
    expect(result.accuracy).toBeCloseTo(0.8, 5);
    expect(result.streak).toBe(0); // 100% 정답이 아니므로 reset
    expect(progressRepo.progresses).toHaveLength(1);
  });

  it('100% 정답이면 streak이 정답 수만큼 증가한다 (신규 세션)', async () => {
    const result = await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 5,
      correctCount: 5,
      sessionScore: 6000,
    });

    expect(result.streak).toBe(5);
  });

  it('이미 진도가 있으면 누적 갱신한다', async () => {
    // 1차: 10라운드 중 8개 정답, 5000점
    await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 10,
      correctCount: 8,
      sessionScore: 5000,
    });

    // 2차: 5라운드 100% 정답, 6000점
    const result = await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 5,
      correctCount: 5,
      sessionScore: 6000,
    });

    expect(result.totalScore).toBe(11_000);
    expect(result.gamesPlayed).toBe(2);
    // accuracy 가중평균: (10*0.8 + 5*1.0) / 15 = 13/15
    expect(result.accuracy).toBeCloseTo(13 / 15, 5);
    // 100% 정답 세션이었으므로 streak += 5 (이전 0)
    expect(result.streak).toBe(5);
    expect(progressRepo.progresses).toHaveLength(1);
  });

  it('100% 세션 후 일부 오답 세션이 오면 streak이 reset 된다', async () => {
    await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 5,
      correctCount: 5,
      sessionScore: 6000,
    });

    const result = await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 5,
      correctCount: 4,
      sessionScore: 4000,
    });

    expect(result.streak).toBe(0);
    expect(result.gamesPlayed).toBe(2);
  });

  it('topic/week 조합이 다르면 별개의 progress 행으로 저장된다', async () => {
    await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 1,
      totalRounds: 5,
      correctCount: 5,
      sessionScore: 6000,
    });
    await svc.recordSessionProgress({
      userId: USER_ID,
      topic: 'sql-basics',
      week: 2,
      totalRounds: 5,
      correctCount: 3,
      sessionScore: 3000,
    });

    expect(progressRepo.progresses).toHaveLength(2);
  });

  it('totalRounds=0 입력은 BadRequest를 throw 한다', async () => {
    await expect(
      svc.recordSessionProgress({
        userId: USER_ID,
        topic: 'sql-basics',
        week: 1,
        totalRounds: 0,
        correctCount: 0,
        sessionScore: 0,
      }),
    ).rejects.toThrow();
  });

  it('correctCount > totalRounds 입력은 BadRequest를 throw 한다', async () => {
    await expect(
      svc.recordSessionProgress({
        userId: USER_ID,
        topic: 'sql-basics',
        week: 1,
        totalRounds: 5,
        correctCount: 6,
        sessionScore: 5000,
      }),
    ).rejects.toThrow();
  });
});

describe('UsersService.tokenEpoch (PR-10a Phase 5)', () => {
  let svc: UsersService;
  let userRepo: FakeUserRepo;

  beforeEach(async () => {
    const built = makeService();
    svc = built.service;
    userRepo = built.userRepo;
    // 테스트용 user 사전 INSERT
    await userRepo.save({
      id: 'user-x',
      username: 'x',
      email: 'x@x',
      passwordHash: 'h',
      role: 'player',
      tokenEpoch: 0,
      createdAt: new Date(),
    } as UserEntity);
  });

  it('getTokenEpoch — 신규 user 는 0 반환', async () => {
    expect(await svc.getTokenEpoch('user-x')).toBe(0);
  });

  it('incrementTokenEpoch — atomic increment (5 호출 → 5)', async () => {
    for (let i = 0; i < 5; i++) {
      await svc.incrementTokenEpoch('user-x');
    }
    expect(await svc.getTokenEpoch('user-x')).toBe(5);
  });

  it('getTokenEpoch — 없는 user → NotFoundException', async () => {
    await expect(svc.getTokenEpoch('ghost-user')).rejects.toThrow(/not found/i);
  });

  it('incrementTokenEpoch — 없는 user → NotFoundException', async () => {
    await expect(svc.incrementTokenEpoch('ghost-user')).rejects.toThrow(/not found/i);
  });
});
