import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnswerHistoryEntity } from './entities/answer-history.entity';
import { UserMistakesService } from './user-mistakes.service';

/**
 * 오답 노트 TDD (사용자 Q1~Q3).
 *
 *  - Q1=b: 문제당 1 row 로 집계 (wrongCount + totalAttempts).
 *  - Q2=a: SR due 뱃지와 완전 분리 — 본 서비스는 `answer_history` 기반, `review_queue` 미참조.
 *  - Q3=b: 최종 시도가 정답이어도 이력 보존 + `currentlyCorrect` 플래그로 뱃지 구분.
 *
 * QueryBuilder 체이닝을 mock 으로 검증 — 실제 DB 연동은 integration 에서.
 */

type StatsQbMock = {
  innerJoin: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  addSelect: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  having: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  clone: ReturnType<typeof vi.fn>;
  getRawMany: ReturnType<typeof vi.fn>;
};

type LatestQbMock = {
  distinctOn: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  addOrderBy: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
};

/**
 * summary 용 3 차원 집계 QueryBuilder mock. createQueryBuilder 호출 순서:
 * stats(1) → summary.byWeek(2) → summary.byTopic(3) → summary.byGameMode(4)
 * → latest(5, 페이지 결과 있을 때만).
 */
type SummaryQbMock = {
  innerJoin: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  addSelect: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  getRawMany: ReturnType<typeof vi.fn>;
};

function makeSummaryQb(rows: Array<{ dim: string | number; count: number }> = []): SummaryQbMock {
  const qb: SummaryQbMock = {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
  return qb;
}

function installEmptySummaryQbs(
  historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> },
) {
  // 3 차원 (byWeek/byTopic/byGameMode) 모두 빈 배열
  historyRepo.createQueryBuilder
    .mockReturnValueOnce(makeSummaryQb([]))
    .mockReturnValueOnce(makeSummaryQb([]))
    .mockReturnValueOnce(makeSummaryQb([]));
}

function makeStatsQb(allRows: unknown[] = [], pagedRows: unknown[] = allRows): StatsQbMock {
  const qb: StatsQbMock = {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    clone: vi.fn(),
    getRawMany: vi.fn(),
  };
  // clone returns a "count query" which returns allRows (for total)
  qb.clone.mockReturnValue({ ...qb, getRawMany: vi.fn().mockResolvedValue(allRows) });
  // main getRawMany returns paged rows (with potential overfetch)
  qb.getRawMany.mockResolvedValue(pagedRows);
  return qb;
}

function makeLatestQb(items: Partial<AnswerHistoryEntity>[]): LatestQbMock {
  const qb: LatestQbMock = {
    distinctOn: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(items),
  };
  return qb;
}

