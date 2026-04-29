# PR-12 — TDD Plan (Discussion Page)

> **본 문서는 PR-12 (web 토론 페이지) 의 TDD 단계 분해 + 신규 케이스 명세서다. SDD `pr-12-discussion-page-design.md` 와 1:1 매핑되며, 코드 PR 진입 시 RED→GREEN→REFACTOR 사이클의 가이드.**

| 메타 | 값 |
|------|-----|
| 합의 ID | consensus-012 (2026-04-29) |
| Phase 수 | 7 (Q-R5-08 분해 결과) |
| 추정 신규 cases | **약 95** (백엔드 30 + 웹 컴포넌트 50 + 통합 15) |
| 70% 커버리지 목표 | 백엔드 신규 80%+ / web 신규 75%+ |
| 의존 | PR-10a/10b/10c 머지 ✓ + 사용자 결정 15건 ✓ |

---

## 1. Phase 분해 (7단계, 의존 그래프)

```
Phase 1 — 백엔드 sanitize-schema 동등성 + Markdown 저장 패치 (CRITICAL C-1, C-2)
    │
    ▼
Phase 2 — 백엔드 hot/top raw query + sort 별 cursor 분기 + 마이그레이션 1714000012000 (CRITICAL C-4, HIGH H-2)
    │
    ▼
Phase 3 — 백엔드 myVote 응답 join + HIGH-3 서버 마스킹 + 비인증 read @Public() (CRITICAL C-3, C-5, HIGH H-1)
    │
    ▼
Phase 4 — web sanitize-schema 모듈 + DiscussionMarkdown + 76 OWASP 회귀 (CRITICAL C-1, C-2)
    │
    ▼
Phase 5 — web 컴포넌트 (ThreadCard / PostTree / VoteButton / RelatedQuestionBlur 등 11종)
    │
    ▼
Phase 6 — web 페이지 라우트 2종 + SWR + /play/solo finished CTA + Hero todayQuestion 칩
    │
    ▼
Phase 7 — axe-core 통합 + 외부 노트북 (Tailscale) 검증 + 모바일 fallback (HIGH H-5, MED M-3)
```

---

## 2. Phase 1 — 백엔드 sanitize-schema 동등성 + Markdown 저장

### 2.1 RED 작성 케이스 (8건)

| # | 파일 | 케이스 | 검증 |
|---|------|------|------|
| 1.1 | `sanitize-post-body.test.ts` (확장) | "Markdown 본문 raw 저장 — `<script>` 토큰 거부" | 입력 `# 제목\n<script>alert(1)</script>` → strip 후 저장 |
| 1.2 | 동상 | "rehype-raw 미사용 — markdown raw HTML 통과 차단" | 입력 `[click](javascript:alert(1))` → href 무효화 |
| 1.3 | 동상 | "data: URL scheme 차단" | 입력 `[x](data:text/html,...)` → href 무효화 |
| 1.4 | 동상 | "mailto: scheme 허용" | 입력 `[email](mailto:a@b.c)` → 통과 |
| 1.5 | 동상 | "백엔드 화이트리스트 — `<details>` 등 default schema 외 태그 strip" | 입력 `<details><summary>x</summary>y</details>` → text 만 |
| 1.6 | 동상 | "백엔드 sanitizeTitle — Markdown 안의 HTML strip" | 입력 `<b>title</b>` → `title` |
| 1.7 | 동상 | "OWASP 50종 회귀 — `<svg onload=>`, `<iframe srcdoc=>` 등" | 76 cases (PR-10b 76 + 12 markdown 특화 - 12 중복) |
| 1.8 | 동상 | "Markdown 본문 길이 BODY_MAX(20000) 검증" | 길이 20001 시 BadRequestException |

### 2.2 GREEN 구현

`apps/api/src/modules/discussion/sanitize-post-body.ts` 패치:
- `sanitizePostBody(input: string): string` — Markdown raw 입력 가정. `<script>`, `<iframe>`, `<object>`, `on*=` 등 위험 토큰 strip + `disallowedTagsMode: 'discard'`.
- ADR-020 §4.2.1 C 패치 결과 인용.

