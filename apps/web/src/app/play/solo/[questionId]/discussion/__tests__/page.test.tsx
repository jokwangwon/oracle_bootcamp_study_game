import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => null,
}));

vi.mock('@/lib/discussion/api-client', () => ({
  discussionApi: {
    listThreads: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getThread: vi.fn(),
    listPosts: vi.fn(),
  },
}));

afterEach(() => {
  notFoundMock.mockClear();
});

describe('discussion page UUID 정규식 (PR-12 §6.1.1, §6.1.2)', () => {
  it('잘못된 questionId (UUID 아님) → notFound() 호출', async () => {
    const { default: DiscussionListPage } = await import('../page');
    expect(() =>
      render(<DiscussionListPage params={{ questionId: 'not-uuid' }} />),
    ).toThrow(/NEXT_NOT_FOUND/);
    expect(notFoundMock).toHaveBeenCalled();
  });

  it('정상 UUID → notFound() 미호출', async () => {
    const { default: DiscussionListPage } = await import('../page');
    expect(() =>
      render(
        <DiscussionListPage
          params={{ questionId: '00000000-0000-4000-8000-000000000001' }}
        />,
      ),
    ).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe('thread detail page UUID 정규식 (PR-12 §6.1.3, §6.1.4)', () => {
  it('잘못된 threadId → notFound()', async () => {
    const { default: ThreadDetailPage } = await import('../[threadId]/page');
    expect(() =>
      render(
        <ThreadDetailPage
          params={{
            questionId: '00000000-0000-4000-8000-000000000001',
            threadId: 'invalid',
          }}
        />,
      ),
    ).toThrow(/NEXT_NOT_FOUND/);
    expect(notFoundMock).toHaveBeenCalled();
  });

  it('정상 UUID 둘 다 → notFound() 미호출', async () => {
    const { default: ThreadDetailPage } = await import('../[threadId]/page');
    expect(() =>
      render(
        <ThreadDetailPage
          params={{
            questionId: '00000000-0000-4000-8000-000000000001',
            threadId: '00000000-0000-4000-8000-000000000002',
          }}
        />,
      ),
    ).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
