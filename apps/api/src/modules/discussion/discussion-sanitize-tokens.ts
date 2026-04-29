/**
 * PR-12 §4.2 — markdown raw 입력의 dangerous scheme 사전 무효화.
 *
 * sanitize-html 은 raw HTML 토큰만 처리하므로 markdown 문법 안에 숨은
 * `[text](javascript:...)` / `![alt](data:...)` / `<javascript:...>` autolink 등은
 * 화이트리스트를 우회한다. 본 모듈은 sanitize-html 호출 직전 단계로,
 * markdown 문법 단위에서 위험 scheme 을 무효화한다.
 *
 * 정책: dangerous scheme link/image 는 텍스트만 보존 (link/image 토큰 자체 제거).
 *  - `[click](javascript:alert(1))`  →  `click`
 *  - `![alt](data:...)`              →  `alt`
 *  - `<javascript:alert(1)>`         →  ``  (autolink 제거)
 */

const DANGEROUS_SCHEMES = ['javascript', 'data', 'vbscript', 'livescript'] as const;
const SCHEME_ALT = DANGEROUS_SCHEMES.join('|');

const MARKDOWN_LINK_RE = new RegExp(
  String.raw`(!?)\[([^\]]*)\]\(\s*(?:${SCHEME_ALT})[^)]*\)`,
  'gi',
);

const MARKDOWN_AUTOLINK_RE = new RegExp(
  String.raw`<\s*(?:${SCHEME_ALT})[^>]*>`,
  'gi',
);

export function stripDangerousMarkdownTokens(input: string): string {
  return input
    .replace(MARKDOWN_LINK_RE, (_match, _bang, text: string) => text)
    .replace(MARKDOWN_AUTOLINK_RE, '');
}
