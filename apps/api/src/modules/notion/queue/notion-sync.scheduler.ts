import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import {
  NOTION_SYNC_QUEUE,
  REPEATABLE_SYNC_JOB_ID,
  SYNC_DATABASE_JOB,
} from './queue.constants';

/**
 * SDD §4.2.1 — RepeatableJob 등록.
 *
 * NOTION_API_TOKEN과 NOTION_DATABASE_ID가 모두 설정된 경우에만 cron 등록.
 * 둘 중 하나라도 비어 있으면 sync는 disabled (수동 트리거만 가능).
 *
 * Job ID는 databaseId 포함 → 동일 DB에 대한 중복 RepeatableJob 방지.
 */
@Injectable()
export class NotionSyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotionSyncScheduler.name);

  constructor(
    @InjectQueue(NOTION_SYNC_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const token = this.config.get<string>('NOTION_API_TOKEN');
    const databaseId = this.config.get<string>('NOTION_DATABASE_ID');
    const cron = this.config.get<string>('NOTION_SYNC_CRON') ?? '0 0 * * 1';

    if (!token || !databaseId) {
      this.logger.warn(
        'NOTION_API_TOKEN 또는 NOTION_DATABASE_ID 미설정 — RepeatableJob 등록 건너뜀 (수동 트리거만 가능)',
      );
      return;
    }

    // 동일 ID로 add하면 BullMQ가 갱신함 (멱등)
    await this.queue.add(
      SYNC_DATABASE_JOB,
      { databaseId },
      {
        repeat: { pattern: cron },
        jobId: `${REPEATABLE_SYNC_JOB_ID}:${databaseId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 24 * 3600, count: 50 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );
    this.logger.log(
      `RepeatableJob 등록: queue=${NOTION_SYNC_QUEUE} db=${databaseId} cron="${cron}"`,
    );
  }
}
