import { describe, expect, it, vi } from 'vitest';

import type { QuestionEntity } from '../entities/question.entity';
import { QuestionPoolService } from './question-pool.service';

/**
 * ADR-019 §5.2 PR-4 — pickRandom.excludeIds 단위 TDD.
 *
 * QueryBuilder 체이닝은 repo.createQueryBuilder mock 으로 검증한다.
 * createQueryBuilder 이 반환하는 객체의 where/andWhere/orderBy/limit/getMany
 * 호출 순서/인자만 검증 (SQL 직접 실행 없음).
 */

type QbMock = {
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
};

function makeQb(returned: QuestionEntity[] = []): QbMock {
  const qb: QbMock = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(returned),
  };
  return qb;
}

describe('QuestionPoolService.pickRandom', () => {
  it('기본 호출: 공통 where/andWhere 4건 + orderBy RANDOM + limit + getMany', async () => {
    const qb = makeQb([]);
    const repo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = new QuestionPoolService(repo as never);

    await service.pickRandom(
      { topic: 'sql-basics', week: 1, gameMode: 'blank-typing' },
      10,
    );

    expect(qb.where).toHaveBeenCalledWith('q.status = :status', { status: 'active' });
    expect(qb.andWhere).toHaveBeenCalledWith('q.topic = :topic', { topic: 'sql-basics' });
    expect(qb.andWhere).toHaveBeenCalledWith('q.gameMode = :gameMode', {
      gameMode: 'blank-typing',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('q.week <= :week', { week: 1 });
    expect(qb.orderBy).toHaveBeenCalledWith('RANDOM()');
    expect(qb.limit).toHaveBeenCalledWith(10);
    expect(qb.getMany).toHaveBeenCalledOnce();
  });

  it('difficulty 지정 시 andWhere 추가', async () => {
    const qb = makeQb([]);
    const repo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = new QuestionPoolService(repo as never);

    await service.pickRandom(
      { topic: 'sql-basics', week: 1, gameMode: 'blank-typing', difficulty: 'MEDIUM' },
      10,
    );

    expect(qb.andWhere).toHaveBeenCalledWith('q.difficulty = :difficulty', {
      difficulty: 'MEDIUM',
    });
  });

  it('excludeIds=[] 이면 NOT IN 추가하지 않음 (기존 호출자 회귀 0)', async () => {
    const qb = makeQb([]);
    const repo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = new QuestionPoolService(repo as never);

    await service.pickRandom(
      { topic: 'sql-basics', week: 1, gameMode: 'blank-typing' },
      10,
      { excludeIds: [] },
    );

    const calls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).not.toContain(expect.stringContaining('NOT IN'));
  });

  it('excludeIds 미전달 (opts undefined) → NOT IN 추가하지 않음', async () => {
    const qb = makeQb([]);
    const repo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = new QuestionPoolService(repo as never);

    await service.pickRandom(
      { topic: 'sql-basics', week: 1, gameMode: 'blank-typing' },
      10,
    );

    const calls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('NOT IN'))).toBe(false);
  });

  it('excludeIds 있으면 q.id NOT IN (:...excludeIds) andWhere 추가', async () => {
    const qb = makeQb([]);
    const repo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const service = new QuestionPoolService(repo as never);

    await service.pickRandom(
      { topic: 'sql-basics', week: 1, gameMode: 'blank-typing' },
      5,
      { excludeIds: ['a', 'b', 'c'] },
    );

    expect(qb.andWhere).toHaveBeenCalledWith('q.id NOT IN (:...excludeIds)', {
      excludeIds: ['a', 'b', 'c'],
    });
  });
});
