import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscussionPostEntity } from './entities/discussion-post.entity';
import { DiscussionThreadEntity } from './entities/discussion-thread.entity';
import { DiscussionVoteEntity } from './entities/discussion-vote.entity';

/**
 * PR-10b §5.1 — R4 토론 모듈 (Phase 2 스켈레톤).
 *
 * Phase 2 는 entity 등록만. Phase 4 에서 DiscussionService / Phase 5 에서
 * DiscussionController + RateLimiter 추가. AppModule 등록은 Phase 6.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiscussionThreadEntity,
      DiscussionPostEntity,
      DiscussionVoteEntity,
    ]),
  ],
  providers: [],
  controllers: [],
  exports: [],
})
export class DiscussionModule {}
