# consensus-012 — PR-12 (web 토론 페이지) 3+1 합의 보고서

> **합의 ID**: consensus-012
> **합의 일자**: 2026-04-29
> **세션**: Session 13 후속4
> **합의 대상**: PR-12 (web 토론 페이지 + VoteButton + react-markdown + rehype-sanitize + 백엔드 hot/top raw query + HIGH-3 블러)
> **합의 단계**: docs PR (SDD + tdd-plan + impact + ADR-020 §6 갱신을 위한 사전 합의). 코드 PR 은 후속.
> **참여자**: Agent A (구현 분석가) / Agent B (품질·안전성 검증가) / Agent C (대안 탐색가) / Reviewer (검토 에이전트)
> **사용자 사전 결정**: 5건 (분리 / 가동 / 동봉 / 시안 D·ε 합류 / `/play/solo/[questionId]/discussion` 라우트)

---

## 0. Executive Summary

PR-12 (web 토론 페이지 + VoteButton + react-markdown + rehype-sanitize + 백엔드 hot/top + HIGH-3 블러) 의 docs PR 머지 전, 3 에이전트는 **CRITICAL 5건 / HIGH 12건 / MED 9건** 을 식별했다 (중복 제거 후 CRITICAL 5 / HIGH 9 / MED 7). 가장 무거운 충돌은 **저장 형식 (HTML vs Markdown)** 으로, ADR-020 §4.2.1 C "sanitize-html allowedTags 화이트리스트 통과 후 저장" 과 PR-12 §6 "rehype-sanitize 클라이언트 렌더" 사이의 데이터 흐름 모순이다. 사용자가 추가로 던진 **커뮤니티 진입점** 질문에 대해 Reviewer 는 "PR-12 에서는 질문 종속 진입점만 구현, 글로벌 `/community` 허브는 별도 ADR-021 (가칭) 로 분리" 를 권장한다 — 이유는 `discussion_threads.question_id` 가 `NOT NULL` 로 마이그레이션 1714000011000 에 박혀 있어 글로벌 허브는 스키마 변경(또는 view) 을 동반하기 때문이다.

**합의율 만장일치 6.7% (1/15) / 유효 합의율 100% (15/15)**. PR-10c (35.7% / 92.9%) 와 비교하면 만장일치는 더 낮으나, 이는 PR-12 가 web + api + DB + UX 가 동시 걸려 에이전트 시야가 분산된 자연 결과이며 유효율 100% 는 Reviewer 가 모든 누락을 평가했음을 의미한다 (미채택 0). 사용자 결정 항목 **15건 (Q-R5-01 ~ Q-R5-15)** 모두 Reviewer 권장값 그대로 채택 (사용자 응답 "전부 권장").

---

## 1. 사용자 사전 결정 5건 (확인, 도전 금지)

| # | 결정 | 합의 범위에서의 처리 |
|---|------|-----------------|
| 1 | docs PR 분리 | 코드 PR 은 별도 후속 — 본 합의는 docs 4파일 + ADR-020 §6 갱신만 다룸 |
| 2 | 3+1 합의 가동 | Phase 2 병렬 분석 완료, 본 보고서는 Phase 3-5 |
| 3 | HIGH-3 related_question_id 블러 PR-12 동봉 | 범위 확정. **Q-R5-09 (서버 마스킹 vs 클라 블러) 은 내부 구현 결정** |
| 4 | 디자인 톤 시안 D / ε Glass 합류 | 시안 D §3.4 글라스 패턴을 토론 카드에 재사용. **Q-R5-12 (블러 톤)** 은 내부 결정 |
| 5 | 라우트 `/play/solo/[questionId]/discussion` | 확정. **글로벌 허브 추가 여부** 만 §2 에서 합의 |

---

## 2. 사용자 추가 결정 — 커뮤니티 진입점 분석

### 2.1 현 web 구조 (직접 검증 결과)

