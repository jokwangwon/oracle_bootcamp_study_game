# Community Hub SDD — 도메인 모델 + 카테고리 + 라우트

> **상태**: Accepted (2026-04-29, consensus-013, ADR-021)
> **합의**: `docs/review/consensus-013-adr-021-community-hub.md`
> **결정**: `docs/decisions/ADR-021-community-hub.md`
> **선행 ADR**: ADR-019 (SM2 단계적 적용), ADR-020 (UX 재설계 base)

---

## 1. 배경

PR-12 (web 토론 페이지) 머지 후 자유게시판 도입 결정. 외부 채널 부재 (Slack 미사용, Zoom 만, 정보 공유 커뮤니티 없음) 컨텍스트 → 부트캠프 1기 정보 공유 메인 채널이 자유게시판이 된다.

본 SDD 는 **도메인 모델 + 카테고리 + 라우트** 만 다룬다. RBAC / 모더레이션 / audit log / PR-13 은 별도 SDD.

---

## 2. 도메인 모델 — 옵션 G (virtual root question 시드)

### 2.1 핵심 아이디어

기존 `discussion_threads.question_id NOT NULL` 잠금을 깨지 않고, **`questions` 테이블에 가상 학습 문제 1개 시드**:

```sql
INSERT INTO questions (id, title, body, is_virtual, ...)
VALUES (
  '00000000-0000-0000-0000-000000000001',  -- 고정 UUID
  '자유게시판',
  '자유게시판 루트 컨테이너 (옵션 G virtual root)',
  true,
  ...
);
```

자유게시판 thread = `'FREE-TALK'` virtual root question 의 thread. 기존 `discussion_threads` 인덱스 / 외래키 / 마이그레이션 100% 재사용.

### 2.2 스키마 변경

#### 2.2.1 `questions` 테이블 — `is_virtual` 컬럼 추가 (마이그레이션 1714000020000)

```sql
ALTER TABLE questions
  ADD COLUMN is_virtual BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO questions (id, title, body, is_virtual, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '자유게시판',
  '커뮤니티 자유게시판 루트 (가상 컨테이너)',
  TRUE,
  now(), now()
);

-- HIGH-3 블러 정책: virtual question 은 항상 unlocked (마스킹 무시)
-- → discussion.service.ts applyBlurPolicy 분기 추가
```

**마이그레이션 영향**:
- 컬럼 추가 (NOT NULL DEFAULT FALSE): 기존 row 모두 `false` 자동 채움
- 마이그레이션 lock 시간: 매우 짧음 (DDL 만, 행 수정 없음)
- 추정 시간: < 1초 (만 개 row 환경)

#### 2.2.2 `discussion_threads` 테이블 — `category` 컬럼 추가 (마이그레이션 1714000021000)

```sql
ALTER TABLE discussion_threads
  ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'discussion'
  CONSTRAINT chk_discussion_category CHECK (
    category IN ('discussion', 'notice', 'free', 'study', 'resource')
  );

-- 카테고리 + 시간순 인덱스 (자유게시판 카테고리별 list)
CREATE INDEX idx_discussion_threads_category_activity
  ON discussion_threads (question_id, category, last_activity_at DESC)
  WHERE is_deleted = FALSE;
```

**카테고리 분류**:
- `discussion` — 질문 종속 토론 (PR-12 그대로, default)
- `notice` — 공지 (operator/admin 만 작성)
- `free` — 자유 대화
- `study` — 스터디 모임 / 학습 팁
- `resource` — 학습 자료 공유

**자유게시판 (virtual root question) 만 4종 (notice/free/study/resource) 노출**. 질문 종속 토론은 `category='discussion'` 만 사용.

### 2.3 도메인 불변성 (Invariants)

