'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { discussionApi } from '@/lib/discussion/api-client';

interface VoteButtonProps {
  target: 'thread' | 'post';
  targetId: string;
  initialScore: number;
  initialMyVote?: 0 | 1;
  /** 자기 thread/post 인지 — true 면 disabled (서버 self-vote 차단 보조). */
  isOwn?: boolean;
  /** 비인증 클릭 시 redirect 할 next 경로. 미지정 시 현재 path. */
  loginNextPath?: string;
  /** SWR 캐시 갱신을 위한 콜백 (선택). */
  onVoted?: (next: { finalScore: number; myVote: 0 | 1 }) => void;
}

/**
 * PR-12 §6.1.4 — 좋아요 토글 (▲ 만, 사용자 결정 2026-04-29).
 *
 * 정책:
 *  - 2-state: 0 / +1 (마이너스 없음 — 사용자 요구)
 *  - 한 번 누르면 +1, 다시 누르면 0 (취소). 자기 글은 disabled.
 *  - 백엔드 R6 UNIQUE (user_id + target_type + target_id) 가 1회 보장.
 *  - optimistic UI: 서버 응답 전 즉시 score/myVote 갱신
 *  - 서버 거부 (403 self-vote / 429 rate limit) → rollback + 한국어 토스트
 *  - 비인증 클릭 → /login?next=... redirect
 *  - aria-pressed + aria-label="좋아요 N개"
 */
export function VoteButton({
  target,
  targetId,
  initialScore,
  initialMyVote = 0,
  isOwn = false,
  loginNextPath,
  onVoted,
}: VoteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState<0 | 1>(initialMyVote);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    if (isOwn) return;
    setError(null);
    const next: 0 | 1 = myVote === 1 ? 0 : 1;
    const delta = next - myVote;
    const prevScore = score;
    const prevMyVote = myVote;

    // optimistic
    setScore((s) => s + delta);
    setMyVote(next);

    startTransition(async () => {
      try {
        const apiCall =
          target === 'thread'
            ? discussionApi.voteThread(targetId, next)
            : discussionApi.votePost(targetId, next);
        const res = await apiCall;
        const finalScore = prevScore + res.change;
        setScore(finalScore);
        setMyVote(next);
        onVoted?.({ finalScore, myVote: next });
      } catch (err) {
        // rollback
        setScore(prevScore);
        setMyVote(prevMyVote);
        const status = (err as { status?: number }).status;
        if (status === 401) {
          const target = loginNextPath ?? window.location.pathname;
          router.push(`/login?next=${encodeURIComponent(target)}`);
          return;
        }
        if (status === 403) {
          setError('자기 글에는 좋아요를 누를 수 없어요');
          return;
        }
        if (status === 429) {
          setError('좋아요 분당 5회 한도를 초과했어요');
          return;
        }
        setError('좋아요 처리 중 오류가 발생했어요');
      }
    });
  };

  return (
    <div
      className="inline-flex flex-col items-center gap-1"
      data-testid={`vote-button-${target}-${targetId}`}
    >
      <button
        type="button"
        aria-label={`좋아요 ${score}개`}
        aria-pressed={myVote === 1}
        disabled={isOwn || isPending}
        onClick={toggle}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 ${
          myVote === 1
            ? 'bg-rose-500/10 text-rose-500'
            : 'text-muted-foreground'
        }`}
      >
        <span aria-hidden="true">{myVote === 1 ? '♥' : '♡'}</span>
        <span aria-live="polite">{score}</span>
      </button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
