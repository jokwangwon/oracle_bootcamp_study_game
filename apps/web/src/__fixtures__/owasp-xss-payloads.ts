/**
 * PR-12 §4.5 + TDD §5.3 — OWASP XSS 76 회귀 페이로드.
 *
 * 백엔드 sanitize-post-body.test.ts 의 50 OWASP 와 1:1 매칭 (서버/클라 동등성).
 * react-markdown 특화 12 + 메타 회귀 14 = 총 76.
 *
 * 출처:
 *  - https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html
 *  - react-markdown autolink + footnote + raw HTML 통합 footgun
 */

/** 50 OWASP — 백엔드 sanitize-post-body.test.ts 와 1:1. */
export const OWASP_PAYLOADS_50: ReadonlyArray<string> = [
  // (1~12) script tag variants
  '<script>alert(1)</script>',
  '<SCRIPT>alert(1)</SCRIPT>',
  '<ScRiPt>alert(1)</ScRiPt>',
  '<script src="https://evil/x.js"></script>',
  '<script defer>alert(1)</script>',
  '<script async>alert(1)</script>',
  '<script type="text/javascript">alert(1)</script>',
  '<script\n>alert(1)</script>',
  '<script>alert(String.fromCharCode(88,83,83))</script>',
  '<script >alert(1)</script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '"><script>alert(1)</script>',

  // (13~24) event-handler attributes
  '<img src=x onerror=alert(1)>',
  '<img src=x onError=alert(1)>',
  '<img src="x" onerror="alert(\'XSS\')">',
  '<svg/onload=alert(1)>',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<a href="x" onclick="alert(1)">x</a>',
  '<div onmouseover="alert(1)">x</div>',
  '<form onsubmit=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '<marquee onstart=alert(1)>',
  '<video><source onerror=alert(1)>',

  // (25~32) javascript: / data: / vbscript: schemes
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<a href="livescript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<img src="javascript:alert(1)">',
  '<a href=" javascript:alert(1)">x</a>',

  // (33~40) container/object/embed/svg/math
  '<iframe src="https://evil"></iframe>',
  '<embed src="evil.swf">',
  '<object data="evil.swf"></object>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext><script>alert(1)</script></mtext></math>',
  '<applet code="evil.class"></applet>',
  '<frame src="evil"></frame>',
  '<frameset><frame src="x"></frameset>',

  // (41~46) css / style / link / meta / base / form
  '<style>body{background:url("javascript:alert(1)")}</style>',
  '<div style="width: expression(alert(1))">x</div>',
  '<link rel="stylesheet" href="evil.css">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<form action="javascript:alert(1)"><input></form>',

  // (47~50) misc / encoding / break-out
  '<a href="https://x">ok</a><script>alert(1)</script>',
  '<!--><script>alert(1)</script>-->',
  '<p>ok</p><img src=x onerror=alert(1)>',
  '<a href="javas\tcript:alert(1)">x</a>',
];

/**
 * 12 react-markdown 특화 — markdown 문법 안에 숨은 XSS footgun.
 *
 * 주의: markdown autolink (`<javascript:...>`) 는 백엔드 stripDangerousMarkdownTokens
 * 가 1차 제거하지만, 클라 단독 정책으로 sanitize-schema 의 protocols 화이트리스트가
 * href 를 무효화한다 (텍스트 노드만 잔존).
 */
export const MARKDOWN_PAYLOADS_12: ReadonlyArray<string> = [
  '[click](javascript:alert(1))',
  '[click](JaVaScRiPt:alert(1))',
  '[x](data:text/html,<script>alert(1)</script>)',
  '![alt](javascript:alert(1))',
  '![](data:text/html,evil)',
  '[v](vbscript:msgbox(1))',
  '[l](livescript:alert(1))',
  '<details><summary>x</summary><script>alert(1)</script></details>',
  '`<script>alert(1)</script>`',
  '> <iframe src="evil"></iframe>',
  '- <img src=x onerror=alert(1)>',
  '<style>body{display:none}</style>',
];

/**
 * 14 메타 — 화이트리스트 통과(positive) + 검증 회귀.
 *
 * 주의: 토론 schema 는 12 태그 (p / br / strong / em / code / pre / ul / ol / li /
 * blockquote / a / hr) 만 허용. h1~h6 / table / img 등은 화이트리스트 외 → strip.
 */
export const POSITIVE_PAYLOADS_14: ReadonlyArray<{ input: string; mustContainTag: string }> = [
  { input: '단순 텍스트', mustContainTag: 'P' },
  { input: '**굵게**', mustContainTag: 'STRONG' },
  { input: '*기울임*', mustContainTag: 'EM' },
  { input: '`코드`', mustContainTag: 'CODE' },
  { input: '```\nSELECT 1\n```', mustContainTag: 'PRE' },
  { input: '- 항목', mustContainTag: 'UL' },
  { input: '- 항목', mustContainTag: 'LI' },
  { input: '1. 항목', mustContainTag: 'OL' },
  { input: '> 인용', mustContainTag: 'BLOCKQUOTE' },
  { input: '---', mustContainTag: 'HR' },
  { input: '[link](https://example.com)', mustContainTag: 'A' },
  { input: '[mail](mailto:a@b.c)', mustContainTag: 'A' },
  { input: '[http](http://example.com)', mustContainTag: 'A' },
  { input: 'a  \nb', mustContainTag: 'BR' },
];

/** 위험 토큰 정규식 — sanitize 결과에 절대 잔존하면 안 됨. */
export const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /<script/i,
  /javascript:/i,
  /vbscript:/i,
  /livescript:/i,
  /data:text\/html/i,
  /\son\w+\s*=/i, // onerror=, onclick=, onload=
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<svg/i,
  /<math/i,
  /<style[\s>]/i,
  /<meta[\s>]/i,
  /<base[\s>]/i,
  /<form[\s>]/i,
  /<input/i,
  /<img/i,
  /<link/i,
  /<frame/i,
  /<applet/i,
  /<body/i,
  /<html/i,
  /expression\s*\(/i,
  /<audio/i,
  /<video/i,
];
