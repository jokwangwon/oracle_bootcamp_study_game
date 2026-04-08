import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import {
  CURRICULUM_TOPICS,
  GAME_MODE_IDS,
  type Difficulty,
  type GameModeId,
  type Topic,
} from '@oracle-game/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AI_QUESTION_GENERATION_QUEUE,
  GENERATE_QUESTIONS_JOB,
} from './queue/queue.constants';
import type { AiGenerationInput, AiGenerationResult } from './ai-question-generator';

class GenerateQuestionsDto {
  @IsEnum(CURRICULUM_TOPICS)
  topic!: Topic;

  @IsInt()
  @Min(1)
  week!: number;

  @IsEnum(GAME_MODE_IDS)
  gameMode!: GameModeId;

  @IsEnum(['EASY', 'MEDIUM', 'HARD'])
  difficulty!: Difficulty;

  @IsInt()
  @Min(1)
  @Max(20)
  count = 5;
}

/**
 * AI 문제 생성 REST 엔드포인트 (SDD §7.1).
 *
 * - POST /api/questions/generate: 비동기 Job 생성, jobId 반환
 * - GET  /api/questions/generate/:jobId: Job 상태 + 결과 조회
 *
 * 모두 JwtAuthGuard로 보호. 실제 LLM 호출은 BullMQ Processor에서 비동기로
 * 수행되므로 POST는 즉시 반환된다.
 */
@Controller('questions/generate')
@UseGuards(JwtAuthGuard)
export class AiQuestionController {
  constructor(
    @InjectQueue(AI_QUESTION_GENERATION_QUEUE)
    private readonly queue: Queue<AiGenerationInput, AiGenerationResult>,
  ) {}

  @Post()
  async enqueue(@Body() dto: GenerateQuestionsDto) {
    const job = await this.queue.add(GENERATE_QUESTIONS_JOB, {
      topic: dto.topic,
      week: dto.week,
      gameMode: dto.gameMode,
      difficulty: dto.difficulty,
      count: dto.count,
    });

    return {
      jobId: job.id,
      status: 'queued',
      input: dto,
    };
  }

  @Get(':jobId')
  async status(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    return {
      jobId: job.id,
      state, // 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | ...
      input: job.data,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
    };
  }
}