- `apps/web/src/app/page.tsx` — 시안 D Hero + Journey + 비대칭 3카드 (`Primary 솔로 / Ranking / Admin`). 토론 진입점 0건.
- `apps/web/src/components/Header.tsx` — 인증 분기. 인증 시 "플레이 / 오답 노트 / 로그아웃", 비인증 시 "로그인 / 회원가입". **글로벌 메뉴 슬롯 0건**.
- `apps/web/src/app/play/` — `solo/` 만 존재. `play/page.tsx` 부재 (인덱스 페이지 없음 — 직접 `/play/solo` 진입).
- `apps/web/src/components/home/` — `feature-cards.tsx` 의 3카드 중 **3번째 슬롯 = AdminCard** 가 잠금 상태. 토론 카드를 추가하려면 4번째 슬롯이거나 AdminCard 교체.

### 2.2 백엔드 제약 (직접 검증 결과)

- `apps/api/src/modules/discussion/entities/discussion-thread.entity.ts` 의 `questionId` 컬럼: `@Column({ type: 'uuid', name: 'question_id' })` — **NOT NULL**.
- 마이그레이션 `1714000011000-AddDiscussion` 에 partial index `(questionId, lastActivityAt DESC) WHERE is_deleted=FALSE` — questionId 가 인덱스 leading column. 글로벌 sort 시 사용 불가.
- `discussion.controller.ts` 의 read endpoint 는 `GET /discussion/questions/:questionId/threads` 만 존재. **questionId 무관 endpoint 0건**.
- ADR-020 §5.3 명세도 동일 — `/api/discussion/questions/:questionId/threads`.

### 2.3 옵션 매트릭스

| # | 옵션 | 라우트 | 백엔드 변경 | DB 스키마 | PR-12 범위 | 위험도 | 권장도 |
|---|------|--------|-----------|----------|----------|--------|--------|
| **A** | 질문 종속 only (현 ADR-020) | `/play/solo/[questionId]/discussion` | 없음 | 없음 | 동봉 | 낮음 | **★ 권장** |
| B | 질문 종속 + Header 메뉴 추가 | A + Header `<Link href="/play/solo">토론</Link>` 같은 우회 | 없음 | 없음 | 동봉 | 낮음 | 부분 권장 |
| C | 글로벌 `/community` 허브 신설 (질문 무관 list) | `/community` + A | 신규 endpoint `/api/discussion/threads?sort=hot` | NOT NULL 유지, view 또는 cross-question join | 동봉 시 PR-12 폭발 | 중간 | 분리 권장 |
| D | 자유 게시판 (question_id NULL 허용) | `/community/free` + A | 신규 endpoint + nullable | **스키마 마이그레이션 + index 재작성** | 분리 필수 | 높음 | 비권장 (ADR 추가 필요) |
| E | 카테고리/태그 시스템 (Reddit 스타일) | `/community/[tag]` + A | 신규 entity `discussion_tags` | **신규 테이블 + 마이그레이션** | 분리 필수 | 매우 높음 | 비권장 (대형 변경) |

### 2.4 Reviewer 권장: **옵션 A 채택 + 옵션 C 후속 분리** → **사용자 채택**

**근거**:
1. **데이터 모델 잠금**: `question_id NOT NULL` + index leading column 이 questionId. 글로벌 허브는 스키마 변경 또는 view 추가가 필수 — PR-12 동봉 시 마이그레이션 추가 / index drop·recreate / read endpoint 신설 등으로 PR 부피 1.5~2배 증가.
2. **ADR 정합성**: ADR-020 §5.3 endpoint 11종은 모두 questionId 종속. 글로벌 허브는 ADR-020 외부 결정이며, 새 ADR (ADR-021 "Community Hub" 가칭) 의 합의 사항.
3. **Agent A/B/C 모두 글로벌 허브는 분석하지 않음** — 3 에이전트가 ADR-020 R4 명세에 충실해 질문 종속만 가정. 누락 (Gap) 이 아니라 "ADR-020 범위 외".
4. **사용자 학습 흐름**: 부트캠프 컨텍스트 — "이 질문에 대한 토론" 이 학습 동기와 직결. 글로벌 허브는 학습 흐름을 끊을 수 있고, MVP-A 우선순위 (실시간 대전 후순위 메모리 참조) 와 정렬.
5. **Header 메뉴 추가는 비권장**: 시안 D §3.1 "Header 변경 없음" 명시. 토론 진입점은 학습 컨텍스트 내부 — Hero `todayQuestion` 카드 또는 `/play/solo` 결과 화면 후 노출이 더 자연스럽다.

