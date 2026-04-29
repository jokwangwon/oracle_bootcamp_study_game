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

describe('<VoteButton />', () => {
  // 5.4.1 + 5.4.2 3-state 토글 + optimistic + 서버 응답 동기화
  it('3-state 토글 — 미투표 → 좋아요 → 토글로 0', async () => {
    voteThreadMock.mockResolvedValueOnce({ finalScore: 6, myVote: 1 });
    voteThreadMock.mockResolvedValueOnce({ finalScore: 5, myVote: 0 });
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={5} initialMyVote={0} />,
    );
    const upButton = screen.getByLabelText(/추천 5개 — 좋아요/);
    await user.click(upButton);
    // optimistic — 즉시 6
    await waitFor(() => expect(screen.getByText('6')).toBeInTheDocument());
    await waitFor(() => expect(voteThreadMock).toHaveBeenCalledWith('t1', 1));
    // 같은 방향 다시 클릭 → 토글로 0
    const upButtonAfter = screen.getByLabelText(/좋아요/);
    await user.click(upButtonAfter);
    await waitFor(() => expect(voteThreadMock).toHaveBeenLastCalledWith('t1', 0));
  });

  // 5.4.3 self-vote 403 → rollback + 한국어 토스트
  it('서버 403 → rollback + "자기 글에는 투표할 수 없어요"', async () => {
    const err = new Error('forbidden') as Error & { status?: number };
    err.status = 403;
    voteThreadMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={3} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요/));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/자기 글에는 투표할 수 없어요/),
    );
    // rollback — score 그대로 3
    expect(screen.getByText('3')).toBeInTheDocument();
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
    await user.click(screen.getByLabelText(/좋아요/));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/분당 5회 한도/),
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // 5.4.5 aria-pressed + aria-label
  it('aria-pressed + aria-label="추천 N개"', () => {
    render(
      <VoteButton target="thread" targetId="t1" initialScore={4} initialMyVote={1} />,
    );
    const up = screen.getByLabelText(/추천 4개 — 좋아요/);
    expect(up).toHaveAttribute('aria-pressed', 'true');
    const down = screen.getByLabelText(/추천 4개 — 싫어요/);
    expect(down).toHaveAttribute('aria-pressed', 'false');
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
    await user.click(screen.getByLabelText(/좋아요/));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        '/login?next=%2Fplay%2Fsolo%2Fq-1%2Fdiscussion%2Ft-1',
      ),
    );
  });

  // 5.4.7 자기 글 → disabled
  it('isOwn=true → 양쪽 버튼 disabled', () => {
    render(
      <VoteButton
        target="thread"
        targetId="t1"
        initialScore={5}
        initialMyVote={0}
        isOwn
      />,
    );
    expect(screen.getByLabelText(/좋아요/)).toBeDisabled();
    expect(screen.getByLabelText(/싫어요/)).toBeDisabled();
  });

  // 5.4.8 finalScore 응답 동기화
  it('서버 응답 finalScore 가 optimistic 값과 다른 경우 서버 값 우선', async () => {
    voteThreadMock.mockResolvedValueOnce({ finalScore: 99, myVote: 1 });
    const user = userEvent.setup();
    render(
      <VoteButton target="thread" targetId="t1" initialScore={5} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요/));
    await waitFor(() => expect(screen.getByText('99')).toBeInTheDocument());
  });

  it('target=post → votePost 호출', async () => {
    votePostMock.mockResolvedValueOnce({ finalScore: 1, myVote: 1 });
    const user = userEvent.setup();
    render(
      <VoteButton target="post" targetId="p1" initialScore={0} initialMyVote={0} />,
    );
    await user.click(screen.getByLabelText(/좋아요/));
    await waitFor(() => expect(votePostMock).toHaveBeenCalledWith('p1', 1));
  });
});
