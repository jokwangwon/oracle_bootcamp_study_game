import sanitizeHtml from 'sanitize-html';

/**
 * PR-10b §4.2.1 C 절 — discussion post 본문 화이트리스트.
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
 *  - 표시 직전 (web) — 저장 후 변형/마이그레이션 고려한 2차 방어 (별도 PR-12 범위)
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

/** post / thread body sanitize. 저장 + 표시 양쪽에서 동일 옵션 사용. */
export function sanitizePostBody(rawHtml: string): string {
  return sanitizeHtml(rawHtml, POST_SANITIZE_OPTS);
}

/** thread title — 일반 텍스트만 허용 (모든 HTML strip). */
export function sanitizeTitle(raw: string): string {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim();
}
