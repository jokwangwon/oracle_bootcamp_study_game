# PR-12 — 변경 영향 분석 (ADR-007 SYSTEM 4차원)

> **본 문서는 PR-12 (web 토론 페이지) 의 변경 영향 분석서다. ADR-007 SYSTEM 4차원 (의존성 / 장애 / 통신 / 데이터) 매핑 + 자동 분류.**

| 메타 | 값 |
|------|-----|
| 합의 ID | consensus-012 (2026-04-29) |
| 분류 | **HIGH** (web 신규 페이지 + 백엔드 raw query + 마이그레이션 + 신규 의존성 6종) |
| ADR | ADR-007 (변경 영향 분석) §3 SYSTEM 4차원 |
| 의존 PR | PR-10a / 10b / 10c 모두 머지 ✓ |
| 후속 분리 | ADR-021 (Community Hub, 가칭) + chore/auth-storage-cleanup |

---

## 1. 분류 (ADR-007 §4 자동 분류)

| 차원 | 영향 | 분류 점수 | 비고 |
|------|------|----------|------|
| ① 의존성 | 신규 의존성 6종 + shadcn primitive 2종 | 3/3 | 외부 패키지 + 내부 모듈 신설 |
| ② 장애 | discussion 도메인 SPOF + 마이그레이션 + read 가드 변경 | 2/3 | rollback 가능 |
| ③ 통신 | Tailscale + PR-10c Origin guard + Cookie httpOnly | 1/3 | same-origin 전제 |
| ④ 데이터 | DB 스키마 변경 0 + expression index 추가 + 응답 schema 확장 | 2/3 | 무손실 |
| **합계** | **8/12** | **HIGH** | docs PR + 코드 PR 분리 권장 |

---

## 2. 차원 ① 의존성

### 2.1 신규 외부 의존성 (6종)

| 패키지 | 버전 | 라이선스 | gzip | 영향 |
|--------|-----|---------|------|------|
| `react-markdown` | `^9.0.1` | MIT | 30KB | web `apps/web/package.json` |
| `rehype-sanitize` | `^6.0.0` | MIT | 6KB | 동상 |
| `swr` | `^2.2.5` | MIT | 13KB | 동상 |
| `@radix-ui/react-tabs` | `^1.0.4` | MIT | 5KB | shadcn Tabs primitive |
| `@axe-core/react` | `^4.8.0` | MPL-2.0 | 35KB (dev only) | dev mode strip |
| `vitest-axe` | `^0.1.0` | MIT | 8KB (dev only) | 테스트 매처 |

**총 production 번들 추가**: ~54KB gzip. `/play/solo/[questionId]/discussion` 페이지 lazy load 시 first-page 부담 0 (route-level chunk).

**총 dev 번들 추가**: ~43KB. production strip 검증 필수 (Phase 7 게이트).

### 2.2 신규 shadcn/ui 컴포넌트 (2종)

```bash
pnpm dlx shadcn-ui@latest add tabs textarea
```

생성 파일:
- `apps/web/src/components/ui/tabs.tsx`
- `apps/web/src/components/ui/textarea.tsx`

영향: 타 페이지에서도 재사용 가능 (예: `/review/mistakes` future enhancement).

### 2.3 내부 모듈 신설 (apps/web)

| 디렉토리 | 신규 파일 수 | 합계 LOC |
|---------|-----------|--------|
| `apps/web/src/app/play/solo/[questionId]/discussion/` | 4 (page + Client child + loading + error) | ~150 |
| `apps/web/src/app/play/solo/[questionId]/discussion/[threadId]/` | 4 | ~150 |
| `apps/web/src/components/discussion/` | 14 (11 컴포넌트 + 3 테스트) | ~700 |
| `apps/web/src/lib/discussion/` | 6 (schema + types + cursor + api-client + 테스트 2) | ~250 |

**총 web 신규 ~1250 LOC**.

### 2.4 내부 모듈 신설 (apps/api)

| 위치 | 신규 LOC |
|------|--------|
| `discussion.service.ts` 확장 (hot/top raw query + HIGH-3 마스킹) | +130 |
| `discussion.controller.ts` 패치 (`@Public()` 데코레이터 + cursor 분기) | +40 |
| `apps/api/src/modules/auth/decorators/public.decorator.ts` (신규) | +15 |
| JwtAuthGuard 확장 (IS_PUBLIC_KEY 분기) | +20 |
| 마이그레이션 1714000012000 | +30 |
| 신규 테스트 38 cases | +400 |

