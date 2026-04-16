import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { Queue } from 'bullmq';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvalAdminGuard } from '../ai/eval/eval-admin.guard';
import {
  NOTION_SYNC_QUEUE,
  SYNC_DATABASE_JOB,
} from './queue/queue.constants';

export class TriggerSyncDto {
  @IsOptional()
  @IsString()
  databaseId?: string;
}

@Controller('notion')
@UseGuards(JwtAuthGuard, EvalAdminGuard)
export class NotionController {
  constructor(
    @InjectQueue(NOTION_SYNC_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  /**
   * SDD §4.2.1 — 즉시 동기화 트리거. RepeatableJob과 동일 큐 사용.
   * 동일 DB에 대한 Job 중복 방지를 위해 jobId에 databaseId 포함.
   */
  @Post('sync')
  async triggerSync(@Body() dto: TriggerSyncDto): Promise<{
    jobId: string;
    databaseId: string;
    queuedAt: string;
  }> {
    const databaseId =
      dto.databaseId?.trim() || this.config.get<string>('NOTION_DATABASE_ID') || '';
    if (!databaseId) {
      throw new BadRequestException(
        'databaseId가 body에 없거나 NOTION_DATABASE_ID 환경변수가 비어있습니다.',
      );
    }
    const queuedAt = new Date().toISOString();
    const jobId = `manual:${databaseId}:${queuedAt}`;
    await this.queue.add(
      SYNC_DATABASE_JOB,
      { databaseId },
      { jobId, attempts: 1 },
    );
    return { jobId, databaseId, queuedAt };
  }
}
