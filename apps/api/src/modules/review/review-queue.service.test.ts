import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReviewQueueEntity } from './entities/review-queue.entity';
import { ReviewQueueService } from './review-queue.service';

/**
 * ADR-019 §5 PR-3 — ReviewQueueService TDD.
 *
 *  - §5.1: upsertAfterAnswer (정상 답변 경로)
 *      1. findOne 으로 existing 조회
 *      2. 없을 때만 today insert count + cap 비교 → 초과 drop + overflow event
 *      3. sm2Next(prev, quality, anchor) 계산 → upsert (ON CONFLICT DO UPDATE)
 *      4. user_token_hash + epoch 자동 채움 (fail-safe null)
 *      5. easeFactor 는 numeric(4,3) → toFixed(3) 문자열로 저장
 *  - §5.1 admin-override: overwriteAfterOverride (cap/existence 체크 없이 덮어쓰기)
 */

type Repo = {
  findOne: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
};

function makeRepo(): Repo {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockResolvedValue([]),
  };
}

type QbMock = {
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
};

function makeQb(returned: unknown[] = []): QbMock {
  const qb: QbMock = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(returned),
  };
  return qb;
}

type QuestionRepo = { createQueryBuilder: ReturnType<typeof vi.fn> };

function makeQuestionRepo(returned: unknown[] = []): {
  repo: QuestionRepo;
  qb: QbMock;
} {
  const qb = makeQb(returned);
  const repo: QuestionRepo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
  return { repo, qb };
}

function makeConfig(cap: number | undefined = 100, salt = 'salt-of-at-least-sixteen-chars!!') {
  return {
    get: vi.fn((key: string) => {
      if (key === 'SR_DAILY_NEW_CAP') return cap;
      if (key === 'USER_TOKEN_HASH_SALT') return salt;
      return undefined;
    }),
  } as never;
}

function makeActiveEpoch(epochId: number | Error = 1) {
  return {
    getActiveEpochId:
      epochId instanceof Error
        ? vi.fn().mockRejectedValue(epochId)
        : vi.fn().mockResolvedValue(epochId),
  } as never;
}

function makeGradingMeasurement() {
  return {
    recordSrQueueOverflow: vi.fn().mockResolvedValue(undefined),
    recordSrUpsertFail: vi.fn().mockResolvedValue(undefined),
  } as never;
}

const anchor = new Date('2026-04-24T12:00:00.000Z');

describe('ReviewQueueService.upsertAfterAnswer — 정상 답변 경로', () => {
  let repo: Repo;
  beforeEach(() => {
    repo = makeRepo();
  });

  it('existing=null → 신규 편입: cap 미초과 시 sm2Next 결과 upsert', async () => {
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', questionId: 'q-1' },
    });
    expect(repo.count).toHaveBeenCalledOnce();
    expect(repo.upsert).toHaveBeenCalledOnce();
    const [row, conflict] = repo.upsert.mock.calls[0]!;
    expect(conflict).toEqual(['userId', 'questionId']);
    // 첫 성공: repetition=1, intervalDays=1, easeFactor clamp [2.3,2.6] → 2.6
    expect(row.userId).toBe('user-1');
    expect(row.questionId).toBe('q-1');
    expect(row.repetition).toBe(1);
    expect(row.intervalDays).toBe(1);
    expect(row.easeFactor).toBe('2.600');
    expect(row.lastQuality).toBe(5);
    expect(row.algorithmVersion).toBe('sm2-v1');
    expect(new Date(row.lastReviewedAt).toISOString()).toBe(anchor.toISOString());
    expect(new Date(row.dueAt).toISOString()).toBe(
      new Date(anchor.getTime() + 86_400_000).toISOString(),
    );
  });

  it('existing 있을 때: cap 체크 생략하고 prev 상태 기반 sm2Next → upsert', async () => {
    repo.findOne.mockResolvedValueOnce({
      userId: 'user-1',
      questionId: 'q-1',
      easeFactor: '2.500',
      intervalDays: 6,
      repetition: 2,
    } as ReviewQueueEntity);
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    // 기존 행 → cap 체크 호출 없음
    expect(repo.count).not.toHaveBeenCalled();
    const [row] = repo.upsert.mock.calls[0]!;
    // rep 2 → 3, intervalDays=round(6*2.5)=15
    expect(row.repetition).toBe(3);
    expect(row.intervalDays).toBe(15);
  });

  it('일일 상한 도달 (existing=null, count>=cap) → drop + recordSrQueueOverflow', async () => {
    repo.count.mockResolvedValueOnce(100);
    const gm = makeGradingMeasurement();
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
      gm,
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    expect(repo.upsert).not.toHaveBeenCalled();
    expect((gm as unknown as { recordSrQueueOverflow: ReturnType<typeof vi.fn> }).recordSrQueueOverflow).toHaveBeenCalledWith({
      questionId: 'q-1',
      userId: 'user-1',
      payload: { cap: 100, observed: 100 },
    });
  });

  it('일일 상한 미초과 (existing=null, count<cap)', async () => {
    repo.count.mockResolvedValueOnce(99);
    const gm = makeGradingMeasurement();
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
      gm,
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 4, anchor);

    expect(repo.upsert).toHaveBeenCalledOnce();
    expect((gm as unknown as { recordSrQueueOverflow: ReturnType<typeof vi.fn> }).recordSrQueueOverflow).not.toHaveBeenCalled();
  });

  it('cap 미설정 (config 없음) → 기본 100', async () => {
    repo.count.mockResolvedValueOnce(100);
    const gm = makeGradingMeasurement();
    const service = new ReviewQueueService(repo as never, {} as never, undefined, undefined, gm);
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    expect(repo.upsert).not.toHaveBeenCalled();
    expect((gm as unknown as { recordSrQueueOverflow: ReturnType<typeof vi.fn> }).recordSrQueueOverflow).toHaveBeenCalledWith({
      questionId: 'q-1',
      userId: 'user-1',
      payload: { cap: 100, observed: 100 },
    });
  });

  it('count where 절: userId + createdAt >= today UTC 0시', async () => {
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    const arg = repo.count.mock.calls[0]![0];
    expect(arg.where.userId).toBe('user-1');
    // MoreThanOrEqual 결과 검증: toString 이 2026-04-24T00:00:00.000Z
    const expectedStart = new Date('2026-04-24T00:00:00.000Z');
    // TypeORM FindOperator — _value 에 비교값 저장
    expect(arg.where.createdAt).toEqual(MoreThanOrEqual(expectedStart));
  });
});

