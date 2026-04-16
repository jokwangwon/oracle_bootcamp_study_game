import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

import { ContentModule } from '../content/content.module';
import { LlmClient } from './llm-client';
import { LlmClientFactory } from './llm-client.factory';
import { ModelDigestProvider } from './model-digest.provider';
import { PromptManager } from './prompt-manager';
import { AiQuestionGenerator } from './ai-question-generator';
import { AiQuestionController } from './ai-question.controller';
import { AiQuestionGenerationProcessor } from './queue/ai-question-generation.processor';
import { AI_QUESTION_GENERATION_QUEUE } from './queue/queue.constants';

/**
 * AI 모듈 (ADR-009 + SDD §4.3).
 *
 * 책임:
 *  - LlmClient: LangChain Chat Model + Langfuse callback (단일 진입점)
 *  - PromptManager: Langfuse Prompt Management fetch + 로컬 fallback
 *  - AiQuestionGenerator: 생성 파이프라인 (LLM → parser → Zod → ScopeValidator → 풀)
 *  - BullMQ Queue + Processor: 비동기 격리 (워커 컨테이너 분리 가능)
 *  - REST 엔드포인트: POST /api/questions/generate, GET :jobId
 *
 * 의존성:
 *  - ContentModule (QuestionPoolService, ScopeValidatorService, WeeklyScopeEntity)
 *  - BullMQ (Redis 연결은 forRootAsync로 ConfigService 활용)
 */
@Module({
  imports: [
    ContentModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        // BullMQ는 connection으로 ioredis 인스턴스 또는 옵션을 받는다.
        // ioredis가 URL 파싱을 지원하므로 그대로 사용.
        return {
          connection: new IORedis(url, {
            // BullMQ 권장 옵션 — Worker는 이 두 옵션이 null이어야 함
            maxRetriesPerRequest: null,
          }),
        };
      },
    }),
    BullModule.registerQueue({
      name: AI_QUESTION_GENERATION_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 24 * 3600 },
      },
    }),
  ],
  providers: [
    LlmClient,
    LlmClientFactory,
    ModelDigestProvider,
    PromptManager,
    AiQuestionGenerator,
    AiQuestionGenerationProcessor,
  ],
  controllers: [AiQuestionController],
  exports: [LlmClient, LlmClientFactory, ModelDigestProvider, PromptManager, AiQuestionGenerator],
})
export class AiModule {}
