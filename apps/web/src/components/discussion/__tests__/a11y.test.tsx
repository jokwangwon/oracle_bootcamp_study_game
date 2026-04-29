import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { AcceptedBadge } from '../AcceptedBadge';
import { DeletedPlaceholder } from '../DeletedPlaceholder';
import { PostComposer } from '../PostComposer';
import { PostTree } from '../PostTree';
import { RelatedQuestionBlur } from '../RelatedQuestionBlur';
import { ThreadCard } from '../ThreadCard';
import { ThreadComposer } from '../ThreadComposer';
import { ThreadDetail } from '../ThreadDetail';
import { ThreadList } from '../ThreadList';
import { ThreadSortTabs } from '../ThreadSortTabs';
import { VoteButton } from '../VoteButton';
import type { PostDto, ThreadDto } from '@/lib/discussion/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/discussion/api-client', () => ({
  discussionApi: {
    voteThread: vi.fn(),
    votePost: vi.fn(),
    createThread: vi.fn(),
    createPost: vi.fn(),
  },
}));

function mkThread(overrides: Partial<ThreadDto> = {}): ThreadDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    questionId: '00000000-0000-4000-8000-000000000099',
    authorId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    title: 'ROW_NUMBER vs RANK',
    body: 'ORDER BY 동률 처리 차이가 헷갈려요.',
    score: 5,
    postCount: 2,
    lastActivityAt: new Date().toISOString(),
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mkPost(id: string, parentId: string | null, overrides: Partial<PostDto> = {}): PostDto {
  return {
    id,
    threadId: '00000000-0000-4000-8000-000000000001',
    authorId: 'u-' + id,
    parentId,
    body: `답변 본문 ${id}`,
    score: 0,
    isAccepted: false,
    isDeleted: false,
    relatedQuestionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * PR-12 TDD §8.1 — axe-core 회귀 (10 cases).
 *
 * jsdom 환경에서 가능한 마크업 a11y 만 검증 (color contrast 는 외부 노트북 axe DevTools).
 */
describe('Discussion a11y — axe-core 회귀', () => {
  // 7.1 ThreadList axe 0 violation
  it('<ThreadList> — 0 violation', async () => {
    const { container } = render(
      <ThreadList
        threads={[mkThread(), mkThread({ id: '00000000-0000-4000-8000-000000000002' })]}
        questionId="00000000-0000-4000-8000-000000000099"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('<ThreadList> empty — 0 violation', async () => {
    const { container } = render(
      <ThreadList threads={[]} questionId="00000000-0000-4000-8000-000000000099" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  // 7.2 ThreadDetail axe 0 violation
  it('<ThreadDetail> — 0 violation', async () => {
    const { container } = render(<ThreadDetail thread={mkThread()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  // 7.3 VoteButton axe 0 violation (aria-pressed)
  it('<VoteButton> — 0 violation (aria-pressed + aria-label)', async () => {
    const { container } = render(
      <VoteButton target="thread" targetId="t1" initialScore={3} initialMyVote={1} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  // 7.4 RelatedQuestionBlur axe 0 violation
  it('<RelatedQuestionBlur> — 0 violation (role=region + aria-label)', async () => {
    const { container } = render(
      <RelatedQuestionBlur relatedQuestionId="00000000-0000-4000-8000-000000000099" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  // 7.5 ThreadComposer axe 0 violation (label + maxLength)
  it('<ThreadComposer> — 0 violation', async () => {
    const { container } = render(
      <ThreadComposer questionId="00000000-0000-4000-8000-000000000099" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('<PostComposer> — 0 violation', async () => {
    const { container } = render(
      <PostComposer threadId="00000000-0000-4000-8000-000000000001" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('<ThreadSortTabs> — 0 violation (role=tablist)', async () => {
    const { container } = render(
      <ThreadSortTabs value="new" onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('<PostTree> nested — 0 violation', async () => {
    const { container } = render(
      <PostTree
        posts={[mkPost('00000000-0000-4000-8000-000000000010', null), mkPost('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000010')]}
        threadId="00000000-0000-4000-8000-000000000001"
        threadAuthorId="u-author"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('<ThreadCard> + <AcceptedBadge> + <DeletedPlaceholder> — 0 violation', async () => {
    const { container } = render(
      <div>
        <ThreadCard
          thread={mkThread()}
          questionId="00000000-0000-4000-8000-000000000099"
        />
        <AcceptedBadge />
        <DeletedPlaceholder kind="thread" />
        <DeletedPlaceholder kind="post" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