**총 api 신규 ~635 LOC**.

### 2.5 영향 받는 모듈

```
apps/web/src/app/page.tsx               ← Hero todayQuestion 칩 추가
apps/web/src/components/home/           ← hero-live-panel.tsx 메타 칩
apps/web/src/app/play/solo/page.tsx     ← finished phase round 별 CTA
apps/web/src/lib/api-client.ts          ← (영향 없음, SWR fetcher 가 활용)
apps/api/src/modules/discussion/         ← 전면 확장
apps/api/src/modules/auth/               ← Public 데코레이터 + JwtAuthGuard 확장
apps/api/src/modules/users/              ← (영향 없음, user_progress entity 그대로)
apps/api/src/migrations/                 ← 1714000012000 추가
```

### 2.6 신규 환경 변수

**없음**. PR-12 는 환경 변수 변경 없음.

---

## 3. 차원 ② 장애

### 3.1 SPOF 분석

| 컴포넌트 | SPOF 등급 | 영향 범위 | 완화 |
|---------|---------|---------|-----|
| `discussion.service.listThreadsByQuestion` (hot/top raw query) | 중 | 모든 토론 리스트 페이지 | expression index + EXPLAIN 검증 |
| `discussion.service.applyMaskAndBlur` (HIGH-3 마스킹) | 낮음 | post 응답 latency +3ms | 단일 쿼리 회피 |
| `react-markdown` 렌더 | 낮음 | 클라 측, 페이지 단위 격리 | error boundary |
| SWR fetcher | 낮음 | 토론 페이지만 | useEffect 격리 |
| 마이그레이션 1714000012000 | 중 | 운영 환경 1회 (1만 thread = 수초) | maintenance window |

### 3.2 회귀 위험

- **discussion.controller.ts:114-116** 의 `@UseGuards(JwtAuthGuard, ThrottlerGuard)` 패치 — `@Public()` 데코레이터 도입. **JwtAuthGuard 의 IS_PUBLIC_KEY 분기 미적용 시 read 4종이 401 으로 회귀**. Phase 3.18 케이스가 회귀 검증.
- **discussion.service.ts:138-142** 의 `Repository.find` → `createQueryBuilder` 전환. 기존 `sort=new` 케이스 회귀 검증 필수 (Phase 2.1).
- **listPostsByThread** 의 N+1 회피 쿼리가 `IN ANY([])` empty 시 SQL syntax 오류 가능 — Phase 3.10 의 `relatedIds.length === 0` early return 으로 회피.
- **expression index** 가 synchronize:true 환경에서 매 부팅 시 재생성 시도 가능 — `IF NOT EXISTS` 로 idempotent.

### 3.3 외부 의존성 장애

- `react-markdown` 의 미래 CVE → npm audit + Renovate alert. lock 버전 명시.
- `rehype-sanitize` default schema 의 미래 변경 → minor 업데이트 시에도 schema 검증 회귀 필수.

### 3.4 Rollback 시나리오

| 시나리오 | rollback 방법 | 영향 |
|---------|------------|-----|
| 마이그레이션 1714000012000 부작용 | `npm run migration:revert` (DROP INDEX) | 0 (index 만 drop) |
| @Public() 데코레이터 부작용 | discussion.controller.ts revert | 비인증 read 차단 (회귀) |
| react-markdown CVE | 의존성 hotfix patch | npm patch |
| 신규 페이지 결함 | feature flag (현 ADR-020 미정의 — chore PR) 또는 revert | 0 |

---

## 4. 차원 ③ 통신 흐름

### 4.1 신규 호출 경로

```
Browser (Tailscale 100.102.41.122:3002)
    │  Cookie: access (httpOnly, secure if production, SameSite=Lax)
    │  Cookie: refresh (path=/api/auth/refresh, httpOnly)
    ▼
Next.js (apps/web, port 3002)
    │  /play/solo/[questionId]/discussion
    │  - Server Component shell (no API call)
    │  - Client Component (SWR + fetch via api-client.ts)
    ▼
NestJS (apps/api, port 3001 or via reverse proxy)
    │  CORS_ORIGIN check (PR-10c OriginGuard 글로벌)
    │  ThrottlerGuard (60/min read, 5/min write)
    │  JwtAuthGuard (write 만, read 는 @Public())
    ▼
DiscussionService
    │  Repository / QueryBuilder / raw query (SQL injection 면역)
    ▼
PostgreSQL
    │  expression index `idx_discussion_threads_hot` (sort=hot 시)
    │  partial index `idx_discussion_threads_question_activity` (sort=new)
    │  WHERE is_deleted=FALSE (모든 read)
```

