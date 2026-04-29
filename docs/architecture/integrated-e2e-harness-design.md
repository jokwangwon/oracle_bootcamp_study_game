# Integrated E2E Harness SDD — PR-13 통합 e2e 하네스

> **상태**: Accepted (2026-04-29, consensus-013, ADR-021)
> **합의**: `docs/review/consensus-013-adr-021-community-hub.md` §4.7-4.8
> **결정**: `docs/decisions/ADR-021-community-hub.md` §3.8 / §5
> **선행 ADR**: ADR-006 (Docker-First), ADR-009 (LangChain + Langfuse)
> **트리거**: Session 14 §3.1 hotfix 11건 패턴 (단위 테스트 GREEN + 통합 결함)

---

## 1. 배경

PR-12 머지 (Session 14) 시 외부 노트북 라이브 검증에서 **hotfix 11건 발생**. 단위 테스트 1284 (api) + 149 (web) 모두 GREEN 인데도 통합/실 부팅에서 결함 다수:

| # | 유형 | 단위 테스트로 잡힘? |
|---|-----|-----------------|
| #1 | DI 누락 (`@Optional()`), pg IMMUTABLE, docker compose env | ❌ |
| #2 | jsonwebtoken `expiresIn + exp` 충돌 (mock JwtService) | ❌ |
| #3 | 클라/서버 응답 schema mismatch | ❌ (mock 응답) |
| #4 | SWR 무한 루프 (default option) | ❌ |
| #5 | ThrottlerModule 부적합 (login 5회 후 모든 read 429) | ❌ |
| #6 | Vote endpoint shape mismatch | ❌ |
| #7 | self-vote 차단 + currentUserId 미전달 | ❌ |
| #8 | docker compose env 6종 누락 | ❌ |

**근본 원인**: 통합 테스트 / E2E 부재.

ADR-021 표면적 (community CRUD + 권한 + 모더레이션 + audit log) > PR-12 표면적 약 3배 → hotfix 산술 폭발 회피 위해 **PR-13 1주 선행 머지** (Q-R6-11 결정).

---

## 2. 도구 스택

### 2.1 보유 자산

| 도구 | 버전 | 위치 |
|-----|-----|------|
| `@nestjs/testing` | ^10.3.0 | `apps/api` devDeps |
| `supertest` | ^7.2.2 | `apps/api` devDeps |
| `@types/supertest` | ^6.0.3 | `apps/api` devDeps |
| `vitest` | ^1.6.0 | `apps/web` devDeps |
| `@testing-library/react` | ^15.0.0 | `apps/web` devDeps |

→ **API 측 신규 의존성 0** (즉시 가동 가능).

### 2.2 신규 의존성

| 도구 | 패키지 | 용량 | aarch64 호환 | 용도 |
|------|-------|-----|------------|-----|
| Playwright | `@playwright/test@^1.48` | ~300MB (Chromium) | ✅ 공식 ARM64 빌드 | web smoke 1~2개 |
| MSW | `msw@^2.0` | ~5MB | ✅ | vitest 단위 보강 + 백엔드 mock |

→ **web 측 신규 의존성 2종**.

### 2.3 거부 (대안 검토 후)

| 도구 | 거부 사유 |
|------|---------|
| Cypress | 무거움 (300MB+), CI 느림 |
| Bun test | aarch64 GB10 안정성 미검증, NestJS metadata reflection 깨짐 보고 |
| Deno test | npm/pnpm 생태계 분리 — monorepo 와 불일치 |
| vitest browser mode | v1.x alpha 단계, 안정성 부족 |
| Pact (contract test) | broker 운영 부담 — 부트캠프 과잉 |
| k6 (부하) | 부트캠프 20명 환경에 부하 테스트 무관 |

---

## 3. 구조

### 3.1 monorepo 디렉터리

