import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
  imports: [TypeOrmModule.forFeature([ReviewQueueEntity]), OpsModule],
  providers: [ReviewQueueService],
  exports: [TypeOrmModule, ReviewQueueService],
})
export class ReviewModule {}