### 4.2 PR-10c Origin guard 호환

- **same-origin**: web → api 호출이 `apps/web` 의 fetch 로 발생 → `Origin: http://100.102.41.122:3002` 헤더 자동 송신.
- `CORS_ORIGIN=http://100.102.41.122:3002` 매칭 → OriginGuard 통과.
- write endpoint (POST /api/discussion/vote 등) 도 동일 origin → 통과.
- **외부 cross-origin** (악성 사이트의 fetch) → Origin 불일치 → 차단.

### 4.3 PR-10a Cookie httpOnly 호환

- 모든 fetch 가 `credentials: 'include'` (api-client.ts:121-128).
- 401 시 자동 refresh interceptor (PR-10a) → POST /api/auth/refresh → 신규 access cookie 설정 → 원 요청 재시도.
- **비인증 read 분기** — JwtAuthGuard 가 IS_PUBLIC_KEY 시 user 부재 통과 → req.user = undefined → service 에서 userId = null.

### 4.4 SWR + 다탭 동기화

- SWR `revalidateOnFocus: true` (default) → 다탭 vote 시 다른 탭 포커스 복귀 시 자동 revalidate.
- `mutate(key)` 명시 호출 — 같은 탭 내 다른 컴포넌트의 cache 갱신.

### 4.5 ThrottlerGuard 분기

| Endpoint | Throttle | 유효 |
|---------|---------|------|
| `GET /threads`, `GET /threads/:id`, `GET /posts` | 60/min (default) | read 모두 |
| `POST /threads`, `POST /posts`, `POST /vote`, `POST /accept`, `PATCH /*`, `DELETE /*` | `discussion_write: 5/min` (named) | write 모두 |

**비인증 read 도 ThrottlerGuard 적용** — IP 기반 throttle.

---

## 5. 차원 ④ 데이터

### 5.1 DB 스키마 변경

**신규 테이블**: 0
**ALTER 컬럼**: 0
**신규 인덱스**: 1 (expression index)

```sql
-- 마이그레이션 1714000012000-AddDiscussionHotIndex.ts
CREATE INDEX IF NOT EXISTS idx_discussion_threads_hot
  ON discussion_threads (
    (LOG(GREATEST(ABS(score), 1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000) DESC,
    id DESC
  )
  WHERE is_deleted = FALSE;
```

**예상 크기 (1만 thread 가정)**:
- index 크기: ~500KB
- index 생성 시간: ~3초

### 5.2 응답 schema 확장

| Endpoint | 신규 필드 | 호환성 |
|---------|---------|------|
| `GET /threads` | `myVote: -1\|0\|1` (인증), `isLocked: boolean` (HIGH-3) | optional → 기존 클라 호환 |
| `GET /threads/:id` | 동상 | 동상 |
| `GET /threads/:id/posts` | 각 post 에 `myVote`, `isLocked` | 동상 |
| `POST /vote` | `change`, `finalScore` (변경 — 기존 `change` 만에서 확장) | breaking? `change` 는 유지 → 비breaking |
| `GET /threads`, `GET /posts` 응답에 thread.discussionCount 추가? | (옵션) round 별 count 표시용 | optional |

### 5.3 데이터 무결성

- **WORM 회귀**: discussion_threads/posts 는 WORM 아님 (PR-10b 명시) — edit/soft-delete 허용. 마이그레이션 1714000012000 가 row 데이터 변경 0.
- **score cache drift**: vote 시 `manager.increment` atomic — 트랜잭션 외 경로 (admin reset) 만 drift 가능. ADR-020 §9 score drift CLI 는 후속.
- **HIGH-3 마스킹**: 응답 직전 적용 — DB 데이터 변경 0.

### 5.4 user_progress 매핑 정확성

- `discussion_post.related_question_id` (uuid, nullable) → `questions.id`
- `questions.topic / questions.week` → `user_progress.topic / user_progress.week` (unique index `userId × topic × week`)
- 결합 쿼리:
  ```sql
  SELECT 1 FROM user_progress up
    JOIN questions q ON q.topic = up.topic AND q.week = up.week
    WHERE q.id = $1 AND up.user_id = $2
    LIMIT 1
  ```
- **인덱스 적합성**: `questions(id)` PK + `user_progress(user_id, topic, week)` unique 둘 다 매칭 → 빠름.

