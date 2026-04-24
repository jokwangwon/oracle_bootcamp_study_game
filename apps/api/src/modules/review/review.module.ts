import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReviewQueueEntity } from './entities/review-queue.entity';

/**
 * ADR-019 — Spaced Repetition Module.
 *
 * PR-1 (현재) — entity 만 등록. service / controller 는 PR-2~PR-4 에서 추가.
 *
 * 단계:
 *  - PR-1: ReviewQueueEntity + TypeOrmModule.forFeature (본 PR)
 *  - PR-2: `Sm2Service` (sm2Next + mapAnswerToQuality pure function)
 *  - PR-3: `ReviewQueueService` (upsertAfterAnswer + overwriteAfterOverride + 일일 상한)
 *  - PR-4: `ReviewQueueController` (GET /api/solo/review-queue) + `pickQuestions` 통합
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReviewQueueEntity])],
  providers: [],
  exports: [TypeOrmModule],
})
export class ReviewModule {}