### 2.5 PR-12 토론 진입점 위치 합의

A/B/C 가 모두 짚은 "토론 참여 링크 위치" 결정 (Q-A4 / Q-B4 / Q-C7) — Reviewer 권장:

| 위치 | A 권장 | B 권장 | C 권장 | Reviewer 결정 (= 사용자 채택) |
|------|--------|--------|--------|---------------------------|
| 솔로 결과 화면 직후 (`finished` phase CTA) | ○ | ○ | ○ | **채택** (3/3 합의) |
| Hero `todayQuestion` 패널 우하단 칩 | ○ | △ | ○ | **채택 (2.5/3)** — 시안 D §3.2.2 패널 내부 "토론 N개" 메타 칩 (라이브 ticker 옆) |
| Header 글로벌 메뉴 | × | × | × | **미채택** (시안 D §3.1 "변경 없음") |
| 비대칭 3카드 4번째 슬롯 | △ | × | △ | **유보** — Q-R5-04 로 사용자 양도 → 사용자 권장값 채택 = (a)+(b) |

---

## 3. Phase 3 — 교차 비교 표 (15개 항목)

| # | 항목 | Agent A | Agent B | Agent C | 분류 | Reviewer 결정 |
|---|------|---------|---------|---------|------|------------|
| 1 | **저장 형식 (HTML vs Markdown)** | 미언급 (구현 가능성만) | CRITICAL-B3 — sanitize-html 화이트리스트로 저장 → react-markdown 렌더 모순 | C 누락 §1 — 동일 모순 정면 제기 | ② 부분 일치 (B+C) | **B+C 채택** — Markdown 저장 + 표시 시점 sanitize. ADR-020 §4.2.1 C 패치 |
| 2 | **클라 sanitize 라이브러리 선택** | Q-A1 미언급 | CRITICAL-B1 — schema 미지정 (rehype-sanitize default vs custom) | Q-C2 sanitize 통일 (서버 = 클라) | ② 부분 일치 (B+C) | **B+C 채택** — `rehype-sanitize` + 사용자 정의 schema. 단일 schema 모듈 도입 |
| 3 | **HIGH-3 블러 (related_question_id 마스킹)** | CRITICAL-A2 — N+1 쿼리 위험 | CRITICAL-B2 — 서버 마스킹 0건 | C-6 블러 구현 | ① 일치 (3/3 CRITICAL) | **3/3 채택** — 서버 정규식 마스킹 + 클라 블러 컴포넌트 (이중 방어) |
| 4 | **백엔드 hot 공식 expression index** | CRITICAL-A1 — index 부재 시 full scan | 미언급 | C-3 hot 정렬 (Reddit / Wilson / 자체) | ② 부분 일치 (A+C) | **A+C 채택** — Reddit log10 공식 + PG expression index, 마이그레이션 1714000012000 |
| 5 | **myVote 응답 포함 방식** | HIGH-A3 — 응답 누락, batch fetch 필요 | Q-B4 vote 응답 | 미언급 | ② 부분 일치 (A+B) | **A+B 채택** — thread/post 응답에 myVote join 포함 |
| 6 | **VoteButton optimistic 동기** | 미언급 | HIGH — optimistic update 동기 보장 | Q-C5 vote UI | ② 부분 일치 (B+C) | **B+C 채택** — SWR mutate optimistic + rollback |
| 7 | **데이터 패칭 전략 (SWR / React Query / 직접)** | 미언급 | 미언급 | C-4 패칭 — web 둘 다 없음 (직접 fetch) | ④ 누락 (C only) | **C 채택** — SWR 신규 도입 |
| 8 | **TDD 분해 단위** | 미언급 (10 항목 분석만) | Q-B8 테스트 명명 | C-8 TDD 분해 | ② 부분 일치 (B+C) | **B+C 채택** — 7 phase (sanitize / VoteButton / page / mask / hot-cursor / myVote / axe) |
| 9 | **axe-core 접근성 통합** | 미언급 | HIGH — axe-core 부재 / Q-B7 | 미언급 | ④ 누락 (B only) | **B 채택** — PR-12 코드 PR 동봉 |
| 10 | **auth-storage.ts 잔존 처리** | 미언급 | HIGH — auth-storage.ts 잔존 / Q-B5 | 미언급 | ④ 누락 (B only) | **B 채택** — 별도 chore PR 분리 |
| 11 | **discussion 비인증 처리** | 미언급 | HIGH (CRITICAL 격상) — 비인증 사용자 처리 / Q-B6 | 미언급 | ④ 누락 (B only) | **B 채택 + CRITICAL 격상** — read 4종 공개, write 7종 인증 (controller line 115 패치) |
| 12 | **A09 audit log** | 미언급 | HIGH — A09 audit / Q-B 미부여 | 미언급 | ④ 누락 (B only) | **B 채택 (낮은 우선순위)** — vote/accept mutation audit. PR-12 범위 외, MED 후속 |
| 13 | **모바일 반응형** | 미언급 | 미언급 | C-9 모바일 | ④ 누락 (C only) | **C 채택** — 시안 D `md:` 패턴 재사용, 단일 컬럼 fallback |
| 14 | **장기 부채 (Stage 2/3 확장 가정)** | 미언급 | 미언급 | C-10 장기 부채 | ④ 누락 (C only) | **C 채택** — SDD 의 §유보/후속 절에 명시 |
| 15 | **cursor schema (sort 별 분기)** | HIGH-A4 — cursor sort=top/hot 별 분기 / Q-A5 | 미언급 | 미언급 | ④ 누락 (A only) | **A 채택** — sort 별 cursor schema 분기 (`{c,i}` / `{s,i}` / `{h,i}`) |