describe('ReviewQueueService.upsertAfterAnswer — D3 Hybrid userTokenHash/epoch', () => {
  let repo: Repo;
  beforeEach(() => {
    repo = makeRepo();
  });

  it('config + activeEpoch 주입 시 userTokenHash(16 hex) + epoch 저장', async () => {
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(7),
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    const [row] = repo.upsert.mock.calls[0]!;
    expect(row.userTokenHash).toMatch(/^[a-f0-9]{16}$/);
    expect(row.userTokenHashEpoch).toBe(7);
  });

  it('salt 누락 → null, upsert 는 정상 진행 (fail-safe)', async () => {
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100, ''),
      makeActiveEpoch(1),
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    expect(repo.upsert).toHaveBeenCalledOnce();
    const [row] = repo.upsert.mock.calls[0]!;
    expect(row.userTokenHash).toBeNull();
    expect(row.userTokenHashEpoch).toBeNull();
  });

  it('activeEpoch 미주입 → null, upsert 진행 (fail-safe)', async () => {
    const service = new ReviewQueueService(repo as never, {} as never, makeConfig(100), undefined);
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    expect(repo.upsert).toHaveBeenCalledOnce();
    const [row] = repo.upsert.mock.calls[0]!;
    expect(row.userTokenHash).toBeNull();
    expect(row.userTokenHashEpoch).toBeNull();
  });

  it('activeEpoch.getActiveEpochId throw → null, upsert 진행 (fail-safe)', async () => {
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(new Error('no active epoch')),
    );
    await service.upsertAfterAnswer('user-1', 'q-1', 5, anchor);

    expect(repo.upsert).toHaveBeenCalledOnce();
    const [row] = repo.upsert.mock.calls[0]!;
    expect(row.userTokenHash).toBeNull();
    expect(row.userTokenHashEpoch).toBeNull();
  });
});

describe('ReviewQueueService.upsertAfterAnswer — 오류 전파 (fail-open 은 caller 에서)', () => {
  it('repo.upsert throw → caller 로 전파 (서비스에서 삼키지 않음)', async () => {
    const repo = makeRepo();
    repo.upsert.mockRejectedValueOnce(new Error('db conflict'));
    const service = new ReviewQueueService(repo as never, {} as never, makeConfig(100), makeActiveEpoch(1));
    await expect(service.upsertAfterAnswer('user-1', 'q-1', 5, anchor)).rejects.toThrow(
      'db conflict',
    );
  });

  it('repo.findOne throw → caller 로 전파', async () => {
    const repo = makeRepo();
    repo.findOne.mockRejectedValueOnce(new Error('db unreachable'));
    const service = new ReviewQueueService(repo as never, {} as never, makeConfig(100), makeActiveEpoch(1));
    await expect(service.upsertAfterAnswer('user-1', 'q-1', 5, anchor)).rejects.toThrow(
      'db unreachable',
    );
  });
});