### 5.5 캐시 / 무효화

- 백엔드 응답: `Cache-Control: private, no-store` 명시 (HIGH-3 블러 우회 방지).
- web SWR: `revalidateOnFocus: true`, 명시 `mutate(key)` 호출.
- CDN 캐시 0 (Cache-Control 차단).

---

## 6. 사용자 결정 5건 (CRITICAL) 영향 매트릭스

| 결정 | 차원 ① | 차원 ② | 차원 ③ | 차원 ④ | 회귀 위험 |
|------|------|------|------|------|--------|
| Q-R5-01 (Markdown raw) | sanitize-html 의존 유지 | 0 | 0 | DB body 컬럼 의미 변경 (HTML → Markdown) — **데이터 마이그레이션 0** (PR-10b 머지 직후, thread 0건 가정) | 낮음 |
| Q-R5-02 (단일 schema) | 신규 모듈 1 | 0 | 0 | 0 | 낮음 |
| Q-R5-03 (이중 마스킹) | 0 | service 메서드 1개 + 헬퍼 2개 추가 | 응답 schema +`isLocked` | 응답 직전 변환 (DB 0) | 낮음 |
| Q-R5-06 (Reddit + index) | 0 | 마이그레이션 1 | 0 | 신규 expression index | 중 (마이그레이션) |
| Q-R5-11 (read 공개) | Public 데코레이터 신규 | JwtAuthGuard 분기 | 비인증 read endpoint 4종 | 0 | 중 (보안 정책 변경) |

---

## 7. 대안 선택 영향 — 옵션 매트릭스

(Q-R5 시리즈의 다른 옵션을 선택했을 경우 영향)

| 결정 | 채택값 (Reviewer 권장) | 대체 옵션 시 영향 |
|------|--------------------|----------------|
| Q-R5-01 | (b) Markdown raw | (a) HTML 저장 → web sanitize 라이브러리 변경 + react-markdown 미사용 → web 신규 LOC -200 / 의존성 -1 |
| Q-R5-05 | (c) ADR-021 분리 | (b) PR-12 동봉 → 스키마 마이그레이션 +1 / API 신규 endpoint +2 / web 페이지 +1 / 부피 1.5~2배 |
| Q-R5-07 | (a) SWR | (c) 직접 fetch → 신규 의존성 -13KB / 보일러플레이트 +200 LOC / TanStack Query 통합 어려움 |
| Q-R5-11 | (a) read 공개 | (b) 모두 인증 → ADR-020 §5.3 학습 동기 상실 / 비로그인 진입점 차단 / @Public 데코레이터 미신설 |

---

## 8. 전후 비교 (코드 PR 머지 후)

| 항목 | 머지 전 (현재) | 머지 후 |
|------|------------|------|
| web 페이지 수 | 11 | 13 (+2) |
| web 컴포넌트 수 | ~25 | ~36 (+11) |
| api 모듈 수 | 변동 없음 | 동상 |
| DB 인덱스 수 | 변동 없음 | +1 (expression) |
| 테스트 케이스 수 | 1218+1s | 1320+1s (+103 신규) |
| /play/solo 빌드 크기 | 15.5 kB | 15.7 kB (예상, 토론 링크만) |
| /play/solo/[questionId]/discussion | 0 | ~25 kB (신규 route chunk) |
| 백엔드 read 엔드포인트 인증 | 강제 인증 | 비인증 read 허용 (4종) |
| Stage 2 (LLM 요약) 준비 | 없음 | sanitize 단일 schema + isLocked flag 재사용 가능 |

---

## 9. CI / pre-commit 영향

### 9.1 Layer 1 PostToolUse (lint)

- web 신규 코드 — ESLint + Prettier 적용. 기존 `apps/web/.eslintrc.json` (또는 .eslintrc.cjs) 그대로.
- 신규 lint rule 권장 (Q-R5-12 후속): `no-restricted-imports` `rehype-raw` 차단.

### 9.2 Layer 2 pre-commit typecheck/test

- `npm run typecheck` 가 web + api 모두 포함 (monorepo turbo / npm workspaces 검증 필요).
- `npm test` — 신규 ~103 cases 모두 GREEN.

### 9.3 Layer 3 git pre-commit hook

- `.githooks/pre-commit` Layer 3-a (민감정보 스캔) — 신규 web 코드에 `api_key|secret|password|token|salt|hmac|token_hash` 키워드 0건 확인 (cookie-only 패턴이라 위험 0).
- Layer 3-a3 (LLM prompt PII) — 본 PR LLM 경로 0건 → 영향 없음.