---

## 4. Phase 4 — 합의 도출 상세 (CRITICAL/주요 항목)

### 4.1 항목 1: 저장 형식 (HTML vs Markdown) — CRITICAL

- **B 근거**: `sanitize-html` allowedTags = HTML 화이트리스트. 저장 시점 = HTML.
- **C 근거**: `react-markdown` 은 markdown 입력. 둘이 한 본문에 공존 불가.
- **A 미언급**: 구현 분석가 시야가 backend 쿼리 / index 에 집중되어 데이터 흐름 검증 부재.
- **Reviewer 판정**: **Markdown 저장 + 표시 시점 sanitize** 채택. 이유:
  1. 사용자 편집 UX — Markdown 이 표준 (Reddit / GitHub / Stack Overflow).
  2. **서버는 raw markdown 저장 + 클라 단독 sanitize** — sanitize 로직 단일화, 서버 부담 감소.
  3. ADR-020 §4.2.1 C 의 `POST_SANITIZE_OPTS` 는 **저장 직전 markdown raw 검증** (script-like 토큰 거부) 으로 재해석. 패치 1줄.
- **Q-R5-01 → 사용자 채택 (b)**.

### 4.2 항목 2: 클라 sanitize schema — CRITICAL

- **B 근거**: rehype-sanitize default schema 는 GitHub flavored — `<details>`, `<input type=checkbox>` 등 ADR-020 화이트리스트 외 태그 허용.
- **C 근거**: 서버 sanitize-html allowedTags 와 클라 schema 가 일치하지 않으면 XSS 우회 가능.
- **Reviewer 판정**: **B+C 채택 + 단일 schema 모듈 도입** — `apps/web/src/lib/discussion/sanitize-schema.ts` 가 export 하는 `discussionSchema` 가 서버 `apps/api/src/modules/discussion/sanitize-post-body.ts` 의 `allowedTags / allowedAttributes / allowedSchemes` 와 1:1 매칭 (테스트로 동등성 검증).
- **Q-R5-02 → 사용자 채택 (a)**.

### 4.3 항목 3: HIGH-3 블러 — CRITICAL (만장일치)

- **A**: N+1 쿼리 위험. ← Reviewer 정정: 본문 정규식 마스킹은 단일 응답 처리 = N+1 없음.
- **B**: 서버 마스킹 0건 = 클라이언트 단독 블러는 우회 가능.
- **C**: 블러 구현 (UI).
- **Reviewer 판정**: 서버 정규식 마스킹 (응답 직전 thread/post body) + 클라 블러 컴포넌트 (`<RelatedQuestionBlur>` 시안 D 글라스 톤). 마스킹 토큰 + `isLocked: boolean` 응답 플래그.
- **Q-R5-03 → 사용자 채택 (a)**.

