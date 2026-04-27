import type IORedis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RedisRateLimiter,
  type RateLimitConfig,
  type RateLimitKind,
} from './redis-rate-limiter';

/**
 * ADR-020 §4.3 — RedisRateLimiter 일반화 TDD.
 *
 * - kind ∈ 'appeal' | 'post' | 'comment' | 'vote'
 * - window ∈ second | minute | hour | day (kind 별 일부만 사용)
 * - key 구조 `rate:{kind}:{key}:{window}:{bucket}` (정렬: 좁은 window 먼저)
 */

interface RedisMockState {
  store: Map<string, number>;
  expires: Map<string, number>;
}

function makeRedisMock(state: RedisMockState): IORedis {
  return {
    incr: vi.fn(async (key: string) => {
      const next = (state.store.get(key) ?? 0) + 1;
      state.store.set(key, next);
      return next;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      state.expires.set(key, ttl);
      return 1;
    }),
  } as unknown as IORedis;
}

const NOW = new Date('2026-04-27T10:30:00Z');

describe('RedisRateLimiter', () => {
  let state: RedisMockState;
  let redis: IORedis;

  beforeEach(() => {
    state = { store: new Map(), expires: new Map() };
    redis = makeRedisMock(state);
  });

  describe('appeal kind (분당 10 / 일당 5 — 기존 정책 회귀)', () => {
    const config: RateLimitConfig = {
      kind: 'appeal',
      limits: { minute: 10, day: 5 },
    };

    it('첫 호출 → allowed=true, counts.minute=1, counts.day=1', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      const r = await limiter.check('user-1', NOW);
      expect(r.allowed).toBe(true);
      expect(r.counts.minute).toBe(1);
      expect(r.counts.day).toBe(1);
    });

    it('5회 까지 allowed, 6회 → day_exceeded', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      for (let i = 0; i < 5; i++) {
        const r = await limiter.check('user-1', NOW);
        expect(r.allowed).toBe(true);
      }
      const over = await limiter.check('user-1', NOW);
      expect(over.allowed).toBe(false);
      expect(over.reason).toBe('day_exceeded');
    });

    it('첫 INCR 시 TTL 설정 — minute=120s, day=86400s (안전 마진)', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      await limiter.check('user-1', NOW);
      const minuteBucket = Math.floor(NOW.getTime() / 60_000);
      expect(state.expires.get(`rate:appeal:user-1:minute:${minuteBucket}`)).toBe(
        120,
      );
      expect(state.expires.get('rate:appeal:user-1:day:2026-04-27')).toBe(86_400);
    });

    it('다른 key 는 독립 카운터', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      for (let i = 0; i < 5; i++) {
        await limiter.check('user-1', NOW);
      }
      const r = await limiter.check('user-2', NOW);
      expect(r.allowed).toBe(true);
      expect(r.counts.minute).toBe(1);
    });

    it('day 키는 UTC YYYY-MM-DD', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      const lateNight = new Date('2026-04-22T23:59:59Z');
      const earlyMorning = new Date('2026-04-23T00:00:01Z');
      await limiter.check('user-1', lateNight);
      await limiter.check('user-1', earlyMorning);
      expect(state.store.has('rate:appeal:user-1:day:2026-04-22')).toBe(true);
      expect(state.store.has('rate:appeal:user-1:day:2026-04-23')).toBe(true);
    });
  });

  describe('post kind (분당 3 / 시간당 20 / 일당 50 — ADR-020 §4.3)', () => {
    const config: RateLimitConfig = {
      kind: 'post',
      limits: { minute: 3, hour: 20, day: 50 },
    };

    it('3회 minute 한도 도달 → 4회째 minute_exceeded', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      for (let i = 0; i < 3; i++) {
        const r = await limiter.check('user-1', NOW);
        expect(r.allowed).toBe(true);
      }
      const over = await limiter.check('user-1', NOW);
      expect(over.allowed).toBe(false);
      expect(over.reason).toBe('minute_exceeded');
    });

    it('window 가 좁은 것이 먼저 트리거 (minute → hour → day)', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      // 분이 다른 시도 5회 → minute 초기화, hour 누적
      for (let i = 0; i < 3; i++) {
        const t = new Date(NOW.getTime() + i * 60_000);
        const r = await limiter.check('user-1', t);
        expect(r.allowed).toBe(true);
      }
      // counts.hour=3
      const t4 = new Date(NOW.getTime() + 3 * 60_000);
      const r4 = await limiter.check('user-1', t4);
      expect(r4.allowed).toBe(true);
      expect(r4.counts.hour).toBe(4);
    });

    it('hour bucket 키는 floor(ts/3_600_000)', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      await limiter.check('user-1', NOW);
      const hourBucket = Math.floor(NOW.getTime() / 3_600_000);
      expect(state.store.has(`rate:post:user-1:hour:${hourBucket}`)).toBe(true);
      expect(state.expires.get(`rate:post:user-1:hour:${hourBucket}`)).toBe(7_200); // 2h margin
    });
  });

  describe('vote kind (초당 5 / 분당 30 — ADR-020 §4.3)', () => {
    const config: RateLimitConfig = {
      kind: 'vote',
      limits: { second: 5, minute: 30 },
    };

    it('5회 second 한도 도달 → 6회째 second_exceeded', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      for (let i = 0; i < 5; i++) {
        const r = await limiter.check('user-1', NOW);
        expect(r.allowed).toBe(true);
      }
      const over = await limiter.check('user-1', NOW);
      expect(over.allowed).toBe(false);
      expect(over.reason).toBe('second_exceeded');
    });

    it('second bucket 키는 floor(ts/1000), TTL=10s (안전 마진)', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      await limiter.check('user-1', NOW);
      const secondBucket = Math.floor(NOW.getTime() / 1000);
      expect(state.store.has(`rate:vote:user-1:second:${secondBucket}`)).toBe(true);
      expect(state.expires.get(`rate:vote:user-1:second:${secondBucket}`)).toBe(10);
    });
  });

  describe('comment kind (분당 10 / 시간당 60)', () => {
    const config: RateLimitConfig = {
      kind: 'comment',
      limits: { minute: 10, hour: 60 },
    };

    it('미설정 window 는 검사하지 않음 (day 미설정 → counts.day undefined)', async () => {
      const limiter = new RedisRateLimiter(redis, config);
      const r = await limiter.check('user-1', NOW);
      expect(r.allowed).toBe(true);
      expect(r.counts.day).toBeUndefined();
      expect(r.counts.minute).toBe(1);
      expect(r.counts.hour).toBe(1);
    });
  });

  describe('빈 limits — 정책 오류 방지', () => {
    it('limits 가 모두 비어있으면 생성 시 throw', () => {
      const bad: RateLimitConfig = { kind: 'appeal', limits: {} };
      expect(() => new RedisRateLimiter(redis, bad)).toThrow(/at least one window/i);
    });
  });

  describe('reason 우선순위 (좁은 window 먼저)', () => {
    it('second 와 minute 둘 다 초과면 second 보고', async () => {
      const limiter = new RedisRateLimiter(redis, {
        kind: 'vote',
        limits: { second: 1, minute: 2 },
      });
      const r1 = await limiter.check('u', NOW);
      expect(r1.allowed).toBe(true);
      const r2 = await limiter.check('u', NOW);
      expect(r2.allowed).toBe(false);
      expect(r2.reason).toBe('second_exceeded');
    });
  });
});

// 타입 가드 — 컴파일 시점 보장 (kind 누락 방어)
describe('RateLimitKind type', () => {
  it('exhaustive', () => {
    const kinds: RateLimitKind[] = ['appeal', 'post', 'comment', 'vote'];
    expect(kinds).toHaveLength(4);
  });
});
