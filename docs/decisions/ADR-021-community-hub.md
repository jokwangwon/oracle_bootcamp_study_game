# ADR-021 — Community Hub (자유게시판 + 카테고리 + RBAC + 모더레이션 + audit log)

| 항목 | 값 |
|------|---|
| 상태 | Accepted (2026-04-29) |
| 제안 세션 | Session 15 (consensus-013) |
| 선행 문서 | `docs/review/consensus-013-adr-021-community-hub.md`, `docs/decisions/ADR-020-ux-redesign.md` §6 / §11, `docs/sessions/SESSION_2026-04-29-session-14.md` §3.1 |
| 관련 ADR | ADR-016 §7 (LLM-judge 안전 D3 Hybrid 재사용), ADR-018 (Salt rotation), ADR-019 (SM2 단계적 적용), ADR-020 (UX 재설계 base) |
| 영향 범위 | `apps/api/src/modules/discussion/` 확장 + `apps/api/src/modules/users/` role 컬럼 + `apps/web/src/middleware.ts` + `apps/web/src/app/community/` 신규 + `apps/web/src/components/home/feature-cards.tsx` 4-카드 + `docs/rationale/main-page-redesign-concept-d.md` §3.4 패치 + 신규 마이그레이션 3건 |

---

## 1. 배경

PR-12 (web 토론 페이지) 가 머지된 직후 사용자가 "커뮤니티는 어디에 추가할지" 라는 질문을 던졌다. consensus-012 §2.4 가 옵션 A (질문 종속만) + 옵션 C (글로벌 `/community` 허브) 후속 분리를 권장 채택했고, 본 ADR-021 이 "옵션 C 후속" 의 정식 결정.

핵심 컨텍스트 (사용자 응답 2026-04-29):

- **외부 채널 부재** — Slack 미사용, 수업 Zoom, **그 외 학생들이 정보를 공유할 커뮤니티 없음**.
- **자유게시판 필요** — 학습 외 정보 (스터디 모임, 자료 공유) 와 강사 공지가 게임 사이트 안에 통합되어야 함.
- **부트캠프 1기 ~20명 / 강사 1~2명 / 8주** — 운영자 권한 분리 필요 (강사 = 학생 글 수정 불가).

본 ADR-021 은 **자유게시판 도입 + 카테고리 분리 + 1기 3-tier RBAC + 강사 모더레이션 + audit log** 의 통합 결정. PR-12 의 sanitize-html / sanitize-schema / SWR / VoteButton 패턴을 100% 재사용한다.

---

## 2. 결정 요약 (사용자 결정 12건)

| ID | 결정 항목 | 채택값 | 등급 |
|----|---------|------|------|
| Q-R6-04 | community read 인증 (Q-R5-11 번복) | **read 인증 필수 (번복 확정)** | CRITICAL |
| Q-R6-05 | read 인증 적용 범위 | **이중 방어 (middleware + backend)** | HIGH |
| Q-R6-06 | audit log 1기 도입 | **도입 (ADR-016 §7 D3 Hybrid 재사용)** | CRITICAL |
| Q-R6-11 | PR-13 1주 선행 머지 | **동의** | CRITICAL |
| Q-R6-01 | 도메인 모델 | **옵션 G (virtual root "FREE-TALK" question 시드)** | HIGH |
| Q-R6-02 | 카테고리 1기 도입 | **후보 2 (4종: notice/free/study/resource)** | HIGH |
| Q-R6-03 | 라우트 구조 | **path segment** (`/community/[category]` + `/community/threads/[threadId]`) | HIGH |
| Q-R6-07 | Throttler IP fallback | **NestJS 기본 + CI 회귀** | HIGH |
| Q-R6-09 | 강사 모더레이션 권한 | **operator role + 학생 글 수정 코드 강제 (1기 3-tier)** | MED |
| Q-R6-10 | role 컬럼 (Q-R6-09 종속) | **3-tier (user/operator/admin)** | MED |
| Q-R6-12 | Hero 칩 형태 | **비대칭 4번째 카드** (시안 D §3.4 변경) | MED |
| Q-R6-08 | 마이그레이션 CONCURRENTLY | **N/A (옵션 G 채택)** | — |