### 2.3 REFACTOR

- `discussion-sanitize-tokens.ts` 분리 — 위험 토큰 정규식 모듈화.
- pre-commit Layer 3-a3 재귀 (PR-7) 자동 커버 (신규 파일이 `apps/api/src` 하위라).

### 2.4 통과 기준

- 8 신규 케이스 GREEN.
- 기존 76 OWASP 케이스 회귀 0.
- `apps/api` 빌드 + typecheck OK.

---

## 3. Phase 2 — 백엔드 hot/top raw query + sort 별 cursor + expression index

### 3.1 RED 작성 케이스 (12건)

| # | 파일 | 케이스 | 검증 |
|---|------|------|------|
| 2.1 | `discussion.service.test.ts` (확장) | `sort=new` 정렬 — 기존 케이스 회귀 | createdAt DESC + id DESC tie-break |
| 2.2 | 동상 | `sort=top` 정렬 — score DESC + id DESC tie-break | score 동률 시 id 안정성 |
| 2.3 | 동상 | `sort=hot` 정렬 — Reddit log10 공식 | hot value 계산 정확성 (3 thread 가정) |
| 2.4 | 동상 | `sort=new` cursor `{c, i}` 안정성 | 다음 페이지 1건 fetch + 누락 0 |
| 2.5 | 동상 | `sort=top` cursor `{s, i}` 안정성 | 다음 페이지 stable |
| 2.6 | 동상 | `sort=hot` cursor `{h, i}` 안정성 | hot value tie-break |
| 2.7 | 동상 | `sort` 화이트리스트 — `'invalid'` 시 BadRequest | enum 검증 |
| 2.8 | 동상 | `limit ≤ 50` 제약 (HIGH-6) | 100 요청 → 50 capped |
| 2.9 | 동상 | empty result | thread 0건 시 빈 배열 |
| 2.10 | 동상 | SQL injection 회귀 — sort 파라미터 escape | `'; DROP TABLE'` → BadRequest (enum 차단) |
| 2.11 | `1714000012000-AddDiscussionHotIndex.test.ts` (신규) | expression index 적용 + EXPLAIN 검증 | `idx_discussion_threads_hot` 사용 확인 |
| 2.12 | 동상 | down 마이그레이션 idempotent | 재실행 시 IF EXISTS 처리 |

### 3.2 GREEN 구현

- `discussion.service.ts:124-144` 의 `listThreadsByQuestion` 확장 (SDD §5.2 코드 참조).
- `decodeCursor(cursor, sort)` controller 헬퍼 — sort 별 schema 분기 (`{c,i}` / `{s,i}` / `{h,i}`).
- 마이그레이션 1714000012000 추가.
- enum 검증 — controller `@Query('sort')` 에 `IsIn(['new','hot','top'])` DTO 적용.

### 3.3 REFACTOR

- 정렬 표현식을 `discussion-sort-expressions.ts` 분리.
- cursor 인코더/디코더를 `cursor.ts` 모듈로 분리 + sort 별 분기 시그니처.

### 3.4 통과 기준

- 12 신규 케이스 GREEN. 기존 listThreadsByQuestion 케이스 회귀 0.
- `EXPLAIN ANALYZE` 결과 expression index 사용 (sort=hot 시).
- 마이그레이션 dry-run + rollback 검증.

---

## 4. Phase 3 — myVote join + HIGH-3 마스킹 + 비인증 read

### 4.1 RED 작성 케이스 (10건)

