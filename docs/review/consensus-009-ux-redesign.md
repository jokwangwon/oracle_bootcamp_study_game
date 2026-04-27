# Consensus 009 — UX 재설계 (ADR-020 후보, 2026-04-24)

**상태**: 완결 — 사용자 Q10~Q15 답변 반영 완료 / ADR-020 초안 진행 가능
**3+1 프로토콜**: Agent A (구현) / B (품질·안전성) / C (대안) 독립 병렬 분석 → 본 Reviewer 합의
**관련 문서**: `docs/rationale/ux-redesign-brief-v1.md`, `docs/architecture/multi-agent-system-design.md` §7.3, ADR-016 §7, ADR-018 §8, ADR-019, PR #25 오답 노트
**Reviewer 검증 방식**: Agent B 의 CRITICAL 1·2·3·5 근거 파일을 본 Reviewer 가 직접 Read — 전부 축자 사실 확인 (§4 참조)

---

## 1. 범위

본 합의는 "부트캠프 학습 게임 UX 전면 재설계" 의 ADR-020 후보 결정에 필요한 항목을 포괄한다. 결정 축:

1. **UI 기술 스택**: Tailwind + shadcn/ui vs Mantine vs Panda CSS vs DaisyUI vs 현 inline 유지
2. **R4 (토론 쓰레드)**: 스키마, 중첩 깊이, 삭제 정책, hot 공식
3. **R5 (Q&A + upvote/downvote)**: 구현 범위
4. **R6 (voting)**: UNIQUE, self-vote 차단, race 방어, 다계정 남용 방어
5. **다크/라이트 토글**: `next-themes` + 기본값 (dark/light/system)
6. **마이그레이션 전략 + PR 로드맵**: 컴포넌트별 + Strangler
7. **보안 기반** (신설 축): helmet/CSP/httpOnly 쿠키/auth rate limit/pre-commit 확장 — R4 배포 전제

---

## 2. Agent 요약

### 2.1 Agent A (구현 분석가)

Tailwind v3.4 + shadcn/ui + next-themes 채택을 **조건부 YES** 로 권고. Next.js 14 App Router · React 18 SSR 호환성 블로커 없음을 `next.config.mjs` / `tsconfig.json` (paths shadcn 기본값 일치) 직접 확인. R4 스키마는 `discussion_threads + discussion_posts + discussion_votes` 3-테이블 + score 캐시 + 1-level nested. 9 PR 로드맵 제시. Hot 정렬 Postgres `LOG(0)` 처리 / `@nestjs/throttler` 미장착 / `feature/mistakes-review` 흡수 타이밍을 주요 블로커로 식별.

### 2.2 Agent B (품질·안전성 검증가)

현 앱이 **helmet/CSRF/CSP/auth-rate-limit 전부 부재**. 토론·voting 도입 시 Stored XSS · 다계정 vote bomb · ADR-018 §8 금지 6 위반 경로 신설. **CRITICAL 5건**: (C-1) Sanitize+CSP, (C-2) localStorage JWT, (C-3) auth rate limit, (C-4) R6 UNIQUE/self-vote, (C-5) pre-commit Layer 3-a3 커버리지. HIGH 6건 + WCAG AA 체크리스트. "CRITICAL 5건 전부 반영 + R4 는 httpOnly 쿠키 전환 후 배포" 를 채택 조건으로 명시.

### 2.3 Agent C (대안 탐색가)

Tailwind + shadcn/ui 가 "평균적으로 최선" 이나 **MVP 20명 / 단일 운영자** 맥락에서 과대 스펙 가능성. 2/3순위 경쟁안: Mantine v7 / Panda CSS / DaisyUI. 외부 서비스 (Disqus/Giscus/Remark42) 는 ADR-018 §8 로 전부 탈락. **Phase 0 덮어쓰기 제안 4건**: Q8 재검토, R6 분리, Q9 기본값 system, UI lib 재경쟁 질문 추가.

---

## 3. 교차 비교

### 3.1 일치 (Consensus — 3개 모두 동의)

