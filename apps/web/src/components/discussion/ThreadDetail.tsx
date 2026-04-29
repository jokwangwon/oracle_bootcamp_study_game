import { DeletedPlaceholder } from './DeletedPlaceholder';
import { DiscussionMarkdown } from './DiscussionMarkdown';
import { VoteButton } from './VoteButton';
import type { ThreadDto } from '@/lib/discussion/types';

interface ThreadDetailProps {
  thread: ThreadDto;
  currentUserId?: string | null;
}

/**
 * PR-12 §6.1.5 — Thread 상세 헤더 + body 렌더 (post 는 PostTree 가 처리).
 */
export function ThreadDetail({ thread, currentUserId = null }: ThreadDetailProps) {
  const isOwn = currentUserId === thread.authorId;

  if (thread.isDeleted) {
    return (
      <header className="rounded-lg border border-border/40 bg-card/30 p-4">
        <DeletedPlaceholder kind="thread" />
      </header>
    );
  }

  return (
    <header
      className="flex gap-4 rounded-lg border border-border/40 bg-card/30 p-4 backdrop-blur-md"
      data-testid="thread-detail"
    >
      <VoteButton
        target="thread"
        targetId={thread.id}
        initialScore={thread.score}
        initialMyVote={thread.myVote ?? 0}
        isOwn={isOwn}
      />
      <div className="flex flex-1 flex-col gap-2">
        <h2 className="text-xl font-semibold">{thread.title}</h2>
        <DiscussionMarkdown className="prose">{thread.body}</DiscussionMarkdown>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>👤 {thread.authorId.slice(0, 8)}</span>
          <span aria-hidden="true">•</span>
          <span>💬 답변 {thread.postCount}개</span>
        </div>
      </div>
    </header>
  );
}
