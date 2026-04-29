import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoteButton } from '../VoteButton';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const voteThreadMock = vi.fn();
const votePostMock = vi.fn();
vi.mock('@/lib/discussion/api-client', () => ({
  discussionApi: {
    voteThread: (...args: unknown[]) => voteThreadMock(...args),
    votePost: (...args: unknown[]) => votePostMock(...args),
  },
}));

beforeEach(() => {
  pushMock.mockReset();
  voteThreadMock.mockReset();
  votePostMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<VoteButton /> — 좋아요 토글 (2-state, 마이너스 없음)', () => {
  // 5.4.1 + 5.4.2 토글 0 → +1 → 0 + optimistic + 서버 응답 동기화
  it('토글 — 미좋아요 → 좋아요 → 다시 누르면 0', async () => {
    voteThreadMock.mockResolvedValueOnce({ change: 1 });
    voteThreadMock.mockResolvedValueOnce({ change: -1 });
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={5} initialMyVote={0} />,
    );
    const button = screen.getByLabelText(/좋아요 5개/);
    await user.click(button);
    // optimistic — 즉시 6
    await waitFor(() => expect(screen.getByLabelText(/좋아요 6개/)).toBeInTheDocument());
    await waitFor(() => expect(voteThreadMock).toHaveBeenCalledWith('t1', 1));
    // 같은 버튼 다시 클릭 → 토글로 0 보내기
    await user.click(screen.getByLabelText(/좋아요 6개/));
    await waitFor(() => expect(voteThreadMock).toHaveBeenLastCalledWith('t1', 0));
  });

  // 5.4.3 self-vote 403 → rollback + 한국어 토스트
  it('서버 403 → rollback + "자기 글에는 좋아요를 누를 수 없어요"', async () => {
    const err = new Error('forbidden') as Error & { status?: number };
    err.status = 403;
    voteThreadMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={3} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요 3개/));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /자기 글에는 좋아요를 누를 수 없어요/,
      ),
    );
    expect(screen.getByLabelText(/좋아요 3개/)).toBeInTheDocument();
  });

  // 5.4.4 429 rate limit → rollback + 한국어
  it('서버 429 → rollback + "분당 5회 한도"', async () => {
    const err = new Error('throttle') as Error & { status?: number };
    err.status = 429;
    voteThreadMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={2} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요 2개/));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/분당 5회 한도/),
    );
  });

  // 5.4.5 aria-pressed + aria-label
  it('initialMyVote=1 → aria-pressed=true + 좋아요 N개', () => {
    render(
      <VoteButton target="thread" targetId="t1" initialScore={4} initialMyVote={1} />,
    );
    const button = screen.getByLabelText(/좋아요 4개/);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('initialMyVote=0 → aria-pressed=false', () => {
    render(
      <VoteButton target="thread" targetId="t1" initialScore={4} initialMyVote={0} />,
    );
    expect(screen.getByLabelText(/좋아요 4개/)).toHaveAttribute('aria-pressed', 'false');
  });

  // 5.4.6 비인증 401 → /login redirect
  it('서버 401 → /login?next=... redirect', async () => {
    const err = new Error('unauth') as Error & { status?: number };
    err.status = 401;
    voteThreadMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(
      <VoteButton
        target="thread"
        targetId="t1"
        initialScore={1}
        initialMyVote={0}
        loginNextPath="/play/solo/q-1/discussion/t-1"
      />,
    );
    await user.click(screen.getByLabelText(/좋아요 1개/));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        '/login?next=%2Fplay%2Fsolo%2Fq-1%2Fdiscussion%2Ft-1',
      ),
    );
  });

  // 5.4.7 자기 글 → disabled
  it('isOwn=true → 좋아요 버튼 disabled', () => {
    render(
      <VoteButton
        target="thread"
        targetId="t1"
        initialScore={5}
        initialMyVote={0}
        isOwn
      />,
    );
    expect(screen.getByLabelText(/좋아요 5개/)).toBeDisabled();
  });

  // 5.4.8 서버 change 값으로 최종 score 계산
  it('서버 응답 { change } 로 prevScore + change = finalScore 계산', async () => {
    voteThreadMock.mockResolvedValueOnce({ change: 2 });
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={5} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요 5개/));
    // 5 + 2 = 7
    await waitFor(() =>
      expect(screen.getByLabelText(/좋아요 7개/)).toBeInTheDocument(),
    );
  });

  it('target=post → votePost 호출', async () => {
    votePostMock.mockResolvedValueOnce({ change: 1 });
    const user = userEvent.setup();
    render(
      <VoteButton target="post" targetId="p1" initialScore={0} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요 0개/));
    await waitFor(() => expect(votePostMock).toHaveBeenCalledWith('p1', 1));
  });
});