1. UI 스택 1순위 = **Tailwind v3.4 + shadcn/ui + next-themes**
2. styled-components / emotion / Chakra v2 **실격** — RSC 상극
3. 외부 커뮤니티 서비스 **전면 기각** — ADR-018 §8 데이터 주권
4. R4 스키마 = **3-테이블** (threads / posts / votes)
5. **(user_id, target) UNIQUE + ON CONFLICT upsert** 로 vote race 방어
6. **score 캐시 컬럼 + 트랜잭션 내 원자적 증감** (실시간 SUM 금지)
7. **`next-themes` + `suppressHydrationWarning`**
8. **EAV / Event sourcing / Big-bang 기각**
9. **CSS 변수 → Tailwind theme token 브리지** 마이그레이션
10. WCAG 2.1 AA 준수 의무

### 3.2 부분 일치 (Partial — 2개 동의, 1개 이견 또는 미언급)

1. R5 범위 — 최소형 vs 완전형 → **Q10 답변으로 결정**
2. 중첩 깊이 — 1-level nested (A·C 합의)
3. 다크/라이트 기본값 → **Q15 답변으로 결정**
4. auth rate limit — B CRITICAL-3, A 약함 언급, C 미언급 → CRITICAL 유지
5. Mobile 375px → **Q12 답변으로 결정**
6. Hot 정렬 공식 — A 단독 구현 디테일 채택
7. 마이그레이션 = 컴포넌트별 + Strangler — A·C 합의

### 3.3 불일치 (Divergence — 3개 서로 다름)

1. UI lib 1순위의 강도 → **Q14 답변으로 결정**
2. R6 downvote MVP-C 이전 필수 여부 — Q5 사용자 결정이나 C 가 덮어쓰기 제안 → **Q10 으로 위임**

### 3.4 누락 (Gap — 특정 에이전트만 언급)

1. Agent B 단독 CRITICAL-1 Stored XSS + CSP — **격상 채택**
2. Agent B 단독 CRITICAL-2 localStorage JWT — **격상 채택**
3. Agent B 단독 CRITICAL-3 auth rate limit — **격상 채택**
4. Agent B 단독 CRITICAL-5 pre-commit Layer 3-a3 — **격상 채택**
5. Agent C 단독 디자인 자신감 재질문 → Q14 로 위임
6. Agent C 단독 mobile 375px → Q12 로 위임
7. Agent A 단독 Hot 공식 + feature/mistakes-review 흡수 — 채택
8. Agent B 단독 WCAG AA + 페이지네이션 limit ≤ 50 — 채택
9. Agent B 단독 "답지 유출" 중재 정책 (HIGH-3) — 채택
10. Agent B 단독 가입 화이트리스트 → Q13 으로 위임

---

## 4. CRITICAL 격상 판정 (Session 4 룰)

Agent B 의 CRITICAL 5건은 모두 B 단독 지적. Reviewer 가 각 근거 파일을 직접 Read 하여 축자 검증 완료.

### CRITICAL-B1 — Stored XSS sanitize + CSP 부재
- **격상**: **채택**
- **축자 근거**: `apps/api/src/main.ts` 전체 38 줄 — `helmet` import/use 없음, CSP 응답 헤더 없음.
- **ADR-020 반영**: `sanitize-html` (서버) + `rehype-sanitize` (클라) + `helmet()` + Next.js `headers()` CSP. R4 와 동일 PR 번들.

### CRITICAL-B2 — JWT localStorage × 토론
- **격상**: **채택**
- **축자 근거**: `apps/web/src/lib/auth-storage.ts:11` localStorage 사용. line 3-6 주석 "httpOnly 쿠키 교체 예정" 미구현 상태.
- **ADR-020 반영**: httpOnly + SameSite=Strict + Secure + `/api/auth/refresh` + CSRF double-submit. R4 배포 게이트.

### CRITICAL-B3 — Auth rate limit 전면 부재
- **격상**: **채택**
- **축자 근거**: `auth.module.ts` imports 에 `ThrottlerModule` 없음. `auth.controller.ts:28-40` 데코 없음.
- **ADR-020 반영**: `/auth/login` IP 당 분당 5 / 15분 잠금, `/auth/register` IP 당 시간당 3. `AppealRateLimiter` → `RedisRateLimiter<{kind, key}>` 일반화.

