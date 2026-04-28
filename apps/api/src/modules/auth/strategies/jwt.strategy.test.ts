import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { UsersService } from '../../users/users.service';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';

/**
 * PR-10a Phase 7 — JwtStrategy.validate epoch 검증.
 *
 * dual extractor (cookie + Bearer) 자체 테스트는 통합 환경 의존이 커서 e2e 에서
 * 다룸. 본 unit test 는 validate() 의 epoch 비교 분기에 집중.
 */

function makeUsers(epoch: number | 'not-found' = 0) {
  return {
    getTokenEpoch: vi.fn(async (id: string) => {
      if (epoch === 'not-found') {
        throw new Error(`User ${id} not found`);
      }
      return epoch;
    }),
  } as unknown as UsersService;
}

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    username: 'alice',
    epoch: 0,
    ...overrides,
  };
}

describe('JwtStrategy.validate (PR-10a)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-very-long-enough-32+';
  });

  it('payload.epoch === db.epoch → { sub, username } 반환', async () => {
    const strategy = new JwtStrategy(makeUsers(3));
    const out = await strategy.validate(payload({ epoch: 3 }));
    expect(out).toEqual({ sub: 'user-1', username: 'alice' });
  });

  it('payload.epoch < db.epoch (logout 후 legacy token) → UnauthorizedException', async () => {
    const strategy = new JwtStrategy(makeUsers(5));
    await expect(strategy.validate(payload({ epoch: 3 }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('payload.epoch undefined + db.epoch === 0 → 통과 (legacy token 호환)', async () => {
    const strategy = new JwtStrategy(makeUsers(0));
    const out = await strategy.validate(payload({ epoch: undefined }));
    expect(out).toEqual({ sub: 'user-1', username: 'alice' });
  });

  it('payload.epoch undefined + db.epoch >= 1 → UnauthorizedException', async () => {
    const strategy = new JwtStrategy(makeUsers(1));
    await expect(strategy.validate(payload({ epoch: undefined }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('user not found → UnauthorizedException (token 의 sub 가 삭제된 user)', async () => {
    const strategy = new JwtStrategy(makeUsers('not-found'));
    await expect(strategy.validate(payload({ epoch: 0 }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
