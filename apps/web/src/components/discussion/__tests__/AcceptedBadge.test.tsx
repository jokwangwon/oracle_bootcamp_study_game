import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AcceptedBadge } from '../AcceptedBadge';
import { DeletedPlaceholder } from '../DeletedPlaceholder';

describe('<AcceptedBadge />', () => {
  it('"채택됨" 텍스트 + role=img + aria-label="채택된 답변"', () => {
    render(<AcceptedBadge />);
    const badge = screen.getByRole('img', { name: '채택된 답변' });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('채택됨');
  });

  it('className 추가 가능', () => {
    render(<AcceptedBadge className="extra" />);
    const badge = screen.getByRole('img');
    expect(badge.className).toContain('extra');
  });
});

describe('<DeletedPlaceholder />', () => {
  it('thread — "[삭제된 토론]" 표시', () => {
    render(<DeletedPlaceholder kind="thread" />);
    expect(screen.getByTestId('deleted-thread')).toHaveTextContent('[삭제된 토론]');
  });

  it('post — "[삭제된 게시물]" 표시', () => {
    render(<DeletedPlaceholder kind="post" />);
    expect(screen.getByTestId('deleted-post')).toHaveTextContent('[삭제된 게시물]');
  });
});