**Reviewer 권장 대비 변경 4건**: Q-R6-02 격상 (외부 채널 부재) / Q-R6-09 격상 (학생 글 수정 코드 강제) / Q-R6-10 종속 격상 / Q-R6-12 변경 (시안 D §3.4 4-카드).

---

## 3. 시스템 설계 (요약, 상세는 SDD 6종)

### 3.1 도메인 모델 — 옵션 G (virtual root question 시드)

```
questions
  ├── (실제 학습 문제들)
  └── 'FREE-TALK' (uuid 고정 시드, title='자유게시판', is_virtual=true)
        │
discussion_threads (PR-10b 머지)
  ├── question_id NOT NULL (변경 없음, 기존 인덱스 재사용)
  ├── category VARCHAR(20) NOT NULL DEFAULT 'discussion'
  │     CHECK (category IN ('discussion','notice','free','study','resource'))
  └── ...
discussion_posts (PR-10b 머지, 변경 없음)
discussion_votes (PR-10b 머지, 변경 없음)
audit_log (신규)
  ├── id, target_type, target_id, action, by_user_id, reason, ip_addr, user_agent, created_at
  └── WORM 트리거 (UPDATE/DELETE 차단)
users
  └── role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user','operator','admin'))
```

- **자유게시판** = `'FREE-TALK'` virtual root question 의 thread 리스트
- **질문 종속 토론** = 실제 question 의 thread (PR-12 그대로, category='discussion')
- 기존 partial index `(questionId, lastActivityAt DESC) WHERE is_deleted=FALSE` 100% 재사용

### 3.2 카테고리 4종

| category | 의미 | 작성 권한 |
|----------|-----|---------|
| `notice` | 공지 (강사·운영자 발신) | operator/admin |
| `free` | 자유 대화 | user/operator/admin |
| `study` | 스터디 모임 / 학습 팁 | user/operator/admin |
| `resource` | 학습 자료 공유 (외부 링크) | user/operator/admin |
| `discussion` | (기존) 질문 종속 토론 | user/operator/admin |

- DB CHECK 제약 + class-validator + UI dropdown enum.
- 자유게시판 (virtual root) 만 4종 (notice/free/study/resource) 노출. 질문 종속 토론은 `discussion` 만.

### 3.3 라우트

```
apps/web/src/app/
├── community/
│   ├── page.tsx                     ← 자유게시판 전체 (모든 카테고리 합산)
│   ├── [category]/
│   │   └── page.tsx                 ← 카테고리별 (notice/free/study/resource)
│   └── threads/
│       └── [threadId]/page.tsx      ← 자유게시판 thread 상세
└── play/solo/[questionId]/discussion/  ← 현 PR-12 유지 (category='discussion')
```

라우트 충돌 방어: `threads` 는 카테고리 enum 외부 (`notice`/`free`/`study`/`resource`) — 충돌 없음.

### 3.4 RBAC — 1기 3-tier

| role | 권한 |
|------|-----|
| `user` (학생) | 본인 글만 수정/삭제, 모든 글 신고, vote, `notice` 작성 불가 |
| `operator` (강사) | + `notice` 작성, 모든 글 신고/숨김/삭제, **본인 외 학생 글 수정 코드 강제 차단**, audit log 기록 |
| `admin` (운영자) | + role 변경, 시스템 설정, full power, audit log 기록 |

- **이중 방어**:
  - `apps/web/src/middleware.ts` PUBLIC_PATHS 에 `/community/*` 미포함 → 게스트 시 `/login?next=/community` 307 redirect (Session 14 c19bf03 적용 상태 유지)
  - 백엔드 `discussion.controller.ts` `@Public()` 데코레이터 **3종 제거** (PR-12 머지된 read 4종 중 community 관련 endpoint) → 비인증 호출 시 401
