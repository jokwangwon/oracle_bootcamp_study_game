# ADR-020 — UX 재설계 (Tailwind + shadcn/ui + 토론 쓰레드 + 라이트/다크 토글)

| 항목 | 값 |
|------|---|
| 상태 | Accepted (2026-04-24) |
| 제안 세션 | Session 7 Phase 1 (consensus-010) |
| 선행 문서 | `docs/rationale/ux-redesign-brief-v1.md`, `docs/review/consensus-010-ux-redesign.md` |
| 관련 ADR | ADR-001 (Phase 0 질문지), ADR-016 §7 (LLM-judge 안전), ADR-018 §8 (salt rotation 금지 6), ADR-019 (SM-2) |
| 영향 범위 | `apps/web` 전면 + `apps/api` 토론·인증·보안 기반 + `.githooks/pre-commit` |

---

## 1. 배경

MVP-A/B 기간 동안 UI 는 **inline-style 최소 구현** 상태로 방치됐다. 2026-04-23 사용자가 tailscale 로 첫 실플레이 시 "즉시 피드백 부재 + 문맥 결여" 피드백이 나왔고 (PR #12 에서 부분 해소), 동시에 "programmers 지향 + Reddit 토론 + 끄투온라인 라이트함" 이라는 재설계 방향이 제시됐다 (`ux-redesign-brief-v1.md`).

2026-04-24 Phase 0 질문지 (Q4~Q9) 와 Phase 1 3+1 합의 (consensus-010) 를 거쳐 본 ADR 이 결정된다. 주요 특징:

- **UI 기술 스택**: Tailwind CSS v3.4 + shadcn/ui + next-themes
- **R4 토론 쓰레드 + R6 voting**: 자체 구현 (Q&A + upvote/downvote)
- **라이트/다크 토글**: `defaultTheme="light"` (programmers 지향)
- **보안 기반 5건**: helmet/CSP/sanitize + httpOnly 쿠키 + auth rate limit + vote UNIQUE + pre-commit Layer 3-a3 재귀

3+1 합의 단독 지적 CRITICAL 5건이 전부 채택된 최초 사례 (Session 4 룰 — Reviewer 축자 확인).

---

## 2. 결정 요약

| 항목 | 결정 | Phase 0 / Phase 1 근거 |
|------|------|----------------------|
| UI 라이브러리 | **Tailwind CSS v3.4 + shadcn/ui + Radix** | Q14=4 (자신감 있음) |
| 테마 시스템 | **next-themes** + `defaultTheme="light"` + `enableSystem` | Q15=b (light 기본), Q9 (토글) |
| darkMode | `'class'` (Tailwind config) | shadcn 표준 |
| R4 스키마 | 3-테이블 (`discussion_threads` + `discussion_posts` + `discussion_votes`) | A·C 합의 |
| R5 범위 | **완전형** — upvote + downvote + 1-level nested 댓글 | Q10=a (Q5 그대로) |
| R6 voting | PK `(user_id, target_type, target_id)` UNIQUE + ON CONFLICT + DB CHECK | CRITICAL-B4 |
| Mobile | **desktop only** (375px 대응 제외) | Q12=a |
| 가입 정책 | **공개** (화이트리스트/초대 없음) | Q13=a |
| 보안 | helmet + CSP + sanitize-html + httpOnly 쿠키 + CSRF + auth rate limit + pre-commit 재귀 | CRITICAL B-1~5 |
| 마이그레이션 | 컴포넌트별 + Strangler Fig 혼합 | A·C 합의 |
| R4 배포 게이트 | **PR-10a (cookie+refresh+revoke) → PR-10b (R4+sanitize+vote) → PR-10c (CSRF) 3분할** | Q11=a *(Session 12 합의 consensus-010 로 분할 — §4.2.1 / §6)* |

---

## 3. 기술 스택 세부

### 3.1 Tailwind CSS v3.4

- v4 는 shadcn/ui 공식 가이드가 아직 v3 기반이라 **v3.4 채택**.
- `darkMode: 'class'` — `next-themes` 가 `html` 에 `.dark` 토글.
- `globals.css` 에 `@tailwind base/components/utilities` 3 줄.

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        accent: 'var(--accent)',
        border: 'var(--border)',
      },
    },
  },
};
```

### 3.2 shadcn/ui (copy-paste 방식)

- `npx shadcn@latest init` → `components.json` + `apps/web/src/components/ui/` 생성.
- 초기 컴포넌트: Button / Card / Dialog / Input / Label / DropdownMenu.
- 추가는 필요 시 `npx shadcn@latest add <name>`.
- Peer deps: `cva`, `tailwind-merge`, `clsx`, `lucide-react`, `@radix-ui/react-*` (필요한 것만).

### 3.3 next-themes + CSS 변수 재구성

`:root` = light 팔레트, `.dark` = dark 팔레트.

```css
:root {
  --bg: #ffffff;
  --bg-elevated: #f8fafc;
  --fg: #0f172a;
  --fg-muted: #64748b;
  --accent: #0284c7;
  --border: #e2e8f0;
}

.dark {
  --bg: #0f172a;
  --bg-elevated: #1e293b;
  --fg: #f1f5f9;
  --fg-muted: #94a3b8;
  --accent: #38bdf8;
  --border: #334155;
}
```

`apps/web/src/app/layout.tsx`:

```tsx
import { ThemeProvider } from 'next-themes';

<html lang="ko" suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Header />
      {children}
    </ThemeProvider>
  </body>
</html>
```

- **Q15=b**: `defaultTheme="light"` (programmers 지향)
- `enableSystem`: OS `prefers-color-scheme` 존중 + 토글 override
- `suppressHydrationWarning`: `<html>` class 서버/클라이언트 불일치 경고 억제 (정상)
- FOUC 방어: next-themes 가 `<head>` blocking script 자동 주입

---

## 4. 보안 기반 (CRITICAL B-1~5 반영)

R4 배포 전 완료 필수. 각 항목은 ADR-020 본문 조항.

### 4.1 Sanitize + CSP + helmet (CRITICAL-B1)

> **2026-04-28 갱신 (consensus-PR-3 합의)** — 본 절의 PR-3 은 PR-3a/3b/3c 로 분할됨.
> 단계 분할 사유 + 각 PR 범위 / 게이트는 §4.1.0 참조. 본 코드 블록은 **각 PR 의
> 결과물 명세**이며 본 PR 머지 후 갱신된다 (현 시점은 PR-3a 만 enforce).

#### 4.1.0 PR-3 분할 (3+1 합의 PR-3 결과)

**합의 배경**: Reviewer 보고서 기준 3-Agent 합의율 87% (2+ 일치). 핵심 CRITICAL 3건:
1. helmet HSTS default 가 tailscale `100.102.41.122:3002` HTTP 환경 영구 차단
2. ADR 본문 `nonce-${nonce}` 의 `nonce` 변수 미정의 + Next.js 14.2 `headers()` 정적 한계로 nonce 한 번에 enforce 불가
3. inline `style={{}}` 81곳 + Radix/next-themes/HMR 으로 한 번 enforce 시 silent break 다발

**분할안**:

| 단계 | 범위 | 게이트 | 의존 | 공수 |
|------|------|-------|------|------|
| **PR-3a** (본 PR, 2026-04-28) | helmet 7.x + production-only HSTS + COEP off + supertest e2e 헤더 단언 | typecheck + 전체 test + e2e 18 cases | 없음 | 0.5d |
| PR-3b | `apps/web/next.config.mjs` 정적 CSP `Content-Security-Policy-Report-Only` + `/api/csp-report` (NestJS) 수집 endpoint + dev/prod 분기 + 누락 directive 4종 (`frame-ancestors 'none'` / `form-action 'self'` / `base-uri 'self'` / `object-src 'none'`) | Report-Only 1주 관측 + 위반 보고 분류 | PR-3a | 0.5d + 1주 |
| PR-3c | `apps/web/middleware.ts` nonce 도입 + inline `style={{}}` 81곳 className 화 (PR-8b 후속 작업으로 흡수) + enforce 전환 | `next dev` HMR 무사 + 위반 보고 0 | PR-3b 데이터 + PR-10 동시 또는 직전 | 2~3d |

**Q2 결정 (CSP report 수신 데이터)**: 로그 파일 + 7일 회전. PR-3b 시 구체화.

**Q3 결정 (inline style 81곳 마이그레이션)**: PR-8b 후속 작업으로 흡수 (파일군 중복 편집 회피).

**ADR 본문 코드 블록 사실 오류 수정**:
- `apps/web/next.config.js` → 실제 파일은 **`apps/web/next.config.mjs`** (ESM)

#### 4.1.1 PR-3a 결과물 (helmet, **현재 enforce**)

**서버 (apps/api/src/main.ts)**:
```ts
import { applySecurityMiddleware } from './security/security-middleware';