describe('ReviewQueueService.overwriteAfterOverride — admin-override 경로', () => {
  let repo: Repo;
  beforeEach(() => {
    repo = makeRepo();
  });

  it('existing=null 이어도 cap 체크 없이 새 행 upsert', async () => {
    const gm = makeGradingMeasurement();
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
      gm,
    );
    await service.overwriteAfterOverride('user-1', 'q-1', 5, anchor);

    expect(repo.count).not.toHaveBeenCalled();
    expect(repo.upsert).toHaveBeenCalledOnce();
    expect((gm as unknown as { recordSrQueueOverflow: ReturnType<typeof vi.fn> }).recordSrQueueOverflow).not.toHaveBeenCalled();
  });

  it('existing 있으면 prev 기반 sm2Next 결과 덮어쓰기', async () => {
    repo.findOne.mockResolvedValueOnce({
      userId: 'user-1',
      questionId: 'q-1',
      easeFactor: '2.500',
      intervalDays: 6,
      repetition: 2,
    } as ReviewQueueEntity);
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
    );
    await service.overwriteAfterOverride('user-1', 'q-1', 5, anchor);

    const [row] = repo.upsert.mock.calls[0]!;
    expect(row.repetition).toBe(3);
    expect(row.intervalDays).toBe(15);
    expect(row.lastQuality).toBe(5);
  });

  it('cap 도달 상황에서도 overwrite 는 drop 하지 않는다', async () => {
    repo.count.mockResolvedValueOnce(999); // 혹시 호출돼도 무시되어야 함
    const gm = makeGradingMeasurement();
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(1),
      gm,
    );
    await service.overwriteAfterOverride('user-1', 'q-1', 5, anchor);

    expect(repo.upsert).toHaveBeenCalledOnce();
    expect((gm as unknown as { recordSrQueueOverflow: ReturnType<typeof vi.fn> }).recordSrQueueOverflow).not.toHaveBeenCalled();
  });

  it('userTokenHash + epoch 를 함께 저장', async () => {
    const service = new ReviewQueueService(
      repo as never,
      {} as never,
      makeConfig(100),
      makeActiveEpoch(4),
    );
    await service.overwriteAfterOverride('user-1', 'q-1', 4, anchor);

    const [row] = repo.upsert.mock.calls[0]!;
    expect(row.userTokenHash).toMatch(/^[a-f0-9]{16}$/);
    expect(row.userTokenHashEpoch).toBe(4);
  });

  it('repo.upsert throw → caller 로 전파', async () => {
    const repo = makeRepo();
    repo.upsert.mockRejectedValueOnce(new Error('boom'));
    const service = new ReviewQueueService(repo as never, {} as never, makeConfig(100), makeActiveEpoch(1));
    await expect(
      service.overwriteAfterOverride('user-1', 'q-1', 5, anchor),
    ).rejects.toThrow('boom');
  });
});

describe('ReviewQueueService — easeFactor numeric(4,3) 문자열 저장', () => {
  it('easeFactor 는 toFixed(3) 3자리 소수점 문자열', async () => {
    const repo = makeRepo();
    const service = new ReviewQueueService(repo as never, {} as never, makeConfig(100), makeActiveEpoch(1));
    await service.upsertAfterAnswer('user-1', 'q-1', 4, anchor);
    const [row] = repo.upsert.mock.calls[0]!;
    // q=4, prev.ease=2.5 → 2.5 (중간), clamp 내부 → "2.500"
    expect(row.easeFactor).toBe('2.500');
  });
});

/**
 * ADR-019 §5.2 PR-4 — findDue + countDueForUser.
 */
