import { Injectable, Logger } from '@nestjs/common';
import type IORedis from 'ioredis';

import {
  RedisRateLimiter,
  type RateLimitResult as GenericResult,
} from '../../shared/rate-limit/redis-rate-limiter';

/**
 * ADR-016 §레이트리밋 — grading_appeals 제출 rate limit.
 *
 * ADR-020 §4.3 (PR-6) 에서 일반화 `RedisRateLimiter` 위 thin wrapper 로 재작성.
 * 외부 시그니처 (check 결과의 `minuteCount`/`dayCount`) 와 키 구조
 * (`rate:appeal:{userId}:min:{floor(ts/60000)}` / `rate:appeal:{userId}:day:{YYYY-MM-DD}`)
 * 은 회귀 0 을 위해 어댑터 계층에서 변환.
 *
 * 기본값: 분당 10 / 일당 5 (ADR-016 §레이트리밋).
 */

export const APPEAL_RATE_LIMIT_PER_MINUTE = 10;
export const APPEAL_RATE_LIMIT_PER_DAY = 5;

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'minute_exceeded' | 'day_exceeded';
  minuteCount: number;
  dayCount: number;
}

@Injectable()
export class AppealRateLimiter {
  private readonly logger = new Logger(AppealRateLimiter.name);
  private readonly inner: RedisRateLimiter;

  constructor(redis: IORedis) {
    this.inner = new RedisRateLimiter(redis, {
      kind: 'appeal',
      limits: {
        minute: APPEAL_RATE_LIMIT_PER_MINUTE,
        day: APPEAL_RATE_LIMIT_PER_DAY,
      },
    });
  }

  async check(userId: string, now: Date = new Date()): Promise<RateLimitResult> {
    const r = await this.inner.check(userId, now);
    return adapt(r);
  }
}

function adapt(r: GenericResult): RateLimitResult {
  const minuteCount = r.counts.minute ?? 0;
  const dayCount = r.counts.day ?? 0;
  if (r.allowed) {
    return { allowed: true, minuteCount, dayCount };
  }
  // appeal 정책상 reason 은 minute_exceeded | day_exceeded 두 가지만 발생.
  const reason = r.reason as 'minute_exceeded' | 'day_exceeded';
  return { allowed: false, reason, minuteCount, dayCount };
}