| # | 파일 | 케이스 | 검증 |
|---|------|------|------|
| 3.1 | `discussion.service.test.ts` | listThreads 응답에 `myVote` join (인증 사용자) | -1/0/+1 정확 |
| 3.2 | 동상 | listThreads `myVote` 비인증 = undefined | userId null 시 미포함 |
| 3.3 | 동상 | getThread `myVote` join | 단일 응답 |
| 3.4 | 동상 | listPosts `myVote` join (각 post 별) | post.myVote 정확 |
| 3.5 | `discussion-blur.test.ts` (신규) | HIGH-3 마스킹 — 풀이 안 한 user | body=`[[BLUR:related-question]]` + isLocked:true |
| 3.6 | 동상 | HIGH-3 — 풀이한 user (user_progress row 존재) | 본문 그대로 |
| 3.7 | 동상 | HIGH-3 — author 본인 | always unmasked |
| 3.8 | 동상 | HIGH-3 — 비인증 read (게스트 미리보기) | 모든 본문 공개 (Q-R5-11=a) |
| 3.9 | 동상 | HIGH-3 — related_question_id null | 비대상, 그대로 |
| 3.10 | 동상 | HIGH-3 — N+1 회피 (단일 쿼리) | post 30개 → user_progress 1 query |

### 4.2 GREEN 구현

- `applyMaskAndBlur(entity, userId)` private 헬퍼 (SDD §6.2).
- `checkUserProgress(userId, relatedQuestionId)` — single query (questions JOIN user_progress).
- `listPostsByThread` 의 N+1 회피 — `IN (UNNEST([]))` 단일 쿼리 (SDD §6.3).
- read endpoint 4종에 `@Public()` 데코레이터 + JwtAuthGuard 의 옵셔널 user attach.
- `apps/api/src/modules/auth/decorators/public.decorator.ts` 신규.

### 4.3 RED 작성 케이스 — 비인증 read (8건)

| # | 파일 | 케이스 | 검증 |
|---|------|------|------|
| 3.11 | `discussion.controller.test.ts` (확장) | `@Public()` 적용 — listThreads 비인증 200 | guard 통과 |
| 3.12 | 동상 | `@Public()` 적용 — getThread 비인증 200 | 동상 |
| 3.13 | 동상 | `@Public()` 적용 — listPosts 비인증 200 | 동상 |
| 3.14 | 동상 | write endpoint POST 비인증 401 | createThread / createPost / castVote 모두 |
| 3.15 | 동상 | write endpoint PATCH 비인증 401 | updateThread / updatePost |
| 3.16 | 동상 | write endpoint DELETE 비인증 401 | deleteThread / deletePost |
| 3.17 | 동상 | accept endpoint 비인증 401 | author only |
| 3.18 | `auth.guards.test.ts` (확장) | JwtAuthGuard `IS_PUBLIC_KEY` 분기 — req.user null 통과 | 옵셔널 attach |

### 4.4 통과 기준

- 18 신규 케이스 GREEN.
- 기존 discussion.controller / .service 케이스 회귀 0.
- read 비인증 통과 + write 비인증 차단 일관.

---

## 5. Phase 4 — web sanitize-schema + DiscussionMarkdown + 76 OWASP 회귀

### 5.1 RED 작성 케이스 (10건)

| # | 파일 | 케이스 | 검증 |
|---|------|------|------|
| 4.1 | `apps/web/src/lib/discussion/sanitize-schema.test.ts` | discussionSchema.tagNames 12종 정확 | SDD §4.3 list |
| 4.2 | 동상 | discussionSchema.attributes a[href,title] 만 | 외 태그 attribute 0 |
| 4.3 | 동상 | discussionSchema.protocols http/https/mailto | data:/javascript: 거부 |
| 4.4 | 동상 | 서버 sanitize-post-body.ts 와 1:1 매칭 (parseable) | 서버 코드 import 후 동등성 |
| 4.5 | `apps/web/src/components/discussion/__tests__/DiscussionMarkdown.test.tsx` | `<DiscussionMarkdown>` 기본 렌더 | `# 제목\n본문` → h1 + p |
| 4.6 | 동상 | `<a href="javascript:..">` 차단 | href 무효화 + clobber |
| 4.7 | 동상 | inline `<script>` 토큰 strip | 텍스트 노드 |
| 4.8 | 동상 | rehype-raw 미사용 — raw HTML 통과 차단 | `<details>` text 만 |
| 4.9 | `sanitize-regression.test.tsx` (신규) | OWASP 50종 negative — 25종 위험 토큰 비잔존 | rendered HTML 정규식 검증 |
| 4.10 | 동상 | react-markdown 특화 12종 — autolink XSS / footnote 등 | 동상 |