```
apps/
├── api/
│   └── test/                              ← 신규
│       ├── e2e-setup.ts                   ← Test.createTestingModule 부트스트랩
│       ├── auth.e2e.test.ts               ← cookie/refresh/revoke + jsonwebtoken (hotfix #2)
│       ├── discussion.e2e.test.ts         ← vote shape (hotfix #6) + self-vote (hotfix #7) + Throttler skip (hotfix #5)
│       ├── community.e2e.test.ts          ← (ADR-021 머지 후) 카테고리 + RBAC + audit log
│       ├── audit-log.e2e.test.ts          ← WORM 트리거 + 트랜잭션 일관성
│       ├── migration-runner.e2e.test.ts   ← IMMUTABLE expression index (hotfix #1)
│       └── helpers/
│           ├── docker-compose.test.ts     ← compose env 누락 검증 (hotfix #1)
│           ├── login-helper.ts
│           ├── role-helper.ts             ← 사용자 role 변경 (1기 3-tier 검증)
│           └── seed-helper.ts
├── e2e/                                    ← 신규 monorepo 패키지 (Playwright)
│   ├── package.json
│   ├── playwright.config.ts
│   ├── tests/
│   │   ├── auth-flow.spec.ts              ← login → /users/me → header (hotfix #5)
│   │   ├── discussion-flow.spec.ts        ← 토론 작성 → vote → SWR 안정성 (hotfix #4)
│   │   └── community-flow.spec.ts         ← (ADR-021 머지 후) 자유게시판 작성 → 모더레이션
│   ├── docker-compose.test.yml            ← API + DB + Langfuse mock
│   └── .env.test
├── api/jest-e2e.json                      ← e2e jest config (단위와 분리)
└── web/vitest.config.ts                    ← MSW 통합
```

### 3.2 NestJS Test.createTestingModule (실 IoC)

```typescript
// apps/api/test/e2e-setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // 실 DB / 실 IoC — Session 14 hotfix #1 (DI 누락) 회귀 차단
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
```

### 3.3 Playwright config (aarch64 호환)

```typescript
// apps/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: false,  // GB10 단일 환경, 동시 실행 회피
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

---

## 4. 5종 안전장치 (B 안)

### 4.1 DB schema 격리

```yaml
# apps/e2e/docker-compose.test.yml
services:
  test-db:
    image: postgres:16-alpine
    ports:
      - "5433:5432"  # 운영 DB (5432) 와 분리
    environment:
      POSTGRES_DB: bootcamp_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: ${TEST_DB_PASSWORD}

  test-api:
    build: ../api
    environment:
      DATABASE_URL: postgres://test_user:${TEST_DB_PASSWORD}@test-db:5432/bootcamp_test
      JWT_SECRET: ${TEST_JWT_SECRET}
      USER_TOKEN_HASH_SALT: ${TEST_HASH_SALT}
      LANGFUSE_DISABLED: "1"  # 안전장치 #3
      CORS_ORIGIN: http://localhost:3001
    ports:
      - "3002:3000"  # 운영 API 와 분리
    depends_on:
      - test-db

  test-web:
    build: ../web
    environment:
      NEXT_PUBLIC_API_URL: http://test-api:3000
    ports:
      - "3001:3000"  # 운영 web 과 분리
```

### 4.2 secret scanner (gitleaks)

```yaml
# .github/workflows/e2e.yml (별도 PR-13 이후)
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

`.env.test` / `apps/e2e/.env.test` 는 **dummy 값만 + .gitignore 등록**. 실 secret 은 GitHub Actions secrets 사용.

### 4.3 Langfuse no-op fallback

```typescript
// apps/api/src/observability/langfuse-langchain.ts
import { CallbackHandler } from 'langfuse-langchain';

const isE2E = process.env.LANGFUSE_DISABLED === '1';

export function createLangfuseHandler() {
  if (isE2E || !process.env.LANGFUSE_PUBLIC_KEY) {
    return undefined;  // no-op fallback
  }
  return new CallbackHandler({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
    flushAt: 0,  // e2e 시 trace queue 누적 차단
  });
}
```

### 4.4 GB10 ulimit

```yaml
# apps/e2e/docker-compose.test.yml (계속)
services:
  test-api:
    # ...
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
```

aarch64 GB10 119GB 통합 메모리 환경에서 connection pool 폭증 차단.

### 4.5 환경변수 격리

```bash
# apps/e2e/.env.test (dummy)
TEST_DB_PASSWORD=dummy_test_password_change_me
TEST_JWT_SECRET=dummy_jwt_secret_for_e2e_only
TEST_HASH_SALT=dummy_salt_e2e_only
LANGFUSE_DISABLED=1
```

CI 에서 GitHub Actions secrets 로 override.

---

## 5. Session 14 hotfix 11건 회귀 매트릭스

