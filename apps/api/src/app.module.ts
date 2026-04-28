import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GameModule } from './modules/game/game.module';
import { ContentModule } from './modules/content/content.module';
import { AiModule } from './modules/ai/ai.module';
import { EvalModule } from './modules/ai/eval/eval.module';
import { OpsModule } from './modules/ops/ops.module';
import { GradingModule } from './modules/grading/grading.module';
import { GradingAppealsModule } from './modules/grading/appeal/grading-appeals.module';
import { NotionModule } from './modules/notion/notion.module';
import { ReviewModule } from './modules/review/review.module';
import { DiscussionModule } from './modules/discussion/discussion.module';
import { typeOrmConfig } from './config/typeorm.config';
import { configValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: configValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfig,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    GameModule,
    ContentModule,
    AiModule,
    OpsModule,
    // consensus-007 S6-C2-3 — GradingModule 격리 해제. free-form 채점 배선은
    // C2-4 GameSessionService.gradeFreeForm + ENABLE_FREE_FORM_GRADING kill-switch.
    GradingModule,
    GradingAppealsModule,
    NotionModule,
    // ADR-019 — SM-2 SR. PR-1 은 entity 등록만, 실 통합은 PR-3 이후.
    ReviewModule,
    // PR-10b §5 — R4 토론 (3 entity + service + controller + discussion_write throttler).
    DiscussionModule,
    EvalModule,
  ],
})
export class AppModule {}