describe('ReviewQueueService.findDue — due rows JOIN questions', () => {
  const now = new Date('2026-04-24T12:00:00.000Z');
  const criteria = {
    topic: 'sql-basics' as const,
    week: 2,
    gameMode: 'blank-typing' as const,
  };

  it('limit<=0 → [] (repo 호출 없음)', async () => {
    const repo = makeRepo();
    const { repo: qRepo } = makeQuestionRepo();
    const service = new ReviewQueueService(repo as never, qRepo as never);
    const result = await service.findDue('user-1', criteria, 0, now);
    expect(result).toEqual([]);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('userId 빈 문자열 → [] (호출 없음)', async () => {
    const repo = makeRepo();
    const { repo: qRepo } = makeQuestionRepo();
    const service = new ReviewQueueService(repo as never, qRepo as never);
    const result = await service.findDue('', criteria, 10, now);
    expect(result).toEqual([]);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('review_queue 에 due 행 없음 → [] (questions 조회 스킵)', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([]);
    const { repo: qRepo } = makeQuestionRepo();
    const service = new ReviewQueueService(repo as never, qRepo as never);
    const result = await service.findDue('user-1', criteria, 10, now);
    expect(result).toEqual([]);
    expect(qRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('repo.find: where userId + dueAt LessThanOrEqual(now), order due_at ASC, take limit', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([]);
    const { repo: qRepo } = makeQuestionRepo();
    const service = new ReviewQueueService(repo as never, qRepo as never);
    await service.findDue('user-1', criteria, 7, now);

    expect(repo.find).toHaveBeenCalledOnce();
    const arg = repo.find.mock.calls[0]![0];
    expect(arg.where.userId).toBe('user-1');
    expect(arg.where.dueAt).toEqual(LessThanOrEqual(now));
    expect(arg.order).toEqual({ dueAt: 'ASC' });
    expect(arg.take).toBe(7);
  });

  it('questions 필터: IN ids + status=active + topic/gameMode/week', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([
      { questionId: 'q-a' },
      { questionId: 'q-b' },
    ] as ReviewQueueEntity[]);
    const { repo: qRepo, qb } = makeQuestionRepo([
      { id: 'q-a' },
      { id: 'q-b' },
    ]);
    const service = new ReviewQueueService(repo as never, qRepo as never);
    await service.findDue('user-1', criteria, 7, now);

    expect(qb.where).toHaveBeenCalledWith('q.id IN (:...ids)', {
      ids: ['q-a', 'q-b'],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('q.status = :status', {
      status: 'active',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('q.topic = :topic', {
      topic: 'sql-basics',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('q.gameMode = :gameMode', {
      gameMode: 'blank-typing',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('q.week <= :week', { week: 2 });
  });

  it('criteria.difficulty 지정 시 andWhere 추가', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([{ questionId: 'q-a' }] as ReviewQueueEntity[]);
    const { repo: qRepo, qb } = makeQuestionRepo([{ id: 'q-a' }]);
    const service = new ReviewQueueService(repo as never, qRepo as never);
    await service.findDue('user-1', { ...criteria, difficulty: 'HARD' }, 7, now);

    expect(qb.andWhere).toHaveBeenCalledWith('q.difficulty = :difficulty', {
      difficulty: 'HARD',
    });
  });

  it('difficulty 미지정 시 difficulty andWhere 호출 없음', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([{ questionId: 'q-a' }] as ReviewQueueEntity[]);
    const { repo: qRepo, qb } = makeQuestionRepo([{ id: 'q-a' }]);
    const service = new ReviewQueueService(repo as never, qRepo as never);
    await service.findDue('user-1', criteria, 7, now);

    const calls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('difficulty'))).toBe(false);
  });

  it('반환 순서: due_at ASC (repo.find 반환 순서 보존)', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([
      { questionId: 'q-earlier' }, // due_at 먼저
      { questionId: 'q-later' },
    ] as ReviewQueueEntity[]);
    // questions repo 는 순서가 뒤바뀌어 반환될 수 있음 (IN 쿼리 특성)
    const { repo: qRepo } = makeQuestionRepo([
      { id: 'q-later' },
      { id: 'q-earlier' },
    ]);
    const service = new ReviewQueueService(repo as never, qRepo as never);

    const result = await service.findDue('user-1', criteria, 7, now);
    expect(result.map((q) => q.id)).toEqual(['q-earlier', 'q-later']);
  });

  it('criteria 불일치 (questions 반환에서 누락된 id) → 해당 문제 제외', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValueOnce([
      { questionId: 'q-match' },
      { questionId: 'q-mismatch' },
    ] as ReviewQueueEntity[]);
    // questions 테이블에서 criteria 로 걸러져 1건만 반환
    const { repo: qRepo } = makeQuestionRepo([{ id: 'q-match' }]);
    const service = new ReviewQueueService(repo as never, qRepo as never);

    const result = await service.findDue('user-1', criteria, 7, now);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('q-match');
  });
});

describe('ReviewQueueService.countDueForUser', () => {
  const now = new Date('2026-04-24T12:00:00.000Z');

  it('repo.count: userId + dueAt LessThanOrEqual(now)', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValueOnce(3);
    const { repo: qRepo } = makeQuestionRepo();
    const service = new ReviewQueueService(repo as never, qRepo as never);
    const count = await service.countDueForUser('user-1', now);

    expect(count).toBe(3);
    expect(repo.count).toHaveBeenCalledOnce();
    const arg = repo.count.mock.calls[0]![0];
    expect(arg.where.userId).toBe('user-1');
    expect(arg.where.dueAt).toEqual(LessThanOrEqual(now));
  });

  it('userId 빈 문자열 → 0 (repo 호출 없음)', async () => {
    const repo = makeRepo();
    const { repo: qRepo } = makeQuestionRepo();
    const service = new ReviewQueueService(repo as never, qRepo as never);
    const count = await service.countDueForUser('', now);
    expect(count).toBe(0);
    expect(repo.count).not.toHaveBeenCalled();
  });
});