### CRITICAL-B4 — R6 self-vote / 다계정 / race
- **격상**: **채택 (통합 CRITICAL)**
- **근거**: A·B·C 공통 구조 (UNIQUE + upsert + self-vote 차단). B 가 "가입 이메일 화이트리스트" 까지 확장 — 운영 정책이라 Q13 으로 위임.
- **ADR-020 반영**: `(user_id, target_type, target_id)` UNIQUE + ON CONFLICT DO UPDATE + DB CHECK `author_id <> voter_id` + 서버 ForbiddenException.

### CRITICAL-B5 — pre-commit Layer 3-a3 커버리지 갭
- **격상**: **채택 (Session 4 룰 정확 사례)**
- **축자 근거**: `.githooks/pre-commit:43-45` 경로 패턴 `apps/api/src/modules/ai/prompts/*.prompt.ts` 하드코딩 — 재귀 glob 아님.
- **ADR-020 반영**: 패턴을 `apps/api/src/**/prompts/*.prompt.ts` 로 확장 + `pii-regression.test.ts` discussion 경로 커버 + "토론 Phase 1 = LLM 경로 0건" 명시.

### 격상 총평

5건 모두 채택. Agent B 단독 지적이었으나 Reviewer 가 축자 확인 완료. ADR-020 이 Accepted 되려면 5건 전부 반영 필수.

---

## 5. 사용자 재확인 Q10~Q15 (2026-04-24 확정 답변)

Phase 0 Q4~Q9 덮어쓰기 후보 + 에이전트 제안을 모아 사용자에게 재확인한 결과:

| # | 질문 | 답변 | 의미 |
|---|------|------|------|
| **Q10** | R5 범위 — 최소형 vs 완전형 | **a (완전형)** | Q5 그대로: R4 + upvote + downvote 모두 MVP-C 이전 필수 |
| **Q11** | R4 배포 게이트 — httpOnly 쿠키 전환 관계 | **a (동일 PR)** | R4 PR 안에 쿠키 전환 포함. 큰 PR 이지만 안전성 최상 |
| **Q12** | Mobile 지원 수준 | **a (Q8 그대로)** | desktop only. mobile 깨짐 허용. 375px 비기능 요구 추가 X |
| **Q13** | 가입 정책 | **a (공개 가입)** | 화이트리스트/초대 없음. 다계정 vote bomb 리스크는 수용 |
| **Q14** | 디자인 자신감 (1~5) | **4** | Tailwind + shadcn/ui 유지. Mantine 재경쟁 없음 |
| **Q15** | 다크/라이트 기본값 | **b (light 기본)** | `defaultTheme="light"` + 토글 제공. programmers 지향 반영 |

### 사용자 답변이 ADR-020 범위에 미치는 영향

- **Q10=a**: `discussion_votes.value ∈ {-1, +1}`. Vote UI 에 downvote 버튼 포함. PR-11/12 에 downvote 경로 모두 구현. Agent C §8 제안 2 기각.
- **Q11=a**: PR-6 (쿠키 전환) + PR-11 (R4) **통합**. 13개 PR 로드맵에서 해당 2개를 한 PR 로 병합 → 실제 PR 수는 12개. 작업 단위 큼.
- **Q12=a**: `globals.css` 미디어쿼리 불필요. Tailwind `md:`/`lg:` prefix 는 장식 수준에서만 (필수 아님). 부트캠프 학생 실기 환경이 desktop 중심임을 공식 가정.
- **Q13=a**: Agent B CRITICAL-4 에서 "가입 화이트리스트" 부분만 기각. UNIQUE 제약 + self-vote DB CHECK + race 방어는 그대로 채택. 다계정 vote bomb 방어는 "비용-편익" 관점에서 완화 대응 (이메일 검증 링크 불요, 가입 자체는 공개).
- **Q14=4**: Agent C 의 UI lib 재경쟁 제안 기각. Tailwind + shadcn/ui 확정. Mantine/DaisyUI/Panda 는 유보 항목 §6.8 에 기록만.
- **Q15=b**: `next-themes` 의 `defaultTheme="light"` 설정. 기존 다크 팔레트 유지하되 CSS 변수 `:root` (light) + `.dark` (dark) 재구성. programmers 지향 톤과 정합.

