import { describe, expect, it } from 'vitest';
import {
  discussionSchema,
  DISCUSSION_ALLOWED_TAGS,
  DISCUSSION_ALLOWED_PROTOCOLS,
} from './sanitize-schema';

/**
 * PR-12 TDD §5.1 — sanitize-schema 동등성 (서버 sanitize-post-body.ts 와 1:1 매칭).
 *
 * 서버 화이트리스트 (apps/api/src/modules/discussion/sanitize-post-body.ts):
 *  - allowedTags: p, br, strong, em, code, pre, ul, ol, li, blockquote, a, hr
 *  - allowedAttributes: { a: ['href', 'title'] }
 *  - allowedSchemes: ['http', 'https', 'mailto']
 *
 * 본 파일이 빨간불이면 서버/클라 schema 가 어긋난 것 → 양쪽 동기 갱신.
 */
describe('discussion sanitize-schema 서버 동등성', () => {
  // 4.1 discussionSchema.tagNames 12종 정확
  it('discussionSchema.tagNames 12종 정확 (p/br/strong/em/code/pre/ul/ol/li/blockquote/a/hr)', () => {
    expect(discussionSchema.tagNames).toEqual([
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
    ]);
  });

  // 4.2 discussionSchema.attributes a[href,title] 만 (외 태그 attribute 0)
  it('a 태그 — href/title 두 attribute 만 허용', () => {
    expect(discussionSchema.attributes?.a).toEqual(['href', 'title']);
  });

  it('code/pre 태그 — attribute 없음 (Shiki 후속 PR)', () => {
    expect(discussionSchema.attributes?.code).toEqual([]);
    expect(discussionSchema.attributes?.pre).toEqual([]);
  });

  // 4.3 discussionSchema.protocols http/https/mailto (data:/javascript: 거부)
  it('protocols.href — http/https/mailto 만 (data:/javascript: 거부)', () => {
    expect(discussionSchema.protocols?.href).toEqual(['http', 'https', 'mailto']);
    expect(discussionSchema.protocols?.href).not.toContain('javascript');
    expect(discussionSchema.protocols?.href).not.toContain('data');
    expect(discussionSchema.protocols?.href).not.toContain('vbscript');
  });

  // 4.4 서버 sanitize-post-body.ts 와 1:1 매칭 (parseable export)
  it('export 상수가 서버 화이트리스트와 동일 list', () => {
    // 서버 sanitize-post-body.ts 의 allowedTags 는 12종 (위 4.1 과 동일)
    const SERVER_ALLOWED_TAGS = [
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
    ];
    const SERVER_ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

    expect([...DISCUSSION_ALLOWED_TAGS]).toEqual(SERVER_ALLOWED_TAGS);
    expect([...DISCUSSION_ALLOWED_PROTOCOLS]).toEqual(SERVER_ALLOWED_SCHEMES);
  });

  it('clobberPrefix 가 빈 문자열 (시안 D 톤 — id="user-content-" prefix 제거)', () => {
    expect(discussionSchema.clobberPrefix).toBe('');
  });
});
