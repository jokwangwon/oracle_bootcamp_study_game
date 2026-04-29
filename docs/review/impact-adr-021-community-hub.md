# Impact Analysis — ADR-021 (Community Hub) + PR-13 (통합 e2e 하네스)

> **합의**: `docs/review/consensus-013-adr-021-community-hub.md`
> **결정**: `docs/decisions/ADR-021-community-hub.md`
> **방법론**: ADR-007 4차원 (의존성 / 마이그레이션 / API 변경 / 운영)
> **작성**: 2026-04-29 (Session 15)

---

## 1. 의존성 영향

### 1.1 신규 의존성 (web)

| 패키지 | 버전 | 라이선스 | 용량 | aarch64 | 도입 PR |
|--------|-----|---------|------|---------|---------|
| `@playwright/test` | ^1.48 | Apache-2.0 | ~300MB (Chromium) | ✅ 공식 ARM64 | PR-13 |
| `msw` | ^2.0 | MIT | ~5MB | ✅ | PR-13 |

### 1.2 신규 의존성 (api)

**0종** — `@nestjs/testing` + `supertest` 모두 보유 (devDeps).

### 1.3 신규 의존성 (root)

| 도구 | 용도 | 도입 시점 |
|------|-----|---------|
| `gitleaks` (CI) | secret scanner | PR-13 CI workflow |

### 1.4 영향받는 기존 의존성

- `react-markdown@^9` + `rehype-sanitize@^6` (PR-12 도입) — 100% 재사용
- `swr@^2` (PR-12 도입) — 100% 재사용
- `sanitize-html@^2.17.3` (PR-10b 도입) — 100% 재사용
- `class-validator` (기존) — 카테고리 enum 검증에 활용
- `langfuse-langchain` (기존) — `LANGFUSE_DISABLED=1` no-op fallback 추가 (PR-13)

### 1.5 의존성 위험

| 위험 | 가능성 | 완화 |
|------|-------|------|
| Playwright Chromium ARM64 호환성 | 낮음 | 공식 v1.40+ ARM64 빌드, GB10 환경 검증 PR-13 Phase 1E |
| msw v2 breaking changes | 낮음 | 공식 stable, vitest 통합 검증 PR-13 |
| gitleaks license 변경 | 낮음 | 공식 무료 라이선스, GitHub Actions 무료 host |

---

## 2. 마이그레이션 영향

### 2.1 신규 마이그레이션 (Phase 3)

| 파일 | 작업 | LOC | DDL 시간 (1만 row 추정) | 운영 부하 |
|------|------|-----|----------------------|---------|
| `1714000020000-AddIsVirtualToQuestions.ts` | `is_virtual` 컬럼 + virtual root question 시드 | ~30 | < 1초 | 0 |
| `1714000021000-AddCategoryToDiscussionThreads.ts` | `category` 컬럼 + CHECK + 인덱스 | ~30 | ~2~5초 | 낮음 |
| `1714000022000-AddRoleToUsers.ts` | `role` 컬럼 + CHECK + 인덱스 | ~25 | < 1초 | 0 |
| `1714000023000-AddAuditLog.ts` | audit_log 테이블 + WORM 트리거 + 인덱스 3종 | ~70 | ~1초 (테이블 신규) | 0 |
| `1714000024000-AddDiscussionReports.ts` | discussion_reports 테이블 + UNIQUE | ~40 | < 1초 | 0 |
| `1714000025000-AddModerationColumns.ts` | is_locked / is_pinned / hidden_by_admin 컬럼 | ~20 | < 1초 | 0 |

**합계**: 6건 마이그레이션, 총 DDL 시간 < 10초 (1만 row 환경).

### 2.2 CONCURRENTLY 옵션 불요 (Q-R6-08 N/A)

옵션 G (virtual root question 시드) 채택으로 모든 마이그레이션이 **컬럼 추가 + 시드 INSERT** 만 — table rewrite 없음. CONCURRENTLY 옵션 불필요.

### 2.3 ROLLBACK 시나리오

