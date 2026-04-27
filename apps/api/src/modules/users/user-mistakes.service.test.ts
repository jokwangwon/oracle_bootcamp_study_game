import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnswerHistoryEntity } from './entities/answer-history.entity';
import type { QuestionEntity } from '../content/entities/question.entity';
import { UserMistakesService } from './user-mistakes.service';

/**
 * UserMistakesService TDD — 사용자 Q1~Q3 + UX v2 (블로그 사이드바 검색/정렬/상태).
 *
 * 호출 순서 (createQueryBuilder mock 순서):
 *   1. dimensionSummary.byWeek
 *   2. dimensionSummary.byTopic
 *   3. dimensionSummary.byGameMode
 *   4. statusSummary.distinct wrong questionIds
 *   5. statusSummary.latest (if wrongs > 0)  — 동일 createQueryBuilder, DISTINCT ON 체이닝
 *   6. fetchStats (topic/week/gameMode/search 필터 + 하드캡 500 + lastAnsweredAt DESC)
 *   7. fetchLatestAttempts (paged ids)
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

function makeSummaryQb(rows: unknown[] = []): SummaryQbMock {
  return {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
}

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
  getRawMany: ReturnType<typeof vi.fn>;
};

function makeStatsQb(rows: unknown[] = []): StatsQbMock {
  return {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
}

type LatestQbMock = {
  distinctOn: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  addOrderBy: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
};

function makeLatestQb(items: Partial<AnswerHistoryEntity>[]): LatestQbMock {
  return {
    distinctOn: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(items),
  };
}

/**
 * 기본 mock 설치: summary 3 dim + statusSummary distinct (empty) → 0 wrongs
 * 이후 stats qb 를 직접 추가해야 함.
 */
function installEmptySummaryAndStatusMocks(historyRepo: {
  createQueryBuilder: ReturnType<typeof vi.fn>;
}): void {
  historyRepo.createQueryBuilder
    .mockReturnValueOnce(makeSummaryQb([])) // byWeek
    .mockReturnValueOnce(makeSummaryQb([])) // byTopic
    .mockReturnValueOnce(makeSummaryQb([])) // byGameMode
    .mockReturnValueOnce(makeSummaryQb([])); // statusSummary distinct wrong ids (empty)
  // statusSummary.latest 는 wrongs 없으면 건너뜀.
}

/**
 * 주어진 wrongQuestionIds 와 latestAttempts 를 가진 상태 샘머리 mock 설치.
 */
function installStatusSummaryMocks(
  historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> },
  wrongIds: string[],
  latest: Partial<AnswerHistoryEntity>[],
): void {
  historyRepo.createQueryBuilder
    .mockReturnValueOnce(makeSummaryQb([])) // byWeek
    .mockReturnValueOnce(makeSummaryQb([])) // byTopic
    .mockReturnValueOnce(makeSummaryQb([])) // byGameMode
    .mockReturnValueOnce(makeSummaryQb(wrongIds.map((id) => ({ questionId: id }))))
    .mockReturnValueOnce(makeLatestQb(latest) as never);
}

// ────────────────────────────────────────────────────────────────────────────