### 5.2 GREEN 구현

- `apps/web/src/lib/discussion/sanitize-schema.ts` (SDD §4.3 코드).
- `apps/web/src/components/discussion/DiscussionMarkdown.tsx` (SDD §4.6 코드).
- 76 OWASP 페이로드는 PR-10b 의 `apps/api/src/modules/discussion/sanitize-post-body.test.ts` 에서 import 또는 fixture 공유.

### 5.3 REFACTOR

- 76 페이로드를 `apps/web/src/__fixtures__/owasp-xss-payloads.ts` 에 분리 (백엔드와 공유 가능).

### 5.4 통과 기준

- 10 신규 케이스 GREEN.
- 76 OWASP 회귀 100%.
- `apps/web` typecheck + build OK.

---

## 6. Phase 5 — web 컴포넌트 (11종)

### 6.1 RED 작성 케이스 (30건)

#### 6.1.1 ThreadCard (5)

| # | 케이스 | 검증 |
|---|------|------|
| 5.1.1 | 시안 D 글라스 톤 (className `glass-panel`) | className 검증 |
| 5.1.2 | 제목 + 작성자 + 시간 + 점수 + post count 표시 | 5종 필드 |
| 5.1.3 | isAccepted=true 시 `<AcceptedBadge>` | 조건부 |
| 5.1.4 | isDeleted=true 시 `<DeletedPlaceholder>` 대체 | 조건부 |
| 5.1.5 | 클릭 시 `/play/solo/[questionId]/discussion/[threadId]` 라우팅 | next/link |

#### 6.1.2 ThreadList (4)

| # | 케이스 | 검증 |
|---|------|------|
| 5.2.1 | thread N개 → ThreadCard N개 렌더 | map |
| 5.2.2 | empty 시 `<EmptyDiscussion>` | 0건 |
| 5.2.3 | cursor 다음 페이지 fetch 트리거 (intersection observer) | scroll |
| 5.2.4 | sort 변경 시 SWR mutate (key 변경) | revalidate |

#### 6.1.3 ThreadSortTabs (3)

| # | 케이스 | 검증 |
|---|------|------|
| 5.3.1 | new/hot/top 3-tab 렌더 | shadcn Tabs |
| 5.3.2 | URL `?sort=hot` query sync | searchParams |
| 5.3.3 | aria-controls + role=tablist + 키보드 ←→ 이동 | Radix 자동 |

#### 6.1.4 VoteButton (8)

| # | 케이스 | 검증 |
|---|------|------|
| 5.4.1 | 3-state (-1/0/+1) 토글 | optimistic |
| 5.4.2 | optimistic mutate + 서버 응답 동기화 | SWR mutate |
| 5.4.3 | 서버 거부 (self-vote 403) → rollback | toast 한국어 |
| 5.4.4 | rate limit 429 → rollback + 한국어 토스트 | "분당 5회 한도" |
| 5.4.5 | aria-pressed + aria-label="추천 N개" | a11y |
| 5.4.6 | 비인증 클릭 → `/login?next=...` redirect | next/navigation |
| 5.4.7 | 자기 thread/post 의 vote → 비활성 (disabled) | service 가 self-vote 차단 |
| 5.4.8 | finalScore 응답 동기화 (다탭) | mutate refresh |

#### 6.1.5 PostTree + PostNode (4)

| # | 케이스 | 검증 |
|---|------|------|
| 5.5.1 | 1-level nested 렌더 | parent + children |
| 5.5.2 | depth 2+ 시도 → BadRequest 처리 (백엔드 의존) | unit test mock |
| 5.5.3 | isAccepted post 골드 테두리 (시안 D 톤) | className |
| 5.5.4 | post.isLocked → `<RelatedQuestionBlur>` | 조건부 |

#### 6.1.6 ThreadComposer + PostComposer (3)

| # | 케이스 | 검증 |
|---|------|------|
| 5.6.1 | shadcn Textarea + 최대 20000자 검증 | maxLength + zod |
| 5.6.2 | submit 시 SWR mutate (cache update) | 즉시 반영 |
| 5.6.3 | 서버 검증 실패 시 한국어 에러 메시지 | toast |

