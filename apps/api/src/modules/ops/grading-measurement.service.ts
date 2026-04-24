import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type GradingMeasuredPayload,
  type LlmTimeoutPayload,
  type MeasurementFailPayload,
} from './entities/ops-event-log.entity';

/**
 * consensus-007 S6-C2-2 — 3단 채점 차원 이벤트 기록.
 *
 * `OpsMeasurementService.measureSync` 와 **시맨틱 분리**:
 *  - `measureSync`: AI 문제 생성 직후 MT3/MT4 재측정. 문제 한 건당 한 row
 *    (`ops_question_measurements` UNIQUE question_id).
 *  - `measureGrading`: 학생이 free-form 문제를 풀 때마다 발생. 여러 학생·여러
 *    시도로 다발 발생 → `ops_event_log(kind='grading_measured')` 로 기록.
 *
 * SDD `operational-monitoring-design.md` §3.2 payload schema per kind 원칙.
 * MT6(layer1_resolved) / MT8(layer3_invoked) 집계는 Phase B cron 에서 본 이벤트
 * 필드를 직접 COUNT.
 *
 * 원칙:
 *  - **Fail-safe**: 이벤트 저장 실패가 학생 채점 경로를 막지 않는다. warn 로그만.
 *  - **PII 0**: payload 에 학생 답안 원문·userId 평문 금지. `userId` 는 외래키로만.
 *  - **감사 체인**: graderDigest / gradingLayersUsed / astFailureReason 필수 기록.
 */
@Injectable()
export class GradingMeasurementService {
  private readonly logger = new Logger(GradingMeasurementService.name);

  constructor(
    @InjectRepository(OpsEventLogEntity)
    private readonly eventRepo: Repository<OpsEventLogEntity>,
  ) {}

  async measureGrading(input: {
    questionId: string;
    userId: string;
    payload: GradingMeasuredPayload;
  }): Promise<void> {
    try {
      await this.eventRepo.save({
        kind: 'grading_measured',
        questionId: input.questionId,
        userId: input.userId,
        payload: input.payload as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
    } catch (err) {
      this.logger.warn(
        `grading_measured 이벤트 기록 실패 (fail-safe) question=${input.questionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * ADR-016 §추가 + consensus-007 S6-C2-5 — Layer 3 LLM-judge timeout 이벤트.
   *
   * LlmJudgeTimeoutError 가 상위 GameSessionService 로 surface 될 때 호출.
   * Fail-safe (warn 만, 학생 경로 보호).
   * 학생 답안 원문 저장 금지.
   */
  async recordLlmTimeout(input: {
    questionId: string;
    userId: string;
    payload: LlmTimeoutPayload;
  }): Promise<void> {
    try {
      await this.eventRepo.save({
        kind: 'llm_timeout',
        questionId: input.questionId,
        userId: input.userId,
        payload: input.payload as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
    } catch (err) {
      this.logger.warn(
        `llm_timeout 이벤트 기록 실패 (fail-safe) question=${input.questionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * PR #15 (consensus-007 사후 검증 CRITICAL-1) — held 감사 row 저장 실패 기록.
   *
   * Layer 3 timeout 발생 후 answer_history held row 저장이 실패하면 학생은
   * HTTP 503 을 받고 원장에 아무것도 안 남는 이중 실패 시나리오. 이 경로를
   * `ops_event_log(kind='measurement_fail', stage='other', cause='held_persist_fail')`
   * 로 강제 기록하여 운영자가 사후 복구 가능한 단서를 남긴다. 본 호출 자체도
   * fail-safe.
   */
  async recordHeldPersistFail(input: {
    questionId: string;
    userId: string;
    error: unknown;
  }): Promise<void> {
    const msg = input.error instanceof Error ? input.error.message : String(input.error);
    const payload: MeasurementFailPayload = {
      error: msg,
      stage: 'other',
      cause: 'held_persist_fail',
    };
    try {
      await this.eventRepo.save({
        kind: 'measurement_fail',
        questionId: input.questionId,
        userId: input.userId,
        payload: payload as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
    } catch (err) {
      this.logger.error(
        `held_persist_fail 이벤트 기록 자체 실패 (최후 방어선) question=${input.questionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