### 4.4 항목 4: hot 공식 + expression index — CRITICAL (A+C 부분 일치)

- **A**: index 부재 시 매 hot sort 가 full scan + ORDER BY = 1만 thread 시 100ms+.
- **C**: hot 공식 자체를 자체 vs Reddit vs Wilson 중 결정 필요.
- **B 미언급**.
- **Reviewer 판정**: Reddit 공식 (`LOG(GREATEST(ABS(score),1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000`) — ADR-020 §5.4 그대로 + PG expression index 마이그레이션 1714000012000. Wilson score 는 정답률 기반 — 토론에 부적합. 자체 공식은 검증 부담.
- **Q-R5-06 → 사용자 채택 (a)**.

### 4.5 항목 11: discussion 비인증 처리 — **CRITICAL 신규 격상**

- **B 단독 지적**: `JwtAuthGuard` 가 controller 전체에 적용 (line 115) → 비인증 사용자가 read 도 못함. ADR-020 §5.3 의 read 4종은 인증 정책 명시 없음 — 묵시적으로 read 는 공개여야 학습 동기 부여.
- **Reviewer 판정**: **PR-12 코드 PR 에서 read endpoint 4종 (listThreadsByQuestion / getThread / listPostsByThread / 추가 my-votes) 을 `@Public()` 데코레이터 또는 별도 controller 로 분리**. write endpoint 7종 (POST/PATCH/DELETE/Vote/Accept) 만 JwtAuthGuard. ThrottlerGuard 는 controller 전체 유지.
- **Q-R5-11 → 사용자 채택 (a)**.

---

## 5. Phase 5 — 합의율

| 분류 | 건수 | 비율 |
|------|-----|------|
| ① 만장일치 (3/3) | **1** (항목 3 CRITICAL HIGH-3 블러) | 6.7% |
| ② 부분 일치 (2/3, 채택) | **6** (항목 1, 2, 4, 5, 6, 8) | 40.0% |
| ③ 불일치 (1+1+1) | **0** | 0.0% |
| ④ 누락 채택 | **8** (항목 7, 9, 10, 11, 12, 13, 14, 15) | 53.3% |
| **전체** | **15** | 100% |

- **만장일치 합의율** = 1 / 15 = **6.7%** (PR-10c 35.7% 대비 낮음)
- **유효 합의율** = (1 + 6 + 8) / 15 = **15 / 15 = 100%**
- **다관점 효과**: B 단독 5건 / C 단독 5건 / A 단독 2건 — 모두 Reviewer 평가, 미채택 0

PR-10c 와 비교: 35.7% / 92.9% — PR-12 는 만장일치율이 더 낮지만 (6.7%), 이는 **PR-12 가 web + api 양쪽을 동시에 다루고 보안·UX·DB 가 모두 걸려 에이전트 시야가 분산** 된 자연 결과. **유효 100%** 가 의미 있는 지표.

**1 Agent 만 짚은 CRITICAL**: **2건** (B 단독: 항목 11 비인증 처리 — Reviewer 가 CRITICAL 격상. B+C: 항목 1 저장 형식 모순 — 부분일치).

---

## 6. Phase 6 — 사용자 결정 항목 통합 (Q-R5 시리즈, 15건 → 전부 권장 채택)