#### 6.1.7 RelatedQuestionBlur (3)

| # | 케이스 | 검증 |
|---|------|------|
| 5.7.1 | blur(8px) + 시안 D 글라스 패널 | 시각 |
| 5.7.2 | "문제 풀러 가기" 링크 → `/play/solo/[relatedQuestionId]` | next/link |
| 5.7.3 | aria-label + role=region | a11y |

### 6.2 GREEN 구현

SDD §2.2 파일 트리에 따라 11 컴포넌트 작성. 시안 D 글라스 톤 일관 — `glass-panel` / `glass-button` Tailwind utility 재사용 (concept-d §5.4).

### 6.3 REFACTOR

- 공통 패턴 추출 — `useDiscussionApi()` 훅 (SWR fetcher + mutator).
- `formatRelativeTime()` 유틸 분리.

### 6.4 통과 기준

- 30 신규 케이스 GREEN.
- React Testing Library 마운트 + 사용자 상호작용 검증.

---

## 7. Phase 6 — web 페이지 라우트 + SWR + CTA 추가

### 7.1 RED 작성 케이스 (15건)

#### 7.1.1 페이지 라우트 (6)

| # | 케이스 | 검증 |
|---|------|------|
| 6.1.1 | `/play/solo/[questionId]/discussion` 페이지 마운트 | params.questionId UUID 검증 |
| 6.1.2 | 잘못된 questionId (UUID 아님) → 404 | notFound() |
| 6.1.3 | `/play/solo/[questionId]/discussion/[threadId]` 마운트 | params.threadId UUID |
| 6.1.4 | thread 미존재 → notFound | API 404 → next notFound |
| 6.1.5 | Server Component shell + Client child mount | hydration |
| 6.1.6 | Suspense + loading.tsx fallback | RSC |

#### 6.1.2 SWR 통합 (4)

| # | 케이스 | 검증 |
|---|------|------|
| 6.2.1 | useSWR fetcher + credentials:include | api-client.ts 의 inflightRefresh 와 호환 |
| 6.2.2 | revalidateOnFocus 활성 | 다탭 동기화 |
| 6.2.3 | optimistic mutate + rollback | VoteButton 통합 |
| 6.2.4 | 401 시 자동 refresh + 재시도 | api-client.ts |

#### 6.1.3 CTA 추가 (5)

| # | 케이스 | 검증 |
|---|------|------|
| 6.3.1 | `/play/solo` finished phase round 별 "토론 보기" 링크 N개 | rounds.map |
| 6.3.2 | round.discussionCount 표시 (메타) | API 신규 필드 |
| 6.3.3 | `<HeroLivePanel>` todayQuestion.discussionCount > 0 시 메타 칩 | 조건부 |
| 6.3.4 | discussionCount = 0 시 칩 미표시 (silent) | 0 case |
| 6.3.5 | 비인증 사용자 — 칩은 표시 + 클릭 시 read-only 페이지 진입 | 게스트 미리보기 |

### 7.2 GREEN 구현

- 페이지 2종 + Server Component shell + Client child (SDD §2.3).
- SWR fetcher = `apps/web/src/lib/discussion/api-client.ts`.
- `/play/solo/page.tsx` finished phase 패치.
- `<HeroLivePanel>` 메타 칩 추가.
- API 응답에 `discussionCount` 필드 추가 (백엔드 patch — listThreadsByQuestion 결과 길이 또는 별도 endpoint).

### 7.3 통과 기준

- 15 신규 케이스 GREEN.
- 외부 노트북 (Tailscale) 에서 페이지 mount + SWR fetch + vote → optimistic 즉시 반영 검증.

---

## 8. Phase 7 — axe-core 통합 + 외부 검증 + 모바일 fallback

### 8.1 RED 작성 케이스 (10건)

