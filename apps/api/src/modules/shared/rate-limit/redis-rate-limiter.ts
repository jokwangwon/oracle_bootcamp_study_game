import { Logger } from '@nestjs/common';
import type IORedis from 'ioredis';

/**
 * ADR-020 §4.3 — Redis 기반 일반화 rate limiter.
 *
 * AppealRateLimiter (ADR-016) 의 구조를 일반화. 토론 R4/R6 의 post/comment/vote 와
 * 기존 appeal 모두 단일 클래스로 처리.
 *
 * Key 구조:
 *   `rate:{kind}:{key}:{window}:{bucket}`
 *
 *   - kind  : 'appeal' | 'post' | 'comment' | 'vote'
 *   - key   : userId (ADR-018 §8 금지 2 — 평문 userId, hash 금지)
 *   - window: 'second' | 'minute' | 'hour' | 'day'
 *   - bucket: window 별 bucket 표현 (second/minute/hour 는 floor(ts/N), day 는 UTC YYYY-MM-DD)
 *
 * 동작:
 *   - INCR + (count===1 일 때만) EXPIRE.
 *   - 좁은 window 먼저 체크 (second → minute → hour → day) — 이유 보고 우선순위.
 *   - 초과 시에도 INCR 한 count 는 rollback 하지 않음 — 다음 bucket 에서 자연 리셋.
 *   - Atomicity: INCR 자체는 원자적이지만 다중 window 간 race 시 ±1 오차 가능.
 *     부트캠프 규모(<100 동접) 에서 정확도 > 단순성 균형으로 수용.
 *
 * ADR-018 §8 금지 2 준수: key 에 `user_token_hash` 사용 금지 (평문 userId).
 */

export type RateLimitKind = 'appeal' | 'post' | 'comment' | 'vote';

export type RateLimitWindow = 'second' | 'minute' | 'hour' | 'day';

export type RateLimitReason =
  | 'second_exceeded'
  | 'minute_exceeded'
  | 'hour_exceeded'
  | 'day_exceeded';

export interface RateLimitLimits {
  second?: number;
  minute?: number;
  hour?: number;
  day?: number;
}

export interface RateLimitConfig {
  kind: RateLimitKind;
  limits: RateLimitLimits;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: RateLimitReason;
  counts: Partial<Record<RateLimitWindow, number>>;
}

const WINDOW_ORDER: readonly RateLimitWindow[] = [
  'second',
  'minute',
  'hour',
  'day',
] as const;

// 안전 마진: bucket 자연 만료 후 정리되도록 1 bucket 길이의 약 2배.
const TTL_SECONDS: Record<RateLimitWindow, number> = {
  second: 10,
  minute: 120,
  hour: 7_200,
  day: 86_400,
};

export class RedisRateLimiter {
  private readonly logger: Logger;

  constructor(
    private readonly redis: IORedis,
    private readonly config: RateLimitConfig,
  ) {
    const activeWindows = WINDOW_ORDER.filter(
      (w) => config.limits[w] !== undefined,
    );
    if (activeWindows.length === 0) {
      throw new Error(
        `RedisRateLimiter[${config.kind}]: at least one window limit required`,
      );
    }
    this.logger = new Logger(`RedisRateLimiter[${config.kind}]`);
  }

  async check(key: string, now: Date = new Date()): Promise<RateLimitResult> {
    const counts: Partial<Record<RateLimitWindow, number>> = {};
    let firstViolation: RateLimitReason | undefined;

    for (const window of WINDOW_ORDER) {
      const limit = this.config.limits[window];
      if (limit === undefined) continue;

      const redisKey = this.buildKey(window, key, now);
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.expire(redisKey, TTL_SECONDS[window]);
      }
      counts[window] = count;

      if (count > limit && firstViolation === undefined) {
        firstViolation = `${window}_exceeded` as RateLimitReason;
      }
    }

    if (firstViolation !== undefined) {
      this.logger.warn(
        `rate limit ${firstViolation} for key=${key}: counts=${JSON.stringify(counts)}`,
      );
      return { allowed: false, reason: firstViolation, counts };
    }

    return { allowed: true, counts };
  }

  private buildKey(window: RateLimitWindow, key: string, now: Date): string {
    const bucket = this.bucketOf(window, now);
    return `rate:${this.config.kind}:${key}:${window}:${bucket}`;
  }

  private bucketOf(window: RateLimitWindow, now: Date): string {
    const ts = now.getTime();
    switch (window) {
      case 'second':
        return String(Math.floor(ts / 1_000));
      case 'minute':
        return String(Math.floor(ts / 60_000));
      case 'hour':
        return String(Math.floor(ts / 3_600_000));
      case 'day': {
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }
}