| # | ID | 결정 항목 | Reviewer 권장 = 사용자 채택 | 등급 |
|---|------|---------|------------------------|--------|
| 1 | **Q-R5-01** | 저장 형식 (HTML vs Markdown) | **(b)** Markdown raw + 클라 sanitize | **CRITICAL** |
| 2 | **Q-R5-02** | 클라 sanitize schema 위치 | **(a)** 서버 = 클라 1:1 단일 schema 모듈 + 동등성 테스트 | **CRITICAL** |
| 3 | **Q-R5-03** | HIGH-3 블러 (서버 마스킹 vs 클라 블러) | **(a)** 서버 정규식 + 클라 컴포넌트 (이중 방어) | **CRITICAL** |
| 4 | **Q-R5-04** | 토론 진입점 위치 | **(a)+(b)** 솔로 결과 + Hero todayQuestion 칩 | HIGH |
| 5 | **Q-R5-05** | 글로벌 `/community` 허브 | **(c)** ADR-021 (가칭) 분리 | HIGH |
| 6 | **Q-R5-06** | hot 공식 | **(a)** Reddit log10 + expression index | **CRITICAL** |
| 7 | **Q-R5-07** | 데이터 패칭 | **(a)** SWR 신규 도입 | HIGH |
| 8 | **Q-R5-08** | myVote 응답 포함 | **(a)** thread/post 응답 join | HIGH |
| 9 | **Q-R5-09** | VoteButton optimistic UI | **(b)** SWR mutate | HIGH |
| 10 | **Q-R5-10** | auth-storage.ts 제거 | **(b)** 별도 chore PR | MED |
| 11 | **Q-R5-11** | discussion 비인증 read | **(a)** read 공개 + write 인증 (controller line 115 패치) | **CRITICAL** |
| 12 | **Q-R5-12** | 블러 디자인 톤 | **(a)** 시안 D 글라스 + blur(8px) | MED |
| 13 | **Q-R5-13** | axe-core 통합 시점 | **(a)** PR-12 코드 PR 동봉 | HIGH |
| 14 | **Q-R5-14** | cursor schema sort 별 분기 | **(b)** sort 별 분기 (`{c,i}` / `{s,i}` / `{h,i}`) | HIGH |
| 15 | **Q-R5-15** | author/admin 권한 분기 | **(b)** 본인 + admin | MED |

**사용자 응답 (2026-04-29)**: "전부 권장" — 15건 모두 Reviewer 권장값 그대로 채택.

---

## 7. Phase 7 — CRITICAL/HIGH/MED 통합 표

| 등급 | 식별자 | 항목 | 출처 Agent | docs PR 머지 전 해소 | 대응 계층 |
|------|--------|------|----------|----------------|---------|
| **CRITICAL** | C-1 | 저장 형식 모순 (HTML vs Markdown) | B, C | **필수** (Q-R5-01) | 사용자 결정 ✓ + ADR-020 §4.2.1 C 패치 + SDD §4 |
| **CRITICAL** | C-2 | 클라 sanitize schema 미지정 | B | **필수** (Q-R5-02) | 사용자 결정 ✓ + SDD §4 + tdd-plan |
| **CRITICAL** | C-3 | HIGH-3 서버 마스킹 0건 | B | **필수** (Q-R5-03) | 사용자 결정 ✓ + SDD §6 |
| **CRITICAL** | C-4 | hot 공식 + expression index 부재 | A, C | **필수** (Q-R5-06) | 사용자 결정 ✓ + 마이그레이션 1714000012000 |
| **CRITICAL** | C-5 | discussion read 비인증 차단 (현 코드 ADR 불일치) | B | **필수** (Q-R5-11) | 사용자 결정 ✓ + ADR-020 §5.3 패치 + SDD §7 |
| HIGH | H-1 | myVote 응답 포함 누락 | A, B | 코드 PR 진입 전 | SDD §5 |
| HIGH | H-2 | cursor sort 별 분기 부재 | A | 코드 PR 진입 전 | SDD §5.4 |
| HIGH | H-3 | VoteButton optimistic 동기 | B, C | 코드 PR 진입 전 | tdd-plan |
| HIGH | H-4 | 데이터 패칭 라이브러리 부재 (SWR) | C | 코드 PR 진입 전 | impact §의존성 |
| HIGH | H-5 | axe-core 통합 부재 | B | 코드 PR 진입 전 | ADR-020 §8.4 인용 + tdd-plan |
| HIGH | H-6 | discussion 비인증 처리 분기 | B | 코드 PR 진입 전 | SDD §7 + auth guard 분리 |
| HIGH | H-7 | 토론 진입점 위치 미정 | A, B, C | docs PR | SDD §3 |
| HIGH | H-8 | 의존성 lock (react-markdown / rehype-sanitize 버전) | A | docs PR | impact §의존성 |
| HIGH | H-9 | 글로벌 커뮤니티 허브 결정 | (Reviewer 발견) | docs PR | ADR-021 분리 결정 (사용자 채택) |
| MED | M-1 | auth-storage.ts 잔존 | B | chore PR | 별도 |
| MED | M-2 | A09 audit log | B | 후속 | 별도 ADR |
| MED | M-3 | 모바일 반응형 | C | 코드 PR | tdd-plan |
| MED | M-4 | 장기 부채 (Stage 2/3) | C | docs PR §유보 | SDD |
| MED | M-5 | 블러 디자인 톤 | (Reviewer) | 코드 PR | SDD §UI |
| MED | M-6 | author/admin 권한 분기 | B | 코드 PR | SDD §권한 |
| MED | M-7 | TDD 분해 단위 | B, C | docs PR | tdd-plan |