---

## 6. 최종 합의 — ADR-020 초안 범위

### 6.1 기술 스택 (Q14 확정 반영)

- **UI**: Tailwind CSS v3.4 + shadcn/ui + Radix + `cva` + `tailwind-merge` + `clsx`
- **테마**: `next-themes` + `<ThemeProvider attribute="class" defaultTheme="light" enableSystem>` + `suppressHydrationWarning`
- **darkMode**: `'class'`
- **CSS 변수 브리지**: 기존 `--bg`/`--fg`/`--accent` → Tailwind theme token 노출 (PR-2)
- **대안 보류** (§6.8): Mantine v7 / DaisyUI / Panda CSS

### 6.2 보안 기반 (CRITICAL 5건 반영 — R4 배포 전제)

1. **Sanitize + CSP + helmet** (C-B1)
   - 서버: `sanitize-html`
   - 클라: `react-markdown` + `rehype-sanitize`, `rehype-raw` 금지
   - `main.ts` `app.use(helmet())`
   - `next.config.js` `headers()` CSP + X-Content-Type-Options + Referrer-Policy

2. **httpOnly 쿠키 + refresh + CSRF** (C-B2, HIGH-1)
   - localStorage JWT 제거
   - httpOnly + SameSite=Strict + Secure
   - `/api/auth/refresh` 엔드포인트
   - CSRF double-submit token
   - **Q11=a 반영**: R4 PR 에 전부 번들

3. **Auth rate limit** (C-B3)
   - `@nestjs/throttler`
   - `/auth/login` IP 분당 5 / 15분 잠금
   - `/auth/register` IP 시간당 3
   - `RedisRateLimiter<{kind, key}>` 일반화

4. **Vote UNIQUE + self-vote + race** (C-B4)
   - `discussion_votes` PK `(user_id, target_type, target_id)` UNIQUE
   - ON CONFLICT DO UPDATE
   - DB CHECK `author_id <> voter_id`
   - 서버 ForbiddenException + 프론트 disabled
   - **Q13=a**: 가입 화이트리스트 제외

5. **pre-commit Layer 3-a3 재귀** (C-B5)
   - 패턴 `apps/api/src/**/prompts/*.prompt.ts`
   - `pii-regression.test.ts` discussion 경로 커버
   - "토론 Phase 1 = LLM 경로 0건" 명시

### 6.3 R4/R5/R6 스키마 + API (Q10=a 반영)

```typescript
// discussion_threads
//   id, question_id (FK), author_id (FK), title, body, score (cache),
//   post_count (cache), last_activity_at, is_deleted, created_at, updated_at
// discussion_posts
//   id, thread_id (FK), author_id (FK), parent_id (nullable, 1-level nested),
//   body, score (cache), is_accepted, is_deleted, created_at, updated_at
// discussion_votes
//   PK (user_id, target_type, target_id)
//   target_type ∈ {'thread', 'post'}
//   value ∈ {-1, +1}  (Q10=a: downvote 포함)
//   created_at
```

**API 엔드포인트** (9개):
```
GET    /api/discussion/questions/:questionId/threads?sort=hot|new|top&cursor=...
POST   /api/discussion/questions/:questionId/threads
GET    /api/discussion/threads/:threadId
PATCH  /api/discussion/threads/:threadId
DELETE /api/discussion/threads/:threadId
GET    /api/discussion/threads/:threadId/posts?parentId=...
POST   /api/discussion/threads/:threadId/posts
POST   /api/discussion/vote    body: { targetType, targetId, value: -1|0|1 }
POST   /api/discussion/posts/:postId/accept
```

