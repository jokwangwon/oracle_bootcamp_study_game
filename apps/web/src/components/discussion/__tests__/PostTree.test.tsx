import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostTree } from '../PostTree';
import type { PostDto } from '@/lib/discussion/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/discussion/api-client', () => ({
  discussionApi: { voteThread: vi.fn(), votePost: vi.fn(), createPost: vi.fn() },
}));

function mkPost(id: string, parentId: string | null, overrides: Partial<PostDto> = {}): PostDto {
  return {
    id,
    threadId: 't1',
    authorId: 'u-' + id,
    parentId,
    body: `본문 ${id}`,
    score: 0,
    isAccepted: false,
    isDeleted: false,
    relatedQuestionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('<PostTree />', () => {
  // 5.5.1 1-level nested 렌더
  it('parent + children — 1-level nested 렌더', () => {
    render(
      <PostTree
        posts={[mkPost('p1', null), mkPost('p1c1', 'p1'), mkPost('p1c2', 'p1')]}
        threadId="t1"
        threadAuthorId="u-author"
      />,
    );
    const nodes = screen.getAllByTestId('post-node');
    expect(nodes).toHaveLength(3);
    // root 와 child 구분
    expect(screen.getByText('본문 p1')).toBeInTheDocument();
    expect(screen.getByText('본문 p1c1')).toBeInTheDocument();
  });

  // 5.5.2 root 만 답글 폼 노출
  it('child 노드는 답글 버튼 미노출 (1-level 강제)', () => {
    render(
      <PostTree
        posts={[mkPost('p1', null), mkPost('p1c1', 'p1')]}
        threadId="t1"
        threadAuthorId="u-author"
      />,
    );
    // root 1개에 대한 답글 버튼 1개만 존재
    expect(screen.getAllByRole('button', { name: '답글' })).toHaveLength(1);
  });

  // 5.5.3 isAccepted post 골드 ring 클래스
  it('isAccepted=true → ring-amber-500/40 클래스 적용', () => {
    render(
      <PostTree
        posts={[mkPost('p1', null, { isAccepted: true })]}
        threadId="t1"
        threadAuthorId="u-author"
      />,
    );
    const node = screen.getByTestId('post-node');
    expect(node.className).toContain('ring-amber');
  });

  // 5.5.4 isLocked → RelatedQuestionBlur
  it('isLocked + relatedQuestionId → RelatedQuestionBlur 렌더', () => {
    render(
      <PostTree
        posts={[mkPost('p1', null, { isLocked: true, relatedQuestionId: 'q-99' })]}
        threadId="t1"
        threadAuthorId="u-author"
      />,
    );
    expect(screen.getByTestId('related-question-blur')).toBeInTheDocument();
    expect(screen.queryByText('본문 p1')).not.toBeInTheDocument();
  });

  it('빈 배열 → empty hint', () => {
    render(<PostTree posts={[]} threadId="t1" threadAuthorId="u-author" />);
    expect(screen.getByTestId('post-tree-empty')).toBeInTheDocument();
  });
});