describe('UserMistakesService.getMistakes', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  it('userId 빈 문자열 → 빈 응답 (repo 호출 없음, 게스트 가드)', async () => {
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('', {});
    expect(result).toEqual({
      mistakes: [],
      total: 0,
      hasMore: false,
      summary: { byWeek: [], byTopic: [], byGameMode: [] },
    });
    expect(historyRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('오답 없음 → 빈 배열 + total=0 + 빈 summary', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    const result = await service.getMistakes('user-1', {});
    expect(result).toEqual({
      mistakes: [],
      total: 0,
      hasMore: false,
      summary: { byWeek: [], byTopic: [], byGameMode: [] },
    });
  });

  it('오답 3건 → 문제당 집계 + wrongCount/totalAttempts/currentlyCorrect 셋 전파', async () => {
    const rows = [
      {
        questionId: 'q-a',
        wrongCount: 2,
        totalAttempts: 3,
        lastAnsweredAt: new Date('2026-04-24T00:00:00Z'),
      },
      {
        questionId: 'q-b',
        wrongCount: 1,
        totalAttempts: 1,
        lastAnsweredAt: new Date('2026-04-23T00:00:00Z'),
      },
    ];
    const statsQb = makeStatsQb(rows, rows);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    questionRepo.findBy.mockResolvedValueOnce([
      {
        id: 'q-a',
        content: { type: 'blank-typing' },
        answer: ['SELECT'],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
        explanation: 'exp-a',
        scenario: 'sc-a',
        rationale: 'r-a',
      },
      {
        id: 'q-b',
        content: { type: 'term-match' },
        answer: ['용어'],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'term-match',
        difficulty: 'EASY',
        explanation: null,
        scenario: null,
        rationale: null,
      },
    ]);
    const latestQb = makeLatestQb([
      {
        questionId: 'q-a',
        answer: 'WRONG',
        isCorrect: false,
        createdAt: new Date('2026-04-24T00:00:00Z'),
        hintsUsed: 0,
      } as AnswerHistoryEntity,
      {
        questionId: 'q-b',
        answer: '정답',
        isCorrect: true,
        createdAt: new Date('2026-04-23T00:00:00Z'),
        hintsUsed: 1,
      } as AnswerHistoryEntity,
    ]);
    historyRepo.createQueryBuilder.mockReturnValueOnce(latestQb);

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});

    expect(result.total).toBe(2);
    expect(result.mistakes).toHaveLength(2);
    const a = result.mistakes.find((m) => m.questionId === 'q-a')!;
    expect(a.wrongCount).toBe(2);
    expect(a.totalAttempts).toBe(3);
    expect(a.currentlyCorrect).toBe(false);
    expect(a.lastAttempt?.answer).toBe('WRONG');
    expect(a.question.explanation).toBe('exp-a');
    expect(a.question.scenario).toBe('sc-a');

    const b = result.mistakes.find((m) => m.questionId === 'q-b')!;
    expect(b.wrongCount).toBe(1);
    // Q3=b: 최종 시도가 정답이어도 이력 보존 + currentlyCorrect=true 로 뱃지
    expect(b.currentlyCorrect).toBe(true);
    expect(b.lastAttempt?.isCorrect).toBe(true);
  });

  it('필터 topic=sql-basics 전달 → statsQb.andWhere 호출 확인', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', { topic: 'sql-basics' });

    expect(statsQb.andWhere).toHaveBeenCalledWith('q.topic = :topic', {
      topic: 'sql-basics',
    });
  });

  it('필터 week 전달', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', { week: 2 });

    expect(statsQb.andWhere).toHaveBeenCalledWith('q.week = :week', { week: 2 });
  });

  it('필터 gameMode 전달', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', { gameMode: 'blank-typing' });

    expect(statsQb.andWhere).toHaveBeenCalledWith('q.game_mode = :gameMode', {
      gameMode: 'blank-typing',
    });
  });

  it('필터 미지정 시 topic/week/gameMode andWhere 추가 없음', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', {});

    const calls = statsQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('q.topic'))).toBe(false);
    expect(calls.some((s) => s.includes('q.week'))).toBe(false);
    expect(calls.some((s) => s.includes('q.game_mode'))).toBe(false);
  });

  it('기본 where 3 조건 (user_id + status active + Group) 적용', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', {});

    expect(statsQb.where).toHaveBeenCalledWith('ah.user_id = :userId', { userId: 'user-1' });
    expect(statsQb.andWhere).toHaveBeenCalledWith('q.status = :status', { status: 'active' });
    expect(statsQb.groupBy).toHaveBeenCalledWith('ah.question_id');
    // Q1=b: HAVING wrong_count > 0 (문제당 1 row 집계)
    expect(statsQb.having).toHaveBeenCalledWith('COUNT(*) FILTER (WHERE ah.is_correct = false) > 0');
  });

  it('정렬: 최근 답변 순 (MAX(created_at) DESC)', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', {});

    expect(statsQb.orderBy).toHaveBeenCalledWith('MAX(ah.created_at)', 'DESC');
  });

  it('페이지네이션 limit=20 기본 + offset 0', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', {});

    // overfetch by 1
    expect(statsQb.limit).toHaveBeenCalledWith(21);
    expect(statsQb.offset).toHaveBeenCalledWith(0);
  });

  it('페이지네이션 limit 100 cap (초과 요청 방어)', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', { limit: 500 });

    // 100 cap + overfetch 1 = 101
    expect(statsQb.limit).toHaveBeenCalledWith(101);
  });

  it('hasMore=true 시 limit+1 만 반환하지만 마지막 원소는 잘라냄', async () => {
    const allRows = Array.from({ length: 25 }, (_, i) => ({
      questionId: `q-${i}`,
      wrongCount: 1,
      totalAttempts: 1,
      lastAnsweredAt: new Date(),
    }));
    // 페이지당 20, 21개 반환 (overfetch) → hasMore=true
    const statsQb = makeStatsQb(allRows, allRows.slice(0, 21));
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    questionRepo.findBy.mockResolvedValueOnce(
      allRows.slice(0, 20).map((r) => ({
        id: r.questionId,
        content: { type: 'blank-typing' },
        answer: [],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
      })),
    );
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeLatestQb([]));

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { limit: 20 });

    expect(result.mistakes).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(25);
  });

  it('questions 테이블에서 삭제된 문제 → 결과에서 제외 (방어)', async () => {
    const rows = [{ questionId: 'q-missing', wrongCount: 1, totalAttempts: 1, lastAnsweredAt: new Date() }];
    const statsQb = makeStatsQb(rows, rows);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    questionRepo.findBy.mockResolvedValueOnce([]); // 삭제됨
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeLatestQb([]));

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});

    expect(result.mistakes).toHaveLength(0);
  });

  it('pagedRows=0 → questions / latest 쿼리 스킵', async () => {
    const statsQb = makeStatsQb([], []);
    installEmptySummaryQbs(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', {});

    // createQueryBuilder 호출 = summary 3 + stats 1 = 4 (latest 호출 없음)
    expect(historyRepo.createQueryBuilder).toHaveBeenCalledTimes(4);
    expect(questionRepo.findBy).not.toHaveBeenCalled();
  });
});