- RolesGuard + `@Roles('operator','admin')` 데코레이터 (NestJS 표준)
- **학생 글 수정 코드 강제**: `DiscussionService.updatePost` 에 `if (caller.role !== 'admin' && caller.id !== post.user_id) throw ForbiddenException` — operator 도 학생 글 수정 불가 (admin 만 가능)

### 3.5 모더레이션 (1기/2기/3기 단계)

| 단계 | 기능 | 트리거 |
|------|-----|-------|
| **1기** | 사용자 신고 + operator/admin queue + lock/pin/숨김/삭제 (audit log 기록) | 본 ADR-021 (community 도입) |
| **2기** | LLM-judge D3 Hybrid 자동 모더레이션 (toxicity / off-topic 자동 사전 검출) | community 글 ≥ 200건 또는 신고 빈도 ≥ 주 5건 |
| **3기** | shadow_ban / 운영자 노트 / appeal 흐름 | 부정 사용자 ≥ 3건 또는 부트캠프 2기 |

ADR-016 §7 D3 Hybrid 패턴 재사용 — 신규 LLM 설계 비용 ≈ 0.

### 3.6 audit log — CWE-778 차단

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(30) NOT NULL,  -- 'discussion_thread' / 'discussion_post' / 'discussion_vote' / 'user_role'
  target_id UUID NOT NULL,
  action VARCHAR(30) NOT NULL,        -- 'create' / 'update' / 'delete' / 'lock' / 'unlock' / 'pin' / 'hide' / 'restore' / 'role_change'
  by_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NULL,
  ip_addr INET NULL,                  -- IPv4/IPv6 둘 다
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WORM (Write Once Read Many) 트리거
CREATE OR REPLACE FUNCTION audit_log_no_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is WORM — % blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_no_update_delete();

CREATE TRIGGER trg_audit_log_no_delete BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_no_update_delete();