| 마이그레이션 | ROLLBACK 영향 |
|------------|------------|
| 1714000020000 | virtual root question 삭제 → discussion_threads.question_id FK 위반 시 cascade 필요 |
| 1714000021000 | category 컬럼 삭제 → 자유게시판 분류 데이터 손실 |
| 1714000022000 | role 컬럼 삭제 → 운영자 권한 손실 |
| 1714000023000 | audit_log 테이블 DROP → 감사 기록 영구 손실 (CWE-778) |

**ROLLBACK 정책**: 1기 운영 동안 ROLLBACK 절대 금지 (audit_log + role 정보 손실). 문제 발생 시 forward fix.

---

## 3. API 변경 영향

### 3.1 신규 endpoint (Phase 3)

| Method | Path | 권한 |
|--------|------|------|
| GET | `/api/community/threads` | user+ |
| GET | `/api/community/threads?category=...` | user+ |
| GET | `/api/community/threads/:threadId` | user+ |
| POST | `/api/community/threads` | user (notice 는 operator+) |
| PATCH | `/api/community/threads/:threadId` | owner / admin |
| DELETE | `/api/community/threads/:threadId` | owner / operator+ |
| GET | `/api/community/threads/:threadId/posts` | user+ |
| POST | `/api/community/threads/:threadId/posts` | user+ |
| POST | `/api/discussion/reports` | user+ |
| GET | `/api/admin/moderation/queue` | operator+ |
| POST | `/api/admin/moderation/threads/:id/lock` | operator+ |
| POST | `/api/admin/moderation/threads/:id/unlock` | operator+ |
| POST | `/api/admin/moderation/threads/:id/pin` | operator+ |
| POST | `/api/admin/moderation/threads/:id/hide` | operator+ |
| POST | `/api/admin/moderation/posts/:id/hide` | operator+ |
| POST | `/api/admin/moderation/posts/:id/restore` | operator+ |
| POST | `/api/admin/moderation/reports/:id/resolve` | operator+ |
| POST | `/api/admin/moderation/reports/:id/dismiss` | operator+ |
| GET | `/api/admin/audit-log/target/:type/:id` | admin |
| GET | `/api/admin/audit-log/actor/:userId` | admin |
| GET | `/api/admin/audit-log/recent` | admin |
| GET | `/api/operator/audit-log/me` | operator+ |
| PATCH | `/api/users/:id/role` | admin |

**총 23개 신규 endpoint**.

### 3.2 변경 endpoint (PR-12 머지 상태)

| Method | Path | 변경 |
|--------|------|------|
| GET | `/api/discussion/questions/:questionId/threads` | **`@Public()` 제거** (Q-R6-04) → 401 if 비인증 |
| GET | `/api/discussion/threads/:threadId` | **`@Public()` 제거** → 401 if 비인증 |
| GET | `/api/discussion/threads/:threadId/posts` | **`@Public()` 제거** → 401 if 비인증 |

### 3.3 응답 schema 확장

`ThreadDto` 에 `category` + `isVirtual` 필드 추가:

```typescript
interface ThreadDto {
  id: string;
  questionId: string;
  category: 'discussion' | 'notice' | 'free' | 'study' | 'resource';  // 신규
  isVirtual: boolean;  // 신규
  // ... 기존 필드
}
```

### 3.4 클라이언트 영향

- PR-12 의 `apps/web/src/lib/discussion/api-client.ts` 에 8종 community endpoint 추가
- VoteButton / PostTree / ThreadComposer 등 컴포넌트는 100% 재사용 (분기 추가)
- middleware PUBLIC_PATHS 변경 없음 (Session 14 적용 상태 유지)

### 3.5 API 변경 위험

| 위험 | 가능성 | 완화 |
|------|-------|------|
| `@Public()` 제거 누락 | 중간 | PR-13 e2e 회귀 (community-auth.e2e.spec.ts) |
| ThreadDto schema 변경 → PR-12 클라이언트 회귀 | 낮음 | 추가 필드만 (제거 없음) |
| 23개 endpoint 권한 분기 누락 | 중간 | RolesGuard 통합 + e2e 회귀 |

---

## 4. 운영 영향

### 4.1 신규 환경변수

| 환경변수 | 용도 | 도입 시점 |
|---------|-----|---------|
| `LANGFUSE_DISABLED` | e2e 시 Langfuse no-op fallback | PR-13 |
| `TEST_DB_PASSWORD` | e2e DB 격리 dummy | PR-13 (.env.test) |
| `TEST_JWT_SECRET` | e2e JWT dummy | PR-13 |
| `TEST_HASH_SALT` | e2e USER_TOKEN_HASH_SALT dummy | PR-13 |