const app = await NestFactory.create(AppModule);
applySecurityMiddleware(app);  // helmet — Next.js 가 CSP 단독 관리
```

**helmet 옵션 (apps/api/src/security/security-middleware.ts)**:
```ts
function buildHelmetOptions(env: NodeJS.ProcessEnv = process.env): HelmetOptions {
  const isProd = env.NODE_ENV === 'production';
  return {
    contentSecurityPolicy: false,        // PR-3b 의 Next.js next.config.mjs 가 단독 관리
    crossOriginEmbedderPolicy: false,    // 외부 자원 호환
    hsts: isProd
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,                            // CRITICAL-1 가드 — tailscale HTTP 차단 방지
  };
}
```

helmet@^7.2.x default 헤더 (X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
X-DNS-Prefetch-Control / X-Download-Options / X-Permitted-Cross-Domain-Policies) +
X-Powered-By 제거가 적용됨. e2e 검증 18 cases (`security-middleware.test.ts`).

#### 4.1.2 PR-3b 결과물 명세 (CSP Report-Only — **미구현**)

**Next.js CSP** (apps/web/next.config.mjs):

```mjs
const isProd = process.env.NODE_ENV === 'production';
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// PR-3b: Report-Only — 1주 관측 후 enforce. PR-3c 에서 nonce 추가.
const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-eval' 은 next dev HMR 호환을 위한 dev 한정.
  isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",   // PR-3c 에서 inline 제거 후 nonce 화 검토
  "img-src 'self' data: blob:",
  `connect-src 'self' ${apiOrigin}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join('; ');

export default {
  reactStrictMode: true,
  transpilePackages: ['@oracle-game/shared'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
```

**`/api/csp-report` endpoint (NestJS)**:
- POST `application/csp-report` 수신
- 로그 파일 + 7일 회전 (Q2 결정)
- 200 응답 (4xx 시 브라우저가 재시도 → 트래픽 증폭)

#### 4.1.3 PR-3c 결과물 명세 (nonce + enforce — **미구현**)

**Sanitize 서버 측** (토론 저장 전, **PR-10 와 함께**):
```ts
import sanitizeHtml from 'sanitize-html';
const clean = sanitizeHtml(body, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['code', 'pre']),
  allowedAttributes: { a: ['href'], '*': ['class'] },
  allowedSchemes: ['http', 'https', 'mailto'],
});
```

**클라 렌더링** (react-markdown + rehype-sanitize, **PR-12 와 함께**):
```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
// rehype-raw 는 사용 금지
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{body}</ReactMarkdown>
```

**Next.js middleware nonce** (apps/web/middleware.ts):
- `crypto.randomUUID()` → `x-nonce` request header → CSP `script-src 'self' 'nonce-${nonce}'`
- RootLayout 이 `headers().get('x-nonce')` 읽어 `<Script nonce>` 삽입
- `Content-Security-Policy-Report-Only` → `Content-Security-Policy` enforce 전환

### 4.2 httpOnly 쿠키 + refresh + CSRF (CRITICAL-B2, HIGH-1, Q11=a)

**`auth-storage.ts` 완전 제거**. 서버가 쿠키 관리.

```ts
// apps/api/src/modules/auth/auth.controller.ts
@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken } = await this.authService.login(dto);
  res.cookie('access', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return { ok: true };
}

@Post('refresh')
async refresh(@Cookies('refresh') refreshToken: string, @Res({ passthrough: true }) res: Response) {
  const tokens = await this.authService.refresh(refreshToken);
  // ... set new cookies
}

@Post('logout')
async logout(@Res({ passthrough: true }) res: Response) {
  res.clearCookie('access');
  res.clearCookie('refresh');
}
```

**CSRF double-submit token** (Next.js middleware):
- 서명된 쿠키 `csrf-token` + 동일 값 `x-csrf-token` header 매칭.
- `apps/web/src/middleware.ts` 에서 세팅.
- 백엔드 가드에서 검증.

**Q11=a**: 본 작업 + R4 기능을 **PR-10 동일 PR 에 번들**. *(Session 12 갱신: 분할 결정 — §4.2.1 부속서 + §6 PR 분할표 참조)*

---

### 4.2.1 부속서 (Session 12 — 3+1 합의 consensus-010 반영)

본 부속서는 §4.2 의 placeholder 들을 머지 가능 수준으로 구체화한다. 작성 근거: 2026-04-28 Session 12 의 3+1 합의 (Agent A 구현 / Agent B 품질 / Agent C 대안 / Reviewer 합의). 합의율 70% (만장일치 7 / 부분 4 / 불일치 3 / 누락 채택 5).

#### A. Refresh rotation 알고리즘 (CRITICAL — B 합의)

**테이블 신설**: `refresh_tokens`

```ts
@Entity('refresh_tokens')
@Index(['userId', 'familyId'])
export class RefreshTokenEntity {
  @PrimaryColumn('uuid') jti: string;            // JWT ID, 고유
  @Column('uuid') userId: string;
  @Column('uuid') familyId: string;              // 같은 family 의 회전 chain
  @Column({ type: 'integer', default: 0 }) generation: number;  // family 내 순번
  @Column({ type: 'timestamp' }) expiresAt: Date;
  @Column({ type: 'timestamp', nullable: true }) revokedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) replacedBy: string | null;  // 다음 jti
  @CreateDateColumn() createdAt: Date;
}
```

**rotation 로직** (NestJS service):

```ts
async refresh(rawToken: string): Promise<{ access: string; refresh: string }> {
  const payload = await this.jwt.verifyAsync(rawToken, { secret: REFRESH_SECRET });
  const stored = await this.repo.findOne({ where: { jti: payload.jti } });

  // 1) reuse detection — 이미 revoked 또는 replacedBy 가 존재하면 family 폐기
  if (!stored || stored.revokedAt || stored.replacedBy) {
    await this.revokeFamily(payload.familyId);  // CRITICAL: 모든 활성 family 토큰 revoke
    throw new UnauthorizedException('refresh_reuse_detected');
  }

  // 2) Race 방어 — Redis SETNX mutex (TTL 5초)
  const lockKey = `refresh:lock:${payload.jti}`;
  const acquired = await this.redis.set(lockKey, '1', 'EX', 5, 'NX');
  if (!acquired) {
    // 동시 두 번째 호출 — grace window 안의 정상 사용자로 간주, 기존 access 재발급만
    return this.reissueWithoutRotation(payload);
  }

  // 3) 새 jti 발급 + 기존 jti 의 replacedBy 갱신 (트랜잭션)
  const newJti = randomUUID();
  await this.dataSource.transaction(async (m) => {
    await m.update(RefreshTokenEntity, { jti: payload.jti }, {
      revokedAt: new Date(),
      replacedBy: newJti,
    });
    await m.insert(RefreshTokenEntity, {
      jti: newJti, userId: payload.userId, familyId: payload.familyId,
      generation: stored.generation + 1, expiresAt: addDays(new Date(), 14),
    });
  });

  return this.signTokens({ userId: payload.userId, jti: newJti, familyId: payload.familyId });
}
```

**근거**:
- A 의 ioredis (BullMQ 용 이미 존재) 재사용 권고 채택
- B 의 reuse detection CRITICAL 갭 해소
- Race condition 시 grace 5 초 — 빠른 더블탭 / 네트워크 retry 의 false positive 차단

#### B. Logout revoke 메커니즘 (CRITICAL — B 단독, Reviewer 채택)

**ADR-018 epoch 통합**. 기존 `users.token_epoch` 컬럼 신설 (migration 1714000009000):

```sql
ALTER TABLE users ADD COLUMN token_epoch INTEGER NOT NULL DEFAULT 0;
```

JWT payload 에 `epoch` claim 포함. `JwtAuthGuard` 가 매 요청 사용자의 현재 `token_epoch` 와 비교 — 불일치 시 401.

```ts
// auth.controller.ts
@Post('logout')
async logout(@CurrentUser() user, @Res({ passthrough: true }) res) {
  await this.users.incrementTokenEpoch(user.id);   // 모든 access JWT 즉시 무효화
  await this.refreshRepo.update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
  res.clearCookie('access');
  res.clearCookie('refresh');
}
```

