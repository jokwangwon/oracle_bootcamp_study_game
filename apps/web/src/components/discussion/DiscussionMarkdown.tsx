'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

import { discussionSchema } from '@/lib/discussion/sanitize-schema';

interface DiscussionMarkdownProps {
  children: string;
  className?: string;
}

/**
 * PR-12 §4.6 — Discussion Markdown renderer.
 *
 * 정책:
 *  - rehype-sanitize 단일 schema (sanitize-schema.ts) — 서버와 1:1 매칭.
 *  - rehype-raw 미사용 — markdown 안의 raw HTML 통합 차단 (XSS footgun, Q-R5-01=b).
 *  - allowDangerousHtml: 기본 false (react-markdown 기본).
 *  - a 태그 — target="_blank" + rel="noopener noreferrer" (외부 링크 안전).
 */
export function DiscussionMarkdown({ children, className }: DiscussionMarkdownProps) {
  return (
    <div className={className} data-testid="discussion-markdown">
      <ReactMarkdown
        rehypePlugins={[[rehypeSanitize, discussionSchema]]}
        components={{
          a: ({ children: linkChildren, href, title }) => (
            <a href={href} title={title} target="_blank" rel="noopener noreferrer">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
