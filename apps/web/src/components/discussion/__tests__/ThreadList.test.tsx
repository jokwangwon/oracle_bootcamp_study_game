import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThreadList } from '../ThreadList';
import type { ThreadDto } from '@/lib/discussion/types';

function mkThread(id: string, overrides: Partial<ThreadDto> = {}): ThreadDto {
  return {
    id,
    questionId: 'q1',
    authorId: 'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    title: `thread ${id}`,
    body: 'body',
    score: 0,
    postCount: 0,
    lastActivityAt: new Date().toISOString(),
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('<ThreadList />', () => {
  // 5.2.1 thread N개 → ThreadCard N개 렌더
  it('thread N개 → ThreadCard N개 렌더', () => {
    render(
      <ThreadList
        threads={[mkThread('t1'), mkThread('t2'), mkThread('t3')]}
        questionId="q1"
      />,
    );
    expect(screen.getAllByTestId('thread-card')).toHaveLength(3);
  });

  // 5.2.2 empty 시 EmptyDiscussion
  it('threads 0건 → EmptyDiscussion (default text)', () => {
    render(<ThreadList threads={[]} questionId="q1" />);
    expect(screen.getByTestId('empty-discussion')).toHaveTextContent(
      /아직 토론이 없어요/,
    );
  });

  it('emptyHint prop 우선 사용', () => {
    render(<ThreadList threads={[]} questionId="q1" emptyHint="커스텀 안내" />);
    expect(screen.getByTestId('empty-discussion')).toHaveTextContent('커스텀 안내');
  });

  it('role=list + aria-label="토론 목록"', () => {
    render(<ThreadList threads={[mkThread('t1')]} questionId="q1" />);
    expect(screen.getByRole('list', { name: '토론 목록' })).toBeInTheDocument();
  });
});