**근거**: B 의 "logout 후 access 1~14분 유효" CRITICAL 해소. ADR-018 epoch 패턴 재사용 → 신규 인프라 0.

#### C. sanitize-html 화이트리스트 (HIGH — B G5 채택, **consensus-012 갱신**)

R4 discussion post 본문 처리 시.

**저장 형식 (consensus-012 Q-R5-01=b)**: 서버는 **Markdown raw** 저장. `sanitizePostBody` 는 markdown raw 입력에 대한 **1차 검증** (위험 토큰 strip + 화이트리스트 외 HTML 태그 strip):

```ts
import sanitizeHtml from 'sanitize-html';

const POST_SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr'],
  allowedAttributes: { a: ['href', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto'],   // data: / javascript: 차단
  allowedSchemesAppliedToAttributes: ['href'],
  disallowedTagsMode: 'discard',
  parser: { lowerCaseTags: true, recognizeSelfClosing: true },
};
```

**클라 표시 형식 (consensus-012 Q-R5-02=a)**: `react-markdown` + `rehype-sanitize` + **사용자 정의 schema**. schema 는 `apps/web/src/lib/discussion/sanitize-schema.ts` 단일 모듈이 export → **서버 화이트리스트와 1:1 동등성** (테스트로 회귀 검증):

```ts
import { defaultSchema } from 'rehype-sanitize';
export const discussionSchema = {
  ...defaultSchema,
  tagNames: ['p','br','strong','em','code','pre','ul','ol','li','blockquote','a','hr'],
  attributes: { a: ['href','title'], code: [], pre: [] },
  protocols: { href: ['http','https','mailto'] },
};
```

**rehype-raw 사용 금지** (XSS 우회 footgun). `<ReactMarkdown rehypePlugins={[[rehypeSanitize, discussionSchema]]}>`.

**저장 시 + 표시 시 양쪽 검증** (defense in depth). 50종 OWASP XSS payload negative test 는 PR-10b 의 `apps/api/src/modules/discussion/sanitize-post-body.test.ts` 76 cases + 클라 측 `apps/web/src/components/discussion/__tests__/sanitize-regression.test.tsx` 76 cases (서버와 fixture 공유).

#### D. dev 환경 secure 분기 (HIGH — A·B·C 합의 C5)

```ts
const isProd = process.env.NODE_ENV === 'production';

res.cookie('access', accessToken, {
  httpOnly: true,
  secure: isProd,                   // dev (http://localhost, tailscale http) 에서는 false
  sameSite: 'lax',                  // Q-R2(a) 채택 — Strict 폐기
  domain: process.env.COOKIE_DOMAIN, // 명시 (subdomain hijack 방어 — B G2)
  maxAge: 30 * 60 * 1000,           // Q-R3(b) 채택 — 30m
});
```

**근거**:
- B의 dev `secure:true` cookie 거부 갭 HIGH 해소
- C 의 SameSite=Lax (Discord/슬랙 링크 UX) 채택 — Q-R2(a)
- B G2 subdomain hijack — `Domain` 속성 명시로 host-only 강제

#### E. CSRF 정책 — Origin/Referer 검증 (Q-R2 결정 + consensus-011 갱신)

double-submit token **폐기** (코드 0건 grep 으로 확인됨 — `csurf`/`xsrf` 구현 이력 없음). NestJS 글로벌 가드 (`APP_GUARD` provider) 로 등록.

> **갱신 이력 (Session 13 후속, consensus-011)**: Session 12 의 17 LOC 명세 sample 은 CRITICAL 결함 3건 보유 (startsWith bypass / CORS_ORIGIN fail-OPEN / 운영 회귀). 본 갱신본은 ~25 LOC + escape hatch + report/enforce mode 포함.

```ts
// apps/api/src/security/origin.guard.ts (~25 LOC, 단순화 — 실제 구현은 ~50 LOC)
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.get<boolean>(SKIP_ORIGIN_CHECK_KEY, ctx.getHandler())) return true;
    if (process.env.ORIGIN_GUARD_DISABLED === 'true') return true; // kill-switch

    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    // CRITICAL #2 fail-closed: env 미설정 시 throw (env.validation 에서 boot-time 검증 + runtime 이중 안전망)
    const allowed = parseAllowedOrigins(process.env.CORS_ORIGIN);
    if (allowed.length === 0) {
      throw new InternalServerErrorException('CORS_ORIGIN 운영 값 미설정 — fail-closed');
    }

    const origin = req.headers.origin ?? req.headers.referer;
    if (!origin || origin === 'null') {
      return this.deny(req, 'Origin 헤더가 필요합니다. 학습용 curl/Postman 호출 시 -H "Origin: http://localhost:3000" 추가하세요.');
    }

    // CRITICAL #1: URL parse + protocol/host:port exact match (startsWith bypass 회피)
    let reqOriginNormalized: string;
    try { reqOriginNormalized = new URL(origin).origin.toLowerCase(); }
    catch { return this.deny(req, '유효하지 않은 Origin 형식입니다.'); }

    const ok = allowed.some((a) => a === reqOriginNormalized);
    if (!ok) return this.deny(req, '허용되지 않은 Origin 입니다.');

    return true;
  }

  private deny(req: Request, msg: string): boolean {
    if (process.env.ORIGIN_GUARD_MODE === 'report') {
      console.warn(`[OriginGuard:report] ${req.method} ${req.url} origin=${req.headers.origin} referer=${req.headers.referer} ua=${req.headers['user-agent']}`);
      return true; // Report-Only — log 만 남기고 통과
    }
    throw new ForbiddenException(msg); // enforce 기본
  }
}

// parseAllowedOrigins — fail-closed + 정규화
function parseAllowedOrigins(env?: string): string[] {
  if (!env) return [];
  return env.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    try { return new URL(s).origin.toLowerCase(); }
    catch { return ''; } // invalid → 무시
  }).filter(Boolean);
}

// SkipOriginCheck decorator (~5 LOC)
export const SKIP_ORIGIN_CHECK_KEY = 'skip_origin_check';
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK_KEY, true);
```

**핵심 차이점 (Session 12 sample → Session 13 후속 갱신본)**:

| 결함 | Session 12 | 본 갱신 |
|---|---|---|
| `startsWith` bypass (`example.com.attacker.com` 통과) | CRITICAL | URL parse + `===` exact match |
| `CORS_ORIGIN` 미설정 fail-OPEN (`''.startsWith('')` = true) | CRITICAL | `allowed.length === 0` → throw + env.validation refine 이중 |
| 대소문자 / trailing slash 변형 | MEDIUM | `URL(...).origin.toLowerCase()` 정규화 |
| 운영 회귀 (학생 curl/Postman 차단) | CRITICAL (운영) | `ORIGIN_GUARD_MODE=report` 1주 관측 + `ORIGIN_GUARD_DISABLED` kill-switch + 한국어 학습 힌트 |
| 미래 외부 통합 (OAuth callback / API key endpoint) | reversibility 부담 | `@SkipOriginCheck()` decorator 옵트아웃 |
| `Origin: null` (sandboxed iframe) | 명시 부재 | 명시 거부 |
| 글로벌 등록 누락 위험 | 컨트롤러별 패턴 (지금) | `APP_GUARD` provider 로 글로벌 + escape hatch decorator |

**가드 등록 순서 (Q-S6=a)**: `ThrottlerGuard → OriginGuard → JwtAuthGuard`. Origin 빠른 차단 (throttle 카운터 소모 절감) + 인증 부담 회피.

**helmet `Referrer-Policy` 정합성** (B 지적 HIGH): 현 helmet default `no-referrer` 사용 시 same-origin 요청에서도 Referer 부재 가능 → Origin 헤더 단일 의존. 본 갱신은 Origin 우선 + Referer fallback (legacy 브라우저용) 유지하되 정상 흐름은 Origin 만으로 검증 가정. 추후 helmet 옵션 변경 시 (PR-3b/3c) 재검토.

**근거**: 부트캠프 환경 (20명 신뢰, Tailscale 폐쇄망, 외부 3rd party 0) 에서 CSRF 위협 모델 빈약 (C). SameSite=Lax + Origin 검증 = OWASP defense-in-depth 권장 패턴 (Session 12 의 "99% 커버" 표현은 OWASP 출처 부재로 본 갱신에서 완화). CSRF cookie httpOnly=false 로 인한 XSS 노출 위험 (A G9) 회피.

