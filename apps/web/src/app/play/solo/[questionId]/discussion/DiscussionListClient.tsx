'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';

import { ThreadComposer } from '@/components/discussion/ThreadComposer';
import { ThreadList } from '@/components/discussion/ThreadList';
import { ThreadSortTabs } from '@/components/discussion/ThreadSortTabs';
import { discussionApi } from '@/lib/discussion/api-client';
import type { ListThreadsResponse, SortMode } from '@/lib/discussion/types';

interface Props {
  questionId: string;
}

const VALID_SORTS: SortMode[] = ['new', 'hot', 'top'];

/**
 * PR-12 §2.3 — Client Component (SWR + sort tabs + composer).
 * URL ?sort=new|hot|top 동기화. 비인증 사용자도 접근 (read-only).
 */
export function DiscussionListClient({ questionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSort = (() => {
    const s = searchParams?.get('sort');
    return VALID_SORTS.includes(s as SortMode) ? (s as SortMode) : 'new';
  })();

  const [sort, setSort] = useState<SortMode>(initialSort);
  const [showComposer, setShowComposer] = useState(false);

  const swrKey = ['discussion-threads', questionId, sort] as const;
  const { data, error, isLoading, mutate } = useSWR<ListThreadsResponse>(
    swrKey,
    () => discussionApi.listThreads(questionId, { sort }),
    {
      revalidateOnFocus: true,
    },
  );

  const handleSortChange = (next: SortMode) => {
    setSort(next);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('sort', next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={`/play/solo/${questionId}`}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-fg"
        >
          ← 문제로 돌아가기
        </Link>
        <h1 className="text-2xl font-semibold">토론</h1>
        <p className="text-sm text-muted-foreground">
          이 문제에 대한 질문과 답변을 모아 봤어요.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3">
        <ThreadSortTabs value={sort} onChange={handleSortChange} />
        <button
          type="button"
          onClick={() => setShowComposer((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="toggle-thread-composer"
        >
          {showComposer ? '닫기' : '+ 새 토론'}
        </button>
      </div>

      {showComposer && (
        <ThreadComposer
          questionId={questionId}
          onCreated={() => {
            setShowComposer(false);
            mutate();
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          토론을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      {isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="threads-loading">
          토론을 불러오는 중…
        </p>
      )}
      {data && <ThreadList threads={data.items} questionId={questionId} />}
    </div>
  );
}
