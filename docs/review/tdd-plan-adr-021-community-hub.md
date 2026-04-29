# TDD Plan — ADR-021 (Community Hub) + PR-13 (통합 e2e 하네스)

> **합의**: `docs/review/consensus-013-adr-021-community-hub.md`
> **결정**: `docs/decisions/ADR-021-community-hub.md`
> **작성**: 2026-04-29 (Session 15)

---

## 0. 진행 순서 (Phase)

| Phase | 산출물 | 머지 시점 | 의존 |
|-------|-------|---------|------|
| **Phase 1** | ADR-021 docs PR (본 PR) + PR-13 docs (병합) | 2026-04-29 | consensus-013 |
| **Phase 2** | PR-13 코드 PR (통합 e2e 하네스) | docs PR 머지 후 | — |
| Phase 3 | ADR-021 코드 PR 4분할 (마이그레이션 / API+RBAC / UI / 모더레이션) | PR-13 머지 + 1주 안정화 후 | PR-13 검증 게이트 |
| Phase 4 (2기 트리거) | 옵션 F/C 마이그레이션 + LLM-judge D3 Hybrid | community 글 ≥ 200건 또는 신고 ≥ 주 5건 | ADR-016 §7 |

**1주 선행 머지 정량화** (Q-R6-11 결정):
- PR-13 코드 PR 머지 → 1주 외부 노트북 라이브 검증 → ADR-021 코드 PR 진입

---

## 1. PR-13 (통합 e2e 하네스) 7 Phase

### Phase 1A — NestJS Test.createTestingModule 부트스트랩

**RED**:
```typescript
// apps/api/test/e2e-setup.test.ts
describe('e2e bootstrap', () => {
  it('실 IoC + DI 검증 — DiscussionService 의 @Optional() 의존성 누락 시 부팅 실패', async () => {
    const app = await bootstrapTestApp();
    expect(app).toBeDefined();
    const svc = app.get(DiscussionService);
    expect(svc).toBeDefined();
  });
});
```

**GREEN**: `apps/api/test/e2e-setup.ts` 의 `bootstrapTestApp()` 구현. `Test.createTestingModule({ imports: [AppModule] }).compile()` + `app.init()`.

**REFACTOR**: helpers/seed-helper.ts 분리. 회귀: Session 14 hotfix #1 (DI 누락) 차단.

### Phase 1B — auth e2e (jsonwebtoken expiresIn 충돌)

**RED**:
```typescript
// apps/api/test/auth.e2e.test.ts
describe('auth refresh — jsonwebtoken option 충돌 회귀', () => {
  it('login → refresh → 새 access token 발급 (PR-10a hotfix #2 회귀)', async () => {
    const { cookies } = await loginHelper(app, 'user@test.com', 'pw');
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.access).toBeDefined();
  });
});
```

**GREEN**: `apps/api/src/modules/auth/refresh-token.service.ts` 의 `signAsync` → `jsonwebtoken` 직접 호출 (Session 14 hotfix #2 적용 상태 검증).

### Phase 1C — discussion contract + Throttler skip + vote shape + self-vote

**RED**: 4종 회귀 테스트
- 응답 schema (hotfix #3): `expect(thread).toMatchObject({ id, title, ... })`
- Throttler skip (hotfix #5): login 5회 → `/users/me` 200
- vote shape (hotfix #6): `POST /discussion/vote` body schema 일치
- self-vote 차단 (hotfix #7): 본인 글 vote → 403

**GREEN**: 모두 PR-12 머지 상태 검증.

### Phase 1D — migration runner (IMMUTABLE expression index)

**RED**:
```typescript
// apps/api/test/migration-runner.e2e.test.ts
describe('migration runner', () => {
  it('1714000013000 hot expression index 마이그레이션 실행 + 인덱스 작동', async () => {
    await dataSource.runMigrations();
    const result = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_discussion_threads_hot'`,
    );
    expect(result[0].indexdef).toContain('IMMUTABLE');
  });
});
```

**GREEN**: 마이그레이션 1714000013000 의 `EXTRACT (EPOCH FROM AT TIME ZONE 'UTC')` 캐스트 검증 (Session 14 hotfix #1).

### Phase 1E — Playwright smoke (apps/e2e)

**RED**:
```typescript
// apps/e2e/tests/auth-flow.spec.ts
test('login → /users/me → header 정합', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@test.com');
  await page.fill('[name="password"]', 'pw');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  await expect(page.locator('header')).toContainText('user@test.com');
});