**정책**:
- 중첩 깊이: **1-level nested**
- 삭제: **soft delete** (`is_deleted=true` + "[삭제된 게시물]" 치환)
- Score: 캐시 컬럼 + 트랜잭션 원자 증감
- Hot 정렬: `LOG(GREATEST(ABS(score), 1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000 DESC`
- **콘텐츠 중재** (HIGH-3): post 에 `related_question_id` FK. 미풀이 시 본문 블러. Admin `hide` + `ops_event_log(kind='forum_report')`.
- **페이지네이션** (HIGH-6): `limit ≤ 50`, cursor-based, server DTO 검증.

### 6.4 다크/라이트 토글 (Q15=b 반영)

- `next-themes` + `defaultTheme="light"` + `enableSystem` (OS 설정 존중)
- FOUC 방어: `next-themes` blocking script + CSP nonce
- CSS 변수 재구성:
  - `:root` = light 팔레트 (새로 정의)
  - `.dark` = 현재 팔레트 유지
- DB 저장은 backlog

### 6.5 접근성 WCAG 2.1 AA (필수)

- 1.4.3 대비비 ≥ 4.5:1 (light/dark 모든 조합 증명)
- 1.4.13 Content on Hover
- 2.1.1 Keyboard (shadcn Radix 기본 OK + custom onKeyDown)
- 2.4.7 Focus Visible (다크 테마 focus ring 별도 토큰)
- 4.1.2 Name/Role/Value (vote 버튼 aria-label, aria-pressed)
- 4.1.3 Status Messages (rate limit/에러 aria-live)

### 6.6 마이그레이션 전략 + PR 로드맵 (Q11=a 반영)

**전략**: 컴포넌트별 + Strangler Fig 혼합.

**PR 로드맵** (Q11=a 로 PR-6+PR-11 병합 → 총 **12 PR**):

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
| PR-10 | **(Q11=a 통합 PR)** httpOnly 쿠키 전환 + `/auth/refresh` + CSRF + R4 discussion 스키마/API + sanitize-html | PR-3, PR-6 | **C-B2 + C-B4 부분** | **3d** |
| PR-11 | R6 vote 엔드포인트 + UNIQUE + self-vote CHECK + race 테스트 | PR-10 | **C-B4** | 1d |
| PR-12 | discussion 페이지 + VoteButton + `/play/solo` "토론 참여" 링크 + rehype-sanitize | PR-10, PR-11, PR-9 | **C-B1** | 2.5d |

**총 추정**: 약 13일 풀타임. 세션당 1 PR 기준 12 세션.

**비상 탈출**: `FORUM_ENABLED=false` feature flag — 운영 중 긴급 차단용 (Q11=a 로 feature flag 필수는 아니나 방어선으로 유지).

### 6.7 채택 조건 (블로커)

ADR-020 이 **Accepted** 되려면 반드시:

1. CRITICAL 5건 전부 ADR 본문 §보안 섹션으로 명문화 (§6.2 전부)
2. **R4 배포 게이트**: PR-10 에 쿠키 전환 + R4 번들 확정 (Q11=a)
3. HIGH-3 (답지 유출 중재) + HIGH-6 (페이지네이션 DoS) 본문 반영
4. MED-2/3/4 (WORM 관계 / 닉네임 / user_token_hash 비저장) 스키마 DDL 동시 확인

### 6.8 유보 / 연기 항목

- **Mobile 375px 지원**: Q12=a 로 현재 범위 제외. 부트캠프 수강생 실기 환경 피드백 발생 시 재검토 (트리거: 실기 이탈 3회/주)
- **다계정 vote bomb 방어 강화**: Q13=a 로 기초만. vote bomb 실관측 시 이메일 검증 링크 / 초대 토큰 재도입 (트리거: 동일 IP 다계정 3명 이상)
- **Best answer UI 스타일**: PR-12 에 버튼만, 골드 테두리/배지는 후속 폴리시
- **SQL syntax highlighting (Shiki)**: PR-12 이후 별도 PR
- **Score cache 드리프트 복구 CLI**: MVP 이후 (관측 후)
- **실시간 반응 (Discord 스타일)**: MVP-C 이후 (별도 ADR)
- **Mantine / DaisyUI / Panda 재경쟁**: Q14=4 로 현재 기각. 유지보수 문제 발생 시 ADR-020-B 로 재검토
- **사용자 preference DB 저장**: 테마/닉네임 등. 멀티 디바이스 동기화 필요 시 별도 PR

