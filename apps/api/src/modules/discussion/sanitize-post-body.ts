import sanitizeHtml from 'sanitize-html';

import { stripDangerousMarkdownTokens } from './discussion-sanitize-tokens';

/**
 * PR-10b §4.2.1 C 절 — discussion post 본문 화이트리스트.
 * PR-12 §4.2 — 입력 의미를 Markdown raw 로 재해석 (Q-R5-01=b).
 *
 * 정책:
 *  - allowedTags: 정렬 + 코드 + 리스트 + 인용 + 링크 + 줄바꿈만 허용
 *    (table/img/iframe/script/style 등 제외)
 *  - allowedSchemes: http/https/mailto — javascript:/data:/vbscript: 차단
 *  - allowedAttributes: a 태그의 href/title 만
 *  - disallowedTagsMode: 'discard' — script/style 등은 텍스트도 함께 제거
 *  - parser.lowerCaseTags + recognizeSelfClosing — Markdown 변환기 (remark-rehype)
 *    의 raw HTML pass-through 차단 보조
 *
 * 적용 시점 (defense in depth):
 *  - 저장 직전 (sanitizePostBody) — DB 에 안전한 형태만 영속화
 *  - 표시 직전 (web) — `apps/web/src/lib/discussion/sanitize-schema.ts` 의
 *    `discussionSchema` 가 본 화이트리스트와 1:1 매칭 (Q-R5-02=a).
 */
export const POST_SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  disallowedTagsMode: 'discard',
  parser: {
    lowerCaseTags: true,
    recognizeSelfClosing: true,
  },
};

/**
 * post / thread body sanitize. 입력은 markdown raw 로 가정 (PR-12 Q-R5-01=b).
 *
 * 처리 순서:
 *  1) markdown link/image 의 dangerous scheme (javascript/data/vbscript/livescript)
 *     을 정규식으로 사전 무효화 — link/image 를 plain text 로 변환.
 *  2) sanitize-html 화이트리스트로 raw HTML 토큰 strip.
 */
export function sanitizePostBody(rawMarkdown: string): string {
  const linkSafe = stripDangerousMarkdownTokens(rawMarkdown);
  return sanitizeHtml(linkSafe, POST_SANITIZE_OPTS);
}

/** thread title — 일반 텍스트만 허용 (모든 HTML strip). */
export function sanitizeTitle(raw: string): string {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim();
}