// apps/e2e/tests/discussion-flow.spec.ts
test('SWR 무한 루프 차단 (hotfix #4 회귀)', async ({ page }) => {
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));

  await loginAsUser(page);
  await page.goto('/play/solo/{question}/discussion');
  await page.waitForTimeout(5000);

  const discussionRequests = requests.filter((u) => u.includes('/discussion/'));
  expect(discussionRequests.length).toBeLessThanOrEqual(3);  // 5초 내 ≤ 3회
});
```

**GREEN**: `@playwright/test` 설치 + `apps/e2e/` 패키지 + `docker-compose.test.yml`.

### Phase 1F — 5종 안전장치

**RED + GREEN**: 각 안전장치 회귀
- DB schema 격리: `test-db` 컨테이너 분리 검증
- secret scanner: `.env.test` dummy + gitleaks 통과
- Langfuse no-op: `LANGFUSE_DISABLED=1` 시 trace queue 비어있음
- GB10 ulimit: `ulimit -n` 65536 적용 확인
- 환경변수 격리: `.env.test` vs `.env` 분리

### Phase 1G — CI 통합 (GitHub Actions)

**RED + GREEN**: `.github/workflows/e2e.yml` 작성 + matrix (api-e2e + web-e2e + secret-scan).

---

## 2. ADR-021 코드 PR 4분할 (Phase 3)

### Phase 2A — 마이그레이션 5종

#### 2A.1 `1714000020000-AddIsVirtualToQuestions`

**RED**:
```typescript
describe('마이그레이션 1714000020000', () => {
  it('is_virtual 컬럼 추가 + virtual root question 시드', async () => {
    await dataSource.runMigrations();
    const q = await dataSource.query(
      `SELECT * FROM questions WHERE id = $1`,
      ['00000000-0000-0000-0000-000000000001'],
    );
    expect(q[0]).toMatchObject({ title: '자유게시판', is_virtual: true });
  });
});
```

**GREEN**: 마이그레이션 작성.

#### 2A.2 `1714000021000-AddCategoryToDiscussionThreads`

**RED**:
```typescript
it('category 컬럼 추가 + CHECK 제약', async () => {
  await dataSource.runMigrations();
  await expect(
    dataSource.query(
      `INSERT INTO discussion_threads (..., category) VALUES (..., 'invalid')`,
    ),
  ).rejects.toThrow('chk_discussion_category');
});
```

#### 2A.3 `1714000022000-AddRoleToUsers`

**RED**:
```typescript
it('role 컬럼 추가 + 기존 사용자 user 기본값', async () => {
  await dataSource.runMigrations();
  const users = await dataSource.query(`SELECT role FROM users LIMIT 5`);
  users.forEach((u) => expect(u.role).toBe('user'));
});

it('role enum 외 값 차단', async () => {
  await expect(
    dataSource.query(`UPDATE users SET role = 'superadmin' WHERE id = $1`, [userId]),
  ).rejects.toThrow('chk_user_role');
});
```

#### 2A.4 `1714000023000-AddAuditLog` — WORM 트리거

**RED**:
```typescript
it('audit_log INSERT 통과', async () => {
  await dataSource.query(
    `INSERT INTO audit_log (target_type, target_id, action, by_user_id) VALUES ($1, $2, $3, $4)`,
    ['discussion_thread', threadId, 'lock', operatorId],
  );
});

it('audit_log UPDATE 차단 (WORM)', async () => {
  const insert = await dataSource.query(`INSERT INTO audit_log (...) VALUES (...) RETURNING id`);
  await expect(
    dataSource.query(`UPDATE audit_log SET reason='hack' WHERE id=$1`, [insert[0].id]),
  ).rejects.toThrow('audit_log is WORM');
});

it('audit_log DELETE 차단 (WORM)', async () => { /* 동일 패턴 */ });
it('audit_log TRUNCATE 차단 (WORM)', async () => { /* 동일 패턴 */ });
```

#### 2A.5 `1714000024000-AddDiscussionReports` + `1714000025000-AddModerationColumns`

**RED**: 신고 테이블 + 모더레이션 컬럼 (is_locked / is_pinned / hidden_by_admin).

### Phase 2B — API + RBAC

#### 2B.1 RolesGuard

**RED**:
```typescript
describe('RolesGuard', () => {
  it('@Roles 데코레이터 없으면 통과 (JwtAuthGuard 만)', () => { /* ... */ });
  it('user 가 @Roles("operator") endpoint 호출 시 403', () => { /* ... */ });
  it('operator 가 @Roles("operator") endpoint 호출 시 통과', () => { /* ... */ });
});
```

**GREEN**: `apps/api/src/modules/auth/guards/roles.guard.ts` 작성 + `apps/api/src/modules/auth/decorators/roles.decorator.ts` + `app.module.ts` APP_GUARD 등록.

#### 2B.2 backend `@Public()` 제거 (Q-R6-04 + Q-R6-05)

**RED**:
```typescript
it('비인증 GET /api/discussion/questions/:id/threads → 401', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/discussion/questions/abc/threads')
    .expect(401);
});
```

**GREEN**: `discussion.controller.ts` 의 `@Public()` 데코레이터 3종 제거.

#### 2B.3 community endpoint 신규

**RED**: 8종 endpoint 회귀 (community-hub-design.md §5 참조).

**GREEN**: `discussion.controller.ts` + `discussion.service.ts` 확장.

#### 2B.4 학생 글 수정 코드 강제 (Q-R6-09)

**RED**:
```typescript
it('operator 가 본인 외 글 수정 시 403 (코드 강제)', async () => {
  await loginAsRole(app, 'operator');
  const res = await request(app.getHttpServer())
    .patch(`/api/discussion/posts/${otherStudentPostId}`)
    .set('Cookie', operatorCookies)
    .send({ body: 'modified' })
    .expect(403);
  expect(res.body.message).toContain('학생 글을 수정할 수 없습니다');
});

