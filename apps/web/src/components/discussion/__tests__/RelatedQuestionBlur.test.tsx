import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RelatedQuestionBlur } from '../RelatedQuestionBlur';

describe('<RelatedQuestionBlur />', () => {
  // 5.7.1 시안 D 글라스 패널 + blur
  it('글라스 패널 클래스 + blur 효과', () => {
    render(<RelatedQuestionBlur relatedQuestionId="q-1" />);
    const blur = screen.getByTestId('related-question-blur');
    expect(blur.className).toContain('glass-panel');
    expect(blur.innerHTML).toContain('blur(8px)');
  });

  // 5.7.2 "문제 풀러 가기" 링크 → /play/solo/[relatedQuestionId]
  it('"문제 풀러 가기" 링크 → /play/solo/[relatedQuestionId]', () => {
    render(<RelatedQuestionBlur relatedQuestionId="q-42" />);
    const link = screen.getByRole('link', { name: /문제 풀러 가기/ });
    expect(link).toHaveAttribute('href', '/play/solo/q-42');
  });

  // 5.7.3 a11y — role=region + aria-label
  it('role=region + aria-label="관련 문제 풀이 후 공개"', () => {
    render(<RelatedQuestionBlur relatedQuestionId="q-1" />);
    const region = screen.getByRole('region', { name: '관련 문제 풀이 후 공개' });
    expect(region).toBeInTheDocument();
  });

  it('블러 본문에 aria-hidden=true (스크린리더 우회)', () => {
    const { container } = render(<RelatedQuestionBlur relatedQuestionId="q-1" />);
    const blurContent = container.querySelector('[aria-hidden="true"]');
    expect(blurContent).not.toBeNull();
  });
});
