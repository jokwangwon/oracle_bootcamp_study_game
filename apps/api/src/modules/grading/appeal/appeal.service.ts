import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AnswerHistoryEntity } from '../../users/entities/answer-history.entity';
import {
  OpsEventLogEntity,
  type GradingAppealPayload,
} from '../../ops/entities/ops-event-log.entity';
import {
  APPEAL_REASONS,
  type AppealReason,
  GradingAppealEntity,
} from '../entities/grading-appeal.entity';
import { AppealRateLimiter } from './appeal-rate-limiter';

export interface SubmitAppealInput {
  answerHistoryId: string;
  userId: string;
  reason: AppealReason;
  note?: string | null;
}

export interface SubmitAppealResult {
  id: string;
  status: 'pending';
  createdAt: Date;
}

/**
 * ADR-016 §추가 이의제기 서비스.
 *
 * 처리 순서:
 *  1. `reason` enum 4종 검증.
 *  2. rate limit 체크 (분당 10 / 일당 5).
 *  3. `answer_history` 존재 + 소유자(`userId === answer_history.userId`) 검증.
 *     ADR-018 §8 금지 2 준수 — 평문 userId 매칭 (hash 식별자 사용 금지).
 *  4. 동일 (answer_history_id, userId) pending appeal 중복 차단 (DB 레벨 partial unique).
 *  5. `grading_appeals` INSERT.
 *  6. `ops_event_log` `kind='grading_appeal'` 동기 기록.
 *
 * answer_history 는 WORM (REVOKE UPDATE + trigger) — 본 서비스는 SELECT 만 수행.
 */

export const APPEAL_MAX_NOTE_LENGTH = 2048;

@Injectable()
export class AppealService {
  constructor(
    @InjectRepository(GradingAppealEntity)
    private readonly appeals: Repository<GradingAppealEntity>,
    @InjectRepository(AnswerHistoryEntity)
    private readonly answerHistory: Repository<AnswerHistoryEntity>,
    @InjectRepository(OpsEventLogEntity)
    private readonly opsEvents: Repository<OpsEventLogEntity>,
    private readonly rateLimiter: AppealRateLimiter,
  ) {}

  async submit(input: SubmitAppealInput): Promise<SubmitAppealResult> {
    // 1. reason 검증 (validator 파이프라인 보조)
    if (!APPEAL_REASONS.includes(input.reason)) {
      throw new HttpException(
        `invalid appeal reason: ${input.reason}. allowed: ${APPEAL_REASONS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.note && input.note.length > APPEAL_MAX_NOTE_LENGTH) {
      throw new HttpException(
        `appeal note exceeds ${APPEAL_MAX_NOTE_LENGTH} chars`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. rate limit
    const rl = await this.rateLimiter.check(input.userId);
    if (!rl.allowed) {
      throw new HttpException(
        {
          error: 'rate_limit',
          reason: rl.reason,
          minuteCount: rl.minuteCount,
          dayCount: rl.dayCount,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. answer_history 소유자 검증
    const history = await this.answerHistory.findOne({
      where: { id: input.answerHistoryId },
    });
    if (!history) {
      throw new NotFoundException(
        `answer_history id=${input.answerHistoryId} not found`,
      );
    }
    if (history.userId !== input.userId) {
      // 소유자가 아님. 정보 누수 최소화를 위해 NotFoundException 유지도 가능하나
      // CLAUDE.md 스타일상 의도 명시적 403.
      throw new ForbiddenException(
        `user does not own answer_history id=${input.answerHistoryId}`,
      );
    }

    // 4~5. INSERT (중복은 DB partial unique 가 ConflictException 으로 전환)
    let saved: GradingAppealEntity;
    try {
      const appeal = this.appeals.create({
        answerHistoryId: input.answerHistoryId,
        userId: input.userId,
        reason: input.reason,
        note: input.note ?? null,
        status: 'pending',
      });
      saved = await this.appeals.save(appeal);
    } catch (err: unknown) {
      // Postgres unique_violation = 23505
      if (isPgUniqueViolation(err)) {
        throw new ConflictException(
          'pending appeal already exists for this answer_history',
        );
      }
      throw err;
    }

    // 6. ops_event_log 기록 (fail-safe: 기록 실패해도 appeal 자체는 유지)
    await this.recordOpsEvent(saved).catch(() => {
      // 의도적 swallow — ops 기록 실패가 사용자 flow 를 막지 않는다.
    });

    return {
      id: saved.id,
      status: 'pending',
      createdAt: saved.createdAt,
    };
  }

  private async recordOpsEvent(appeal: GradingAppealEntity): Promise<void> {
    const payload: GradingAppealPayload = {
      appealId: appeal.id,
      answerHistoryId: appeal.answerHistoryId,
      reason: appeal.reason,
    };
    const event = this.opsEvents.create({
      kind: 'grading_appeal',
      userId: appeal.userId,
      payload: payload as unknown as Record<string, unknown>,
    });
    await this.opsEvents.save(event);
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}