| ID | 불변성 | 검증 위치 |
|----|------|---------|
| INV-1 | `discussion_threads.category` 가 `discussion` 이면 `questions.is_virtual = FALSE` | DiscussionService.createThread 검증 |
| INV-2 | `discussion_threads.category` 가 `discussion` 외 4종이면 `questions.is_virtual = TRUE` | 동일 |
| INV-3 | `notice` 카테고리 작성은 `caller.role IN ('operator','admin')` 만 가능 | RolesGuard + DiscussionService |
| INV-4 | virtual question (FREE-TALK) 의 thread 는 HIGH-3 블러 적용 안 함 (`applyBlurPolicy` 분기) | DiscussionService.applyBlurPolicy |
| INV-5 | virtual question id (`'00000000-0000-0000-0000-000000000001'`) 는 시스템 예약, 사용자 작성 question 으로 재사용 금지 | INSERT 마이그레이션 + UNIQUE (자연 보장) |

---

## 3. 카테고리 (4종)

### 3.1 enum 정의

```typescript
// apps/api/src/modules/discussion/types/category.ts
export const DISCUSSION_CATEGORIES = ['discussion', 'notice', 'free', 'study', 'resource'] as const;
export type DiscussionCategory = typeof DISCUSSION_CATEGORIES[number];

export const COMMUNITY_CATEGORIES = ['notice', 'free', 'study', 'resource'] as const;
export type CommunityCategory = typeof COMMUNITY_CATEGORIES[number];

export const CATEGORY_LABELS: Record<CommunityCategory, string> = {
  notice: '공지',
  free: '자유',
  study: '스터디',
  resource: '자료',
};
```

### 3.2 작성 권한 매트릭스

| category | user (학생) | operator (강사) | admin (운영자) |
|----------|----|----|----|
| `discussion` (질문 종속) | ✅ 작성 | ✅ 작성 | ✅ 작성 |
| `notice` (공지) | ❌ | ✅ 작성 | ✅ 작성 |
| `free` (자유) | ✅ | ✅ | ✅ |
| `study` (스터디) | ✅ | ✅ | ✅ |
| `resource` (자료) | ✅ | ✅ | ✅ |

**검증**: RolesGuard + class-validator + DB CHECK 3중 방어.

### 3.3 클라이언트 UI

- 자유게시판 새 글 작성 화면: 카테고리 dropdown (`free` / `study` / `resource`) — `notice` 는 role 이 operator/admin 일 때만 노출
- 카테고리별 list: `/community/[category]` — segment 라우트
- 카테고리 라벨: 한국어 (`공지` / `자유` / `스터디` / `자료`)
- 카테고리별 색상 칩 (시안 D 글라스 톤 일관)

---

## 4. 라우트

### 4.1 Next.js App Router 트리

```
apps/web/src/app/
├── community/
│   ├── page.tsx                          ← 전체 자유게시판 (모든 카테고리 합산, hot 정렬)
│   ├── [category]/
│   │   └── page.tsx                      ← 카테고리별 (notice/free/study/resource)
│   ├── threads/
│   │   ├── new/
│   │   │   └── page.tsx                  ← 새 글 작성 (카테고리 dropdown)
│   │   └── [threadId]/
│   │       ├── page.tsx                  ← thread 상세
│   │       └── loading.tsx + error.tsx
│   └── layout.tsx                         ← community 공통 layout (헤더 / 카테고리 탭 / 글라스 톤)
└── play/solo/[questionId]/discussion/      ← PR-12 유지 (category='discussion')
    ├── page.tsx
    └── [threadId]/page.tsx
```

### 4.2 라우트 충돌 방어

- `[category]` segment 의 동적 매칭은 카테고리 enum 4종 (notice/free/study/resource) 만 허용
- `threads` segment 가 `[category]` 와 충돌하지 않도록 **`[category]` 매칭 시 enum 검증 추가**:

```typescript
// apps/web/src/app/community/[category]/page.tsx
import { COMMUNITY_CATEGORIES } from '@/lib/community/types';
import { notFound } from 'next/navigation';

export default function CategoryPage({ params }: { params: { category: string } }) {
  if (!COMMUNITY_CATEGORIES.includes(params.category as any)) {
    notFound();
  }
  // ...
}
```

- Next.js 라우팅 우선순위: 정적 segment (`threads`) > 동적 segment (`[category]`) — 자동 충돌 방어. 단 enum 검증으로 이중 방어.

### 4.3 backLink referer 보존 (Agent A HIGH 지적)

