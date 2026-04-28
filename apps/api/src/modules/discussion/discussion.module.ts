import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionPostEntity } from './entities/discussion-post.entity';
import { DiscussionThreadEntity } from './entities/discussion-thread.entity';
import { DiscussionVoteEntity } from './entities/discussion-vote.entity';

/**
 * PR-10b §5 — R4 토론 모듈.
 *
 * Phase 2 entity / Phase 4 service / Phase 5 controller. AppModule 에 import.
 * ThrottlerModule 은 AppModule 의 글로벌 설정 재사용 (PR-10a Phase 6).
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
  controllers: [DiscussionController],
  exports: [DiscussionService],
})
export class DiscussionModule {}
