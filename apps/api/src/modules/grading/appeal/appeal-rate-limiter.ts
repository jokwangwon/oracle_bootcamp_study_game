import { Injectable, Logger } from '@nestjs/common';
import type IORedis from 'ioredis';

/**
 * ADR-016 §레이트리밋 — grading_appeals 제출 rate limit.
 *
 * 기본값: 분당 10회 / 일당 5회.
 *
 * 구현:
 *  - Redis INCR + EXPIRE (first increment 시 TTL 설정).
 *  - Key 구조:
 *    - minute: `rate:appeal:{userId}:min:{floor(ts/60000)}`
 *    - day:    `rate:appeal:{userId}:day:{YYYY-MM-DD}`
 *  - Atomic 보장은 약함 (race 시 ±1 오차). 부트캠프 규모에서 정확도 > 실용 균형으로 수용.
 *  - 상한 초과 시 INCR 한 count 는 rollback 하지 않음 — 다음 window 에서 자연 리셋.
 *
 * ADR-018 §8 금지 2 준수: `userId` 는 평문 사용. `user_token_hash` 를 key 에 포함하지 않음.
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

  constructor(private readonly redis: IORedis) {}

  async check(userId: string, now: Date = new Date()): Promise<RateLimitResult> {
    const minuteKey = this.minuteKey(userId, now);
    const dayKey = this.dayKey(userId, now);

    const minuteCount = await this.redis.incr(minuteKey);
    if (minuteCount === 1) {
      await this.redis.expire(minuteKey, 120); // 2분 TTL (안전 마진)
    }

    const dayCount = await this.redis.incr(dayKey);
    if (dayCount === 1) {
      await this.redis.expire(dayKey, 86400);
    }

    if (minuteCount > APPEAL_RATE_LIMIT_PER_MINUTE) {
      this.logger.warn(
        `appeal rate limit (minute) exceeded for user=${userId}: ${minuteCount}/${APPEAL_RATE_LIMIT_PER_MINUTE}`,
      );
      return { allowed: false, reason: 'minute_exceeded', minuteCount, dayCount };
    }

    if (dayCount > APPEAL_RATE_LIMIT_PER_DAY) {
      this.logger.warn(
        `appeal rate limit (day) exceeded for user=${userId}: ${dayCount}/${APPEAL_RATE_LIMIT_PER_DAY}`,
      );
      return { allowed: false, reason: 'day_exceeded', minuteCount, dayCount };
    }

    return { allowed: true, minuteCount, dayCount };
  }

  private minuteKey(userId: string, now: Date): string {
    return `rate:appeal:${userId}:min:${Math.floor(now.getTime() / 60000)}`;
  }

  private dayKey(userId: string, now: Date): string {
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `rate:appeal:${userId}:day:${yyyy}-${mm}-${dd}`;
  }
}
