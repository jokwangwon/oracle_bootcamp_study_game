import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThreadCard } from '../ThreadCard';
import type { ThreadDto } from '@/lib/discussion/types';

function mkThread(overrides: Partial<ThreadDto> = {}): ThreadDto {
  return {
    id: 't1',
    questionId: 'q1',
    authorId: 'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    title: 'ROW_NUMBER vs RANK 차이가 뭔가요?',
    body: 'ORDER BY 동률 처리 차이가 헷갈려요.',
    score: 7,
    postCount: 3,
    lastActivityAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('<ThreadCard />', () => {
  // 5.1.1 시안 D 글라스 톤
  it('glass-panel 글라스 톤 클래스', () => {
    render(<ThreadCard thread={mkThread()} questionId="q1" />);
    const card = screen.getByTestId('thread-card');
    expect(card.className).toContain('glass-panel');
  });

  // 5.1.2 제목 + 시간 + 점수 + post count 표시
  it('제목 / 작성자 / 시간 / 점수 / post count 5종 메타 표시', () => {
    render(<ThreadCard thread={mkThread()} questionId="q1" />);
    expect(screen.getByText('ROW_NUMBER vs RANK 차이가 뭔가요?')).toBeInTheDocument();
    expect(screen.getByText(/30분 전/)).toBeInTheDocument();
    expect(screen.getByText(/▲ 7/)).toBeInTheDocument();
    expect(screen.getByText(/답변 3/)).toBeInTheDocument();
    expect(screen.getByText(/aaaaaaaa/)).toBeInTheDocument();
  });

  // 5.1.3 isAccepted (postCount > 0) 시 AcceptedBadge
  it('postCount > 0 + 미삭제 시 AcceptedBadge 표시', () => {
    render(<ThreadCard thread={mkThread({ postCount: 1 })} questionId="q1" />);
    expect(screen.getByRole('img', { name: '채택된 답변' })).toBeInTheDocument();
  });

  // 5.1.4 isDeleted 시 DeletedPlaceholder
  it('isDeleted=true 시 DeletedPlaceholder 대체', () => {
    render(<ThreadCard thread={mkThread({ isDeleted: true })} questionId="q1" />);
    expect(screen.getByTestId('deleted-thread')).toBeInTheDocument();
    expect(screen.queryByText('ROW_NUMBER vs RANK 차이가 뭔가요?')).not.toBeInTheDocument();
  });

  // 5.1.5 클릭 라우팅 — Link href
  it('Link href = /play/solo/[questionId]/discussion/[threadId]', () => {
    render(<ThreadCard thread={mkThread({ id: 't-42' })} questionId="q-9" />);
    const card = screen.getByTestId('thread-card') as HTMLAnchorElement;
    expect(card.tagName).toBe('A');
    expect(card.getAttribute('href')).toBe('/play/solo/q-9/discussion/t-42');
  });
});
