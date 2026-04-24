import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QuestionEntity } from '../content/entities/question.entity';
import { OpsModule } from '../ops/ops.module';
import { ReviewQueueEntity } from './entities/review-queue.entity';
import { ReviewQueueService } from './review-queue.service';

/**
 * ADR-019 — Spaced Repetition Module.
 *
 * 단계:
 *  - PR-1: ReviewQueueEntity + TypeOrmModule.forFeature (완료)
 *  - PR-2: sm2.ts pure function (완료)
 *  - PR-3 (본 커밋): `ReviewQueueService` (upsertAfterAnswer + overwriteAfterOverride
 *    + 일일 상한 + D3 Hybrid hash/epoch 채움)
 *  - PR-4: `ReviewQueueController` (GET /api/solo/review-queue) + `pickQuestions` 통합
 *
 * OpsModule 을 import 하여 `GradingMeasurementService` 를 주입받는다
 * (`sr_queue_overflow` / `sr_upsert_failed` 이벤트 기록용, @Optional).
 */
@Module({
  // PR-4: QuestionEntity 도 registerFeature 에 포함 (findDue 의 JOIN 쿼리용).
  // 동일 entity 를 여러 모듈이 register 해도 TypeORM 은 단일 repo 로 해석 (충돌 없음).
  imports: [TypeOrmModule.forFeature([ReviewQueueEntity, QuestionEntity]), OpsModule],
  providers: [ReviewQueueService],
  exports: [TypeOrmModule, ReviewQueueService],
})
export class ReviewModule {}
