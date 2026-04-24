# ADR-020 — UX 재설계 (Tailwind + shadcn/ui + 토론 쓰레드 + 라이트/다크 토글)

| 항목 | 값 |
|------|---|
| 상태 | Accepted (2026-04-24) |
| 제안 세션 | Session 7 Phase 1 (consensus-009) |
| 선행 문서 | `docs/rationale/ux-redesign-brief-v1.md`, `docs/review/consensus-009-ux-redesign.md` |
| 관련 ADR | ADR-001 (Phase 0 질문지), ADR-016 §7 (LLM-judge 안전), ADR-018 §8 (salt rotation 금지 6), ADR-019 (SM-2) |
| 영향 범위 | `apps/web` 전면 + `apps/api` 토론·인증·보안 기반 + `.githooks/pre-commit` |

---

## 1. 배경

MVP-A/B 기간 동안 UI 는 **inline-style 최소 구현** 상태로 방치됐다. 2026-04-23 사용자가 tailscale 로 첫 실플레이 시 "즉시 피드백 부재 + 문맥 결여" 피드백이 나왔고 (PR #12 에서 부분 해소), 동시에 "programmers 지향 + Reddit 토론 + 끄투온라인 라이트함" 이라는 재설계 방향이 제시됐다 (`ux-redesign-brief-v1.md`).

2026-04-24 Phase 0 질문지 (Q4~Q9) 와 Phase 1 3+1 합의 (consensus-009) 를 거쳐 본 ADR 이 결정된다. 주요 특징:

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
| R4 배포 게이트 | **PR-10 에 httpOnly 쿠키 전환 + R4 번들** | Q11=a |

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

**서버**:
```ts
// apps/api/src/main.ts
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: false, // Next.js headers() 에서 관리
}));
```

**sanitize-html 서버 측** (토론 저장 전):
```ts
import sanitizeHtml from 'sanitize-html';
const clean = sanitizeHtml(body, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['code', 'pre']),
  allowedAttributes: { a: ['href'], '*': ['class'] },
  allowedSchemes: ['http', 'https', 'mailto'],
});
```

**클라 렌더링** (react-markdown + rehype-sanitize):
```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
// rehype-raw 는 사용 금지
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{body}</ReactMarkdown>
```

**Next.js CSP**:
```js
// apps/web/next.config.js
const cspHeader = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'`;
module.exports = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: cspHeader },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
```

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

**Q11=a**: 본 작업 + R4 기능을 **PR-10 동일 PR 에 번들**.

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
GET    /api/discussion/questions/:questionId/threads?sort=hot|new|top&cursor=<uuid>
POST   /api/discussion/questions/:questionId/threads
GET    /api/discussion/threads/:threadId
PATCH  /api/discussion/threads/:threadId
DELETE /api/discussion/threads/:threadId (soft delete)

GET    /api/discussion/threads/:threadId/posts?parentId=<uuid>
POST   /api/discussion/threads/:threadId/posts
PATCH  /api/discussion/posts/:postId
DELETE /api/discussion/posts/:postId (soft delete)

POST   /api/discussion/vote
  body: { targetType: 'thread'|'post', targetId: uuid, value: -1|0|1 }
  - value=0 → 기존 vote 철회 (DELETE)
POST   /api/discussion/posts/:postId/accept (thread author only)
```

모두 `JwtAuthGuard` + `RedisRateLimiter` 가드 (§4.3).

### 5.4 정책

- **중첩 깊이**: 1-level nested (StackOverflow 패턴)
- **삭제**: soft delete + "[삭제된 게시물]" 치환
- **Score 캐시**: 트랜잭션 원자 증감
- **Hot 공식**: `LOG(GREATEST(ABS(score), 1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000 DESC`
- **콘텐츠 중재 (HIGH-3)**: `related_question_id` FK. 해당 문제 미풀이 상태면 서버에서 본문 블러 처리. Admin `hide` + `ops_event_log(kind='forum_report')`.
- **페이지네이션 (HIGH-6)**: `limit ≤ 50`, cursor-based, DTO `@Max(50)`.

---

## 6. 구현 로드맵 (12 PR)

Q11=a 로 PR-6+PR-11 통합 → 총 **12 PR**. 각 PR 는 세션 1회 완료 가능 목표.

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
| PR-10 | **(Q11=a 통합)** httpOnly 쿠키 + `/auth/refresh` + CSRF + R4 discussion 스키마/API + sanitize-html | PR-3, PR-6 | **C-B2 + C-B4 부분** | **3d** |
| PR-11 | R6 vote 엔드포인트 + UNIQUE + self-vote CHECK + race 테스트 | PR-10 | **C-B4** | 1d |
| PR-12 | discussion 페이지 + VoteButton + `/play/solo` "토론 참여" 링크 + rehype-sanitize | PR-10, PR-11, PR-9 | **C-B1** | 2.5d |

**총 추정**: 약 13일. 세션당 1 PR 기준 **12 세션**.

### 병렬 가능

- PR-3 / PR-6 / PR-7 독립 (보안 기반) — 동시 진행 가능
- PR-1 / PR-2 선행 후 PR-4 / PR-5 병렬
- PR-10 은 모든 보안 기반 PR 에 의존 (PR-3, PR-6)

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
| 토론 LLM 요약/추천 | pre-commit Layer 3-a3 확장 전제 | 별도 ADR-021 (가칭) |

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
| 2026-04-24 | 본 ADR 최초 Accepted | Phase 0 브리프 + Phase 1 consensus-009 + 사용자 Q4~Q15 |

---

## 12. 참조

- `docs/rationale/ux-redesign-brief-v1.md` — Phase 0 브리프 (R1~R7 요구사항)
- `docs/review/consensus-009-ux-redesign.md` — 3+1 합의 원문 + CRITICAL 격상 근거
- `docs/architecture/multi-agent-system-design.md` §7.3 — 합의율 패턴 관찰
- ADR-001 — Phase 0 질문지 프로토콜
- ADR-016 §7 — LLM-judge 안전 (metadata 화이트리스트)
- ADR-018 §4 D3 Hybrid, §8 금지 1~6 — user_token_hash salt rotation
- ADR-019 — SM-2 SR (독립적)
- `apps/api/src/main.ts` — helmet / CSP 도입 지점
- `apps/web/src/lib/auth-storage.ts` — localStorage 제거 대상 (PR-10)
- `apps/api/src/modules/auth/auth.module.ts` — ThrottlerModule 추가 지점 (PR-6)
- `.githooks/pre-commit:43-45` — Layer 3-a3 재귀 확장 지점 (PR-7)
- `apps/web/src/app/play/solo/page.tsx` — Tailwind 이전 예시 (PR-9)