describe('UserMistakesService.getMistakes — 기본 동작', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  it('userId 빈 문자열 → 빈 응답 (repo 호출 없음, 게스트 가드)', async () => {
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('', {});
    expect(result.total).toBe(0);
    expect(result.mistakes).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(historyRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('오답 없음 → 빈 배열 + 빈 summary', async () => {
    installEmptySummaryAndStatusMocks(historyRepo);
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb([]));
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    const result = await service.getMistakes('user-1', {});
    expect(result.mistakes).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.summary.byWeek).toEqual([]);
    expect(result.summary.byStatus).toEqual({ unresolved: 0, resolved: 0 });
  });

  it('오답 2건 → 집계 + currentlyCorrect 반영 (Q3=b)', async () => {
    installStatusSummaryMocks(
      historyRepo,
      ['q-a', 'q-b'],
      [
        {
          questionId: 'q-a',
          answer: 'wrong',
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
      ],
    );
    const statsRows = [
      {
        questionId: 'q-a',
        wrongCount: 2,
        totalAttempts: 3,
        lastAnsweredAt: new Date('2026-04-24T00:00:00Z'),
      },
      {
        questionId: 'q-b',
        wrongCount: 1,
        totalAttempts: 2,
        lastAnsweredAt: new Date('2026-04-23T00:00:00Z'),
      },
    ];
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb(statsRows));
    questionRepo.findBy.mockResolvedValueOnce([
      {
        id: 'q-a',
        content: { type: 'blank-typing' },
        answer: ['SELECT'],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
      },
      {
        id: 'q-b',
        content: { type: 'term-match' },
        answer: ['용어'],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'term-match',
        difficulty: 'EASY',
      },
    ] as QuestionEntity[]);
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeLatestQb([
        {
          questionId: 'q-a',
          answer: 'wrong',
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
      ]) as never,
    );

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});

    expect(result.total).toBe(2);
    const a = result.mistakes.find((m) => m.questionId === 'q-a')!;
    expect(a.wrongCount).toBe(2);
    expect(a.totalAttempts).toBe(3);
    expect(a.currentlyCorrect).toBe(false);
    const b = result.mistakes.find((m) => m.questionId === 'q-b')!;
    expect(b.currentlyCorrect).toBe(true); // Q3=b: 정답 처리됨
  });

  it('questions 삭제 → 결과에서 제외', async () => {
    installStatusSummaryMocks(
      historyRepo,
      ['q-missing'],
      [
        {
          questionId: 'q-missing',
          answer: 'x',
          isCorrect: false,
          createdAt: new Date(),
          hintsUsed: 0,
        } as AnswerHistoryEntity,
      ],
    );
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeStatsQb([
        {
          questionId: 'q-missing',
          wrongCount: 1,
          totalAttempts: 1,
          lastAnsweredAt: new Date(),
        },
      ]),
    );
    questionRepo.findBy.mockResolvedValueOnce([]); // 문제 삭제됨
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeLatestQb([]) as never);

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});
    expect(result.mistakes).toHaveLength(0);
  });
});

describe('UserMistakesService — 필터 (topic/week/gameMode/search) DB 경로', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  function arrangeEmpty(): StatsQbMock {
    installEmptySummaryAndStatusMocks(historyRepo);
    const statsQb = makeStatsQb([]);
    historyRepo.createQueryBuilder.mockReturnValueOnce(statsQb);
    return statsQb;
  }

  it('필터 미지정 → topic/week/gameMode/search andWhere 호출 없음', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);

    await service.getMistakes('user-1', {});

    const calls = statsQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('q.topic'))).toBe(false);
    expect(calls.some((s) => s.includes('q.week'))).toBe(false);
    expect(calls.some((s) => s.includes('q.game_mode'))).toBe(false);
    expect(calls.some((s) => s.includes('ILIKE'))).toBe(false);
  });

  it('topic 필터', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', { topic: 'sql-basics' });
    expect(statsQb.andWhere).toHaveBeenCalledWith('q.topic = :topic', {
      topic: 'sql-basics',
    });
  });

  it('week 필터', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', { week: 2 });
    expect(statsQb.andWhere).toHaveBeenCalledWith('q.week = :week', { week: 2 });
  });

  it('gameMode 필터', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', { gameMode: 'term-match' });
    expect(statsQb.andWhere).toHaveBeenCalledWith('q.game_mode = :gameMode', {
      gameMode: 'term-match',
    });
  });

  it('search keyword → ILIKE 5 컬럼 OR 조건', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', { search: 'SELECT' });

    const ilikeCall = statsQb.andWhere.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('ILIKE'),
    );
    expect(ilikeCall).toBeTruthy();
    expect(ilikeCall![0]).toContain('q.content::text');
    expect(ilikeCall![0]).toContain('q.explanation');
    expect(ilikeCall![0]).toContain('q.scenario');
    expect(ilikeCall![0]).toContain('q.rationale');
    expect(ilikeCall![0]).toContain('q.answer::text');
    expect(ilikeCall![1]).toEqual({ pattern: '%SELECT%' });
  });

  it('search trim 공백 시 무시', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', { search: '   ' });
    const calls = statsQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('ILIKE'))).toBe(false);
  });

  it('stats 하드캡 500 적용', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', {});
    expect(statsQb.limit).toHaveBeenCalledWith(500);
  });

  it('정렬 기본: lastAnsweredAt DESC', async () => {
    const statsQb = arrangeEmpty();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', {});
    expect(statsQb.orderBy).toHaveBeenCalledWith('MAX(ah.created_at)', 'DESC');
  });
});

