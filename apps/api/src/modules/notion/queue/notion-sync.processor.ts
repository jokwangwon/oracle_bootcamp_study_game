import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { NotionSyncService, type SyncResult } from '../notion-sync.service';
import { NOTION_SYNC_QUEUE, SYNC_DATABASE_JOB } from './queue.constants';

export interface NotionSyncJobData {
  databaseId: string;
}

@Processor(NOTION_SYNC_QUEUE)
export class NotionSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(NotionSyncProcessor.name);

  constructor(private readonly service: NotionSyncService) {
    super();
  }

  async process(job: Job<NotionSyncJobData, SyncResult>): Promise<SyncResult> {
    if (job.name !== SYNC_DATABASE_JOB) {
      throw new Error(`알 수 없는 job 이름: ${job.name}`);
    }
    this.logger.log(`Job ${job.id} 시작: databaseId=${job.data.databaseId}`);
    const result = await this.service.syncDatabase(job.data.databaseId);
    this.logger.log(
      `Job ${job.id} 완료: processed=${result.pagesProcessed} skipped=${result.skipped}`,
    );
    return result;
  }
}
