import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnswerHistoryEntity } from '../../users/entities/answer-history.entity';
import { OpsEventLogEntity } from '../../ops/entities/ops-event-log.entity';
import { GradingAppealEntity } from '../entities/grading-appeal.entity';
import { AppealService } from './appeal.service';
import { AppealRateLimiter, type RateLimitResult } from './appeal-rate-limiter';

/**
 * ADR-016 §추가 이의제기 서비스 TDD.
 */

const USER = 'u-1';
const ANSWER_ID = 'a-1';

function makeHistory(overrides: Partial<AnswerHistoryEntity> = {}): AnswerHistoryEntity {
  return {
    id: ANSWER_ID,
    userId: USER,
    questionId: 'q-1',
    answer: 'SELECT 1',
    isCorrect: false,
    score: 0,
    timeTakenMs: 100,
    hintsUsed: 0,
    gameMode: 'blank-typing',
    gradingMethod: null,
    graderDigest: null,
    gradingLayersUsed: null,
    partialScore: null,
    userTokenHash: null,
    userTokenHashEpoch: null,
    createdAt: new Date('2026-04-22T10:00:00Z'),
    ...overrides,
  } as AnswerHistoryEntity;
}

function makeRateLimiter(result: RateLimitResult): AppealRateLimiter {
  return { check: vi.fn(async () => result) } as unknown as AppealRateLimiter;
}

interface Context {
  service: AppealService;
  appealSave: ReturnType<typeof vi.fn>;
  historyFind: ReturnType<typeof vi.fn>;
  opsSave: ReturnType<typeof vi.fn>;
}

function makeService(opts: {
  history?: AnswerHistoryEntity | null;
  rateLimit?: RateLimitResult;
  saveImpl?: (a: GradingAppealEntity) => GradingAppealEntity | Promise<GradingAppealEntity>;
} = {}): Context {
  const rateLimiter =
    opts.rateLimit === undefined
      ? makeRateLimiter({ allowed: true, minuteCount: 1, dayCount: 1 })
      : makeRateLimiter(opts.rateLimit);

  const appealSave = vi.fn(
    opts.saveImpl ??
      (async (a: GradingAppealEntity) => ({
        ...a,
        id: 'appeal-1',
        createdAt: new Date('2026-04-22T10:30:00Z'),
      })),
  );

  const appeals = {
    create: vi.fn((a: Partial<GradingAppealEntity>) => ({ ...a })),
    save: appealSave,
  } as unknown as Repository<GradingAppealEntity>;

  const historyFind = vi.fn(async () => opts.history ?? null);
  const history = {
    findOne: historyFind,
  } as unknown as Repository<AnswerHistoryEntity>;

  const opsSave = vi.fn(async (e: OpsEventLogEntity) => e);
  const opsEvents = {
    create: vi.fn((e: Partial<OpsEventLogEntity>) => e),
    save: opsSave,
  } as unknown as Repository<OpsEventLogEntity>;

  const service = new AppealService(appeals, history, opsEvents, rateLimiter);
  return { service, appealSave, historyFind, opsSave };
}

describe('AppealService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('정상 submit — INSERT + ops_event_log 기록', async () => {
    const ctx = makeService({ history: makeHistory() });
    const r = await ctx.service.submit({
      answerHistoryId: ANSWER_ID,
      userId: USER,
      reason: 'incorrect_grading',
      note: '이 답은 정답입니다',
    });
    expect(r.id).toBe('appeal-1');
    expect(r.status).toBe('pending');
    expect(ctx.appealSave).toHaveBeenCalledOnce();
    expect(ctx.opsSave).toHaveBeenCalledOnce();
    const opsArg = ctx.opsSave.mock.calls[0][0];
    expect(opsArg.kind).toBe('grading_appeal');
    expect(opsArg.userId).toBe(USER);
    expect(opsArg.payload).toEqual({
      appealId: 'appeal-1',
      answerHistoryId: ANSWER_ID,
      reason: 'incorrect_grading',
    });
  });

  it('invalid reason → 400', async () => {
    const ctx = makeService({ history: makeHistory() });
    await expect(
      ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reason: 'bogus' as any,
      }),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });

  it('note 가 2048자 초과 → 400', async () => {
    const ctx = makeService({ history: makeHistory() });
    await expect(
      ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        reason: 'other',
        note: 'x'.repeat(2049),
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rate limit 초과 (minute) → 429', async () => {
    const ctx = makeService({
      history: makeHistory(),
      rateLimit: {
        allowed: false,
        reason: 'minute_exceeded',
        minuteCount: 11,
        dayCount: 1,
      },
    });
    await expect(
      ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        reason: 'other',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(ctx.appealSave).not.toHaveBeenCalled();
  });

  it('answer_history 없음 → 404', async () => {
    const ctx = makeService({ history: null });
    await expect(
      ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        reason: 'other',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('다른 사용자의 answer_history → 403 (ADR-018 §8 금지 2: 평문 userId 매칭)', async () => {
    const ctx = makeService({
      history: makeHistory({ userId: 'another-user' }),
    });
    await expect(
      ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        reason: 'other',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('동일 (answer, user) pending 중복 → DB partial unique 위반 → 409', async () => {
    const ctx = makeService({
      history: makeHistory(),
      saveImpl: async () => {
        const err: Error & { code?: string } = new Error('duplicate');
        err.code = '23505';
        throw err;
      },
    });
    await expect(
      ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        reason: 'other',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ops_event_log 기록 실패해도 appeal 은 유지 (fail-safe)', async () => {
    const ctx = makeService({ history: makeHistory() });
    ctx.opsSave.mockRejectedValueOnce(new Error('ops event down'));
    const r = await ctx.service.submit({
      answerHistoryId: ANSWER_ID,
      userId: USER,
      reason: 'technical_error',
    });
    expect(r.id).toBe('appeal-1');
  });

  it('4개 reason enum 모두 정상 통과', async () => {
    for (const reason of [
      'incorrect_grading',
      'scope_dispute',
      'technical_error',
      'other',
    ] as const) {
      const ctx = makeService({ history: makeHistory() });
      const r = await ctx.service.submit({
        answerHistoryId: ANSWER_ID,
        userId: USER,
        reason,
      });
      expect(r.status).toBe('pending');
    }
  });
});