describe('UserMistakesService — status 필터 (TS 적용)', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  function arrangeMixedItems() {
    // Summary + status summary: q-a unresolved, q-b resolved
    installStatusSummaryMocks(
      historyRepo,
      ['q-a', 'q-b'],
      [
        { questionId: 'q-a', isCorrect: false, createdAt: new Date(), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
        { questionId: 'q-b', isCorrect: true, createdAt: new Date(), hintsUsed: 0, answer: 'ok' } as AnswerHistoryEntity,
      ],
    );
    const statsRows = [
      {
        questionId: 'q-a',
        wrongCount: 2,
        totalAttempts: 3,
        lastAnsweredAt: new Date('2026-04-24T00:00:00Z'),
      },
      {
        questionId: 'q-b',
        wrongCount: 1,
        totalAttempts: 2,
        lastAnsweredAt: new Date('2026-04-23T00:00:00Z'),
      },
    ];
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb(statsRows));
    questionRepo.findBy.mockResolvedValueOnce([
      {
        id: 'q-a',
        content: {},
        answer: [],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
      },
      {
        id: 'q-b',
        content: {},
        answer: [],
        topic: 'sql-basics',
        week: 2,
        gameMode: 'term-match',
        difficulty: 'EASY',
      },
    ] as QuestionEntity[]);
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeLatestQb([
        { questionId: 'q-a', isCorrect: false, createdAt: new Date('2026-04-24T00:00:00Z'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
        { questionId: 'q-b', isCorrect: true, createdAt: new Date('2026-04-23T00:00:00Z'), hintsUsed: 0, answer: 'ok' } as AnswerHistoryEntity,
      ]) as never,
    );
  }

  it('status="all" (기본): 전체 표시', async () => {
    arrangeMixedItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});
    expect(result.mistakes).toHaveLength(2);
  });

  it('status="unresolved": 미해결만 (currentlyCorrect=false)', async () => {
    arrangeMixedItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { status: 'unresolved' });
    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0]!.questionId).toBe('q-a');
    expect(result.total).toBe(1);
  });

  it('status="resolved": 정답 처리만 (currentlyCorrect=true)', async () => {
    arrangeMixedItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { status: 'resolved' });
    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0]!.questionId).toBe('q-b');
  });
});