it('admin 이 본인 외 글 수정 시 200 + audit log INSERT', async () => {
  await loginAsRole(app, 'admin');
  await request(app.getHttpServer())
    .patch(`/api/discussion/posts/${otherStudentPostId}`)
    .set('Cookie', adminCookies)
    .send({ body: 'admin override', reason: '학생 요청' })
    .expect(200);

  const log = await dataSource.query(`SELECT * FROM audit_log WHERE target_id = $1`, [otherStudentPostId]);
  expect(log[0]).toMatchObject({ action: 'update', reason: '학생 요청' });
});
```

**GREEN**: `DiscussionService.updatePost` 에 role 분기 + audit log INSERT (트랜잭션 내).

### Phase 2C — UI

#### 2C.1 community 라우트 + 페이지

**RED**: vitest + @testing-library/react
- `/community` 페이지 렌더 + thread list 표시
- `/community/[category]` segment 라우트 + 카테고리 필터
- `/community/threads/[threadId]` 상세
- 비인증 시 middleware redirect

**GREEN**: `apps/web/src/app/community/` 라우트 트리 + Server shell + Client SWR.

#### 2C.2 비대칭 4-카드 (Q-R6-12)

**RED**:
```typescript
describe('FeatureCards 4-카드', () => {
  it('lg 이상에서 비대칭 4-카드 (1.4fr 1fr 1fr 1fr)', () => { /* ... */ });
  it('Community 카드 신규 표시', () => { /* ... */ });
  it('게스트 시 Community 카드 클릭 → /login?next=/community', () => { /* ... */ });
});
```

**GREEN**: `apps/web/src/components/home/feature-cards.tsx` 의 grid → `lg:grid-cols-[1.4fr_1fr_1fr_1fr]` + `<CommunityCard>` 컴포넌트 추가.

#### 2C.3 카테고리 dropdown (글 작성)

**RED**: 카테고리 enum 4종 + role 분기 (`notice` 는 operator+ 만 노출).

**GREEN**: `<ThreadComposer>` 카테고리 dropdown 추가.

### Phase 2D — 모더레이션

#### 2D.1 신고 endpoint + UI

**RED**: 사용자 신고 → 404 회피 + UNIQUE 제약 (동일 사용자 중복 신고 차단).

#### 2D.2 모더레이션 queue (operator/admin)

**RED**: `/admin/moderation` 라우트 + RolesGuard.

#### 2D.3 lock/pin/hide/restore + audit log

**RED**: 트랜잭션 일관성 — 모더레이션 액션 실패 시 audit log 도 롤백.

---

## 3. 추정 LOC + 일정

| Phase | 작업 | LOC | 일정 |
|-------|------|-----|------|
| **PR-13 (Phase 2 in 합의 timeline)** | NestJS testing + helpers + e2e 4종 + Playwright smoke + 5종 안전장치 + CI | ~2700 | ~4d |
| ADR-021 코드 PR-A (마이그레이션) | 마이그레이션 5종 + 회귀 테스트 | ~500 | 1d |
| ADR-021 코드 PR-B (API + RBAC) | RolesGuard + community endpoint + Public 제거 + 학생 글 수정 코드 강제 | ~1200 | 2d |
| ADR-021 코드 PR-C (UI) | community 라우트 + 4-카드 + 카테고리 dropdown | ~1500 | 2d |
| ADR-021 코드 PR-D (모더레이션) | 신고 + queue + lock/pin/hide + audit log INSERT | ~1000 | 1.5d |
| **합계** | — | **~6900** | **~10.5d** |

PR-13 1주 선행 머지 + ADR-021 코드 4분할 = 외부 노트북 검증 + hotfix 흡수 buffer 포함.

---

## 4. 회귀 테스트 카운트 추정

| Phase | RED 신규 테스트 | 회귀 보호 |
|-------|----------------|----------|
| PR-13 Phase 1A-G | ~120 | hotfix 11건 회귀 매트릭스 |
| ADR-021 PR-A | ~25 | 마이그레이션 5종 + WORM 트리거 |
| ADR-021 PR-B | ~80 | RolesGuard + community endpoint + 학생 글 수정 코드 강제 |
| ADR-021 PR-C | ~60 | community UI + 4-카드 + 카테고리 |
| ADR-021 PR-D | ~50 | 모더레이션 + audit log + 신고 UNIQUE |
| **합계** | **~335** | api 1284 + web 149 → ~1768 |

---

## 5. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 TDD plan 최초 작성 (Session 15, consensus-013) | 사용자 결정 12건 |

---

## 6. 참조

- `docs/decisions/ADR-021-community-hub.md`
- `docs/architecture/community-hub-design.md`
- `docs/architecture/community-rbac-design.md`
- `docs/architecture/community-moderation-design.md`
- `docs/architecture/audit-log-design.md`
- `docs/architecture/integrated-e2e-harness-design.md`
- `docs/review/consensus-013-adr-021-community-hub.md`