| hotfix | 회귀 테스트 위치 | 검증 방법 |
|--------|-------------|---------|
| #1 DI 누락 | `apps/api/test/e2e-setup.ts` | Test.createTestingModule 실 IoC 부팅 |
| #1 EXTRACT IMMUTABLE | `apps/api/test/migration-runner.e2e.test.ts` | 실 마이그레이션 실행 + expression index 작동 |
| #1 docker compose env | `apps/e2e/docker-compose.test.yml` | 부팅 검증 + helpers/docker-compose.test.ts |
| #2 jsonwebtoken expiresIn 충돌 | `apps/api/test/auth.e2e.test.ts` | refresh token 발급 + 유효 검증 |
| #3 contract mismatch | `apps/api/test/discussion.e2e.test.ts` | 응답 schema (Zod or class-validator) 검증 |
| #4 SWR 무한 루프 | `apps/e2e/tests/discussion-flow.spec.ts` | network panel request 빈도 검증 (5초 내 ≤ 3회) |
| #5 Throttler 부적합 | `apps/api/test/discussion.e2e.test.ts` | login 5회 → /users/me 200 (skip 검증) |
| #6 vote shape | `apps/api/test/discussion.e2e.test.ts` | single endpoint body schema 일치 |
| #7 self-vote 차단 | `apps/api/test/discussion.e2e.test.ts` | 본인 글 vote → 403 |
| #7 currentUserId | `apps/e2e/tests/discussion-flow.spec.ts` | useCurrentUserId mock + e2e 검증 |
| #8 docker env 누락 | `apps/e2e/docker-compose.test.yml` | 부팅 시 env 검증 + (실패 시 명확한 에러) |

---

## 6. ADR-021 검증 (Phase 3 진입 시)

PR-13 머지 + 1주 안정화 후 ADR-021 코드 PR 진입 시 추가 회귀:

### 6.1 community RBAC 회귀

```typescript
// apps/api/test/community.e2e.test.ts
describe('Community RBAC', () => {
  it('비인증 GET /community/threads → 401 (이중 방어)', async () => { /* ... */ });
  it('user 가 notice 작성 → 403', async () => { /* ... */ });
  it('operator 가 notice 작성 → 201', async () => { /* ... */ });
  it('operator 가 본인 외 학생 글 수정 → 403 (코드 강제)', async () => { /* ... */ });
  it('admin 이 본인 외 글 수정 → 200 + audit_log INSERT', async () => { /* ... */ });
});
```

### 6.2 audit_log WORM 회귀

```typescript
// apps/api/test/audit-log.e2e.test.ts
describe('audit_log WORM', () => {
  it('UPDATE 차단 (트리거)', async () => {
    await expect(dataSource.query(`UPDATE audit_log SET reason='hack' WHERE id=$1`, [logId]))
      .rejects.toThrow('audit_log is WORM');
  });
  it('lockThread 실패 시 audit_log 도 롤백', async () => { /* ... */ });
});
```

### 6.3 카테고리 + virtual root question 회귀

```typescript
describe('Community 카테고리', () => {
  it('virtual root question 의 thread = 자유게시판', async () => { /* ... */ });
  it('thread.category 가 enum 외 값 → 400 (DB CHECK)', async () => { /* ... */ });
  it('virtual root question 의 thread 는 HIGH-3 블러 적용 안 함 (always unlocked)', async () => { /* ... */ });
});
```

### 6.4 Playwright community smoke

```typescript
// apps/e2e/tests/community-flow.spec.ts
test('community 기본 흐름', async ({ page }) => {
  await loginAsUser(page);
  await page.goto('/community');
  await expect(page).toHaveURL('/community');

  // 자유 카테고리 새 글 작성
  await page.click('a[href="/community/threads/new"]');
  await page.fill('[name="title"]', 'E2E 테스트 글');
  await page.fill('[role="textbox"]', '본문 내용');
  await page.selectOption('[name="category"]', 'free');
  await page.click('button[type="submit"]');

  // 작성 확인
  await expect(page.locator('h1')).toContainText('E2E 테스트 글');

  // 본인 좋아요 시도 → 403 토스트
  await page.click('[aria-label*="좋아요"]');
  await expect(page.locator('.toast')).toContainText('자기 글에는');
});
```

---

