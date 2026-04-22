import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import IORedis from 'ioredis';

import { OpsEventLogEntity } from '../../ops/entities/ops-event-log.entity';
import { AnswerHistoryEntity } from '../../users/entities/answer-history.entity';
import { GradingAppealEntity } from '../entities/grading-appeal.entity';
import { AppealController } from './appeal.controller';
import { AppealRateLimiter } from './appeal-rate-limiter';
import { AppealService } from './appeal.service';

/**
 * ADR-016 §추가 이의제기 모듈.
 *
 * 배선 정책:
 *  - GradingModule 은 AppModule 미등록 유지 (채점 파이프라인 배선 전까지 게임 흐름 회귀 0).
 *  - 본 GradingAppealsModule 은 **독립 등록** — 엔드포인트가 answer_history 조회만 하므로
 *    GradingOrchestrator 의존 없음. 학생이 기존 INSERT 된 answer_history 를 대상으로
 *    이의 제기 가능 (free-form 경로 없어도 작동).
 *
 * Redis 연결은 IORedis 단일 인스턴스 — rate limit 전용. BullMQ 연결(AiModule)과 별도
 * 인스턴스지만 동일 Redis 서버 사용.
 */

export const APPEAL_REDIS = Symbol('APPEAL_REDIS');

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GradingAppealEntity,
      AnswerHistoryEntity,
      OpsEventLogEntity,
    ]),
    ConfigModule,
  ],
  controllers: [AppealController],
  providers: [
    {
      provide: APPEAL_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): IORedis => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        return new IORedis(url, { maxRetriesPerRequest: null });
      },
    },
    {
      provide: AppealRateLimiter,
      inject: [APPEAL_REDIS],
      useFactory: (redis: IORedis) => new AppealRateLimiter(redis),
    },
    AppealService,
  ],
  exports: [AppealService],
})
export class GradingAppealsModule {}
