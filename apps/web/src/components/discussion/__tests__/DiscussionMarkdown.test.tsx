import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiscussionMarkdown } from '../DiscussionMarkdown';

/**
 * PR-12 TDD §5.1 — DiscussionMarkdown 회귀.
 *
 * 검증:
 *  - 기본 markdown 렌더 (h1, p, code, link 등)
 *  - href javascript:/data: 차단
 *  - inline <script> 토큰 strip
 *  - rehype-raw 미사용 — raw HTML 통과 차단
 */
describe('<DiscussionMarkdown />', () => {
  // 4.5 기본 렌더 — markdown 본문 → p (h1~h6 화이트리스트 외)
  it('기본 markdown 렌더 — 본문 p + h1 strip (화이트리스트 외)', () => {
    const { container } = render(
      <DiscussionMarkdown>{'# 제목\n\n본문 내용'}</DiscussionMarkdown>,
    );
    expect(screen.getByText('본문 내용')).toBeInTheDocument();
    // h1~h6 는 화이트리스트 외 → DOM 에 h1 노드 없음 (텍스트만 보존)
    expect(container.querySelector('h1')).toBeNull();
    expect(container.textContent).toContain('제목');
    expect(container.textContent).toContain('본문 내용');
  });

  it('strong/em/code 렌더', () => {
    render(<DiscussionMarkdown>{'**굵게** *기울임* `code`'}</DiscussionMarkdown>);
    expect(screen.getByText('굵게').tagName).toBe('STRONG');
    expect(screen.getByText('기울임').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
  });

  // 4.6 <a href="javascript:..."> 차단
  it('javascript: scheme href 차단 — href 무효화', () => {
    const { container } = render(
      <DiscussionMarkdown>{'[click](javascript:alert(1))'}</DiscussionMarkdown>,
    );
    const links = container.querySelectorAll('a');
    links.forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      expect(href).not.toMatch(/^javascript:/i);
    });
    expect(container.innerHTML).not.toMatch(/javascript:/i);
  });

  it('data: scheme href 차단', () => {
    const { container } = render(
      <DiscussionMarkdown>{'[x](data:text/html,<script>alert(1)</script>)'}</DiscussionMarkdown>,
    );
    expect(container.innerHTML).not.toMatch(/data:text\/html/i);
    expect(container.innerHTML).not.toMatch(/<script/i);
  });

  it('mailto: scheme 허용', () => {
    const { container } = render(
      <DiscussionMarkdown>{'[email](mailto:a@b.c)'}</DiscussionMarkdown>,
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('mailto:a@b.c');
  });

  // 4.7 inline <script> 토큰 strip — 텍스트 노드로 처리
  it('raw <script> 태그 — 실행 차단 (텍스트 또는 strip)', () => {
    const { container } = render(
      <DiscussionMarkdown>{'<script>alert(1)</script>본문'}</DiscussionMarkdown>,
    );
    // <script> 가 DOM 에 실제 script 엘리먼트로 들어가서는 안 됨
    expect(container.querySelector('script')).toBeNull();
  });

  // 4.8 rehype-raw 미사용 — raw HTML <details> 통과 차단
  it('rehype-raw 미사용 — <details> 등 화이트리스트 외 raw HTML 통과 차단', () => {
    const { container } = render(
      <DiscussionMarkdown>{'<details><summary>x</summary>y</details>'}</DiscussionMarkdown>,
    );
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('a 태그 — target=_blank + rel="noopener noreferrer" 자동 부여', () => {
    const { container } = render(
      <DiscussionMarkdown>{'[link](https://example.com)'}</DiscussionMarkdown>,
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