기존 환경변수 변경 없음.

### 4.2 docker-compose 변경

`apps/e2e/docker-compose.test.yml` 신규 — 운영 docker-compose.yml 영향 없음 (별도 파일).

### 4.3 운영 모니터링

| 메트릭 | 도입 |
|-------|-----|
| audit_log INSERT 빈도 | Phase 3 |
| 신고 queue 길이 | Phase 3 |
| community read latency (옵션 G hot 정렬) | Phase 3 |
| 카테고리별 글 카운트 | Phase 3 |
| 모더레이션 액션 빈도 | Phase 3 |

ADR-017 운영 지표 (MT6/MT7/MT8) 와 별개 — 신규 지표 정의는 별도 작업.

### 4.4 CI/CD 영향 (PR-13 머지 후)

- GitHub Actions 추가 workflow: `e2e.yml` (api-e2e + web-e2e + secret-scan)
- 추정 CI 시간 증가: +5~8분
- Playwright Chromium 캐시 전략: turbo cache + GitHub Actions cache key

### 4.5 사용자 작업 (운영자)

| 작업 | 시점 |
|------|-----|
| `.env` 에 `LANGFUSE_DISABLED` 미설정 (운영 환경 무관) | 변경 없음 |
| 마이그레이션 실행 후 admin 사용자 role 부여 (`UPDATE users SET role='admin' WHERE email=...`) | Phase 3 |
| 강사 사용자 role 부여 (`UPDATE users SET role='operator' WHERE email=...`) | Phase 3 |
| `apps/e2e/.env.test` dummy 값 (CI secret 오버라이드) | PR-13 |
| `gitleaks` CI 통합 후 secret 누설 0 검증 | PR-13 |

### 4.6 운영 위험

| 위험 | 가능성 | 영향 | 완화 |
|------|-------|------|-----|
| audit_log 테이블 폭증 (예상보다 많음) | 낮음 | 디스크 부담 | 1년 후 archive (3기) |
| 강사 role 부여 실수 (admin 부여) | 중간 | 의도치 않은 권한 상승 | role 변경 endpoint audit log 강제 |
| 학생이 role 변경 시도 (CWE-269) | 낮음 | RolesGuard 우회 시 | RolesGuard 단위 테스트 + e2e 회귀 |
| 운영 DB 마이그레이션 실수 (테스트 DB 와 혼동) | 낮음 | 데이터 손실 | docker-compose.test.yml 별도 파일 + ports 분리 (5433) |
| Playwright CI 시간 증가 (불안정 시 retry) | 중간 | PR 머지 지연 | retry 1회 + flaky 테스트 격리 |

---

## 5. 종합 위험도 평가

| 차원 | 위험도 | 주요 항목 |
|------|-------|---------|
| 의존성 | 낮음 | Playwright + msw 모두 안정 stable |
| 마이그레이션 | 낮음 | 옵션 G 채택으로 table rewrite 없음 |
| API | 중간 | 23개 신규 endpoint + `@Public()` 제거 |
| 운영 | 중간 | audit_log + role 부여 + CI 시간 증가 |

**종합 위험도**: **낮음~중간** — PR-13 1주 선행 머지가 위험을 추가로 50% 이상 감소.

---

## 6. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 영향 분석 최초 작성 (Session 15, consensus-013) | 사용자 결정 12건 |

---

## 7. 참조

- `docs/decisions/ADR-007-change-impact-analysis.md` — 4차원 영향 분석 base
- `docs/decisions/ADR-021-community-hub.md`
- `docs/architecture/community-hub-design.md` (도메인 모델)
- `docs/architecture/community-rbac-design.md` (RBAC + endpoint 권한)
- `docs/architecture/community-moderation-design.md` (모더레이션 endpoint)
- `docs/architecture/audit-log-design.md` (audit_log 영향)
- `docs/architecture/integrated-e2e-harness-design.md` (PR-13 영향)
- `docs/review/tdd-plan-adr-021-community-hub.md` (Phase 매트릭스)