### 9.4 Layer 4 CI

- GitHub Actions / pre-push CI — 본 분석 범위 외, 변경 없음.

### 9.5 Layer 5 3+1 합의

- 본 PR consensus-012 (2026-04-29) → docs PR 머지 게이트 해소.

---

## 10. 외부 노트북 검증 항목

(코드 PR 머지 전 수행)

| # | 검증 | 도구 |
|---|-----|-----|
| 1 | 라이트/다크 토글 — discussion 페이지 시안 D 글라스 톤 일관성 | DevTools |
| 2 | 키보드 풀 플로우 — Tab + ←→ + Enter (sort tab → thread → vote → composer) | 키보드 |
| 3 | axe DevTools 라이트/다크 — 0 violation | axe |
| 4 | 모바일 (375px) breakpoint — 1 column + sticky vote | DevTools responsive |
| 5 | vote 클릭 — optimistic 즉시 반영 + 다탭 동기화 (focus 시) | 다탭 |
| 6 | XSS 대표 5종 페이로드 — `<script>` / `javascript:` / `<svg onload>` / `data:` / `<iframe srcdoc>` | 직접 입력 |
| 7 | HIGH-3 블러 — 미풀이 후 풀이 → 본문 공개 흐름 | 시나리오 |
| 8 | 비인증 read — 로그아웃 후 토론 페이지 접근 → 200 + 모든 본문 공개 | 시나리오 |
| 9 | 비인증 write — vote 클릭 → /login redirect | 시나리오 |
| 10 | Origin guard 통과 — Network 탭에서 /api/discussion/* 200 응답 | DevTools |

---

## 11. 위험 + 완화 (요약)

| 위험 | 가능성 | 영향 | 완화 |
|------|------|-----|-----|
| 신규 의존성 6종 CVE | 낮음 | npm audit / Renovate alert | lock 버전 + 자동 patch |
| react-markdown v9 → v10 breaking | 낮음 | major 차단 lock | 1주 관측 + 수동 |
| HIGH-3 N+1 회피 쿼리 성능 (50 posts 가정) | 낮음 | latency +3ms | EXPLAIN ANALYZE |
| expression index 마이그레이션 운영 환경 락 | 낮음 | 1만 thread = 3초 | maintenance window 또는 CONCURRENTLY |
| 비인증 read 트래픽 폭증 (DDOS) | 낮음 | api SPOF | ThrottlerGuard 60/min IP 기반 + Cache-Control 짧은 TTL 검토 |
| Q-R5-11 패치 후 보안 회귀 | 중 | 모든 사용자 read | Phase 3.11~3.18 회귀 케이스 |
| 시안 D 톤 미반영 (시각 회귀) | 낮음 | UX 일관성 | 외부 노트북 검증 항목 1 |

---

## 12. 다음 단계

1. ✅ 사용자 결정 15건 채택 (2026-04-29)
2. ✅ docs PR 작성 (본 문서 포함 4파일 + ADR-020 패치)
3. **docs PR 머지** ← 다음
4. **코드 PR (PR-12-code)** — 본 영향 분석을 가이드로 14 commit
5. **외부 노트북 검증 10항목** — 코드 PR 머지 전
6. **ADR-021 (Community Hub)** — PR-12 머지 후 별도 합의
7. **chore/auth-storage-cleanup** — 병렬 가능

---

## 13. 참조

- `docs/architecture/pr-12-discussion-page-design.md` — SDD 본문
- `docs/review/tdd-plan-pr-12-discussion-page.md` — TDD 분해
- `docs/review/consensus-012-pr-12-discussion-page.md` — 합의 보고서
- `docs/decisions/ADR-007-change-impact-analysis.md` — SYSTEM 4차원 정의
- `docs/decisions/ADR-020-ux-redesign.md` — §4.2.1 C / §5.3 / §6 / §9 / §11 패치 대상
- `apps/api/src/modules/discussion/` — PR-10b 머지 코드
- `apps/api/src/migrations/` — 1714000012000 추가 위치
- `apps/web/package.json` — 신규 의존성 6종 추가 위치

---

**impact 분석 끝.** ADR-007 SYSTEM 4차원 평가 결과 **HIGH** 등급 — docs PR 분리 + 코드 PR 14 commit + 외부 노트북 검증 10항목 합당.
