import Link from 'next/link';

import { AcceptedBadge } from './AcceptedBadge';
import { DeletedPlaceholder } from './DeletedPlaceholder';
import type { ThreadDto } from '@/lib/discussion/types';

interface ThreadCardProps {
  thread: ThreadDto;
  questionId: string;
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return '방금';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

/**
 * PR-12 §6.1.1 — Thread 리스트 카드 (시안 D 글라스 톤).
 * 클릭 시 /play/solo/[questionId]/discussion/[threadId] 라우팅.
 */
export function ThreadCard({ thread, questionId }: ThreadCardProps) {
  const isAccepted = !thread.isDeleted && thread.postCount > 0;

  return (
    <Link
      href={`/play/solo/${questionId}/discussion/${thread.id}`}
      className="glass-panel block rounded-lg border border-border/40 bg-card/40 p-4 backdrop-blur-md transition-colors hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="thread-card"
      data-thread-id={thread.id}
    >
      {thread.isDeleted ? (
        <DeletedPlaceholder kind="thread" />
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-tight">{thread.title}</h3>
            {isAccepted && <AcceptedBadge />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>👤 {thread.authorId.slice(0, 8)}</span>
            <span aria-hidden="true">•</span>
            <span>🕐 {formatRelativeTime(thread.lastActivityAt)}</span>
            <span aria-hidden="true">•</span>
            <span>▲ {thread.score}</span>
            <span aria-hidden="true">•</span>
            <span>💬 답변 {thread.postCount}</span>
          </div>
        </>
      )}
    </Link>
  );
}