---

## 7. 합의율 (정량)

| 분류 | 개수 | 비율 |
|------|------|------|
| 주요 결정 항목 수 | 27 | 100% |
| 완전 일치 (§3.1) | 10 | 37.0% |
| 부분 일치 (§3.2) | 7 | 25.9% |
| 불일치 (§3.3) | 2 | 7.4% |
| 누락 / 단독 지적 (§3.4) | 10 | (중복 집계) |
| **CRITICAL 격상 (단독 지적 → 채택)** | 5 | Session 4 룰 적용 |
| **사용자 Q 로 위임 → 확정** | 6 | 100% |

**합의율**: (10 + 7) / 27 = **63.0%**

- 단독 지적 CRITICAL 채택률: 5/5 = 100%
- Phase 0 덮어쓰기 제안 확정률: 6/6 = 100%

---

## 8. 합의율 패턴 관찰 (multi-agent-system-design §7.3 누적)

| consensus | 주제 | 완전 일치 | 부분 일치 | 합의율 | CRITICAL 단독 |
|-----------|------|-----------|-----------|--------|----------------|
| consensus-007 | 구현 세부 검증 (Session 6 grading) | ~25% | — | ~25% | 소수 |
| consensus-008 | 설계 결정 (SM-2) | ~37% | — | ~37% | 1건 |
| **consensus-009** | **설계 + 보안 통합 (UX 재설계)** | **37.0%** | **25.9%** | **63.0%** | **5건** |

### 관찰 메모

1. **이번 세션 특수성**: 설계 + 보안 + 운영 정책이 한꺼번에 들어간 최초 사례. 합의율은 크게 올랐으나 (63%) 단독 지적 CRITICAL 은 1 → 5 로 급증.
2. **합의율 상승 이유**: UI 스택 / 마이그레이션 / 스키마는 3 에이전트 합의 구간이 넓음.
3. **단독 지적 폭증 이유**: 보안 축은 Agent B 독점. **"다관점" 이 "다보안관점" 을 보장하지 않는다** 는 발견.
4. **Session 4 룰 재입증**: 다수결이었다면 CRITICAL 5건 모두 기각. Reviewer 축자 확인이 격상 근거. **"Reviewer 재분석 금지" 와 "단독 지적 축자 확인" 은 병립 가능** — 재분석이 아니라 근거 검증.
5. **부분 일치 증가**: 운영 정책 (downvote ROI, mobile 지원, 기본 테마) 은 각자 유효 의견 → §5 사용자 재확인 Q 가 6개로 늘어난 구조적 원인.
6. **권장 조정**: UX/운영/보안 교차 consensus 에서 "Agent B 에게 명시적 보안 단독 책임 부여" 패턴이 유효. 다른 Agent 는 자연스럽게 못 본다.

---

## 9. ADR-020 초안 진행 권장

- **Phase 0** (완료): 본 consensus-009 + 사용자 Q10~Q15 답변 확정
- **Phase 1** (진행): ADR-020 초안 작성 — §6 전체 반영 + Q10~Q15 확정 반영
- **Phase 2**: PR 로드맵 착수 — PR-1~7 (인프라 + 보안 기반) 선행 → PR-8~9 (UI 이전) → PR-10~12 (R4/R6/UI 연결)
- **Phase 3**: R4/R5/R6 사후 모니터링 — vote drift, XSS 회귀, WCAG AA 자동 검증, rate limit 히트율

---

## 10. Reviewer 판정 요약

- UI 스택 (Tailwind + shadcn/ui, Q14=4 반영) + 마이그레이션 (컴포넌트별 + Strangler) 은 **합의 완료**
- 보안 기반 5건은 **CRITICAL 전원 채택** (Agent B 단독, Reviewer 축자 확인)
- Phase 0 덮어쓰기 6건 (Q10~Q15) **사용자 확정 완료**
- **ADR-020 초안 Accepted 권고** — §6.7 채택 조건 충족 시