describe('UserMistakesService.getMistakes — summary (학습 범위 확장 대응)', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  it('차원별 count 전파: byWeek / byTopic / byGameMode', async () => {
    historyRepo.createQueryBuilder
      .mockReturnValueOnce(
        makeSummaryQb([
          { dim: 1, count: 3 },
          { dim: 2, count: 5 },
        ]),
      )
      .mockReturnValueOnce(
        makeSummaryQb([{ dim: 'sql-basics', count: 7 }]),
      )
      .mockReturnValueOnce(
        makeSummaryQb([
          { dim: 'blank-typing', count: 4 },
          { dim: 'term-match', count: 3 },
        ]),
      );
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb([], []));
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    const result = await service.getMistakes('user-1', {});
    expect(result.summary).toEqual({
      byWeek: [
        { week: 1, count: 3 },
        { week: 2, count: 5 },
      ],
      byTopic: [{ topic: 'sql-basics', count: 7 }],
      byGameMode: [
        { gameMode: 'blank-typing', count: 4 },
        { gameMode: 'term-match', count: 3 },
      ],
    });
  });

  it('summary 는 필터와 무관 — 필터 있어도 전체 인벤토리 반영', async () => {
    const byWeekQb = makeSummaryQb([{ dim: 1, count: 10 }]);
    historyRepo.createQueryBuilder
      .mockReturnValueOnce(byWeekQb)
      .mockReturnValueOnce(makeSummaryQb([]))
      .mockReturnValueOnce(makeSummaryQb([]));
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb([], []));
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    // topic 필터 요청
    const result = await service.getMistakes('user-1', { topic: 'sql-basics' });
    // summary 쿼리는 filter 무관 — is_correct=false + status=active + user 만
    expect(byWeekQb.andWhere).toHaveBeenCalledWith('q.status = :status', {
      status: 'active',
    });
    expect(byWeekQb.andWhere).toHaveBeenCalledWith('ah.is_correct = false');
    // topic 필터는 summary 에 적용되지 않아야 함
    const calls = byWeekQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('q.topic'))).toBe(false);
    // 응답 summary 는 그대로 전달
    expect(result.summary.byWeek).toEqual([{ week: 1, count: 10 }]);
  });
});
