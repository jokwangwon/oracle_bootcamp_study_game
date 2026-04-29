import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiscussionMarkdown } from '../DiscussionMarkdown';
import {
  FORBIDDEN_PATTERNS,
  MARKDOWN_PAYLOADS_12,
  OWASP_PAYLOADS_50,
  POSITIVE_PAYLOADS_14,
} from '@/__fixtures__/owasp-xss-payloads';

/**
 * PR-12 TDD §5.1 (4.9 / 4.10) — OWASP XSS 76 회귀.
 *
 * 검증:
 *  - 50 OWASP (백엔드 sanitize-post-body.test.ts 와 1:1)
 *  - 12 react-markdown 특화 (markdown link/autolink XSS / footnote)
 *  - 14 positive (화이트리스트 12 태그 + 메타)
 *
 * 회귀 정책: 본 테스트가 빨간불이면 sanitize-schema.ts 또는 DiscussionMarkdown.tsx 의
 * 화이트리스트가 우회된 것 → 즉시 차단 (PR 머지 차단).
 */

describe('DiscussionMarkdown — 76 OWASP XSS 회귀', () => {
  it('50종 OWASP + 12 markdown 특화 + 14 positive = 76 페이로드', () => {
    expect(OWASP_PAYLOADS_50).toHaveLength(50);
    expect(MARKDOWN_PAYLOADS_12).toHaveLength(12);
    expect(POSITIVE_PAYLOADS_14).toHaveLength(14);
    expect(
      OWASP_PAYLOADS_50.length + MARKDOWN_PAYLOADS_12.length + POSITIVE_PAYLOADS_14.length,
    ).toBe(76);
  });

  describe('50종 OWASP — 위험 토큰 비잔존 (negative)', () => {
    it.each(OWASP_PAYLOADS_50)('"%s" — 위험 토큰 strip', (payload) => {
      const { container } = render(<DiscussionMarkdown>{payload}</DiscussionMarkdown>);
      const html = container.innerHTML;
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(html).not.toMatch(pattern);
      }
      // 추가 — 실제 DOM 노드에 위험 태그 0
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('object')).toBeNull();
      expect(container.querySelector('embed')).toBeNull();
    });
  });

  describe('12 markdown 특화 — XSS footgun 차단', () => {
    it.each(MARKDOWN_PAYLOADS_12)('markdown "%s" — 위험 scheme/태그 차단', (payload) => {
      const { container } = render(<DiscussionMarkdown>{payload}</DiscussionMarkdown>);
      const html = container.innerHTML;
      // 핵심 footgun 만 검증 — markdown 안의 link/image scheme + raw HTML
      expect(html).not.toMatch(/javascript:/i);
      expect(html).not.toMatch(/vbscript:/i);
      expect(html).not.toMatch(/livescript:/i);
      expect(html).not.toMatch(/data:text\/html/i);
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('details')).toBeNull();
    });
  });

  describe('14 positive — 화이트리스트 통과', () => {
    it.each(POSITIVE_PAYLOADS_14)(
      '"$input" → $mustContainTag 노드 존재',
      ({ input, mustContainTag }) => {
        const { container } = render(<DiscussionMarkdown>{input}</DiscussionMarkdown>);
        const found = container.querySelector(mustContainTag.toLowerCase());
        expect(found).not.toBeNull();
      },
    );
  });
});