## 7. CI 통합 (GitHub Actions, Layer 4)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  api-e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: dummy
          POSTGRES_DB: bootcamp_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm --filter api migration:run
      - run: pnpm --filter api test:e2e
        env:
          DATABASE_URL: postgres://test_user:dummy@localhost:5432/bootcamp_test
          JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
          USER_TOKEN_HASH_SALT: ${{ secrets.TEST_HASH_SALT }}
          LANGFUSE_DISABLED: "1"

  web-e2e:
    runs-on: ubuntu-latest
    needs: api-e2e
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm --filter e2e exec playwright install chromium --with-deps
      - run: docker compose -f apps/e2e/docker-compose.test.yml up -d
      - run: pnpm --filter e2e test
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/e2e/playwright-report/

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
```

---

## 8. 추정 LOC + 일정

| 단계 | 작업 | LOC | 일정 |
|------|------|-----|------|
| 1 | NestJS Test.createTestingModule + helpers | ~400 | 0.5d |
| 2 | api e2e — auth + discussion + migration | ~800 | 1d |
| 3 | apps/e2e 패키지 + Playwright 설치 + docker-compose.test.yml | ~300 | 0.5d |
| 4 | Playwright smoke — auth + discussion | ~600 | 1d |
| 5 | hotfix 11건 회귀 매트릭스 박기 | ~400 | 0.5d |
| 6 | CI 통합 (GitHub Actions matrix) | ~200 | 0.5d |
| **합계** | — | **~2700** | **~4d** |

PR-13 1주 선행 머지 = 4d 작업 + 1주 안정화 (외부 노트북 검증 buffer).

---

## 9. ADR-021 코드 PR 진입 게이트

PR-13 머지 + 1주 안정화 후 ADR-021 코드 PR 진입 시:

| 게이트 | 검증 |
|--------|------|
| `pnpm --filter api test:e2e` GREEN | api 통합 e2e 통과 |
| `pnpm --filter e2e test` GREEN | Playwright smoke 통과 |
| `gitleaks` 통과 | secret 누설 0 |
| `LANGFUSE_DISABLED=1` 시 통과 | Langfuse trace 누수 0 |
| Session 14 hotfix 11건 회귀 매트릭스 모두 GREEN | 결함 패턴 차단 |

---

## 10. 위험 요소

| 위험 | 가능성 | 영향 | 완화 |
|------|-------|------|------|
| Playwright Chromium 다운로드 부담 (~300MB) | 중간 | CI 캐시 누수 시 매번 다운로드 | turbo cache 분리 + GitHub Actions cache key 전략 |
| docker compose 부팅 시간 증가 | 중간 | CI 시간 +2~3분 | `services: postgres` (CI 내장) 활용 |
| 5종 안전장치 도입 비용 underestimate | 중간 | 일정 +1~2d | PR-13 1주 안정화 buffer 로 흡수 |
| GB10 aarch64 환경 의존성 호환 | 낮음 | Playwright 공식 ARM64 빌드 ✅ | `playwright install --with-deps` |
| Langfuse no-op fallback 미작동 | 중간 | trace queue 폭증 + flaky | `flushAt: 0` 강제 + e2e 시 환경변수 검증 |
| MSW 와 SWR 충돌 (web 단위 보강) | 낮음 | mock 응답이 SWR cache 와 race | MSW handlers 명시 + dedupingInterval 검증 |

---

## 11. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 SDD 최초 작성 (Session 15, consensus-013) | Session 14 hotfix 11건 + Q-R6-11 |

---

## 12. 참조

- `docs/decisions/ADR-021-community-hub.md` §3.8 / §5
- `docs/sessions/SESSION_2026-04-29-session-14.md` §3.1 (hotfix 11건 패턴)
- `docs/architecture/community-hub-design.md` (ADR-021 코드 PR 진입 시 회귀 대상)
- `docs/architecture/community-rbac-design.md` (RBAC 회귀)
- `docs/architecture/audit-log-design.md` (WORM 회귀)
- `docs/architecture/community-moderation-design.md` (모더레이션 회귀)
- `docs/architecture/harness-engineering-design.md` (Layer 4 CI Pipeline)
- `docs/architecture/environment-and-docker-design.md` (Docker-First)
- `docs/decisions/ADR-006-environment-and-docker.md` (환경 변수 중앙 관리)
- `docs/decisions/ADR-009-langchain-langfuse-stack.md` (Langfuse 우회 base)
- `apps/api/test/security/security-middleware.test.ts` (현 유일 통합 테스트, NestJS 우회 패턴)
- Playwright 공식 ARM64 — https://playwright.dev/docs/intro
- gitleaks — https://github.com/gitleaks/gitleaks