자유게시판 thread 상세 (`/community/threads/[threadId]`) 와 질문 종속 thread 상세 (`/play/solo/[qId]/discussion/[tId]`) 가 분리됨:
- 자유게시판: thread 가 가상 question 종속이므로 backLink = `/community` (또는 `/community/[category]`)
- 질문 종속: backLink = `/play/solo/[qId]/discussion`

라우트 분리로 referer 보존 부담 0 — 통합 라우트 시 발생할 부담을 회피.

### 4.4 middleware PUBLIC_PATHS

```typescript
// apps/web/src/middleware.ts (Session 14 c19bf03 적용 상태 유지)
const PUBLIC_PATHS = ['/', '/login', '/register'];
// /community/* 는 PUBLIC_PATHS 미포함 → 게스트 시 /login?next=... 307 redirect
```

이중 방어: backend `discussion.controller.ts` `@Public()` 데코레이터 community read endpoint 에서 제거 (RBAC SDD 참조).

---

## 5. API endpoint (확장)

### 5.1 신규 endpoint

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/community/threads` | user+ | 자유게시판 전체 list (모든 카테고리, sort=hot/new/top, cursor) |
| GET | `/api/community/threads?category=notice` | user+ | 카테고리별 list |
| GET | `/api/community/threads/:threadId` | user+ | thread 상세 |
| POST | `/api/community/threads` | user (notice 는 operator+) | 새 글 작성 |
| PATCH | `/api/community/threads/:threadId` | owner only (admin 예외) | 본인 글 수정 |
| DELETE | `/api/community/threads/:threadId` | owner / operator+ | 삭제 (operator 는 audit log) |
| GET | `/api/community/threads/:threadId/posts` | user+ | thread 의 댓글 list |
| POST | `/api/community/threads/:threadId/posts` | user+ | 댓글 작성 |

### 5.2 라우팅 매핑

```typescript
// apps/api/src/modules/discussion/discussion.controller.ts
// 기존 PR-12 endpoint (질문 종속, 변경 없음):
//   GET /api/discussion/questions/:questionId/threads (read, @Public 제거)
//   GET /api/discussion/threads/:threadId (read, @Public 제거)
//   ...

