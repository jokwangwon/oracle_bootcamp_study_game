import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscussionService } from './discussion.service';
import { DiscussionPostEntity } from './entities/discussion-post.entity';
import { DiscussionThreadEntity } from './entities/discussion-thread.entity';
import { DiscussionVoteEntity } from './entities/discussion-vote.entity';

/**
 * PR-10b §5.1 — R4 토론 모듈.
 *
 * Phase 2 entity / Phase 4a Thread CRUD service. Phase 4b/4c 에서 Post + Vote
 * 메서드 추가. Phase 5 에서 Controller + RateLimiter 추가, AppModule 등록.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiscussionThreadEntity,
      DiscussionPostEntity,
      DiscussionVoteEntity,
    ]),
  ],
  providers: [DiscussionService],
  controllers: [],
  exports: [DiscussionService],
})
export class DiscussionModule {}
