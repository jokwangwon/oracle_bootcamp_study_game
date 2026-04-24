import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import type { Difficulty, GameModeId, Topic } from '@oracle-game/shared';

import { QuestionEntity } from '../content/entities/question.entity';
import { hashUserToken } from '../grading/user-token-hash';
import { ActiveEpochLookup } from '../ops/active-epoch.lookup';
import { GradingMeasurementService } from '../ops/grading-measurement.service';
import { ReviewQueueEntity } from './entities/review-queue.entity';
import { sm2Next, type Sm2PrevState, type Sm2Result } from './sm2';

export interface FindDueCriteria {
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  difficulty?: Difficulty;
}

/**
 * ADR-019 §5 PR-3 — SM-2 review_queue 서비스.
 *
 *  - `upsertAfterAnswer`: 정상 답변 경로. `mapAnswerToQuality` 의 quality 를
 *    입력으로 받아 existing 상태와 결합해 `sm2Next` 로 다음 상태 계산 후 UPSERT.
 *    신규 편입 시 일일 상한 (SR_DAILY_NEW_CAP, 기본 100) 체크하여 초과 drop.
 *  - `overwriteAfterOverride`: admin-override 경로. cap 미체크 / existing 미요구.
 *
 * ## fail 정책
 *
 *  - **user_token_hash + epoch resolve**: fail-safe (null 저장, upsert 진행).
 *    파생/캐시 테이블이므로 누락 관측은 health-check 로 감지 (§4.3 운영 규약).
 *  - **repo 오류**: caller(`GameSessionService`) 로 전파. 학생 응답은 이미 성공
 *    반환되므로 submitAnswer try-catch 에서 `recordSrUpsertFail` 기록 후 warn.
 *
 * ## 트랜잭션 (ADR-019 §5.1)
 *
 * 본 서비스는 Tx2 (보조). Tx1 (`answer_history` INSERT) 는 GameSessionService
 * 가 본 메서드 호출 **이전에** 이미 성공 반환. UPSERT 는 단일 statement 원자성
 * (ON CONFLICT) 로 race 방어 (§8.2 advisory lock 은 MVP 유보).
 */
@Injectable()
export class ReviewQueueService {
  private readonly logger = new Logger(ReviewQueueService.name);

  constructor(
    @InjectRepository(ReviewQueueEntity)
    private readonly repo: Repository<ReviewQueueEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly activeEpoch?: ActiveEpochLookup,
    @Optional() private readonly gradingMeasurement?: GradingMeasurementService,
  ) {}

  private dailyNewCap(): number {
    const raw = this.config?.get<number>('SR_DAILY_NEW_CAP');
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    return 100;
  }

