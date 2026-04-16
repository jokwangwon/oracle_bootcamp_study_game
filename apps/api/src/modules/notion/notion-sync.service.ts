import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotionDocumentEntity } from './entities/notion-document.entity';
import { NotionSyncStateEntity } from './entities/notion-sync-state.entity';
import { NOTION_API, type NotionApi, type NotionPageMeta } from './notion-api';

export interface SyncResult {
  databaseId: string;
  pagesProcessed: number;
  newPages: number;
  updatedPages: number;
  skipped: boolean;
}

/**
 * SDD §4.2.1 Stage 1 — 노션 증분 동기화 + 마크다운 캐시.
 *
 * 1. notion_sync_state(databaseId) 확보 (없으면 생성)
 * 2. 동시 실행 차단: 이미 status='syncing'이면 즉시 skip
 * 3. status='syncing' + 호출 시점 기록
 * 4. dataSourceId 조회
 * 5. last_synced_at 이후 변경된 페이지 페이지네이션 루프 fetch
 * 6. 각 페이지 fetchPageMarkdown → notion_documents upsert (rawMarkdown 갱신)
 * 7. lastSyncedAt = max(처리한 페이지의 lastEditedAt) 갱신
 * 8. 실패 시 status='error' + errorMessage + throw
 *
 * Phase 2(Stage 2 LLM 정리)와 Phase 3(범위 추론)는 후속 sub-task.
 */
@Injectable()
export class NotionSyncService {
  private readonly logger = new Logger(NotionSyncService.name);

  constructor(
    @Inject(NOTION_API) private readonly api: NotionApi,
    @InjectRepository(NotionSyncStateEntity)
    private readonly syncRepo: Repository<NotionSyncStateEntity>,
    @InjectRepository(NotionDocumentEntity)
    private readonly docRepo: Repository<NotionDocumentEntity>,
  ) {}

  async syncDatabase(databaseId: string): Promise<SyncResult> {
    const existing = await this.syncRepo.findOne({ where: { databaseId } });
    if (existing?.status === 'syncing') {
      this.logger.warn(`db=${databaseId} already syncing — skip`);
      return { databaseId, pagesProcessed: 0, newPages: 0, updatedPages: 0, skipped: true };
    }

    // 상태 → syncing
    let state = (await this.syncRepo.save({
      ...(existing ?? {}),
      databaseId,
      status: 'syncing',
      errorMessage: null,
    } as NotionSyncStateEntity)) as NotionSyncStateEntity;

    let pagesProcessed = 0;
    let newPages = 0;
    let updatedPages = 0;
    let maxEditedAt: Date | null = state.lastSyncedAt ?? null;

    try {
      const dataSourceId = await this.api.resolveDataSourceId(databaseId);

      let cursor: string | null = null;
      do {
        const resp = await this.api.queryDataSource(dataSourceId, {
          editedAfter: state.lastSyncedAt ?? undefined,
          cursor,
        });
        for (const page of resp.pages) {
          const upsertKind = await this.upsertDocument(page);
          if (upsertKind === 'new') newPages += 1;
          else updatedPages += 1;
          pagesProcessed += 1;
          if (!maxEditedAt || page.lastEditedAt > maxEditedAt) {
            maxEditedAt = page.lastEditedAt;
          }
        }
        cursor = resp.hasMore ? resp.nextCursor : null;
      } while (cursor !== null);

      state = (await this.syncRepo.save({
        ...state,
        status: 'idle',
        lastSyncedAt: maxEditedAt,
        errorMessage: null,
      } as NotionSyncStateEntity)) as NotionSyncStateEntity;

      this.logger.log(
        `db=${databaseId} sync OK: processed=${pagesProcessed} new=${newPages} updated=${updatedPages}`,
      );
      return { databaseId, pagesProcessed, newPages, updatedPages, skipped: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`db=${databaseId} sync FAIL: ${msg}`);
      await this.syncRepo.save({
        ...state,
        status: 'error',
        errorMessage: msg,
      } as NotionSyncStateEntity);
      throw err;
    }
  }

  private async upsertDocument(page: NotionPageMeta): Promise<'new' | 'updated'> {
    const markdown = await this.api.fetchPageMarkdown(page.pageId);
    const existing = await this.docRepo.findOne({ where: { notionPageId: page.pageId } });
    if (existing) {
      await this.docRepo.save({
        ...existing,
        title: page.title,
        rawMarkdown: markdown,
        lastEditedAt: page.lastEditedAt,
        status: 'active',
      } as NotionDocumentEntity);
      return 'updated';
    }
    await this.docRepo.save({
      notionPageId: page.pageId,
      title: page.title,
      rawMarkdown: markdown,
      structuredContent: null,
      week: null,
      topic: null,
      status: 'active',
      lastEditedAt: page.lastEditedAt,
    } as NotionDocumentEntity);
    return 'new';
  }
}
