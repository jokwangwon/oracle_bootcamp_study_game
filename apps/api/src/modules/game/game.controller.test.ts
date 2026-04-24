import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { GameController } from './game.controller';
import type { GameSessionService } from './services/game-session.service';

/**
 * ADR-019 §5.2 PR-4 — Controller 수준 테스트.
 *
 *  - `POST /start` 는 JWT user.sub 를 `userId` 로 서비스에 전파 (SR 혼합 입력)
 *  - `GET /review-queue` 는 `getReviewQueueSummary(userId)` 반환값 그대로 노출
 */

function makeReq(userSub: string): Request {
  return { user: { sub: userSub } } as unknown as Request;
}

describe('GameController.start — userId JWT 전파 (PR-4)', () => {
  it('req.user.sub 를 StartSoloInput.userId 로 전달', async () => {
    const session = {
      startSolo: vi.fn().mockResolvedValue([]),
    } as unknown as GameSessionService;
    const controller = new GameController(session);

    const dto = {
      topic: 'sql-basics',
      week: 1,
      gameMode: 'blank-typing',
      difficulty: 'EASY',
      rounds: 10,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.start(dto as any, makeReq('user-xyz'));

    expect(
      (session as unknown as { startSolo: ReturnType<typeof vi.fn> }).startSolo,
    ).toHaveBeenCalledWith({
      ...dto,
      userId: 'user-xyz',
    });
  });

  it('서비스 반환값을 그대로 리턴 (pass-through)', async () => {
    const fakeRounds = [{ id: 'r-1' }];
    const session = {
      startSolo: vi.fn().mockResolvedValue(fakeRounds),
    } as unknown as GameSessionService;
    const controller = new GameController(session);

    const dto = {
      topic: 'sql-basics',
      week: 1,
      gameMode: 'blank-typing',
      difficulty: 'EASY',
      rounds: 10,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await controller.start(dto as any, makeReq('user-1'));
    expect(result).toBe(fakeRounds);
  });
});

describe('GameController.reviewQueue — GET /review-queue (PR-4)', () => {
  it('getReviewQueueSummary(user.sub) 반환 전달', async () => {
    const session = {
      getReviewQueueSummary: vi.fn().mockResolvedValue({ dueCount: 7 }),
    } as unknown as GameSessionService;
    const controller = new GameController(session);

    const result = await controller.reviewQueue(makeReq('user-abc'));

    expect(result).toEqual({ dueCount: 7 });
    expect(
      (session as unknown as { getReviewQueueSummary: ReturnType<typeof vi.fn> })
        .getReviewQueueSummary,
    ).toHaveBeenCalledWith('user-abc');
  });
});
