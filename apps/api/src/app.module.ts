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
import { NotionModule } from './modules/notion/notion.module';
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
    NotionModule,
    EvalModule,
  ],
})
export class AppModule {}