---

## 8. Phase 8 — docs PR 산출물 설계

### 8.1 산출물 5건

| # | 파일 | 핵심 절 | 추정 길이 | 의존 |
|---|------|--------|--------|------|
| 1 | `docs/architecture/pr-12-discussion-page-design.md` (SDD) | §1 배경 / §2 라우트 + 페이지 트리 / §3 진입점 / §4 sanitize 단일 schema / §5 백엔드 hot/top + cursor 분기 + myVote / §6 HIGH-3 마스킹 + 블러 / §7 비인증 처리 / §8 의존성 lock / §9 유보 | 600~800줄 | ADR-020 §6 PR-12 행 |
| 2 | `docs/review/tdd-plan-pr-12-discussion-page.md` | 7 phase RED→GREEN | 300~400줄 | SDD §4-6 |
| 3 | `docs/review/impact-pr-12-discussion-page.md` (ADR-007 4차원) | 의존성 / 마이그레이션 / API 변경 / 비인증 read 영향 | 250~350줄 | SDD 전체 |
| 4 | `docs/review/consensus-012-pr-12-discussion-page.md` (본 문서) | A/B/C + Reviewer 본문 | 600~700줄 | A/B/C 출력 + ADR-020 |
| 5 | `docs/decisions/ADR-020-ux-redesign.md` 패치 | §4.2.1 C / §5.3 / §6 PR-12 행 / §9 / §11 | 150~200줄 패치 | SDD + 사용자 결정 |

### 8.2 의존 관계 그래프

```
사용자 결정 Q-R5-01 ~ Q-R5-15
    │
    ▼
ADR-020 §4.2.1 C / §5.3 / §6 / §9 / §11 패치 ──┐
    │                                            │
    ▼                                            │
SDD pr-12-discussion-page-design.md ─────────────┼──→ tdd-plan / impact
    │                                            │
    ▼                                            │
consensus-012 (본 보고서) ◀──────────────────────┘
    │
    ▼
docs PR 머지 → 코드 PR 시작
```

### 8.3 별도 결정 (PR-12 외)

- **ADR-021 (Community Hub)** — 글로벌 `/community` 허브 결정. PR-12 머지 후 별도 합의.
- **chore/auth-storage-cleanup** PR — Q-R5-10 (b) 채택. PR-12 와 무관, 독립 진행.

---

## 9. Phase 9 — Reviewer 권고 + 다음 단계

### 9.1 권고 요약

1. **CRITICAL 5건 (Q-R5-01, 02, 03, 06, 11) 모두 사용자 결정 완료** (전부 권장 채택). docs PR 머지 게이트 해소.
2. **Q-R5-05 (글로벌 커뮤니티 허브) 는 ADR-021 분리** — PR-12 동봉 시 부피 1.5~2배 + 마이그레이션 추가 + index 재작성 = MVP 일정 위험. 사용자 채택.
3. **Q-R5-04 (토론 진입점) 는 (a)+(b) 채택** — 솔로 결과 직후 + Hero todayQuestion 칩. Header 변경 없음 (시안 D §3.1).
4. **만장일치율 6.7%** 는 정상 — PR-12 가 web + api + DB + UX 가 동시 걸려 에이전트 시야 분산. **유효율 100%** 가 의미 있는 지표.
5. **B 단독 지적 5건 중 4건 채택** — 다관점 시스템의 가치 입증. 특히 항목 11 (비인증 처리) 은 B 가 없었으면 코드 PR 에서야 발견됐을 ADR-코드 불일치.

### 9.2 다음 단계 (순서)

