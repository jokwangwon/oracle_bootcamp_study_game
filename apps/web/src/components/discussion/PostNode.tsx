'use client';

import { useState } from 'react';

import { AcceptedBadge } from './AcceptedBadge';
import { DeletedPlaceholder } from './DeletedPlaceholder';
import { DiscussionMarkdown } from './DiscussionMarkdown';
import { PostComposer } from './PostComposer';
import { RelatedQuestionBlur } from './RelatedQuestionBlur';
import { VoteButton } from './VoteButton';
import type { PostDto } from '@/lib/discussion/types';

interface PostNodeProps {
  post: PostDto;
  threadId: string;
  /** thread 작성자 — accept 권한 (UI 노출만, 서버가 최종 확인). */
  isThreadAuthor?: boolean;
  /** 현재 사용자 — VoteButton self-vote 차단 보조. */
  currentUserId?: string | null;
  children?: React.ReactNode;
  onPostCreated?: (post: PostDto) => void;
}

/**
 * PR-12 §6.1.5 — 단일 post 렌더 + nested 자식 (PostTree 가 children 전달).
 *
 * 분기:
 *  - isDeleted → DeletedPlaceholder
 *  - isLocked  → RelatedQuestionBlur
 *  - 정상      → DiscussionMarkdown + VoteButton + 답글 폼 (parent 만)
 */
export function PostNode({
  post,
  threadId,
  isThreadAuthor = false,
  currentUserId = null,
  children,
  onPostCreated,
}: PostNodeProps) {
  const [showReply, setShowReply] = useState(false);
  const isOwn = currentUserId === post.authorId;
  const canReply = post.parentId === null && !post.isDeleted && !post.isLocked;

  return (
    <article
      data-testid="post-node"
      data-post-id={post.id}
      data-depth={post.parentId ? 'child' : 'root'}
      className={`flex gap-3 rounded-md border border-border/30 bg-card/20 p-3 ${
        post.isAccepted
          ? 'ring-1 ring-amber-500/40'
          : ''
      }`}
    >
      {!post.isDeleted && !post.isLocked && (
        <VoteButton
          target="post"
          targetId={post.id}
          initialScore={post.score}
          initialMyVote={post.myVote === 1 ? 1 : 0}
          isOwn={isOwn}
        />
      )}
      <div className="flex flex-1 flex-col gap-2">
        {post.isDeleted ? (
          <DeletedPlaceholder kind="post" />
        ) : post.isLocked && post.relatedQuestionId ? (
          <RelatedQuestionBlur relatedQuestionId={post.relatedQuestionId} />
        ) : (
          <>
            <DiscussionMarkdown className="prose-sm">{post.body}</DiscussionMarkdown>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>👤 {post.authorId.slice(0, 8)}</span>
              {post.isAccepted && <AcceptedBadge />}
              {canReply && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setShowReply((v) => !v)}
                >
                  {showReply ? '답글 닫기' : '답글'}
                </button>
              )}
              {isThreadAuthor && !post.isAccepted && post.parentId === null && (
                <span aria-label="채택 권한 (서버가 최종 확인)" className="opacity-60">
                  채택 가능
                </span>
              )}
            </div>
          </>
        )}
        {showReply && (
          <PostComposer
            threadId={threadId}
            parentId={post.id}
            onCancel={() => setShowReply(false)}
            onCreated={(reply) => {
              setShowReply(false);
              onPostCreated?.(reply);
            }}
          />
        )}
        {children && <div className="ml-2 mt-2 flex flex-col gap-2 border-l border-border/30 pl-3">{children}</div>}
      </div>
    </article>
  );
}