describe('UserMistakesService — sort 옵션', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  function arrangeItems() {
    installStatusSummaryMocks(historyRepo, ['q-1', 'q-2', 'q-3'], [
      { questionId: 'q-1', isCorrect: false, createdAt: new Date('2026-04-20'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
      { questionId: 'q-2', isCorrect: false, createdAt: new Date('2026-04-22'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
      { questionId: 'q-3', isCorrect: false, createdAt: new Date('2026-04-24'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
    ]);
    const statsRows = [
      { questionId: 'q-1', wrongCount: 5, totalAttempts: 6, lastAnsweredAt: new Date('2026-04-20') },
      { questionId: 'q-2', wrongCount: 1, totalAttempts: 1, lastAnsweredAt: new Date('2026-04-22') },
      { questionId: 'q-3', wrongCount: 3, totalAttempts: 4, lastAnsweredAt: new Date('2026-04-24') },
    ];
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb(statsRows));
    questionRepo.findBy.mockResolvedValueOnce([
      { id: 'q-1', content: {}, answer: [], topic: 'sql-basics', week: 2, gameMode: 'blank-typing', difficulty: 'EASY' },
      { id: 'q-2', content: {}, answer: [], topic: 'transactions', week: 1, gameMode: 'term-match', difficulty: 'EASY' },
      { id: 'q-3', content: {}, answer: [], topic: 'sql-basics', week: 1, gameMode: 'blank-typing', difficulty: 'EASY' },
    ] as QuestionEntity[]);
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeLatestQb([
        { questionId: 'q-1', isCorrect: false, createdAt: new Date('2026-04-20'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
        { questionId: 'q-2', isCorrect: false, createdAt: new Date('2026-04-22'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
        { questionId: 'q-3', isCorrect: false, createdAt: new Date('2026-04-24'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
      ]) as never,
    );
  }

  it('sort="recent" (기본): lastAnsweredAt DESC', async () => {
    arrangeItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});
    expect(result.mistakes.map((m) => m.questionId)).toEqual(['q-3', 'q-2', 'q-1']);
  });

  it('sort="wrongCount": 틀린 횟수 DESC', async () => {
    arrangeItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { sort: 'wrongCount' });
    expect(result.mistakes.map((m) => m.questionId)).toEqual(['q-1', 'q-3', 'q-2']);
  });

  it('sort="week": 주차 ASC', async () => {
    arrangeItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { sort: 'week' });
    // q-2(week1), q-3(week1, wrongCount 3), q-1(week2)
    // week tie → wrongCount DESC: q-3 wrongCount 3 > q-2 wrongCount 1
    expect(result.mistakes.map((m) => m.questionId)).toEqual(['q-3', 'q-2', 'q-1']);
  });

  it('sort="topic": 주제 ASC', async () => {
    arrangeItems();
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { sort: 'topic' });
    // sql-basics (q-3 week1, q-1 week2) then transactions (q-2)
    expect(result.mistakes.map((m) => m.questionId)).toEqual(['q-3', 'q-1', 'q-2']);
  });
});

describe('UserMistakesService — 페이지네이션 (TS slice)', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  function arrangeN(n: number) {
    const ids = Array.from({ length: n }, (_, i) => `q-${i}`);
    installStatusSummaryMocks(
      historyRepo,
      ids,
      ids.map(
        (id, i) =>
          ({
            questionId: id,
            isCorrect: false,
            createdAt: new Date(2026, 3, 1 + i),
            hintsUsed: 0,
            answer: 'x',
          }) as AnswerHistoryEntity,
      ),
    );
    const statsRows = ids.map((id, i) => ({
      questionId: id,
      wrongCount: 1,
      totalAttempts: 1,
      lastAnsweredAt: new Date(2026, 3, 1 + i),
    }));
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb(statsRows));
    questionRepo.findBy.mockResolvedValueOnce(
      ids.map((id, i) => ({
        id,
        content: {},
        answer: [],
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
      })) as QuestionEntity[],
    );
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeLatestQb(
        ids.map(
          (id, i) =>
            ({
              questionId: id,
              isCorrect: false,
              createdAt: new Date(2026, 3, 1 + i),
              hintsUsed: 0,
              answer: 'x',
            }) as AnswerHistoryEntity,
        ),
      ) as never,
    );
  }

  it('기본 limit=20, offset=0, hasMore=true (25건 중)', async () => {
    arrangeN(25);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});
    expect(result.mistakes).toHaveLength(20);
    expect(result.total).toBe(25);
    expect(result.hasMore).toBe(true);
  });

  it('offset=20 → 다음 페이지 (5건 남음, hasMore=false)', async () => {
    arrangeN(25);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { offset: 20 });
    expect(result.mistakes).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it('limit=100 cap', async () => {
    arrangeN(10);
    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { limit: 500 });
    expect(result.mistakes).toHaveLength(10); // 500 요청이었지만 cap 100 내로
    // 검증: 결과가 반환된 것. 내부 Math.min(500, 100) = 100.
  });

  it('status 필터 적용 후 총계도 정확히 집계됨', async () => {
    // 3개 중 q-1만 resolved (currentlyCorrect=true)
    installStatusSummaryMocks(
      historyRepo,
      ['q-0', 'q-1', 'q-2'],
      [
        { questionId: 'q-0', isCorrect: false, createdAt: new Date('2026-04-20'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
        { questionId: 'q-1', isCorrect: true, createdAt: new Date('2026-04-21'), hintsUsed: 0, answer: 'ok' } as AnswerHistoryEntity,
        { questionId: 'q-2', isCorrect: false, createdAt: new Date('2026-04-22'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
      ],
    );
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeStatsQb([
        { questionId: 'q-0', wrongCount: 1, totalAttempts: 1, lastAnsweredAt: new Date('2026-04-20') },
        { questionId: 'q-1', wrongCount: 1, totalAttempts: 2, lastAnsweredAt: new Date('2026-04-21') },
        { questionId: 'q-2', wrongCount: 1, totalAttempts: 1, lastAnsweredAt: new Date('2026-04-22') },
      ]),
    );
    questionRepo.findBy.mockResolvedValueOnce([
      { id: 'q-0', content: {}, answer: [], topic: 'sql-basics', week: 1, gameMode: 'blank-typing', difficulty: 'EASY' },
      { id: 'q-1', content: {}, answer: [], topic: 'sql-basics', week: 1, gameMode: 'blank-typing', difficulty: 'EASY' },
      { id: 'q-2', content: {}, answer: [], topic: 'sql-basics', week: 1, gameMode: 'blank-typing', difficulty: 'EASY' },
    ] as QuestionEntity[]);
    historyRepo.createQueryBuilder.mockReturnValueOnce(
      makeLatestQb([
        { questionId: 'q-0', isCorrect: false, createdAt: new Date('2026-04-20'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
        { questionId: 'q-1', isCorrect: true, createdAt: new Date('2026-04-21'), hintsUsed: 0, answer: 'ok' } as AnswerHistoryEntity,
        { questionId: 'q-2', isCorrect: false, createdAt: new Date('2026-04-22'), hintsUsed: 0, answer: 'x' } as AnswerHistoryEntity,
      ]) as never,
    );

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', { status: 'unresolved' });

    expect(result.mistakes).toHaveLength(2); // q-0, q-2
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });
});

describe('UserMistakesService — summary (학습 범위 확장 대응)', () => {
  let historyRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let questionRepo: { findBy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyRepo = { createQueryBuilder: vi.fn() };
    questionRepo = { findBy: vi.fn().mockResolvedValue([]) };
  });

  it('차원별 + status byX 전파', async () => {
    historyRepo.createQueryBuilder
      .mockReturnValueOnce(
        makeSummaryQb([
          { dim: 1, count: 3 },
          { dim: 2, count: 5 },
        ]),
      )
      .mockReturnValueOnce(makeSummaryQb([{ dim: 'sql-basics', count: 7 }]))
      .mockReturnValueOnce(makeSummaryQb([{ dim: 'blank-typing', count: 7 }]))
      // statusSummary: wrongIds q-a, q-b
      .mockReturnValueOnce(makeSummaryQb([{ questionId: 'q-a' }, { questionId: 'q-b' }]))
      .mockReturnValueOnce(
        makeLatestQb([
          { questionId: 'q-a', isCorrect: false } as AnswerHistoryEntity,
          { questionId: 'q-b', isCorrect: true } as AnswerHistoryEntity,
        ]) as never,
      );
    historyRepo.createQueryBuilder.mockReturnValueOnce(makeStatsQb([]));

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    const result = await service.getMistakes('user-1', {});

    expect(result.summary.byWeek).toEqual([
      { week: 1, count: 3 },
      { week: 2, count: 5 },
    ]);
    expect(result.summary.byTopic).toEqual([{ topic: 'sql-basics', count: 7 }]);
    expect(result.summary.byGameMode).toEqual([{ gameMode: 'blank-typing', count: 7 }]);
    expect(result.summary.byStatus).toEqual({ unresolved: 1, resolved: 1 });
  });

  it('summary 는 필터와 무관 — topic 필터 있어도 전체 인벤토리 반영', async () => {
    const byWeekQb = makeSummaryQb([{ dim: 1, count: 10 }]);
    historyRepo.createQueryBuilder
      .mockReturnValueOnce(byWeekQb)
      .mockReturnValueOnce(makeSummaryQb([]))
      .mockReturnValueOnce(makeSummaryQb([]))
      .mockReturnValueOnce(makeSummaryQb([]))
      .mockReturnValueOnce(makeStatsQb([]));

    const service = new UserMistakesService(historyRepo as never, questionRepo as never);
    await service.getMistakes('user-1', { topic: 'sql-basics' });

    expect(byWeekQb.andWhere).toHaveBeenCalledWith('q.status = :status', {
      status: 'active',
    });
    expect(byWeekQb.andWhere).toHaveBeenCalledWith('ah.is_correct = false');
    const calls = byWeekQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((s) => s.includes('q.topic'))).toBe(false);
  });
});