| # | 케이스 | 검증 |
|---|------|------|
| 7.1 | `discussion-a11y.test.tsx` (신규) — `<ThreadList>` axe 0 violation | @axe-core/react |
| 7.2 | `<ThreadDetail>` axe 0 violation | 동상 |
| 7.3 | `<VoteButton>` axe 0 violation (aria-pressed) | 동상 |
| 7.4 | `<RelatedQuestionBlur>` axe 0 violation (role=region) | 동상 |
| 7.5 | `<ThreadComposer>` axe 0 violation (label + autocomplete) | 동상 |
| 7.6 | 모바일 (375px) ThreadList 1 column | media query |
| 7.7 | 모바일 ThreadDetail PostTree indent 축소 | 동상 |
| 7.8 | 모바일 VoteButton sticky 하단 | 동상 |
| 7.9 | 키보드 — Tab 순서 (sort tab → thread → vote → composer) | 키보드 |
| 7.10 | 키보드 — Enter 로 thread 진입 | router |

### 8.2 GREEN 구현

- `apps/web/src/__a11y__/setup.ts` — `@axe-core/react` dev 모드 통합 (production strip).
- `vitest-axe` 매처 도입 — `expect(await axe(container)).toHaveNoViolations()`.
- 모바일 Tailwind `md:` prefix 매핑 (시안 D §13.x grid-cols-1 fallback).

### 8.3 외부 노트북 검증 (수동)

- Tailscale `100.102.41.122:3002` 접근.
- 라이트/다크 토글 양쪽 axe DevTools.
- 키보드 풀 플로우 (Tab + ←→ + Enter).
- vote 클릭 → optimistic 즉시 반영 시각 확인.
- Origin guard 통과 (PR-10c) — Network 탭에서 200 응답 확인.

### 8.4 통과 기준

- 10 신규 케이스 GREEN.
- axe DevTools (라이트/다크) 0 violation.
- 외부 노트북 풀 플로우 통과.
- 모바일 breakpoint 시각 검증.

---

## 9. 신규 케이스 합계

| Phase | 케이스 수 | 누적 |
|-------|---------|------|
| Phase 1 | 8 | 8 |
| Phase 2 | 12 | 20 |
| Phase 3 | 18 (10 + 8) | 38 |
| Phase 4 | 10 | 48 |
| Phase 5 | 30 | 78 |
| Phase 6 | 15 | 93 |
| Phase 7 | 10 | 103 |

**총 신규 ~103 cases**. 기존 1218+1s → **1318~1330+1s** 예상 (백엔드 38 + web 65).

---

## 10. 커버리지 측정

### 10.1 백엔드 신규 코드

- 신규 LOC: hot/top raw query (~80) + HIGH-3 마스킹 (~50) + @Public() 데코레이터 (~30) + 마이그레이션 (~30) = **~190 LOC**.
- 신규 테스트: 38 cases.
- 예상 커버리지: **80%+** (논리 분기 모두 커버).

### 10.2 web 신규 코드

- 신규 LOC: 컴포넌트 11종 (~600) + 페이지 2종 (~150) + lib (~150) + 시안 D 톤 통합 (~50) = **~950 LOC**.
- 신규 테스트: 65 cases.
- 예상 커버리지: **75%+** (시각 컴포넌트 일부 unit 한계 — 시각은 외부 노트북 검증).

### 10.3 측정 명령

```bash
# 백엔드
cd apps/api && npm run test -- --coverage --testPathPattern="discussion"

# web
cd apps/web && npm run test -- --coverage --testPathPattern="discussion"
```

---

## 11. RED → GREEN → REFACTOR 사이클 시간 추정

| Phase | RED | GREEN | REFACTOR | 합계 |
|-------|-----|-------|----------|------|
| 1 | 30분 | 1시간 | 30분 | 2시간 |
| 2 | 1시간 | 2시간 | 30분 | 3.5시간 |
| 3 | 1.5시간 | 2시간 | 30분 | 4시간 |
| 4 | 1시간 | 1시간 | 30분 | 2.5시간 |
| 5 | 3시간 | 4시간 | 1시간 | 8시간 |
| 6 | 2시간 | 3시간 | 30분 | 5.5시간 |
| 7 | 1시간 | 2시간 | 30분 | 3.5시간 |
| **합계** | **10시간** | **15시간** | **4시간** | **29시간 ≈ 3.5일** |

