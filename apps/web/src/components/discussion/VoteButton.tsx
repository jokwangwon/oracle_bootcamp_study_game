'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { discussionApi } from '@/lib/discussion/api-client';

interface VoteButtonProps {
  target: 'thread' | 'post';
  targetId: string;
  initialScore: number;
  initialMyVote?: -1 | 0 | 1;
  /** 자기 thread/post 인지 — true 면 disabled (서버 self-vote 차단 보조). */
  isOwn?: boolean;
  /** 비인증 클릭 시 redirect 할 next 경로. 미지정 시 현재 path. */
  loginNextPath?: string;
  /** SWR 캐시 갱신을 위한 콜백 (선택). */
  onVoted?: (next: { finalScore: number; myVote: -1 | 0 | 1 }) => void;
}

/**
 * PR-12 §6.1.4 — VoteButton (3-state 토글 + optimistic + 자기 vote 차단).
 *
 * 정책:
 *  - 3-state: -1 / 0 / +1 (현재 상태에서 같은 방향 클릭 시 0 으로 토글)
 *  - optimistic UI: 서버 응답 전 즉시 score/myVote 갱신
 *  - 서버 거부 (403 self-vote / 429 rate limit) → rollback + 한국어 토스트
 *  - 비인증 클릭 → /login?next=... redirect
 *  - aria-pressed + aria-label="추천 N개"
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
  const [myVote, setMyVote] = useState<-1 | 0 | 1>(initialMyVote);
  const [error, setError] = useState<string | null>(null);

  const cast = (direction: -1 | 1) => {
    if (isOwn) return;
    setError(null);
    const next: -1 | 0 | 1 = myVote === direction ? 0 : direction;
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
        // 서버 응답 { change } 로 정확 동기화. myVote 는 클라가 보낸 값 그대로.
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
          const next = loginNextPath ?? window.location.pathname;
          router.push(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        if (status === 403) {
          setError('자기 글에는 투표할 수 없어요');
          return;
        }
        if (status === 429) {
          setError('투표 분당 5회 한도를 초과했어요');
          return;
        }
        setError('투표 중 오류가 발생했어요');
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
        aria-label={`추천 ${score}개 — 좋아요`}
        aria-pressed={myVote === 1}
        disabled={isOwn || isPending}
        onClick={() => cast(1)}
        className={`rounded p-1 text-lg transition-colors hover:bg-accent ${
          myVote === 1 ? 'text-emerald-500' : 'text-muted-foreground'
        } disabled:opacity-50`}
      >
        ▲
      </button>
      <span
        className="min-w-[2ch] text-center text-sm font-medium"
        aria-live="polite"
      >
        {score}
      </span>
      <button
        type="button"
        aria-label={`추천 ${score}개 — 싫어요`}
        aria-pressed={myVote === -1}
        disabled={isOwn || isPending}
        onClick={() => cast(-1)}
        className={`rounded p-1 text-lg transition-colors hover:bg-accent ${
          myVote === -1 ? 'text-rose-500' : 'text-muted-foreground'
        } disabled:opacity-50`}
      >
        ▼
      </button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