  private async resolveHashAndEpoch(
    userId: string,
  ): Promise<{ userTokenHash: string | null; userTokenHashEpoch: number | null }> {
    if (!userId) return { userTokenHash: null, userTokenHashEpoch: null };
    if (!this.config || !this.activeEpoch) {
      return { userTokenHash: null, userTokenHashEpoch: null };
    }
    try {
      const salt = this.config.get<string>('USER_TOKEN_HASH_SALT');
      if (!salt) return { userTokenHash: null, userTokenHashEpoch: null };
      const epochId = await this.activeEpoch.getActiveEpochId();
      return {
        userTokenHash: hashUserToken(userId, salt),
        userTokenHashEpoch: epochId,
      };
    } catch (err) {
      this.logger.warn(
        `user_token_hash resolve 실패 (fail-safe): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { userTokenHash: null, userTokenHashEpoch: null };
    }
  }

  async upsertAfterAnswer(
    userId: string,
    questionId: string,
    quality: number,
    anchor: Date = new Date(),
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { userId, questionId } });

    if (!existing) {
      const todayStart = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
      );
      const observed = await this.repo.count({
        where: { userId, createdAt: MoreThanOrEqual(todayStart) },
      });
      const cap = this.dailyNewCap();
      if (observed >= cap) {
        await this.gradingMeasurement?.recordSrQueueOverflow({
          questionId,
          userId,
          payload: { cap, observed },
        });
        return;
      }
    }

    await this.persist(userId, questionId, this.computeNext(existing, quality, anchor));
  }

  async overwriteAfterOverride(
    userId: string,
    questionId: string,
    quality: number,
    anchor: Date = new Date(),
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { userId, questionId } });
    await this.persist(userId, questionId, this.computeNext(existing, quality, anchor));
  }

  private computeNext(
    existing: ReviewQueueEntity | null,
    quality: number,
    anchor: Date,
  ): Sm2Result {
    const prev: Sm2PrevState = existing
      ? {
          easeFactor: Number(existing.easeFactor),
          intervalDays: existing.intervalDays,
          repetition: existing.repetition,
        }
      : { easeFactor: 2.5, intervalDays: 0, repetition: 0 };
    return sm2Next(prev, quality, anchor);
  }

  /**
   * ADR-019 §5.2 PR-4 — 사용자에게 오늘(또는 지정 시각 기준) due 인 문제를 조회.
   *
   * 2-step:
   *  1. `review_queue` 에서 user-scoped + `due_at <= now` 행을 due_at ASC 로 take limit
   *     (NULL 은 `LessThanOrEqual` 비교에서 자동 제외 — `NULL <= now` 는 NULL 이므로 매치 X).
   *  2. 해당 question_id 들을 questions 테이블에서 topic/week/gameMode/difficulty 로 필터.
   *  3. 원래 due_at ASC 순서 보존 (byId 리오더).
   *
   * criteria 불일치로 filter 후 length < limit 이어도 caller 가 random 으로 보충 (§5.2).
   */
  async findDue(
    userId: string,
    criteria: FindDueCriteria,
    limit: number,
    now: Date = new Date(),
  ): Promise<QuestionEntity[]> {
    if (!userId || limit <= 0) return [];

    const dueRows = await this.repo.find({
      where: { userId, dueAt: LessThanOrEqual(now) },
      order: { dueAt: 'ASC' },
      take: limit,
    });
    if (dueRows.length === 0) return [];

    const ids = dueRows.map((r) => r.questionId);
    const qb = this.questionRepo
      .createQueryBuilder('q')
      .where('q.id IN (:...ids)', { ids })
      .andWhere('q.status = :status', { status: 'active' })
      .andWhere('q.topic = :topic', { topic: criteria.topic })
      .andWhere('q.gameMode = :gameMode', { gameMode: criteria.gameMode })
      .andWhere('q.week <= :week', { week: criteria.week });
    if (criteria.difficulty) {
      qb.andWhere('q.difficulty = :difficulty', { difficulty: criteria.difficulty });
    }
    const matched = await qb.getMany();

    const byId = new Map(matched.map((q) => [q.id, q]));
    return ids
      .map((id) => byId.get(id))
      .filter((q): q is QuestionEntity => q !== undefined);
  }

  /**
   * ADR-019 §5.2 PR-4 — 세션 헤더 "오늘 복습 N" 뱃지 (PR-5) 입력.
   *
   * 전체 topic/gameMode 범위에서 user 가 오늘 due 인 문제 수. 필터 X (UI 집계용).
   */
  async countDueForUser(userId: string, now: Date = new Date()): Promise<number> {
    if (!userId) return 0;
    return this.repo.count({
      where: { userId, dueAt: LessThanOrEqual(now) },
    });
  }

  private async persist(
    userId: string,
    questionId: string,
    next: Sm2Result,
  ): Promise<void> {
    const hashMeta = await this.resolveHashAndEpoch(userId);
    await this.repo.upsert(
      {
        userId,
        questionId,
        easeFactor: next.easeFactor.toFixed(3),
        intervalDays: next.intervalDays,
        repetition: next.repetition,
        dueAt: next.dueAt,
        lastReviewedAt: next.lastReviewedAt,
        lastQuality: next.lastQuality,
        algorithmVersion: 'sm2-v1',
        userTokenHash: hashMeta.userTokenHash,
        userTokenHashEpoch: hashMeta.userTokenHashEpoch,
      } as Partial<ReviewQueueEntity>,
      ['userId', 'questionId'],
    );
  }
}