ADR-020 §6 추정 2.5d → **실제 3.5d 추정** (시안 D 톤 일관성 + axe-core 통합 + 외부 검증 포함).

---

## 12. 중간 commit 단위

### 12.1 추천 commit 구조 (코드 PR 단계)

```
1. (Phase 1) feat(discussion): Markdown raw 저장 + sanitize 화이트리스트 패치 (8 RED → 8 GREEN)
2. (Phase 2) feat(discussion): hot/top raw query + sort 별 cursor + expression index (12 RED → GREEN)
3. (Phase 3a) feat(discussion): myVote join 응답 (4 cases)
4. (Phase 3b) feat(discussion): HIGH-3 서버 마스킹 + N+1 회피 (6 cases)
5. (Phase 3c) feat(discussion): 비인증 read 허용 + @Public 데코레이터 (8 cases)
6. (Phase 4) feat(web): sanitize-schema 모듈 + DiscussionMarkdown + 76 OWASP 회귀 (10 cases)
7. (Phase 5a) feat(web): ThreadCard / ThreadList / ThreadSortTabs (12 cases)
8. (Phase 5b) feat(web): VoteButton + AcceptedBadge + DeletedPlaceholder (10 cases)
9. (Phase 5c) feat(web): PostTree + PostNode + Composer 2종 (8 cases)
10. (Phase 5d) feat(web): RelatedQuestionBlur (3 cases)
11. (Phase 6a) feat(web): /play/solo/[questionId]/discussion 라우트 + SWR (10 cases)
12. (Phase 6b) feat(web): /play/solo finished CTA + Hero todayQuestion 칩 (5 cases)
13. (Phase 7) feat(web): axe-core 통합 + 모바일 fallback + a11y 회귀 (10 cases)
14. chore(deps): react-markdown ^9 + rehype-sanitize ^6 + swr ^2 + @radix-ui/react-tabs + @axe-core/react
```

### 12.2 단일 PR vs 분할

ADR-020 §6 PR-12 행 = **단일 PR**. 14 commit 누적 후 `feature/pr-12-discussion-page-code` 브랜치에서 단일 PR open.

---

## 13. 통과 게이트 (PR 머지 전 체크리스트)

- [ ] Phase 1~7 신규 ~103 cases 모두 GREEN
- [ ] 기존 1218+1s 회귀 0 (총 ~1320+1s)
- [ ] 백엔드 신규 커버리지 80%+
- [ ] web 신규 커버리지 75%+
- [ ] axe DevTools (라이트/다크) 0 violation
- [ ] 외부 노트북 (Tailscale) 풀 플로우 검증 (vote / sort 전환 / blur / 새로고침 / refresh 토큰 만료 + 자동 갱신)
- [ ] PR-10c Origin guard 통과 (Network 탭 검증)
- [ ] 모바일 breakpoint (375px) 시각 검증
- [ ] 마이그레이션 1714000012000 dry-run + rollback OK
- [ ] CSP 호환 — react-markdown 출력에 inline `<script>` 0
- [ ] CRITICAL 5건 모두 해소 (Q-R5-01/02/03/06/11)

---

## 14. 위험 + 완화

| 위험 | 가능성 | 완화 |
|------|------|-----|
| Phase 5 컴포넌트 11종이 시간 초과 | 중 | sub-commit 별 머지 (12.1 참조) |
| react-markdown v9 의 breaking change | 낮음 | lock + minor 만 자동 |
| HIGH-3 N+1 회피 쿼리 성능 | 낮음 | EXPLAIN ANALYZE 검증 + posts 30+ 가정 |
| 외부 노트북 Tailscale 환경 변경 | 낮음 | impact §통신 흐름 명시 |
| axe-core production 번들 포함 | 낮음 | dev mode strip 검증 (NODE_ENV=production 빌드 후 grep) |

---

**TDD plan 끝.** 코드 PR 진입 시 본 분해 그대로 RED → GREEN → REFACTOR.
