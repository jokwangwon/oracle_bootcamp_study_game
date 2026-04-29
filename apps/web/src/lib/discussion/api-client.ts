/**
 * PR-12 §SDD 2.2 — Discussion web api-client.
 *
 * 정책:
 *  - dual-mode (PR-10a): credentials:'include' + Authorization Bearer fallback.
 *  - 401 → refresh 1회 retry (apps/web/src/lib/api-client.ts 와 동일 패턴 — 단,
 *    discussion 은 cookie-only 모드 가정. inflightRefresh 캐시는 글로벌 import).
 *  - SWR fetcher 호환 — key = path + 쿼리 string, fetcher = 본 모듈의 GET 함수.
 */

import type {
  ListPostsResponse,
  ListThreadsResponse,
  PostDto,
  SortMode,
  ThreadDto,
  VoteResponseDto,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let inflightRefresh: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

interface RequestOpts {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: RequestOpts = {},
  retried = false,
): Promise<T> {
  const qs = opts.query
    ? `?${new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()}`
    : '';

  const res = await fetch(`${API_URL}/api${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
    credentials: 'include',
  });

  if (res.status === 401 && !retried) {
    try {
      await refreshOnce();
      return request<T>(method, path, opts, true);
    } catch {
      // 그대로 전파
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const discussionApi = {
  listThreads: (
    questionId: string,
    opts: { sort?: SortMode; cursor?: string; limit?: number } = {},
  ) =>
    request<ListThreadsResponse>('GET', `/discussion/questions/${questionId}/threads`, {
      query: { sort: opts.sort ?? 'new', cursor: opts.cursor, limit: opts.limit },
    }),

  getThread: (threadId: string) =>
    request<ThreadDto>('GET', `/discussion/threads/${threadId}`),

  listPosts: (threadId: string, opts: { cursor?: string; limit?: number } = {}) =>
    request<ListPostsResponse>('GET', `/discussion/threads/${threadId}/posts`, {
      query: { cursor: opts.cursor, limit: opts.limit },
    }),

  createThread: (questionId: string, input: { title: string; body: string }) =>
    request<ThreadDto>('POST', `/discussion/questions/${questionId}/threads`, {
      body: input,
    }),

  updateThread: (threadId: string, input: { title?: string; body?: string }) =>
    request<ThreadDto>('PATCH', `/discussion/threads/${threadId}`, { body: input }),

  deleteThread: (threadId: string) =>
    request<void>('DELETE', `/discussion/threads/${threadId}`),

  createPost: (
    threadId: string,
    input: { body: string; parentId?: string | null },
  ) => request<PostDto>('POST', `/discussion/threads/${threadId}/posts`, { body: input }),

  updatePost: (postId: string, input: { body: string }) =>
    request<PostDto>('PATCH', `/discussion/posts/${postId}`, { body: input }),

  deletePost: (postId: string) =>
    request<void>('DELETE', `/discussion/posts/${postId}`),

  voteThread: (threadId: string, value: -1 | 0 | 1) =>
    request<VoteResponseDto>('POST', `/discussion/threads/${threadId}/vote`, {
      body: { value },
    }),

  votePost: (postId: string, value: -1 | 0 | 1) =>
    request<VoteResponseDto>('POST', `/discussion/posts/${postId}/vote`, {
      body: { value },
    }),

  acceptPost: (postId: string) =>
    request<{ ok: true }>('POST', `/discussion/posts/${postId}/accept`, {
      body: {},
    }),
};

export type DiscussionApi = typeof discussionApi;

/** SWR fetcher — 첫 인자가 함수, 두 번째부터 args. */
export const swrFetcher = <T>([fn, ...args]: [
  (...a: unknown[]) => Promise<T>,
  ...unknown[]
]): Promise<T> => fn(...args);
