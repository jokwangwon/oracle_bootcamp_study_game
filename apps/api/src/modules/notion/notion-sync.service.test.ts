import { describe, it, expect, beforeEach, vi } from 'vitest';

import { NotionSyncService } from './notion-sync.service';
import type { NotionApi, NotionPageMeta } from './notion-api';
import type { NotionSyncStateEntity } from './entities/notion-sync-state.entity';
import type { NotionDocumentEntity } from './entities/notion-document.entity';

type SyncRepo = {
  findOne: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};
type DocRepo = {
  findOne: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

function makeApi(
  pages: NotionPageMeta[],
  markdownByPage: Record<string, string> = {},
  opts: { failQuery?: boolean; failResolve?: boolean; pages2?: NotionPageMeta[] } = {},
): NotionApi {
  let queryCallCount = 0;
  return {
    resolveDataSourceId: vi.fn(async () => {
      if (opts.failResolve) throw new Error('resolve failed');
      return 'ds-1';
    }),
    queryDataSource: vi.fn(async () => {
      if (opts.failQuery) throw new Error('query failed');
      queryCallCount += 1;
      if (opts.pages2 && queryCallCount === 1) {
        return { pages, hasMore: true, nextCursor: 'cursor-1' };
      }
      if (opts.pages2 && queryCallCount === 2) {
        return { pages: opts.pages2, hasMore: false, nextCursor: null };
      }
      return { pages, hasMore: false, nextCursor: null };
    }),
    fetchPageMarkdown: vi.fn(async (pageId: string) => markdownByPage[pageId] ?? `# ${pageId}`),
  };
}

const T = (iso: string): Date => new Date(iso);

describe('NotionSyncService.syncDatabase', () => {
  let syncRepo: SyncRepo;
  let docRepo: DocRepo;

  beforeEach(() => {
    syncRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((e) => Promise.resolve({ id: 'state-1', ...e })),
    };
    docRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((e) => Promise.resolve({ id: `doc-${Date.now()}`, ...e })),
    };
  });

  it('첫 동기화: state 신규 생성 + 페이지 2개 INSERT + last_synced_at = max(lastEditedAt)', async () => {
    const pages: NotionPageMeta[] = [
      { pageId: 'p1', title: 'Page 1', lastEditedAt: T('2026-04-10T00:00:00Z') },
      { pageId: 'p2', title: 'Page 2', lastEditedAt: T('2026-04-12T00:00:00Z') },
    ];
    const api = makeApi(pages);
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    const result = await service.syncDatabase('db-1');

    expect(result.pagesProcessed).toBe(2);
    expect(result.newPages).toBe(2);
    expect(result.updatedPages).toBe(0);

    // state save 호출: 최소 (idle->syncing) + 최종 idle 두 번
    const stateSaves = syncRepo.save.mock.calls.map((c) => c[0]) as Array<Partial<NotionSyncStateEntity>>;
    const finalState = stateSaves[stateSaves.length - 1]!;
    expect(finalState.status).toBe('idle');
    expect(finalState.lastSyncedAt?.toISOString()).toBe('2026-04-12T00:00:00.000Z');
    expect(finalState.errorMessage).toBeNull();

    // 문서 저장 검증
    const docSaves = docRepo.save.mock.calls.map((c) => c[0]) as Array<Partial<NotionDocumentEntity>>;
    expect(docSaves.map((d) => d.notionPageId).sort()).toEqual(['p1', 'p2']);
    expect(docSaves[0]!.rawMarkdown).toBeTruthy();
    expect(docSaves[0]!.status).toBe('active');
  });

  it('이미 존재하는 페이지: 변경 없으면 update만 (newPages=0, updatedPages=수)', async () => {
    docRepo.findOne = vi.fn().mockImplementation(async (opts: { where: { notionPageId: string } }) => ({
      id: `existing-${opts.where.notionPageId}`,
      notionPageId: opts.where.notionPageId,
    }));
    const pages: NotionPageMeta[] = [
      { pageId: 'p1', title: 'Page 1 updated', lastEditedAt: T('2026-04-12T00:00:00Z') },
    ];
    const api = makeApi(pages);
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    const result = await service.syncDatabase('db-1');

    expect(result.newPages).toBe(0);
    expect(result.updatedPages).toBe(1);
  });

  it('두 번째 동기화: 기존 state 있고 변경된 페이지 1개 → editedAfter 필터 적용', async () => {
    syncRepo.findOne = vi.fn().mockResolvedValue({
      id: 'state-1',
      databaseId: 'db-1',
      lastSyncedAt: T('2026-04-10T00:00:00Z'),
      status: 'idle',
    });
    const pages: NotionPageMeta[] = [
      { pageId: 'p3', title: 'New', lastEditedAt: T('2026-04-15T00:00:00Z') },
    ];
    const api = makeApi(pages);
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    await service.syncDatabase('db-1');

    expect(api.queryDataSource).toHaveBeenCalledWith('ds-1', {
      editedAfter: T('2026-04-10T00:00:00Z'),
      cursor: null,
    });
  });

  it('페이지 0개: state 갱신만, last_synced_at은 보존', async () => {
    syncRepo.findOne = vi.fn().mockResolvedValue({
      id: 'state-1',
      databaseId: 'db-1',
      lastSyncedAt: T('2026-04-10T00:00:00Z'),
      status: 'idle',
    });
    const api = makeApi([]);
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    const result = await service.syncDatabase('db-1');

    expect(result.pagesProcessed).toBe(0);
    const finalState = syncRepo.save.mock.calls.at(-1)![0] as Partial<NotionSyncStateEntity>;
    expect(finalState.status).toBe('idle');
    expect(finalState.lastSyncedAt?.toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(docRepo.save).not.toHaveBeenCalled();
  });

  it('페이지네이션: hasMore=true → 두 번 호출 → 모두 처리', async () => {
    const page1: NotionPageMeta[] = [{ pageId: 'p1', title: 'A', lastEditedAt: T('2026-04-10T00:00:00Z') }];
    const page2: NotionPageMeta[] = [{ pageId: 'p2', title: 'B', lastEditedAt: T('2026-04-12T00:00:00Z') }];
    const api = makeApi(page1, {}, { pages2: page2 });
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    const result = await service.syncDatabase('db-1');

    expect(api.queryDataSource).toHaveBeenCalledTimes(2);
    expect(result.pagesProcessed).toBe(2);
    // 두 번째 호출은 cursor 'cursor-1'으로
    expect(api.queryDataSource).toHaveBeenLastCalledWith('ds-1', {
      editedAfter: undefined,
      cursor: 'cursor-1',
    });
  });

  it('API 실패: status=error + errorMessage 기록 + throw', async () => {
    const api = makeApi([], {}, { failQuery: true });
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    await expect(service.syncDatabase('db-1')).rejects.toThrow('query failed');
    const finalState = syncRepo.save.mock.calls.at(-1)![0] as Partial<NotionSyncStateEntity>;
    expect(finalState.status).toBe('error');
    expect(finalState.errorMessage).toContain('query failed');
  });

  it('이미 syncing 상태인 DB: skip + result.skipped=true', async () => {
    syncRepo.findOne = vi.fn().mockResolvedValue({
      id: 'state-1',
      databaseId: 'db-1',
      status: 'syncing',
      lastSyncedAt: null,
    });
    const api = makeApi([]);
    const service = new NotionSyncService(api, syncRepo as never, docRepo as never);

    const result = await service.syncDatabase('db-1');

    expect(result.skipped).toBe(true);
    expect(api.queryDataSource).not.toHaveBeenCalled();
  });
});