// 신규 community endpoint (virtual root question 우회):
@Get('community/threads')
@Roles('user', 'operator', 'admin')
async listCommunityThreads(@Query() query: ListCommunityDto, @Req() req) {
  return this.service.listThreadsByQuestion(VIRTUAL_QUESTION_ID, {
    ...query,
    category: query.category, // notice/free/study/resource
    callerUserId: req.user.id,
  });
}
// ... (POST/PATCH/DELETE 동일 패턴)
```

**virtual_question_id 상수**:

```typescript
// apps/api/src/modules/discussion/constants.ts
export const VIRTUAL_QUESTION_ID = '00000000-0000-0000-0000-000000000001';
```

### 5.3 응답 schema 확장

기존 `ThreadDto` (PR-12) 에 `category` 필드 추가:

```typescript
// apps/api/src/modules/discussion/dto/thread.dto.ts
export interface ThreadDto {
  id: string;
  questionId: string;        // virtual root 시 VIRTUAL_QUESTION_ID
  category: DiscussionCategory;  // 신규
  title: string;
  bodyMarkdown: string;
  // ... 기존 필드
  isVirtual: boolean;        // 클라이언트 분기 (자유게시판 vs 질문 종속)
}
```

---

## 6. SWR + VoteButton + sanitize-schema 재사용 (PR-12)

PR-12 의 모든 컴포넌트 / lib 100% 재사용:

| 자산 | 재사용 위치 |
|------|----------|
| `apps/web/src/lib/discussion/sanitize-schema.ts` | community 글 sanitize (서버=클라 1:1) |
| `apps/web/src/lib/discussion/api-client.ts` | community API 호출 추가 (11 → 19 endpoint) |
| `apps/web/src/components/discussion/VoteButton.tsx` | community thread/post vote |
| `apps/web/src/components/discussion/PostTree.tsx` | community thread 의 1-level nested 댓글 |
| `apps/web/src/components/discussion/ThreadComposer.tsx` | community 새 글 작성 (카테고리 dropdown 추가) |
| `apps/web/src/components/discussion/PostComposer.tsx` | community 댓글 작성 |
| `apps/web/src/components/discussion/RelatedQuestionBlur.tsx` | virtual root question 의 thread 는 항상 unlocked (마스킹 분기) |
| `apps/web/src/components/discussion/SortTabs.tsx` | hot/new/top 정렬 탭 |
| SWR config (`/lib/swr-config.ts`) | dedup + revalidate 정책 그대로 |

신규 컴포넌트 (Q-R6-12 변경):
- `apps/web/src/components/home/feature-cards.tsx` 4번째 카드 (`<CommunityCard>`)

---

## 7. 마이그레이션 계획

### 7.1 마이그레이션 파일 목록 (Phase 3)

| 파일 | 내용 | LOC |
|------|------|-----|
| `1714000020000-AddIsVirtualToQuestions.ts` | `is_virtual` 컬럼 + virtual root question 시드 | ~30 |
| `1714000021000-AddCategoryToDiscussionThreads.ts` | `category` 컬럼 + CHECK + 인덱스 | ~30 |
| `1714000022000-AddRoleToUsers.ts` | `role` 컬럼 + CHECK (RBAC SDD 참조) | ~25 |
| `1714000023000-AddAuditLog.ts` | audit_log 테이블 + WORM 트리거 (audit-log SDD 참조) | ~70 |

### 7.2 운영 부하 (CONCURRENTLY 불요)

옵션 G 채택으로 모든 마이그레이션이 **컬럼 추가 + 시드 INSERT** 만 — table rewrite 없음. 운영 환경 lock 시간 < 1초 (1만 row 기준 추정). CONCURRENTLY 옵션 불필요.

---

## 8. 단계적 적용 (1기/2기/3기)

| 단계 | 적용 | 트리거 |
|------|------|-------|
| **1기 (본 SDD)** | 옵션 G + 카테고리 4종 + 신규 라우트 + PR-12 자산 재사용 | ADR-021 결정 (2026-04-29) |
| 2기 | 옵션 F (mview) 또는 옵션 C (view) 마이그레이션 + global hot 큐레이션 | community 글 ≥ 200건 또는 신고 빈도 ≥ 주 5건 |
| 3기 | 옵션 G hack 제거 (virtual root question 데이터 마이그레이션 → 별도 free_threads 테이블 또는 view) | 부트캠프 2기 (학생 ≥ 50명) |

---

## 9. 위험 요소

| 위험 | 가능성 | 영향 | 완화 |
|------|-------|------|------|
| virtual root question hack 의 의미 오염 | 중간 | 코드 분기 (applyBlurPolicy / RolesGuard) 분산 | INV-1~5 명시 + 단위 테스트 |
| 카테고리 enum 변경 시 마이그레이션 부담 | 낮음 | 기존 row backfill 필요 | 1기는 4종 고정, 2기 트리거 시 enum 추가 |
| `[category]` 라우트 enum 검증 누락 | 낮음 | 사용자가 `/community/random` 진입 시 404 | enum 검증 + notFound() |
| 자유게시판 글 폭발 (20명 × 8주 추정 100건) | 낮음 | hot 정렬 비용 ↑ | 2기 트리거에서 mview 도입 |
| backend `@Public()` 제거 누락 | 중간 | 비인증 read 가능 (CRITICAL 회귀) | RBAC SDD 의 이중 방어 + PR-13 회귀 테스트 |

---

## 10. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 SDD 최초 작성 (Session 15, consensus-013) | 사용자 결정 12건 |

---

## 11. 참조

- `docs/decisions/ADR-021-community-hub.md` §3 — 시스템 설계 요약
- `docs/architecture/community-rbac-design.md` — RBAC 상세
- `docs/architecture/community-moderation-design.md` — 모더레이션 상세
- `docs/architecture/audit-log-design.md` — audit log 상세
- `docs/architecture/integrated-e2e-harness-design.md` — PR-13 상세
- `docs/architecture/pr-12-discussion-page-design.md` — PR-12 자산 재사용 base
- `docs/decisions/ADR-019-sm2-spaced-repetition.md` — 단계적 적용 패턴
- `docs/rationale/main-page-redesign-concept-d.md` §3.4 — 비대칭 4-카드 패치 대상
