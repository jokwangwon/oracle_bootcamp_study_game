import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '@notionhq/client';

import { EvalAdminGuard } from '../ai/eval/eval-admin.guard';
import { NotionDocumentEntity } from './entities/notion-document.entity';
import { NotionSyncStateEntity } from './entities/notion-sync-state.entity';
import { NotionController } from './notion.controller';
import { NOTION_API, RealNotionApi } from './notion-api';
import { NotionSyncService } from './notion-sync.service';
import { NotionSyncProcessor } from './queue/notion-sync.processor';
import { NotionSyncScheduler } from './queue/notion-sync.scheduler';
import { NOTION_SYNC_QUEUE } from './queue/queue.constants';

/**
 * Notion 동기화 모듈 (SDD §4.2 Stage 1).
 *
 * 책임:
 *  - NotionApi 추상 (RealNotionApi @notionhq/client v5 wrap)
 *  - NotionSyncService: 증분 동기화 + 마크다운 캐시
 *  - BullMQ notion-sync 큐 + Processor + RepeatableJob (cron)
 *  - REST POST /api/notion/sync (관리자 가드)
 *
 * NOTION_API_TOKEN 미설정 시 Client는 빈 토큰으로 생성되며 API 호출 시점에
 * 401로 거부된다. 운영 부팅 자체는 차단하지 않음 (env validation에서 optional).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([NotionSyncStateEntity, NotionDocumentEntity]),
    BullModule.registerQueue({
      name: NOTION_SYNC_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 24 * 3600, count: 50 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
    ConfigModule,
  ],
  controllers: [NotionController],
  providers: [
    {
      provide: NOTION_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new RealNotionApi(new Client({ auth: config.get<string>('NOTION_API_TOKEN') ?? '' })),
    },
    {
      provide: 'EVAL_ADMIN_USERNAMES',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<string>('EVAL_ADMIN_USERNAMES'),
    },
    EvalAdminGuard,
    NotionSyncService,
    NotionSyncProcessor,
    NotionSyncScheduler,
  ],
  exports: [NotionSyncService],
})
export class NotionModule {}
