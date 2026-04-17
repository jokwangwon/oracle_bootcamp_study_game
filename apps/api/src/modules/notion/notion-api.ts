import { Client } from '@notionhq/client';

/**
 * NotionApi 추상화 — service 단위 테스트에서 mock하기 위한 인터페이스.
 * 실 구현(RealNotionApi)은 @notionhq/client v5의 dataSources/blocks API를 사용한다.
 */

export interface NotionPageMeta {
  pageId: string;
  title: string;
  /** ISO 8601 string from Notion API */
  lastEditedAt: Date;
}

export interface DataSourceQueryResult {
  pages: NotionPageMeta[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface QueryOpts {
  /** Notion 측 last_edited_time > editedAfter 인 페이지만 조회. 없으면 전체. */
  editedAfter?: Date;
  /** 이전 응답의 next_cursor (페이지네이션 재개) */
  cursor?: string | null;
  /** 한 페이지당 최대 결과 수 (기본 100) */
  pageSize?: number;
}

export interface NotionApi {
  /** databaseId → 첫 번째 dataSourceId. 캐시 권장 (id는 변하지 않음). */
  resolveDataSourceId(databaseId: string): Promise<string>;
  queryDataSource(dataSourceId: string, opts?: QueryOpts): Promise<DataSourceQueryResult>;
  /** pageId의 children blocks → 마크다운 (notion-markdown.blocksToMarkdown 사용) */
  fetchPageMarkdown(pageId: string): Promise<string>;
}

import { blocksToMarkdown } from './notion-markdown';

/**
 * SDK v5 기반 실 구현. NotionSyncService 외부에서 직접 instance하지 말고
 * NotionModule provider(`NOTION_API`)를 통해 주입받는다.
 */
export class RealNotionApi implements NotionApi {
  private dataSourceCache = new Map<string, string>();

  constructor(private readonly client: Client) {}

  async resolveDataSourceId(databaseId: string): Promise<string> {
    const cached = this.dataSourceCache.get(databaseId);
    if (cached) return cached;

    const db = (await this.client.databases.retrieve({ database_id: databaseId })) as {
      data_sources?: Array<{ id: string }>;
    };
    const first = db.data_sources?.[0]?.id;
    if (!first) {
      throw new Error(`Notion DB ${databaseId}에 data_source가 없습니다 (v5 API 가정)`);
    }
    this.dataSourceCache.set(databaseId, first);
    return first;
  }

  async queryDataSource(
    dataSourceId: string,
    opts: QueryOpts = {},
  ): Promise<DataSourceQueryResult> {
    const args: Record<string, unknown> = {
      data_source_id: dataSourceId,
      page_size: opts.pageSize ?? 100,
    };
    if (opts.cursor) args.start_cursor = opts.cursor;
    if (opts.editedAfter) {
      args.filter = {
        timestamp: 'last_edited_time',
        last_edited_time: { after: opts.editedAfter.toISOString() },
      };
    }
    const resp = (await this.client.dataSources.query(args as never)) as {
      results: Array<{
        id: string;
        last_edited_time: string;
        properties?: Record<string, { type?: string; title?: Array<{ plain_text: string }> }>;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    };

    const pages: NotionPageMeta[] = resp.results.map((p) => ({
      pageId: p.id,
      title: extractTitle(p.properties),
      lastEditedAt: new Date(p.last_edited_time),
    }));
    return { pages, hasMore: resp.has_more, nextCursor: resp.next_cursor };
  }

  async fetchPageMarkdown(pageId: string): Promise<string> {
    const blocks: unknown[] = [];
    let cursor: string | undefined;
    do {
      const resp = (await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      })) as { results: unknown[]; has_more: boolean; next_cursor: string | null };
      blocks.push(...resp.results);
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return blocksToMarkdown(blocks as never);
  }
}

function extractTitle(properties?: Record<string, { type?: string; title?: Array<{ plain_text: string }> }>): string {
  if (!properties) return 'Untitled';
  for (const value of Object.values(properties)) {
    if (value.type === 'title' && value.title) {
      return value.title.map((t) => t.plain_text).join('') || 'Untitled';
    }
  }
  return 'Untitled';
}

export const NOTION_API = Symbol('NotionApi');
