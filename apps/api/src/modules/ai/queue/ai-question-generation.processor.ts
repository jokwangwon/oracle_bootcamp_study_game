import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  AiQuestionGenerator,
  type AiGenerationInput,
  type AiGenerationResult,
} from '../ai-question-generator';
import {
  AI_QUESTION_GENERATION_QUEUE,
  GENERATE_QUESTIONS_JOB,
} from './queue.constants';

/**
 * BullMQ 워커 (SDD §4.3 + ADR-009).
 *
 * 큐: 'ai-question-generation'
 * Job 타입: 'generate-questions'
 *
 * AiQuestionGenerator를 호출하여 결과를 그대로 반환한다. 이 결과는
 * Job.returnvalue에 저장되어 GET /api/questions/generate/:jobId에서
 * 조회할 수 있다.
 *
 * 실패 정책 (BullMQ 기본):
 *  - process()가 throw하면 Job은 'failed' 상태가 되며 잡 목록에 보관됨
 *  - 자동 재시도는 enqueue 시 설정 (현재 attempts:1, 향후 정책 도입)
 */
@Processor(AI_QUESTION_GENERATION_QUEUE)
export class AiQuestionGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiQuestionGenerationProcessor.name);

  constructor(private readonly generator: AiQuestionGenerator) {
    super();
  }

  async process(job: Job<AiGenerationInput, AiGenerationResult>): Promise<AiGenerationResult> {
    if (job.name !== GENERATE_QUESTIONS_JOB) {
      throw new Error(`알 수 없는 job 이름: ${job.name}`);
    }

    this.logger.log(
      `Job ${job.id} 시작: topic=${job.data.topic}, week=${job.data.week}, mode=${job.data.gameMode}, count=${job.data.count}`,
    );

    const result = await this.generator.generate(job.data);

    this.logger.log(
      `Job ${job.id} 완료: saved=${result.saved.length}/${result.attempted}, rejected=${result.rejected.length}`,
    );

    return result;
  }
}