**Lax 알려진 우회 4종 (본 환경 무관함 명시)**:
- GET 기반 상태 변경 — discussion.controller 모든 mutation 은 POST/PATCH/DELETE (검증 완료)
- Method override (`_method=POST`) — NestJS 미지원
- Chrome 120s grace (Lax+POST top-level navigation) — fetch() API 호출이라 무관
- Sibling/registrable domain — Tailscale IP only 환경 무관

→ 환경 변화 (production HTTPS 전환, 외부 도메인 통합 등) 시 본 절 즉시 재합의.

**해소된 합의**: consensus-011 (2026-04-28). PR-10c 머지 전 reviewer 재합의 완료 — 본 갱신본 채택.

#### F. 만료 정식 정책 (Q-R3 결정)

| 토큰 | 임시 (.env.example, Session 12) | 정식 (PR-10a 머지 후) | 근거 |
|------|--------------------------------|---------------------|------|
| access | **24h** | **30m** | 학습 세션 1~2h 기반 (C Q-C9). 임시는 사용자 페인 즉시 해소 (24h = 하루 1회 로그인) |
| refresh | 14d | 14d | 부트캠프 수료 주기(8주) 중간값. 재로그인 부담 최소 |

PR-10a 머지 시 `.env` 와 `env.validation.ts` default 모두 30m / 14d 로 회귀.

#### G. env.validation.ts refine 추가 (HIGH — A·B 합의)

```ts
// 신규 secret 4건 분리 검증 (ADR-018 §8 패턴 복제)
.refine((cfg) => cfg.JWT_REFRESH_SECRET !== cfg.JWT_SECRET, {
  message: 'JWT_REFRESH_SECRET 이 JWT_SECRET 과 동일 — 재사용 금지',
})
.refine((cfg) => cfg.JWT_REFRESH_SECRET !== cfg.USER_TOKEN_HASH_SALT, { /* ... */ })
.refine((cfg) => cfg.COOKIE_DOMAIN !== '', { message: 'COOKIE_DOMAIN 명시 필수' })
```

추가 env: `JWT_REFRESH_SECRET` (32+) / `JWT_REFRESH_EXPIRES_IN` (default '14d') / `COOKIE_DOMAIN` / `REDIS_URL` (이미 존재 확인).

#### H. PR 분할 (Q-R4 결정)

§6 PR 분할표 갱신. PR-10 → PR-10a / 10b / 10c 3분할. 자세한 일정은 §6 참조.

#### I. 머지 전 선결 조건

**PR-10a 머지 전** (✅ 모두 완료, Session 13):

