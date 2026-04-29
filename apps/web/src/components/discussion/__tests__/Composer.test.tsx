import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadComposer } from '../ThreadComposer';
import { PostComposer } from '../PostComposer';

const createThreadMock = vi.fn();
const createPostMock = vi.fn();

vi.mock('@/lib/discussion/api-client', () => ({
  discussionApi: {
    createThread: (...args: unknown[]) => createThreadMock(...args),
    createPost: (...args: unknown[]) => createPostMock(...args),
  },
}));

beforeEach(() => {
  createThreadMock.mockReset();
  createPostMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<ThreadComposer />', () => {
  // 5.6.1 maxLength + 검증
  it('빈 제목 → "제목을 입력해 주세요" 에러', async () => {
    const user = userEvent.setup();
    render(<ThreadComposer questionId="q1" />);
    await user.type(screen.getByLabelText('토론 본문'), '본문');
    await user.click(screen.getByRole('button', { name: /토론 시작/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('제목을 입력해 주세요');
    expect(createThreadMock).not.toHaveBeenCalled();
  });

  // 5.6.2 submit → SWR mutate 호출 (onCreated 콜백)
  it('정상 submit → createThread 호출 + onCreated 콜백', async () => {
    createThreadMock.mockResolvedValueOnce({
      id: 't-new',
      title: '새 글',
      body: '본문',
      questionId: 'q1',
      authorId: 'u1',
      score: 0,
      postCount: 0,
      lastActivityAt: new Date().toISOString(),
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<ThreadComposer questionId="q1" onCreated={onCreated} />);
    await user.type(screen.getByLabelText('토론 제목'), '새 글');
    await user.type(screen.getByLabelText('토론 본문'), '본문');
    await user.click(screen.getByRole('button', { name: /토론 시작/ }));
    await waitFor(() =>
      expect(createThreadMock).toHaveBeenCalledWith('q1', { title: '새 글', body: '본문' }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  // 5.6.3 서버 429 → 한국어 메시지
  it('429 → "작성 분당 5회 한도를 초과했어요"', async () => {
    const err = new Error('throttle') as Error & { status?: number };
    err.status = 429;
    createThreadMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(<ThreadComposer questionId="q1" />);
    await user.type(screen.getByLabelText('토론 제목'), 'a');
    await user.type(screen.getByLabelText('토론 본문'), 'b');
    await user.click(screen.getByRole('button', { name: /토론 시작/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/분당 5회 한도/),
    );
  });
});

describe('<PostComposer />', () => {
  it('parentId 없음 — 답변 등록 버튼', () => {
    render(<PostComposer threadId="t1" />);
    expect(screen.getByRole('button', { name: '답변 등록' })).toBeInTheDocument();
  });

  it('parentId 있음 — 답글 등록 버튼 + 취소 버튼', () => {
    render(<PostComposer threadId="t1" parentId="p1" onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: '답글 등록' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('정상 submit → createPost(threadId, {body, parentId})', async () => {
    createPostMock.mockResolvedValueOnce({
      id: 'p-new',
      threadId: 't1',
      authorId: 'u1',
      parentId: 'p1',
      body: '답글',
      score: 0,
      isAccepted: false,
      isDeleted: false,
      relatedQuestionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<PostComposer threadId="t1" parentId="p1" onCreated={onCreated} />);
    await user.type(screen.getByLabelText('답글 본문'), '답글');
    await user.click(screen.getByRole('button', { name: '답글 등록' }));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith('t1', { body: '답글', parentId: 'p1' }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('400 → "답변 형식이 올바르지 않아요 (1-level 답글만 허용)"', async () => {
    const err = new Error('bad') as Error & { status?: number };
    err.status = 400;
    createPostMock.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(<PostComposer threadId="t1" />);
    await user.type(screen.getByLabelText('답변 본문'), 'x');
    await user.click(screen.getByRole('button', { name: '답변 등록' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/1-level 답글만 허용/),
    );
  });
});
