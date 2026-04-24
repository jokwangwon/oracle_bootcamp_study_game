import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { UserMistakesService } from './user-mistakes.service';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

/**
 * 오답 노트 컨트롤러 smoke — JWT user.sub 전파 + query DTO → service filters.
 */

function makeReq(userSub: string): Request {
  return { user: { sub: userSub, username: 'u' } } as unknown as Request;
}

describe('UsersController.getMyMistakes', () => {
  it('req.user.sub 와 쿼리 필터를 서비스에 전달', async () => {
    const usersService = {} as unknown as UsersService;
    const mistakesService = {
      getMistakes: vi
        .fn()
        .mockResolvedValue({
          mistakes: [],
          total: 0,
          hasMore: false,
          summary: { byWeek: [], byTopic: [], byGameMode: [] },
        }),
    } as unknown as UserMistakesService;
    const controller = new UsersController(usersService, mistakesService);

    await controller.getMyMistakes(makeReq('user-xyz'), {
      topic: 'sql-basics',
      week: 2,
      gameMode: 'blank-typing',
      limit: 20,
      offset: 0,
    });

    expect(
      (mistakesService as unknown as { getMistakes: ReturnType<typeof vi.fn> })
        .getMistakes,
    ).toHaveBeenCalledWith('user-xyz', {
      topic: 'sql-basics',
      week: 2,
      gameMode: 'blank-typing',
      limit: 20,
      offset: 0,
    });
  });

  it('빈 쿼리 → 빈 필터 객체 (필드 모두 undefined)', async () => {
    const usersService = {} as unknown as UsersService;
    const mistakesService = {
      getMistakes: vi
        .fn()
        .mockResolvedValue({
          mistakes: [],
          total: 0,
          hasMore: false,
          summary: { byWeek: [], byTopic: [], byGameMode: [] },
        }),
    } as unknown as UserMistakesService;
    const controller = new UsersController(usersService, mistakesService);

    await controller.getMyMistakes(makeReq('user-1'), {});

    expect(
      (mistakesService as unknown as { getMistakes: ReturnType<typeof vi.fn> })
        .getMistakes,
    ).toHaveBeenCalledWith('user-1', {
      topic: undefined,
      week: undefined,
      gameMode: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('서비스 응답을 그대로 pass-through', async () => {
    const usersService = {} as unknown as UsersService;
    const payload = {
      mistakes: [{ questionId: 'q-1' } as never],
      total: 1,
      hasMore: false,
      summary: {
        byWeek: [{ week: 1, count: 1 }],
        byTopic: [{ topic: 'sql-basics', count: 1 }],
        byGameMode: [{ gameMode: 'blank-typing', count: 1 }],
      },
    };
    const mistakesService = {
      getMistakes: vi.fn().mockResolvedValue(payload),
    } as unknown as UserMistakesService;
    const controller = new UsersController(usersService, mistakesService);

    const result = await controller.getMyMistakes(makeReq('user-1'), {});
    expect(result).toBe(payload);
  });
});