- [x] **Tailscale spike** — 환경 사실 확정 (HTTP IP only, localhost 불가, production URL 미정) → `secure: NODE_ENV==='production'` + RFC 6265 host-only cookie 결론, 추가 spike 불필요
- [x] **ADR-007 변경 영향 분석** — `docs/review/impact-pr-10a-cookie-refresh-revoke.md` 502L (PR #50)
- [x] **refresh_tokens migration TDD** — 11 cases (PR #51 Phase 1)
- [x] **token_epoch ALTER TABLE migration TDD** — Phase 1 합산
- [x] ~~**OriginGuard 글로벌 등록 + CSRF token 폐기 e2e**~~ — **PR-10c 로 분리** (본 항목은 PR-10a 머지 전 조건이 아니었음, 분류 오류). PR-10c 머지 전 §K 절 이행
- [x] **임시 완화 24h → 정식 30m 복귀** — PR #51 Phase 11 `0f8126a`

#### J. 합의 메타

| 항목 | 출처 |
|------|------|
| 합의 보고서 (consensus-010, Session 12) | `docs/review/consensus-010-pr-10-security.md` |
| 합의 보고서 (consensus-011, Session 13 후속, PR-10c 재합의) | `docs/review/consensus-011-pr-10c-csrf.md` |
| Agent A | 구현 분석 — LOC 추정 ~2000 / 분할 권장 / Redis SETNX |
| Agent B | 품질·안전성 — 명세 그대로 시 보안 58/100 / 5도메인 단일 PR CRITICAL |
| Agent C | 대안 탐색 — iron-session 후보 (미채택) / Lax+Origin 채택 / 30m/14d 채택 |
| Reviewer | 5결정 (a/a/b/b/a) — 사용자 채택 |
| 합의율 (consensus-010) | 70% 만장일치 7 / 부분 4 / 불일치 3 / 누락 채택 5 |
| 합의율 (consensus-011) | 만장일치 35.7% / 유효 92.9% — 좁은 단일 명세 검토 회의 특성 |

#### K. PR-10c 머지 전 추가 선결 조건 (consensus-011, Session 13 후속)

PR-10c (CSRF Origin guard) 머지 전 다음 모두 완료:

**docs PR (Phase 0, 0.5d)**:
- [ ] **§4.2.1 E 절 명세 코드 갱신** (CRITICAL 3건 패치 반영) — 본 갱신본 (~25 LOC sample)
- [ ] **§4.2.1 I 절 정정** — "OriginGuard 글로벌 등록 + CSRF token 폐기 e2e" 항목을 "PR-10c 머지 전 §K 절 이행" 으로 분리
- [ ] **§4.2.1 K 절 신설** (본 절)
- [ ] **§11 변경 이력 1행** (consensus-011 결과)
- [ ] **`consensus-011-pr-10c-csrf.md`** 합의 보고서 INDEX 등록
- [ ] **CONTEXT.md / INDEX.md** 헤더 갱신

**코드 PR (Phase 1~3, 1d)**:
- [ ] **CORS_ORIGIN env 운영 값 결정** — `.env.example` 명시 추가 (현재 부재). 부트캠프 표준 값 (`http://localhost:3000,http://100.102.41.122:3000,http://100.102.41.122:3002`) 문서화
- [ ] **env.validation.ts CORS_ORIGIN refine** — fail-closed 강제 (production 에서 비어있으면 boot 거부) + `ORIGIN_GUARD_MODE` enum + `ORIGIN_GUARD_DISABLED` boolean 추가
- [ ] **OriginGuard TDD 33 cases** — Method 분기 5 / CORS_ORIGIN env 6 / startsWith bypass 4 / 정규화 3 / Origin vs Referer 4 / Tailscale 4 / SkipOriginCheck 3 / 에러 응답 4
- [ ] **`@SkipOriginCheck()` decorator + Reflector 패턴** — 미래 외부 통합 reversibility 보존
- [ ] **APP_GUARD provider 글로벌 등록** (AppModule)
- [ ] **가드 순서**: ThrottlerGuard → OriginGuard → JwtAuthGuard
- [ ] **한국어 에러 메시지 + 학습 힌트** (`Origin 헤더가 필요합니다. 학습용 curl/Postman 호출 시 -H "Origin: http://localhost:3000" 추가하세요.`)

**머지 후 1주 관측 (Phase 4)**:
- [ ] **Report-Only 1주 운영** — `ORIGIN_GUARD_MODE=report` 시 `console.warn` 으로 차단 사례 적재. 부트캠프 학생 비표준 클라이언트 (curl/Postman) 호출 패턴 식별
- [ ] **enforce 전환 follow-up commit** — 1주 후 `ORIGIN_GUARD_MODE=enforce` 로 전환 (default = enforce, env 미설정 시 자동)
- [ ] **Rollback runbook** — `ORIGIN_GUARD_DISABLED=true` 즉시 비활성화 절차 + 영향 evaluation 문서

**미래 재검토 트리거** (consensus-011 §3 Q-S 부속):
- TR-CSRF-1: production HTTPS 전환 시 → Sec-Fetch-Site 단독 채택 가능성 재평가
- TR-CSRF-2: 사용자 100명 초과 또는 외부 3rd party 통합 시 → Synchronizer Token / iron-session 재평가
- TR-CSRF-3: discussion 외 mutation endpoint 가 12개 이상 추가 시 → guard 적용 누락 lint rule 추가
- TR-iron-session: refresh rotation race 6개월 내 3건 이상 발생 시 → iron-session SealedBox 단순성 재평가

---

### 4.3 Auth rate limit (CRITICAL-B3)

```ts
// apps/api/src/modules/auth/auth.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

imports: [
  ThrottlerModule.forRoot([
    { name: 'login', ttl: 15 * 60 * 1000, limit: 5 },
    { name: 'register', ttl: 60 * 60 * 1000, limit: 3 },
  ]),
]

// auth.controller.ts
@Throttle({ login: { ttl: 15 * 60 * 1000, limit: 5 } })
@Post('login') ...

@Throttle({ register: { ttl: 60 * 60 * 1000, limit: 3 } })
@Post('register') ...
```

**`RedisRateLimiter<{kind, key}>`** 일반화:
- 기존 `apps/api/src/modules/grading/appeal/appeal-rate-limiter.ts` 를 refactor
- `kind` ∈ `'appeal' | 'post' | 'comment' | 'vote'`
- 각 kind 별 `{minute, hour, day}` 임계치 주입
- 토론 post: 분당 3 / 시간당 20 / 일당 50
- comment: 분당 10 / 시간당 60
- vote: 초당 5 / 분당 30

### 4.4 Vote UNIQUE + self-vote + race (CRITICAL-B4)

```sql
CREATE TABLE discussion_votes (
  user_id     UUID NOT NULL,
  target_type VARCHAR(10) NOT NULL, -- 'thread' | 'post'
  target_id   UUID NOT NULL,
  value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, target_type, target_id)
);
```

**Self-vote DB CHECK**:
```sql
-- migration 에서 트리거 (CHECK 는 JOIN 불가):
CREATE OR REPLACE FUNCTION prevent_self_vote() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    IF NEW.user_id = (SELECT author_id FROM discussion_posts WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'self-vote prohibited';
    END IF;
  ELSIF NEW.target_type = 'thread' THEN
    IF NEW.user_id = (SELECT author_id FROM discussion_threads WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'self-vote prohibited';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tr_prevent_self_vote BEFORE INSERT OR UPDATE ON discussion_votes
  FOR EACH ROW EXECUTE FUNCTION prevent_self_vote();
```

**서버 측 ForbiddenException**: DB 트리거보다 먼저 차단 (UX 메시지).

**Race 방어**: `INSERT ... ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET value = EXCLUDED.value`. score 캐시 UPDATE 는 **동일 트랜잭션 내** 에서 이전 value 와 delta 계산.

**Q13=a**: 가입 이메일 화이트리스트 / 초대 토큰 **제외**. 다계정 vote bomb 리스크는 수용. 실관측 시 재도입 (§6.8 트리거 조건).

### 4.5 pre-commit Layer 3-a3 재귀 확장 (CRITICAL-B5)

```bash
# .githooks/pre-commit:43-45
if git diff --cached --diff-filter=ACM \
    -- 'apps/api/src/**/prompts/*.prompt.ts' \
    | grep -iE '(user[_-]?token[_-]?hash|\buser[_-]?id\b)' > /dev/null 2>&1; then
  echo "[Layer 3-a3] prompt template 에 user identifier 감지"
  exit 1
fi
```

`**/prompts/*.prompt.ts` 재귀 glob 으로 `discussion/prompts/` 등 신규 경로 자동 커버.

**pii-regression.test.ts** 확장: discussion 경로 테스트 추가.

**ADR-020 명시**: "토론 기능 Phase 1 (본 ADR) 은 LLM 경로 0건. LLM 기반 요약/추천은 별도 ADR (ADR-021 가칭)."

---

## 5. R4/R5/R6 스키마 + API

### 5.1 엔티티 스키마

```typescript
// apps/api/src/modules/discussion/entities/discussion-thread.entity.ts
@Entity('discussion_threads')
@Index(['questionId', 'lastActivityAt'])
export class DiscussionThreadEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'question_id' }) questionId!: string;
  @Column({ type: 'uuid', name: 'author_id' }) authorId!: string;
  @Column({ type: 'varchar', length: 200 }) title!: string;
  @Column({ type: 'text' }) body!: string; // sanitized
  @Column({ type: 'int', default: 0 }) score!: number; // cache sum(votes)
  @Column({ type: 'int', name: 'post_count', default: 0 }) postCount!: number;
  @Column({ type: 'timestamptz', name: 'last_activity_at' }) lastActivityAt!: Date;
  @Column({ type: 'boolean', name: 'is_deleted', default: false }) isDeleted!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

// apps/api/src/modules/discussion/entities/discussion-post.entity.ts
@Entity('discussion_posts')
@Index(['threadId', 'createdAt'])
export class DiscussionPostEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'thread_id' }) threadId!: string;
  @Column({ type: 'uuid', name: 'author_id' }) authorId!: string;
  @Column({ type: 'uuid', name: 'parent_id', nullable: true }) parentId!: string | null; // 1-level nested
  @Column({ type: 'text' }) body!: string; // sanitized
  @Column({ type: 'int', default: 0 }) score!: number;
  @Column({ type: 'boolean', name: 'is_accepted', default: false }) isAccepted!: boolean; // Best answer
  @Column({ type: 'boolean', name: 'is_deleted', default: false }) isDeleted!: boolean;
  @Column({ type: 'uuid', name: 'related_question_id', nullable: true }) relatedQuestionId!: string | null; // HIGH-3 중재
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

// apps/api/src/modules/discussion/entities/discussion-vote.entity.ts
@Entity('discussion_votes')
@Index(['targetType', 'targetId'])
export class DiscussionVoteEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' }) userId!: string;
  @PrimaryColumn({ type: 'varchar', length: 10, name: 'target_type' }) targetType!: 'thread' | 'post';
  @PrimaryColumn({ type: 'uuid', name: 'target_id' }) targetId!: string;
  @Column({ type: 'smallint' }) value!: -1 | 1; // Q10=a: downvote 포함
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
```

### 5.2 마이그레이션

`apps/api/src/migrations/1715000001000-AddDiscussion.ts`:
- 3개 테이블 `CREATE TABLE IF NOT EXISTS`
- self-vote 방지 트리거 (§4.4)
- 인덱스
- `IF NOT EXISTS` 로 synchronize 병행 안전

### 5.3 API 엔드포인트

```
# Read endpoints — @Public() (consensus-012 Q-R5-11=a)
GET    /api/discussion/questions/:questionId/threads?sort=hot|new|top&cursor=<base64url>
GET    /api/discussion/threads/:threadId
GET    /api/discussion/threads/:threadId/posts?parentId=<uuid>

# Write endpoints — JwtAuthGuard
POST   /api/discussion/questions/:questionId/threads
PATCH  /api/discussion/threads/:threadId
DELETE /api/discussion/threads/:threadId (soft delete)

POST   /api/discussion/threads/:threadId/posts
PATCH  /api/discussion/posts/:postId
DELETE /api/discussion/posts/:postId (soft delete)

POST   /api/discussion/vote
  body: { targetType: 'thread'|'post', targetId: uuid, value: -1|0|1 }
  - value=0 → 기존 vote 철회 (DELETE)
POST   /api/discussion/posts/:postId/accept (thread author only)
```

**가드 정책 (consensus-012 Q-R5-11=a)**:
- Read endpoint 4종 (`GET`): `@Public()` 데코레이터 + ThrottlerGuard (60/min IP 기반). JwtAuthGuard 는 `IS_PUBLIC_KEY` 메타데이터 시 user 옵셔널 attach (req.user undefined 통과).
- Write endpoint 7종 (`POST/PATCH/DELETE`): `JwtAuthGuard` 강제 + ThrottlerGuard `discussion_write` named (5/min).
- 비인증 read = 게스트 미리보기 (HIGH-3 블러 비활성, 학습 동기 부여).

**응답 schema 확장 (consensus-012 Q-R5-08=a + Q-R5-03=a)**:
- `myVote: -1|0|1` (인증 사용자만, 비투표 시 0 또는 undefined)
- `isLocked: boolean` (HIGH-3 블러 — `related_question_id` 미풀이 시 body 마스킹)

**cursor schema sort 별 분기 (consensus-012 Q-R5-14=b)**:
- sort=new: `{c: ISO timestamp, i: uuid}` (createdAt + id)
- sort=top: `{s: number, i: uuid}` (score + id)
- sort=hot: `{h: number, i: uuid}` (hot value + id)

### 5.4 정책

- **중첩 깊이**: 1-level nested (StackOverflow 패턴)
- **삭제**: soft delete + "[삭제된 게시물]" 치환
- **Score 캐시**: 트랜잭션 원자 증감
- **Hot 공식**: `LOG(GREATEST(ABS(score), 1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000 DESC`
- **콘텐츠 중재 (HIGH-3)**: `related_question_id` FK. 해당 문제 미풀이 상태면 서버에서 본문 블러 처리. Admin `hide` + `ops_event_log(kind='forum_report')`.
- **페이지네이션 (HIGH-6)**: `limit ≤ 50`, cursor-based, DTO `@Max(50)`.

---

## 6. 구현 로드맵 (14 PR — Session 12 갱신)

Q11=a 로 PR-6+PR-11 통합 → 12 PR. **Session 12 합의 (consensus-010) — PR-10 분할 (Q-R4(b)) 로 14 PR 으로 확장**. 각 PR 는 세션 1회 완료 가능 목표.

| # | 제목 | 의존 | CRITICAL | 추정 |
|---|------|------|----------|------|
| PR-1 | Tailwind v3.4 + postcss + utils 설치 | — | — | 0.5d |
| PR-2 | CSS 변수 → Tailwind theme token 브리지 + light 팔레트 | PR-1 | — | 0.5d |
| PR-3 | `helmet()` + CSP 헤더 + Next.js `headers()` | — | **C-B1** | 0.5d |
| PR-4 | next-themes + ThemeProvider(`light` 기본) + Header 토글 | PR-2 | — | 0.5d |
| PR-5 | shadcn/ui 초기화 + Button/Card/Dialog/Input/DropdownMenu | PR-1 | — | 0.5d |
| PR-6 | `@nestjs/throttler` + auth rate limit + `RedisRateLimiter` 일반화 | — | **C-B3** | 1d |
| PR-7 | pre-commit Layer 3-a3 재귀 + pii-regression 확장 | — | **C-B5** | 0.5d |
| PR-8 | Header + `/`, `/login`, `/register` Tailwind 재작성 | PR-5 | — | 1d |
| PR-9 | `/play/solo` Tailwind 이전 | PR-8 | — | 1.5d |
| **PR-10a** | **httpOnly cookie + refresh rotation + revoke epoch** (refresh_tokens 테이블 + token_epoch ALTER + Redis SETNX mutex + reuse detection family revoke + dev secure 분기 + Domain 명시 + 4 secret refine + JwtAuthGuard cookie extractor + web 6 페이지 마이그레이션) | PR-3, PR-6 | **C-B2** | **2d** |
| **PR-10b** | **R4 discussion 3-entity + sanitize-html + vote 무결성** (discussion_threads/posts/votes + R6 UNIQUE+self-vote CHECK + sanitize allowedTags 화이트리스트 + 저장·표시 양쪽 적용 + IDOR author 검증 + 50종 OWASP XSS negative test) | PR-10a | **C-B4** | 2d |
| **PR-10c** | **CSRF Origin/Referer 검증** (OriginGuard 글로벌 등록 + double-submit token 폐기) — *위협 모델 변화 시 재합의* | PR-10a | — | 1d |
| PR-12 | **discussion 페이지 + VoteButton + react-markdown + rehype-sanitize 단일 schema + HIGH-3 서버 마스킹 + 비인증 read 패치 + hot expression index 마이그레이션 1714000012000 + axe-core 통합 + SWR 도입 + Hero todayQuestion 칩** *(consensus-012 — 사용자 결정 15건 모두 권장 채택)* | PR-10b, PR-9 | **C-B1** | 2.5d (실제 3.5d) |

**총 추정**: 약 13d → **14d** (PR-10 3분할로 +1d). 세션당 1 PR 기준 **14 세션**.

**임시 완화 (Session 12 즉시 적용, Q-R1(a))**: `.env JWT_EXPIRES_IN=24h` — PR-10a 머지 시점에 30m 으로 회귀.

### 병렬 가능

- PR-3 / PR-6 / PR-7 독립 (보안 기반) — 동시 진행 가능
- PR-1 / PR-2 선행 후 PR-4 / PR-5 병렬
- **PR-10a** 는 모든 보안 기반 PR 에 의존 (PR-3, PR-6)
- **PR-10b / PR-10c** 는 PR-10a 직선 의존 (병렬 불가 — refresh+epoch 위에 R4·CSRF 가 빌딩)
- 구 PR-11 (R6 vote) 은 PR-10b 에 흡수됨 — 별도 PR 없음

---

## 7. 접근성 WCAG 2.1 AA (필수)

- **1.4.3** 대비비 ≥ 4.5:1 — light/dark 모든 조합 증명
- **1.4.13** Content on Hover
- **2.1.1** Keyboard — shadcn Radix 기본 + custom onKeyDown
- **2.4.7** Focus Visible — focus ring 별도 토큰
- **4.1.2** Name/Role/Value — vote 버튼 aria-label, aria-pressed
- **4.1.3** Status Messages — rate limit/에러 aria-live

---

## 8. 테스트 전략

### 8.1 단위 테스트 (TDD)

- PR-6: `throttler-integration.test.ts`
- PR-10: `auth.cookie.test.ts` / `discussion.service.test.ts` / `sanitize-html.test.ts`
- PR-11: `vote-race.test.ts` (Promise.all 10 동시) / `vote-self.test.ts` (403)

### 8.2 E2E / 보안 회귀 테스트

- `forum-xss.e2e.test.ts` — OWASP 20종 payload 주입 → 실행 안 됨 검증
- `auth-brute-force.test.ts` — 11회차 429 (CRITICAL-B3)
- `forum-pagination.test.ts` — `?limit=100000` → 400
- `discussion-sanitize.test.ts` — 서버 저장 + 클라 렌더 양쪽 검증

### 8.3 pre-commit Layer 3-a3 회귀

- `pii-regression.test.ts` 에 discussion 경로 커버

### 8.4 접근성 자동 검증

- `@axe-core/react` 통합 — `/discussion/*` 페이지 렌더 시 WCAG AA 위반 0건

---

## 9. 유보 / 연기 항목

| 항목 | 이유 | 재검토 시점 |
|------|------|-----------|
| Mobile 375px 지원 | Q12=a | 실기 이탈 3회/주 관찰 시 |
| 다계정 vote bomb 방어 (이메일 인증 / 초대 토큰) | Q13=a | 동일 IP 3계정+ 관찰 시 |
| Best answer UI 스타일 (골드 테두리) | PR-12 는 버튼만 | 후속 폴리시 PR |
| SQL syntax highlighting (Shiki) | PR-12 이후 | 별도 PR (MED-6) |
| Score cache 드리프트 복구 CLI | MVP 이후 | 드리프트 실관측 시 |
| 실시간 반응 (Discord 스타일) | R6 범위 초과 | MVP-C 이후 별도 ADR |
| Mantine / DaisyUI / Panda 재경쟁 | Q14=4 | Tailwind 유지보수 문제 발생 시 ADR-020-B |
| 사용자 preference DB 저장 | 멀티 디바이스 | 필요 발생 시 별도 PR |
| 토론 LLM 요약/추천 | pre-commit Layer 3-a3 확장 전제 | 별도 ADR-021 (가칭, Community Hub + LLM 요약) |
| 글로벌 `/community` 허브 (질문 무관 토론) | `discussion_threads.question_id` NOT NULL 잠금 + index leading column. PR-12 동봉 시 부피 1.5~2배 | **별도 ADR-021** (consensus-012 Q-R5-05=c) |
| `auth-storage.ts` 잔존 제거 | PR-10a 머지 후 dual-mode 1주 관측 후 | **별도 chore PR** (consensus-012 Q-R5-10=b) |
| A09 audit log (vote/accept/IDOR/blur 우회) | OWASP A09 권장, 본 ADR 범위 외 | MVP-D 이후 별도 ADR |

---

## 10. 연결 ADR / 정합성

| ADR | 관계 | 본 ADR 에서의 의미 |
|-----|------|------------------|
| ADR-016 §7 | Langfuse metadata 화이트리스트 | 토론 Phase 1 에 LLM 경로 없음 → 충돌 없음 |
| ADR-018 §8 금지 1 | 재계산 migration 금지 | discussion 테이블은 WORM 아님 (edit/soft-delete 허용) 명시 |
| ADR-018 §8 금지 2 | hash 를 식별자 금지 | discussion `author_id` 는 UUID, `user_token_hash` 저장 금지 |
| ADR-018 §8 금지 6 | Langfuse 에 userId 파생 금지 | pre-commit Layer 3-a3 재귀 (§4.5) + "LLM 경로 0건" |
| ADR-019 | SM-2 SR | 토론 기능과 독립 — SR 뱃지는 기존대로 유지 |

---

## 11. 결정 소급 / 변경 기록

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-24 | 본 ADR 최초 Accepted | Phase 0 브리프 + Phase 1 consensus-010 + 사용자 Q4~Q15 |
| 2026-04-27 | PR-2/PR-5 토큰 rename — 우리 `--accent`/`--accent-fg` → `--brand`/`--brand-fg` (shadcn 표준 `--accent` 가 hover bg 의미라 충돌). shadcn HSL 토큰 (`--primary`/`--card`/...) 도 §3.3 에 공존 등록. light/dark 양쪽 적용 22 위치 sed | Session 8 PR #29 (PR-2) + PR #31 (PR-5) |
| 2026-04-28 | PR-8b 시안 D — 신규 토큰 5종 (`--brand-strong` / `--code-bg` / `--code-tab-bg` / `--syntax-blank` / `--syntax-blank-fg`) 추가. Tailwind `theme.extend` 에 `brand-gradient` background-image + `grid-cols-20` 추가. 메인 페이지 Hero 3-layer 패널 + Journey strip + 비대칭 카드 | `docs/rationale/main-page-redesign-concept-d.md` §5 |
| 2026-04-28 | PR-7 (CRITICAL-B5) — `.githooks/pre-commit` Layer 3-a3 glob 을 `apps/api/src/**/*.prompt.ts` 재귀로 확장 (+ `*.test.ts` 제외). `pii-regression.test.ts` 에 `findPromptFilesRecursively` helper 분리 + 단위 테스트 3종 추가, 기존 PII 회귀 스캔도 `apps/api/src` 전체 재귀로 변경. 신규 모듈 `prompts/` 자동 커버 | ADR-020 §4.5 |
| 2026-04-28 | PR-3a (CRITICAL-B1, 분할 1/3) — helmet@^7.2 + `applySecurityMiddleware` (production-only HSTS / COEP off / CSP off — Next.js 단독 관리). supertest e2e 18 cases (헤더 6+1종 + HSTS 환경 분기 4종 + CSP/COEP 옵트아웃 2종 + 옵션 단위 5종). §4.1 본문에 PR-3 분할 명세 추가 (3a/3b/3c) + Q2/Q3 결정 + `next.config.js` → `next.config.mjs` 사실 오류 수정 | ADR-020 §4.1, 3+1 합의 보고서 |
| 2026-04-28 | 시안 β (Flow Glass) 채택 — `/play/solo` (config/playing/finished) + `/review/mistakes` 4 화면 통합 디자인 시스템. 옵션 1 다중 모드 + 신규 트랙 분기 (랭킹 도전 / 개인 공부) + 적응형 난이도 (개인 공부 한정). 신규 토큰 2종 예약 (`--feedback-correct`/`--feedback-incorrect`, PR-9a 시 §3.3 패치) + 신규 의존성 2종 (framer-motion PR-9b / recharts PR-9c). PR-9a/9b/9c/9d 단계 분할. 백엔드 변경 (track / modes 배열 / adaptiveHistory / weakAreas / practiceStats) 별도 트랙 | `docs/rationale/play-and-mistakes-redesign-concept-beta.md` |
| 2026-04-28 | PR-9a (시안 β 분할 1/4) — `/play/solo` config phase 시안 β 적용. 신규 토큰 2종 (`--feedback-correct`/`--feedback-incorrect`) + Tailwind 매핑. 신규 컴포넌트 3종 (`<TrackSelector>` 글라스 트랙 타일 + `<ModeMultiSelect>` 옵션 1 다중 chip + `<ConfigForm>` 글라스 폼) + `lib/play/{types,mock}.ts`. URL 쿼리 `?track=practice` 진입 지원. 백엔드 시그니처 호환 — 클라이언트가 `modes[0]`/`difficulty ?? 'EASY'` 로 변환해 기존 `solo.start` 유지. playing/finished phase 는 PR-8 톤 일시 유지. 미사용 `Field` helper + 5종 import 제거 | `play-and-mistakes-redesign-concept-beta.md` §3.1 §11 |
| 2026-04-28 | 시안 ε (Hero Mirror) 채택 — `/play/solo` config 시각 풍부화 polish. 메인 시안 D Hero idiom (좌 개인화 카피 + 우 코드 패널) 미러링. 7가지 시각 결정: Hero anchor 신규 / 트랙 타일 36px+stats / split 폼 / 주차 input → `<WeekDayPicker>` 20-dot strip / 모드 chip 메타 (시간+정답률) / 난이도 chip 강도 dot 3중 인코딩 / 라이브 통계 4-metric strip. 신규 토큰 6종 예약 (`--difficulty-{easy,medium,hard}` foreground + bg, PR-9a' 시 §3.3 패치) + 신규 의존성 framer-motion (선반영 가능). 단일 PR-9a' polish 진행. 백엔드 endpoint 5종 (weekly-stats / recommended-preview / mode-stats / recommended-week / last-session) 별도 트랙 | `docs/rationale/solo-play-config-redesign-concept-epsilon.md` |
| 2026-04-28 | PR-9a' (시안 ε polish) — 신규 토큰 6종 (`--difficulty-easy/medium/hard` foreground + `-bg` background) + Tailwind `theme.extend.colors.difficulty.{easy,medium,hard}.{DEFAULT,bg}` 매핑. 난이도 chip 3중 인코딩 (색 + 강도 dot `●●○○○`/`●●●○○`/`●●●●●` + 라벨). 신규 컴포넌트 4종 (`<CodePreviewPanel>` 추출 / `<ConfigHero>` Hero anchor / `<WeekDayPicker>` 20-dot strip / `<WeeklyStatsStrip>` 4-metric). 기존 컴포넌트 3종 시각 풍부화 (`<TrackSelector>` 36px 아이콘+stats row / `<ModeMultiSelect>` 가로 4 col + lucide 아이콘 매핑 + 메타 시간·정답률 / `<ConfigForm>` split 레이아웃). `lib/code/types.ts` 신규 — 코드 라인 모델 home↔play 공유. mock 4종 (`MOCK_WEEKLY_STATS` / `MOCK_RECOMMENDED_PREVIEW` / `MOCK_MODE_STATS` / `MOCK_LAST_SESSION`) + 트랙 stats mock 2종. 백엔드 endpoint 5종 미연결 — page.tsx 의 mock 상수 (`MOCK_NICKNAME` 등) 가 후속 PR `useUser()` 도입 시 1:1 swap 지점 | `docs/rationale/solo-play-config-redesign-concept-epsilon.md` §3 / §5 / §10 |
| 2026-04-28 | CTA 즉시 시작 — `/play/solo` config 의 `추천으로 시작` / `이어서 학습` 명시적 confirm 패턴 제거. `startGame(overrides?: Partial<SoloConfigSelection>)` 시그니처 확장 → 자동 폼 채움 + 즉시 게임 시작 (1 클릭). 사용자 피드백: 다시 시작 클릭은 redundant. concept-epsilon §3.1.4 / §7.3 / §13.1 / §16 변경 이력 갱신 | Session 12 사용자 결정 |
| 2026-04-28 | **PR-10 분할 + 임시 완화 + Lax+Origin 정책 (Session 12 합의 consensus-010)** — 3+1 합의 (Agent A 구현 / Agent B 품질 / Agent C 대안 / Reviewer) 70% 만장일치. 사용자 5결정 (a/a/b/b/a): (Q-R1) 임시 `JWT_EXPIRES_IN=24h` 즉시, PR-10a 머지까지 / (Q-R2) SameSite=Lax + Origin 헤더 검증 (CSRF token 폐기 검토) / (Q-R3) 정식 만료 30m/14d (학습 세션 1~2h 기반) / (Q-R4) PR-10 → 10a (cookie+refresh+revoke epoch 2d) / 10b (R4+sanitize+vote 무결성 2d) / 10c (CSRF Origin-only 1d) 3분할 / (Q-R5) ADR-020 §4.2.1 부속서. CRITICAL 4건 해소: refresh reuse detection 알고리즘 (Redis SETNX mutex + family revoke) + logout revoke epoch (ADR-018 통합) + tailscale SameSite 미검증 (Lax 채택) + 5도메인 단일 PR 인지 부하 (분할). §4.2.1 부속서 + §6 PR 분할표 + §11 본 행 갱신 | `docs/decisions/ADR-020-ux-redesign.md` §4.2.1 / §6, Session 12 합의 |
| 2026-04-28 후속 | **PR-10c CSRF 위협 모델 재합의 (Session 13 후속, consensus-011)** — ADR-020 §4.2.1 E 절 "유보" (PR-10c 머지 전 reviewer 재합의) 트리거. 3+1 합의 (Agent A·B·C 병렬 + Reviewer). 합의율 만장일치 35.7% / 유효 92.9% (좁은 단일 명세 검토). 사용자 6결정 모두 추천값 채택 (a/a/a/b/a/a). **CRITICAL 3건 식별** — (1) startsWith bypass (`example.com.attacker.com` / port prefix 우회) → URL 객체 parse + protocol/host:port exact match. (2) CORS_ORIGIN fail-OPEN (`''.split(',')` = `['']`, `'x'.startsWith('')` = true) → fail-closed (boot-time refine + runtime 이중 안전망). (3) 운영 회귀 (학생 curl/Postman 차단) → SkipOriginCheck decorator + Report-Only 1주 + 한국어 학습 힌트 + kill-switch. **§4.2.1 E 절 명세 코드 17 LOC → 25~30 LOC 갱신** (URL parse + 정규화 + report/enforce + decorator). **§4.2.1 I 절 정정** ("OriginGuard 글로벌 등록 + CSRF token 폐기 e2e" → PR-10c 분리). **§4.2.1 K 절 신설** (PR-10c 머지 전 추가 선결 조건 + 미래 재검토 트리거 4종). **CSRF token 폐기 처리** — `csurf`/`xsrf` grep 0건 확인, "폐기" = 명목상 작업 0. defense-in-depth 약화 보완은 SkipOriginCheck + Report-Only 로 완화. **Sec-Fetch-Site hybrid (C 추천) 채택 거부 사유**: Tailscale HTTP only 환경에서 브라우저가 secure context 만 헤더 전송 → 단독 무력. 미래 production HTTPS 전환 시 TR-CSRF-1 트리거 | `docs/review/consensus-011-pr-10c-csrf.md`, ADR-020 §4.2.1 E·I·K |
| 2026-04-29 후속4 | **PR-12 web 토론 페이지 docs PR (consensus-012)** — 3+1 합의 (Agent A·B·C 병렬 + Reviewer). 합의율 만장일치 6.7% (1/15) / 유효 100% (15/15). 사용자 결정 15건 (Q-R5-01~15) 모두 Reviewer 권장값 채택 ("전부 권장"). **CRITICAL 5건 해소**: (C-1) 저장 형식 모순 → Markdown raw 저장 + 클라 단독 sanitize (Q-R5-01=b). (C-2) 클라 sanitize schema 미지정 → 서버=클라 1:1 단일 schema 모듈 + 동등성 테스트 (Q-R5-02=a). (C-3) HIGH-3 마스킹 0건 → 서버 정규식 마스킹 + 클라 글라스 블러 이중 방어 (Q-R5-03=a). (C-4) hot 공식 expression index 부재 → Reddit log10 + PG expression index 마이그레이션 1714000012000 (Q-R5-06=a). (C-5) discussion read 비인증 차단 (controller line 115 ADR 불일치) → read 4종 `@Public()` + write 7종 JwtAuthGuard 분리 (Q-R5-11=a). **§4.2.1 C 절** Markdown raw 저장 + 클라 단독 sanitize 명시 + rehype-raw 금지 + 76 OWASP 회귀 클라/서버 양쪽 명시. **§5.3 절** 가드 정책 분리 + 응답 schema 확장 (`myVote` / `isLocked`) + cursor sort 별 schema 분기 명시. **§6 PR-12 행** 확장 (단일 schema + 비인증 패치 + 마이그레이션 + axe-core + SWR + Hero 칩). **§9 유보 행 3건 추가** (글로벌 `/community` 허브 → ADR-021 분리 / auth-storage.ts → 별도 chore PR / A09 audit → MVP-D 이후). **사용자 추가 질문 "커뮤니티는 어디에 추가할지"** — Reviewer 분석 결과 옵션 A (질문 종속 only) + 옵션 C 후속 분리 권장 → 사용자 채택. 진입점 = 솔로 결과 직후 (round 별 CTA) + Hero `todayQuestion` 우하단 메타 칩 (Q-R5-04=a+b). Header 변경 없음 (시안 D §3.1). **B 단독 지적 5건 중 4건 채택 — 다관점 시스템 가치 입증** (특히 항목 11 비인증 처리 = ADR-코드 불일치). **신규 의존성 6종**: react-markdown@^9 / rehype-sanitize@^6 / swr@^2 / @radix-ui/react-tabs / @axe-core/react / vitest-axe. **신규 마이그레이션 1**: 1714000012000 expression index. **추정 신규 cases ~103** (백엔드 38 + web 65). **추정 분량 3.5d** (ADR-020 §6 추정 2.5d + axe-core + 외부 검증). | `docs/review/consensus-012-pr-12-discussion-page.md`, `docs/architecture/pr-12-discussion-page-design.md`, `docs/review/tdd-plan-pr-12-discussion-page.md`, `docs/review/impact-pr-12-discussion-page.md`, ADR-020 §4.2.1 C / §5.3 / §6 / §9 |
| 2026-04-29 (Session 15) | **ADR-021 (Community Hub) docs PR + PR-13 (통합 e2e 하네스) docs (consensus-013)** — 3+1 합의 (Agent A·B·C 병렬 + Reviewer). 합의율 만장일치 12.5% (1/8) / 유효 100% (8/8). 사용자 결정 12건 (Q-R6-01~12). Reviewer 권장 대비 변경 4건 (Q-R6-02 격상 / Q-R6-09 격상 / Q-R6-10 종속 격상 / Q-R6-12 변경). **CRITICAL 3건 해소**: (1) middleware PUBLIC_PATHS 모순 → Q-R5-11 번복 확정 (community read 인증 필수, Q-R6-04). (2) PR-13 우선순위 → 1주 선행 머지 (Q-R6-11). (3) audit log 부재 → 1기 도입 (ADR-016 §7 D3 Hybrid 재사용, Q-R6-06). **옵션 공간 재오픈**: Agent C 단독 제안 옵션 F (Q&A 모음 mview) / G (virtual root question 시드) — consensus-012 의 5개 매트릭스 Gap 메우기. **사용자 채택 = 옵션 G 1기 + 옵션 F/C 2기 트리거**. **외부 채널 부재 컨텍스트** (Slack 미사용, Zoom 만, 정보 공유 커뮤니티 없음) → 카테고리 1기 도입 격상 (Reviewer 미도입 → 4종 도입: notice/free/study/resource). **1기 3-tier RBAC 격상** (강사 = operator role, 학생 글 수정 코드 강제). **시안 D §3.4 비대칭 3-카드 → 4-카드 변경** (Community 카드 추가, rationale 패치). **PR-13 1주 선행 머지** = Session 14 §3.1 hotfix 11건 패턴 (단위 GREEN + 통합 결함) 차단. **신규 마이그레이션 5종**: virtual root 시드 + category 컬럼 + role 컬럼 + audit_log 테이블 + 모더레이션 컬럼. **신규 의존성 2종 (web)**: @playwright/test@^1.48 (ARM64 호환) + msw@^2 (vitest 단위 보강). **PR-13 5종 안전장치**: DB schema 격리 + secret scanner (gitleaks) + Langfuse no-op fallback + GB10 ulimit + 환경변수 격리. **추정 분량**: ADR-021 docs 1d (본 PR) + PR-13 코드 4d (Phase 2 1주 선행) + ADR-021 코드 4분할 6d (Phase 3). | `docs/review/consensus-013-adr-021-community-hub.md`, `docs/decisions/ADR-021-community-hub.md`, `docs/architecture/community-hub-design.md`, `docs/architecture/community-rbac-design.md`, `docs/architecture/community-moderation-design.md`, `docs/architecture/audit-log-design.md`, `docs/architecture/integrated-e2e-harness-design.md`, `docs/rationale/main-page-redesign-concept-d.md` §1·§3.4 |

---

## 12. 참조

- `docs/rationale/ux-redesign-brief-v1.md` — Phase 0 브리프 (R1~R7 요구사항)
- `docs/review/consensus-010-ux-redesign.md` — 3+1 합의 원문 + CRITICAL 격상 근거
- `docs/architecture/multi-agent-system-design.md` §7.3 — 합의율 패턴 관찰
- ADR-001 — Phase 0 질문지 프로토콜
- ADR-016 §7 — LLM-judge 안전 (metadata 화이트리스트)
- ADR-018 §4 D3 Hybrid, §8 금지 1~6 — user_token_hash salt rotation
- ADR-019 — SM-2 SR (독립적)
- ADR-021 — Community Hub (자유게시판 + 카테고리 + RBAC + 모더레이션 + audit log) — Session 15 결정
- `apps/api/src/main.ts` — helmet / CSP 도입 지점
- `apps/web/src/lib/auth-storage.ts` — localStorage 제거 대상 (PR-10)
- `apps/api/src/modules/auth/auth.module.ts` — ThrottlerModule 추가 지점 (PR-6)
- `.githooks/pre-commit:43-45` — Layer 3-a3 재귀 확장 지점 (PR-7)
- `apps/web/src/app/play/solo/page.tsx` — Tailwind 이전 예시 (PR-9)
