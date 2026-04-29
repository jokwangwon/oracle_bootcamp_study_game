import { ThreadCard } from './ThreadCard';
import type { ThreadDto } from '@/lib/discussion/types';

interface ThreadListProps {
  threads: ThreadDto[];
  questionId: string;
  emptyHint?: React.ReactNode;
}

function EmptyDiscussion({ emptyHint }: { emptyHint?: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-dashed border-border/40 bg-card/20 p-8 text-center"
      data-testid="empty-discussion"
    >
      <p className="text-sm text-muted-foreground">
        {emptyHint ?? '아직 토론이 없어요. 첫 질문을 시작해 보세요.'}
      </p>
    </div>
  );
}

/**
 * PR-12 §6.1.2 — ThreadCard 컬렉션 + empty state.
 * cursor 페이지네이션은 부모 (DiscussionListClient) 가 SWR 로 처리.
 */
export function ThreadList({ threads, questionId, emptyHint }: ThreadListProps) {
  if (threads.length === 0) {
    return <EmptyDiscussion emptyHint={emptyHint} />;
  }

  return (
    <ul
      className="flex flex-col gap-3"
      role="list"
      aria-label="토론 목록"
      data-testid="thread-list"
    >
      {threads.map((thread) => (
        <li key={thread.id}>
          <ThreadCard thread={thread} questionId={questionId} />
        </li>
      ))}
    </ul>
  );
}
