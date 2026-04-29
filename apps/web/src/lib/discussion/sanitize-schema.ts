import { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';

/**
 * PR-12 §4.3 — Discussion sanitize schema (단일 source of truth).
 *
 * 서버 화이트리스트 (apps/api/src/modules/discussion/sanitize-post-body.ts) 와 1:1 매칭.
 * 서버 화이트리스트 변경 시 본 파일도 동기 갱신 (sanitize-schema.test.ts 가 회귀 검증).
 *
 * 정책:
 *  - tagNames 12종: p / br / strong / em / code / pre / ul / ol / li / blockquote / a / hr
 *  - attributes: a[href|title] 만 허용 (code/pre 는 attribute 없음)
 *  - protocols: href 에 http/https/mailto 만 (data:/javascript:/vbscript: 차단)
 *  - clobberPrefix: '' — id="user-content-..." prefix 제거 (시안 D 톤)
 *  - rehype-raw 미사용 — markdown 안의 raw HTML 통합 차단 (XSS footgun)
 *  - default ancestors 정책 유지 — li 는 ul/ol 안에만 등
 */
export const DISCUSSION_ALLOWED_TAGS = [
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
] as const;

export const DISCUSSION_ALLOWED_PROTOCOLS = ['http', 'https', 'mailto'] as const;

export const discussionSchema: Schema = {
  ...defaultSchema,
  tagNames: [...DISCUSSION_ALLOWED_TAGS],
  attributes: {
    a: ['href', 'title'],
    code: [],
    pre: [],
  },
  protocols: {
    href: [...DISCUSSION_ALLOWED_PROTOCOLS],
  },
  clobberPrefix: '',
};