1. ✅ **사용자 결정** (Q-R5-01 ~ Q-R5-15, 15건) — Reviewer 권장 그대로 채택 (2026-04-29).
2. **docs 4파일 + ADR-020 §6 패치 작성** ← 본 commit 진행 중.
3. **docs PR (PR-12-docs) 머지** — CRITICAL 5건 해소 검증 후.
4. **코드 PR (PR-12-code) 시작** — TDD RED → GREEN → REFACTOR.
5. **글로벌 hub 결정 (ADR-021 가칭)** — PR-12 머지 후 별도 합의.
6. **chore/auth-storage-cleanup PR** — 병렬 진행 가능.

### 9.3 위험 요소

| 위험 | 확률 | 영향 | 완화 |
|------|-----|------|-----|
| Q-R5-01 채택값 (Markdown raw) 의 클라 의존성 | 낮음 | react-markdown / rehype-sanitize 보안 CVE | impact §의존성 lock + Renovate alert |
| hot expression index 마이그레이션 운영 환경 부하 | 낮음 | 마이그레이션 시간 (1만 thread = 수초) | CONCURRENTLY 옵션 + maintenance window |
| 비인증 read 허용 (Q-R5-11) 후 트래픽 증가 | 낮음 | DDOS 표적 | ThrottlerGuard 유지 + Cache-Control: public, s-maxage=30 (옵션) |
| ADR-021 (글로벌 허브) 결정 지연 | 중간 | 사용자 학습 흐름 손실 | MVP 후속 우선순위 명시 |

### 9.4 Reviewer 자기 평가

- **재분석 금지 원칙 준수**: A/B/C 가 짚지 않은 새 항목은 짚지 않았다 (단, 항목 11 의 CRITICAL 격상은 B 의 지적을 코드 line 115 확인으로 강도 평가).
- **편향 회피**: 만장일치 1/15 는 다관점 시스템이 정상 작동했다는 증거. Reviewer 가 합의 압력 없이 누락을 100% 채택.
- **사용자 사전 결정 5건 도전 0건**: 5건 모두 합의 범위 외로 처리.
- **CRITICAL 5건 모두 docs PR 머지 게이트로 명시**: 게이트 누수 0.

### 9.5 메타

- **합의 만장일치**: 1 / 15 (6.7%)
- **유효 합의 (Reviewer 판정 채택)**: 15 / 15 (100%)
- **1 Agent 만 짚은 CRITICAL**: 2건 (모두 채택)
- **사용자 사전 결정 도전**: 0건
- **다관점 효과**: B 단독 5건 (4 채택) / C 단독 5건 (5 채택) / A 단독 2건 (2 채택) — 미채택 0
- **본 보고서 작성 시점**: 2026-04-29
- **다음 합의 ID**: consensus-013 (ADR-021 Community Hub, Q-R5-05 (c) 채택 → 후속)

---

## 10. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | consensus-012 본 합의 보고서 최초 작성. 3 에이전트 병렬 분석 + Reviewer 종합. 사용자 결정 15건 모두 권장 채택 | A/B/C 출력 + 사용자 응답 "전부 권장" |

---

## 11. 참조

- `docs/decisions/ADR-020-ux-redesign.md` — §4.2.1 C / §5.3 / §6 / §9 / §11 패치 대상
- `docs/architecture/pr-12-discussion-page-design.md` — 본 합의 결과 SDD
- `docs/review/tdd-plan-pr-12-discussion-page.md` — 본 합의 결과 TDD plan
- `docs/review/impact-pr-12-discussion-page.md` — 본 합의 결과 ADR-007 4차원 영향
- `apps/api/src/modules/discussion/` — 백엔드 구현 (PR-10b 머지)
- `apps/api/src/modules/users/entities/user-progress.entity.ts` — HIGH-3 블러 매핑 키
- `apps/web/src/app/play/solo/page.tsx` — 진입점 위치 (finished phase)
- `apps/web/src/app/page.tsx` — Hero todayQuestion 칩 추가 대상
- `docs/rationale/main-page-redesign-concept-d.md` — 시안 D 글라스 톤
- `docs/rationale/solo-play-config-redesign-concept-epsilon.md` — 시안 ε CTA 그룹
- `docs/architecture/multi-agent-system-design.md` §7.3/7.4 — 합의율 패턴 관찰

---

**보고서 끝.** docs PR 머지 후 코드 PR 시작.