-- 인덱스 (조회 패턴: target / actor / 시간 순)
CREATE INDEX idx_audit_log_target ON audit_log (target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log (by_user_id, created_at DESC);
```

- 모든 모더레이션 액션 (lock/pin/hide/restore/delete) 트랜잭션 내 INSERT.
- ADR-016 §7 D3 Hybrid 패턴 재사용 (Langfuse trace 와 별도, 분쟁 추적 전용).

### 3.7 Hero 비대칭 4-카드

**시안 D §3.4 변경**: 비대칭 3-카드 (Primary 1.4 : Ranking 1 : Admin 1) → **비대칭 4-카드 (Primary 1.4 : Ranking 1 : Admin 1 : Community 1)**.

- `apps/web/src/components/home/feature-cards.tsx` 4번째 카드 추가 (`<CommunityCard>`)
- 글라스 톤 일관 (Ranking/Admin 카드 패턴 재사용)
- Tailwind grid: `lg:grid-cols-[1.4fr_1fr_1fr_1fr]` 또는 `lg:grid-cols-[1.4fr_repeat(3,1fr)]`
- 모바일/태블릿 (`< lg`): 균등 4열 또는 1열
- **Hero `todayQuestion` 패널 우하단 메타 칩 변경 없음** (PR-12 의 "토론 N개" 칩 그대로)
- 시안 D rationale 패치 — `docs/rationale/main-page-redesign-concept-d.md` §3.4 비대칭 3 → 4 카드 명세 변경

### 3.8 PR-13 우선순위

- **Phase 1 (현재, docs PR 병렬)**: ADR-021 docs PR + PR-13 docs PR (또는 합본) — 일정 손실 0
- **Phase 2 (1주 선행)**: PR-13 코드 PR — NestJS testing + supertest + Playwright smoke + MSW + 5종 안전장치 (DB schema 격리 + secret scanner + Langfuse no-op fallback + GB10 ulimit + 환경변수 격리)
- **Phase 3 (PR-13 머지 + 1주 안정화 후)**: ADR-021 코드 PR 4분할 (마이그레이션 / API+RBAC / UI / 모더레이션)
- 검증 게이트: ADR-021 코드 PR 진입 시 PR-13 의 통합 e2e 통과 필수

근거: Session 14 §3.1 hotfix 11건 패턴 (단위 GREEN + 통합 결함 = DI / IMMUTABLE / contract mismatch / SWR / Throttler / vote shape / self-vote / docker env). ADR-021 표면적 (community CRUD + 권한 + 모더레이션 + audit log) > PR-12 표면적 약 3배 → hotfix 산술 폭발 회피.

---

## 4. 단계적 적용 (1기/2기/3기 트리거)

ADR-019 SM2 단계적 적용 패턴 재사용.

### 4.1 1기 (본 ADR-021 적용 범위)

- 옵션 G (virtual root question 시드)
- 카테고리 4종 (notice/free/study/resource)
- 1기 3-tier RBAC (user/operator/admin)
- 사용자 신고 + operator/admin queue + audit log
- 비대칭 4-카드
- PR-13 통합 e2e 하네스

### 4.2 2기 트리거

| 트리거 | 조치 |
|--------|------|
| community 글 ≥ 200건 또는 신고 빈도 ≥ 주 5건 | 옵션 F (Q&A 모음 mview) 또는 옵션 C (view + endpoint) 마이그레이션 + LLM-judge D3 Hybrid 자동 모더레이션 |
| 강사 ≥ 3명 또는 학생 글 수정 사고 ≥ 1건 | 4-tier RBAC 분리 (instructor / operator / admin) — operator 와 admin 명확 분리 |
| 학습 trail 정렬 강화 요구 | `/learn/board` 라우트 추가 (Agent C 안) |

### 4.3 3기 트리거

| 트리거 | 조치 |
|--------|------|
| 부정 사용자 ≥ 3건 | shadow_ban + 운영자 노트 + appeal 흐름 |
| 부트캠프 2기 (학생 ≥ 50명) | 옵션 G → 옵션 F/C 데이터 마이그레이션 (1~2일 작업) + virtual root question 제거 |
| 외부 검색 / SEO 필요 | 부분 비인증 read (Q-R6-04 재검토) — 별도 ADR |

---

## 5. PR-13 우선순위 + 검증 게이트

### 5.1 PR-13 도구 스택

| Layer | 도구 | 역할 |
|-------|-----|------|
| API 통합 | `@nestjs/testing` (보유) + `supertest` (보유) | NestJS Test.createTestingModule + 실 IoC + DB seed |
| Web smoke | `@playwright/test` (신규, ARM64 호환) | 브라우저 환경 critical path 1~2개 (login → community → 글 작성) |
| Mock | `msw` (신규) | vitest 단위 보강 + 백엔드 mock |
| 격리 (B 5종) | docker compose `test-api` schema + `gitleaks` + `LANGFUSE_DISABLED=1` + `ulimit` + `.env.test` | 운영 DB 분리 + secret 누설 차단 + Langfuse trace 누수 차단 + GB10 부하 차단 + 환경 분리 |

### 5.2 PR-13 회귀 게이트 — Session 14 hotfix 11건 모두 차단

| hotfix | 회귀 테스트 |
|--------|-----------|
| #1 DI 누락 (`@Optional()`) | NestJS Test.createTestingModule 실 IoC 검증 |
| #1 EXTRACT IMMUTABLE | migration-runner.e2e.test 의 expression index 검증 |
| #1 docker compose env | docker-compose.test 부팅 검증 |
| #2 jsonwebtoken expiresIn 충돌 | auth.e2e.test 의 refresh token 발급 검증 |
| #3 contract mismatch | discussion.e2e.test 의 응답 schema 검증 |
| #4 SWR 무한 루프 | Playwright network panel 의 request 빈도 검증 |
| #5 Throttler 부적합 | login 5회 후 다른 endpoint 호출 검증 |
| #6 vote shape | discussion.e2e.test 의 single endpoint body schema 검증 |
| #7 self-vote 차단 + currentUserId | useCurrentUserId mock + e2e 검증 |

### 5.3 PR-13 5종 안전장치 (B 안)

1. **DB schema 격리**: docker compose `test-api` 서비스 (별도 schema 또는 별도 컨테이너 5433/6380 포트)
2. **secret scanner**: CI 에 `gitleaks` 통합 + `.env.test` 하드코딩 금지
3. **Langfuse no-op fallback**: 통합 e2e 시 `LANGFUSE_PUBLIC_KEY` 미설정 → no-op
4. **GB10 ulimit**: aarch64 환경 connection pool + ulimit 명시
5. **환경변수 격리**: `.env.test` 별도 + CI 시 secret scanner 통과

---

## 6. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | ADR-021 본문 작성 (Session 15, consensus-013) — 사용자 결정 12건 + 1기/2기/3기 트리거 + PR-13 우선순위 + 시안 D §3.4 4-카드 변경 | consensus-013 + 사용자 응답 |

---

## 7. 참조

### 7.1 합의 / 설계 문서

- `docs/review/consensus-013-adr-021-community-hub.md` — 본 결정 합의 보고서
- `docs/architecture/community-hub-design.md` — 도메인 모델 + 카테고리 + 라우트 SDD
- `docs/architecture/community-rbac-design.md` — 1기 3-tier RBAC SDD
- `docs/architecture/community-moderation-design.md` — 모더레이션 1기/2기/3기 단계 SDD
- `docs/architecture/audit-log-design.md` — CWE-778 + WORM SDD
- `docs/architecture/integrated-e2e-harness-design.md` — PR-13 SDD
- `docs/review/tdd-plan-adr-021-community-hub.md` — TDD plan
- `docs/review/impact-adr-021-community-hub.md` — ADR-007 4차원 영향

### 7.2 관련 ADR

- ADR-016 §7 D3 Hybrid — audit log + 2기 LLM-judge 패턴 재사용
- ADR-018 — Salt rotation (현 영향 없음, 2기 자동 모더레이션 시 재검토)
- ADR-019 — SM2 단계적 적용 패턴 (1기/2기/3기 트리거)
- ADR-020 — UX 재설계 base (§6 행 추가, §11 패치)

### 7.3 코드 base

- `apps/api/src/modules/discussion/` — PR-10b 머지 (R4 토론 base)
- `apps/api/src/modules/users/entities/` — role 컬럼 추가 대상
- `apps/web/src/middleware.ts` — PUBLIC_PATHS 이중 방어 base (Session 14 c19bf03)
- `apps/web/src/app/play/solo/[questionId]/discussion/` — PR-12 라우트 (질문 종속, 변경 없음)
- `apps/web/src/lib/discussion/sanitize-schema.ts` — sanitize-schema 100% 재사용
- `apps/web/src/components/home/feature-cards.tsx` — 비대칭 4-카드 변경 대상

### 7.4 사전 결정 / 컨텍스트

- `docs/sessions/SESSION_2026-04-29-session-14.md` §3.1 — hotfix 11건 패턴 (PR-13 가동 근거)
- `docs/sessions/SESSION_2026-04-29-session-14.md` §4.2 — middleware PUBLIC_PATHS 사용자 결정
- `docs/review/consensus-012-pr-12-discussion-page.md` §2.4 — 옵션 A 채택 + 옵션 C 후속 분리 (본 ADR 발단)
- `docs/rationale/main-page-redesign-concept-d.md` §3.4 — 비대칭 3 → 4 카드 패치 대상
- 사용자 메모리 (외부): Slack 미사용 + 수업 Zoom + 학생 정보 공유 커뮤니티 부재 (Session 15 응답)

---

**ADR-021 끝.** docs PR 머지 후 PR-13 코드 PR (Phase 2, 1주 선행) → ADR-021 코드 PR 4분할 (Phase 3) 진입.
