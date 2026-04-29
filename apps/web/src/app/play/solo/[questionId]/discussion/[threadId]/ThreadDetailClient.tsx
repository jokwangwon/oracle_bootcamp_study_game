'use client';

import Link from 'next/link';
import useSWR from 'swr';

import { PostComposer } from '@/components/discussion/PostComposer';
import { PostTree } from '@/components/discussion/PostTree';
import { ThreadDetail } from '@/components/discussion/ThreadDetail';
import { discussionApi } from '@/lib/discussion/api-client';
import type { ListPostsResponse, ThreadDto } from '@/lib/discussion/types';
import { useCurrentUserId } from '@/lib/discussion/use-current-user';

interface Props {
  questionId: string;
  threadId: string;
}

/**
 * PR-12 §2.3 — Client Component (SWR + ThreadDetail + PostTree + PostComposer).
 * 비인증 사용자도 read-only 로 진입 가능. 답글 폼은 인증 필요 (서버 401).
 */
export function ThreadDetailClient({ questionId, threadId }: Props) {
  const currentUserId = useCurrentUserId();
  const threadKey = `discussion-thread:${threadId}`;
  const postsKey = `discussion-posts:${threadId}`;

  // 무한 재요청 방어 — 429/5xx 시 최대 2회만 retry, 30초 dedupe.
  const swrOpts = {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
    errorRetryCount: 2,
    errorRetryInterval: 5_000,
    shouldRetryOnError: (err: unknown) =>
      (err as { status?: number }).status !== 429,
  } as const;

  const {
    data: thread,
    error: threadError,
    isLoading: threadLoading,
    mutate: mutateThread,
  } = useSWR<ThreadDto>(threadKey, () => discussionApi.getThread(threadId), swrOpts);

  const {
    data: postsResponse,
    error: postsError,
    isLoading: postsLoading,
    mutate: mutatePosts,
  } = useSWR<ListPostsResponse>(
    postsKey,
    () => discussionApi.listPosts(threadId),
    swrOpts,
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/play/solo/${questionId}/discussion`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-fg"
      >
        ← 토론 목록
      </Link>

      {threadError && (
        <p role="alert" className="text-sm text-destructive">
          토론을 불러오지 못했어요.
        </p>
      )}
      {threadLoading && (
        <p className="text-sm text-muted-foreground">토론 불러오는 중…</p>
      )}
      {thread && <ThreadDetail thread={thread} currentUserId={currentUserId} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">답변 ({postsResponse?.length ?? 0})</h2>
        {postsError && (
          <p role="alert" className="text-sm text-destructive">
            답변을 불러오지 못했어요.
          </p>
        )}
        {postsLoading && (
          <p className="text-sm text-muted-foreground">답변 불러오는 중…</p>
        )}
        {postsResponse && thread && (
          <PostTree
            posts={postsResponse}
            threadId={threadId}
            threadAuthorId={thread.authorId}
            currentUserId={currentUserId}
            onPostCreated={() => {
              mutatePosts();
              mutateThread();
            }}
          />
        )}
      </section>

      {thread && !thread.isDeleted && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">답변 작성</h3>
          <PostComposer
            threadId={threadId}
            onCreated={() => {
              mutatePosts();
              mutateThread();
            }}
          />
        </section>
      )}
    </div>
  );
}
