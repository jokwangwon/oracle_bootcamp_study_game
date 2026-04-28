# 변경 영향 분석 — PR-10a (httpOnly cookie + refresh rotation + revoke epoch)

> ADR-007 § 3.3 / SDD `change-impact-analysis-design.md` 4차원 분석 + 의존성 매트릭스
>
> ADR-020 §4.2.1 I 절 "머지 전 선결 조건" 의 두 번째 항목 (JwtAuthGuard 9 컨트롤러 + web 6 페이지 호출처 추적) 이행
>
> **상위 결정**: ADR-020 §4.2.1 부속서 (Session 12, consensus-010, 합의율 70%)

**작성**: 2026-04-29 Session 13
**대상 PR**: PR-10a (refresh_tokens migration + token_epoch ALTER + cookie extractor + web 6 페이지 마이그레이션 + env.validation refine)
**범위 자동 분류**: **SYSTEM** (인증/인가 파일 변경 + DB 스키마 변경 → ADR-007 §2.1 자동 격상)
**3+1 합의 상태**: 이미 완료 (consensus-010, 별도 합의 불필요 — 본 문서는 매핑만)
**환경 가정 (Session 13 확정)**: dev/staging = `http://100.102.41.122:3002` (Tailscale HTTP IP only) / `localhost` 접근 불가 / production URL = IP 구매 후 별도 결정 (현재 미정)

---

## 0. 요약

PR-10a 의 변경 표면은 **인증 토큰 운반 매체 전환** (Bearer header → httpOnly cookie) 과 **세션 관리 강화** (refresh rotation + epoch revoke) 두 축. 코드 표면은 작으나 (auth + 1 guard + 1 strategy + 6 web 페이지 + api-client) 의존하는 "인증된 모든 endpoint" 로 영향 전파. 본 문서는 4차원에 걸쳐 영향과 회귀 항목을 매핑한다.

| 차원 | 핵심 발견 | 회귀 위험 |
|------|---------|---------|
| ① 의존성 | 9 컨트롤러 / 12 endpoint 가 JwtAuthGuard 통과. 현재 모두 `Authorization: Bearer` 헤더 가정. cookie extractor 추가 시 dual-mode 가 트랜지션 핵심 | 중 |
| ② 장애 전파 | refresh endpoint 가 SPOF. 신규 의존: cookie-parser / Redis SETNX (이미 BullMQ 통해 사용 중) | 저 |
| ③ 통신 흐름 | CORS credentials:true 이미 enable, SameSite=Lax + Domain 명시 + dev secure:false 분기 | 저 |
| ④ 데이터 흐름 | refresh_tokens 테이블 신설 + users.token_epoch ALTER. ADR-018 epoch 와 통합 (logout/revoke 시 ++) | 중 |

---

## 1. 변경 표면 (SYSTEM 판정 근거)

### 1.1 자동 격상 트리거 (ADR-007 §2.1)

- ✅ **인증/인가 관련 파일 변경** — `apps/api/src/modules/auth/**`, `JwtStrategy`, `JwtAuthGuard`, `auth.controller.ts`, `auth.module.ts`
- ✅ **DB 스키마 변경 (브레이킹 아님)** — `refresh_tokens` 신설 + `users.token_epoch` ADD COLUMN (default 0, NOT NULL)
- ✅ **설정 파일 변경** — `.env.example` / `env.validation.ts` (refine 4건 추가)
- ➖ **public API 시그니처 변경** — `/api/auth/login` / `/api/auth/register` 응답 body 의 `accessToken` 제거 (cookie 로 set), `/api/auth/refresh` / `/api/auth/logout` 신설

→ ADR-007 §2.2 SYSTEM 단계 (4차원 + 합의) 적용. 합의는 consensus-010 으로 이미 완료.

### 1.2 변경 파일 목록 (예상)

| 파일 | 변경 유형 | 라인 추정 |
|------|---------|---------|
| `apps/api/src/migrations/1714000009000-AddTokenEpoch.ts` | 신규 | ~30 |
| `apps/api/src/migrations/1714000010000-AddRefreshTokens.ts` | 신규 | ~50 |
| `apps/api/src/modules/auth/entities/refresh-token.entity.ts` | 신규 | ~40 |
| `apps/api/src/modules/auth/refresh-token.service.ts` | 신규 | ~150 |
| `apps/api/src/modules/auth/refresh-token.service.test.ts` | 신규 | ~250 |
| `apps/api/src/modules/auth/auth.service.ts` | 수정 (issueToken — refresh + epoch claim) | +30 |
| `apps/api/src/modules/auth/auth.controller.ts` | 수정 (logout/refresh endpoint + Res passthrough) | +60 |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | 수정 (cookie extractor + epoch validate) | +30 |
| `apps/api/src/modules/auth/auth.module.ts` | 수정 (RefreshToken provider + cookie-parser middleware) | +15 |
| `apps/api/src/modules/users/users.service.ts` | 수정 (incrementTokenEpoch + getTokenEpoch) | +20 |
| `apps/api/src/main.ts` | 수정 (cookieParser middleware 등록) | +3 |
| `apps/api/src/config/env.validation.ts` | 수정 (refine 4건 + JWT_REFRESH_SECRET / COOKIE_DOMAIN 등 5건 추가) | +30 |
| `.env.example` | 수정 (정식 만료 회귀 + 신규 secret) | +15 |
| `apps/api/package.json` | 수정 (`cookie-parser` + `@types/cookie-parser`) | +2 |
| `apps/web/src/lib/api-client.ts` | 수정 (`credentials: 'include'` + Authorization 헤더 제거) | +5 / -8 |
| `apps/web/src/lib/auth-storage.ts` | **삭제** (localStorage 폐기) | -45 |
| `apps/web/src/components/Header.tsx` | 수정 (`useUser()` 훅 또는 `/users/me` 응답 기반 로그인 상태) | +20 / -10 |
| `apps/web/src/app/login/page.tsx` | 수정 (`setToken` 호출 제거 + redirect 만 유지) | +2 / -5 |
| `apps/web/src/app/register/page.tsx` | 동일 | +2 / -5 |
| `apps/web/src/app/play/solo/page.tsx` | 수정 (`getToken()` 호출 제거 + apiClient signature 변경) | +3 / -8 |
| `apps/web/src/app/review/mistakes/page.tsx` | 동일 | +3 / -8 |
| `apps/web/src/lib/home/data.ts` | 수정 (`hasToken()` → `useUser()` 훅) | +5 / -3 |

**합계 추정**: api +700 / -10 / web +40 / -90 / docs +50 → 약 1.5k 변경 (Agent A 추정 6.0d 의 제일 큰 슬라이스)

---

## 2. 차원 ① — 의존성 (Dependencies)

### 2.1 하류 의존 (이 코드가 사용하는 것)

| 의존 대상 | 인터페이스 | 변경 여부 | 영향 |
|---------|----------|---------|------|
| `@nestjs/jwt` | `JwtModule.registerAsync` | 변경 — refresh secret 추가 | 영향 없음 (옵션 추가만) |
| `@nestjs/passport` | `AuthGuard('jwt')` | 변경 없음 | — |
| `passport-jwt` | `ExtractJwt.fromExtractors` | 변경 — `fromAuthHeaderAsBearerToken` → 다중 extractor (cookie + Bearer) | dual-mode 트랜지션용 |
| `bcrypt` | `hash` / `compare` | 변경 없음 | — |
| `@nestjs/bullmq` → `ioredis` | Redis 클라이언트 | **신규 사용** — SETNX mutex (TTL 5초) | 정상. Redis URL 이미 존재 |
| `cookie-parser` (신규) | Express middleware | **신규 의존** | — |
| TypeORM | 신규 entity + 마이그레이션 | 변경 — refresh_tokens 테이블 + users.token_epoch | 마이그레이션 롤백 가능해야 함 (down() 작성) |

**순환 의존 위험**: 없음. RefreshTokenService 는 UsersService 에 의존, UsersService 는 AuthService 에 의존하지 않음 (단방향).

### 2.2 상류 의존 (이 코드를 사용하는 것 — JwtAuthGuard 통과)

#### API 컨트롤러 매트릭스 (10개 — auth 포함, 9개가 JwtAuthGuard)

| # | 컨트롤러 | path prefix | 가드 체인 | 엔드포인트 | `req.user` 형태 변경 영향 |
|---|---------|-------------|---------|----------|----------|
| 1 | AuthController | `/auth` | ThrottlerGuard | POST `/register`, POST `/login` | 직접 — Res passthrough 패턴 도입 |
| 2 | AiQuestionController | `/questions/generate` | JwtAuthGuard | POST `/`, GET `/:jobId` | epoch claim 추가만, 코드 변경 0 |
| 3 | EvalController | `/eval` | JwtAuthGuard + EvalAdminGuard | POST `/run` | 동일 |
| 4 | ContentController | `/questions` | JwtAuthGuard | GET `/` | 동일 |
| 5 | AppealController | `/grading` | JwtAuthGuard | POST `/:answerHistoryId/appeal` | 동일 |
| 6 | NotionController | `/notion` | JwtAuthGuard + EvalAdminGuard | POST `/sync` | 동일 |
| 7 | GameController | `/games/solo` | JwtAuthGuard | POST `/start`, GET `/review-queue`, POST `/answer`, POST `/finish` | 동일 |
| 8 | UsersController | `/users` | JwtAuthGuard | GET `/me`, GET `/me/progress`, GET `/me/mistakes` | 동일 |
| 9 | QuestionReportController | `/questions` | JwtAuthGuard | POST `/:id/report` | 동일 |
| 10 | AdminReviewController | `/questions` | JwtAuthGuard + EvalAdminGuard | PATCH `/:id/review` | 동일 |

**핵심**: JwtAuthGuard 가 cookie 도 받도록 수정되면 9 컨트롤러 / 12 endpoint **컨트롤러 코드 0 라인 변경** (강한 추상화). 다만:

- `req.user.sub` 사용처 — 모든 9 컨트롤러 (sub 형식 그대로 유지 — userId)
- `req.user.username` 사용처 — `EvalController` / `NotionController` / `AdminReviewController` 의 EvalAdminGuard 화이트리스트 검사. **유지**
- `epoch` claim 추가 — JwtStrategy.validate 가 DB 의 `users.token_epoch` 와 비교 → 불일치 시 401. 컨트롤러는 인지 불요.

#### Web 호출처 매트릭스 (6 페이지 + 3 lib)

| 파일 | 토큰 의존 | 변경 |
|------|--------|------|
| `lib/api-client.ts` | `Authorization: Bearer ${token}` 헤더 직접 set / `request()` signature `token?` 파라미터 | **핵심**: `credentials: 'include'` 추가 + `token` 파라미터 제거 + refresh 401 자동 재시도 wrapping |
| `lib/auth-storage.ts` | localStorage `setToken/getToken/clearToken/hasToken` + `AUTH_CHANGED_EVENT` | **삭제** (또는 stub 후 다음 PR) |
| `lib/home/data.ts` | `hasToken()` 분기 | `useUser()` 훅 또는 `/users/me` 응답 기반 분기 |
| `components/Header.tsx` | `hasToken()` 구독 + `clearToken()` | `useUser()` + `apiClient.auth.logout()` (POST + revoke) |
| `app/page.tsx` | data.ts 통해 간접 | 영향 없음 (data.ts 통해 자동) |
| `app/login/page.tsx` | `setToken(accessToken)` | accessToken 응답 제거 → redirect 만 |
| `app/register/page.tsx` | 동일 | 동일 |
| `app/play/solo/page.tsx` | `getToken()` + `apiClient.solo.*(token, ...)` | `apiClient.solo.*(...)` (token 제거) |
| `app/review/mistakes/page.tsx` | 동일 | 동일 |

#### 트랜지션 전략

**dual-mode** (cookie + Bearer 양쪽 수용 1주일):

```ts
// jwt.strategy.ts
super({
  jwtFromRequest: ExtractJwt.fromExtractors([
    (req) => req?.cookies?.access ?? null,    // 신규 우선
    ExtractJwt.fromAuthHeaderAsBearerToken(),  // 기존 fallback
  ]),
  ...
});
```

→ web 마이그레이션과 api 머지 사이의 race 완화. 1주일 후 Bearer extractor 제거.

### 2.3 의존성 그래프 (변경 추가만)

```
RefreshTokenService (신규)
  ├─ TypeORM Repository<RefreshTokenEntity>
  ├─ ioredis (SETNX mutex)
  ├─ JwtService (JwtModule)
  └─ DataSource (트랜잭션)

JwtStrategy (수정)
  └─ UsersService.getTokenEpoch (신규 메서드)

AuthController (수정 — Res passthrough)
  ├─ AuthService (기존)
  ├─ RefreshTokenService (신규)
  └─ UsersService.incrementTokenEpoch (신규)

AppModule
  └─ cookie-parser middleware (신규)
```

순환 없음. UsersService 는 RefreshTokenService 를 모름 (단방향).

---

## 3. 차원 ② — 장애 전파 (Failure Propagation)

### 3.1 신규 단일 실패점 (SPOF) 평가

| 컴포넌트 | SPOF 여부 | 다운 시 영향 | 대응 |
|---------|----------|-----------|------|
| `refresh_tokens` 테이블 | 읽기/쓰기 SPOF | refresh endpoint 불가 → access 만료 후 강제 재로그인 | RDB 다운 시 전체 서비스 다운이므로 별도 SPOF 아님 |
| Redis SETNX mutex | refresh race 방어 | Redis 다운 시 mutex 미작동 → race 발생 가능 | **fail-open** (mutex 획득 실패 시 grace period 안 정상 사용자로 간주, ADR-020 §4.2.1 A) |
| `users.token_epoch` 컬럼 | 매 요청 read | DB 다운 시 인증 0 (현재도 동일) | — |
| cookie-parser middleware | 모든 요청 통과 | 미작동 시 cookie 추출 불가 → 401 | npm dep, 다운 시나리오 무의미 |

### 3.2 타임아웃 / 재시도 / 폴백 (구체 수치)

| 호출 경로 | 타임아웃 | 재시도 | 폴백 |
|---------|--------|------|------|
| `RefreshTokenService.refresh()` → Redis SETNX | TTL 5초 (Redis 명시) | 0 (단발) | mutex 획득 실패 시 `reissueWithoutRotation` (grace 5초 안 정상 사용자로 간주) |
| `RefreshTokenService.refresh()` → DB 트랜잭션 | TypeORM 기본 | 0 | 트랜잭션 rollback → `UnauthorizedException('refresh_failed')` |
| Web `apiClient` 401 → `/auth/refresh` 재시도 | 5초 (fetch AbortSignal) | **1회만** (refresh 도 401이면 login 페이지 redirect) | redirect to `/login` |
| `JwtStrategy.validate` → `UsersService.getTokenEpoch` | TypeORM 기본 | 0 | DB 오류 시 `UnauthorizedException` (현재 동작 보존) |

### 3.3 부분 장애 시나리오

#### 시나리오 A — Redis 다운 (BullMQ 도 동시 다운)

영향: `refresh()` mutex 획득 실패. **선택**:
- 옵션 1 — fail-open (현재 합의): grace 5초 안 정상 사용자로 간주, 기존 access 재발급
- 옵션 2 — fail-closed: 401 (Redis 복구까지 강제 재로그인)

**채택 — 옵션 1** (ADR-020 §4.2.1 A): 부트캠프 환경 (사용자 ~20명) 의 race 가 빈번하지 않고, Redis 일시 장애 (BullMQ restart 등) 동안 사용자 강제 로그아웃은 페인.

#### 시나리오 B — refresh_tokens 행 일관성 깨짐 (직접 SQL 수정 등)

영향: `replacedBy` 가 NULL 인데 새 jti 발급된 경우. reuse detection 의 family revoke 가 trigger 됨 → 모든 활성 refresh 토큰 revoke. **수동 SQL DELETE FROM refresh_tokens WHERE userId = ...` 가 필요한 incident response 절차 명문화 필요** (PR-10a 후속 ops doc).

#### 시나리오 C — 토큰 epoch 불일치 (예: ADR-018 salt rotation 시 epoch++ 부수 효과)

영향: 활성 access 토큰 모두 401. **현재 ADR-018 §4 epoch는 user_token_hash_epoch (logging용) 와 분리되어야 한다 — JWT auth epoch (`users.token_epoch`) 는 별도 용도** (ADR-020 §4.2.1 B). 두 epoch 가 동일 컬럼이면 hash rotation 시 강제 로그아웃 발생.

→ **결론**: `users.token_epoch` 는 신규 컬럼. `users.user_token_hash_active_epoch` (ADR-018) 와 분리 (이름 충돌 회피).

#### 시나리오 D — Tailscale http://100.102.41.122:3002 (현재 dev/staging) cookie 동작

영향: 사용자 환경 = Tailscale HTTP IP only, localhost 접근 불가. dev 에서 `secure:true` 시 cookie 거부 → 인증 0. **`secure: NODE_ENV === 'production'` 분기 필수** (ADR-020 §4.2.1 D 그대로). 추가로 RFC 6265 §4.1.2.3 — IP 주소는 `Domain` 속성 불가 → dev 는 `Domain` 미설정 (host-only cookie 자동 적용).

→ Session 13 확정: 추가 spike 불필요. 본 분석으로 위 패턴이 표준 브라우저 행위 (RFC) 임이 명백.

---

## 4. 차원 ③ — 통신 흐름 (Communication Flow)

### 4.1 인증 통신 경로 변경

#### Before (현재)

```
[Browser]                       [API]
   │                              │
   ├── POST /auth/login           │
   │   {email, password}          │
   │                          ◀───┤
   │   {accessToken: "eyJ..."}    │
   │                              │
   ├── localStorage.setItem       │
   │   ('oracle-game.accessToken')│
   │                              │
   ├── GET /games/solo/start      │
   │   Authorization: Bearer eyJ..│
   │                          ◀───┤
   │   {rounds: [...]}            │
```

#### After (PR-10a)

```
[Browser]                                     [API]
   │                                           │
   ├── POST /auth/login                        │
   │   {email, password}                       │
   │                          Set-Cookie       │
   │                          access=eyJ..     │
   │                          (httpOnly,       │
   │                           secure=isProd,  │
   │                           sameSite=Lax,   │
   │                           domain=COOKIE_  │
   │                            DOMAIN,        │
   │                           maxAge=30m)     │
   │                          Set-Cookie       │
   │                          refresh=eyJ..    │
   │                          (httpOnly,       │
   │                           path=/auth,     │
   │                           maxAge=14d)     │
   │                                       ◀───┤
   │   {} (body 없음)                          │
   │                                           │
   ├── GET /games/solo/start                   │
   │   Cookie: access=eyJ..                    │
   │   (브라우저 자동 첨부, fetch              │
   │    credentials:'include')                 │
   │                                       ◀───┤
   │   {rounds: [...]}                         │
   │                                           │
   ├── (access 만료 401) ─────────────────────▶│
   │                                       ◀───┤
   │   401 + body{code: 'token_expired'}       │
   │                                           │
   ├── POST /auth/refresh ────────────────────▶│
   │   Cookie: refresh=eyJ..                   │
   │                          [refresh 검증]   │
   │                          [SETNX mutex]    │
   │                          [reuse detect]   │
   │                          [family revoke]  │
   │                          [트랜잭션]        │
   │                          Set-Cookie       │
   │                          access=eyJ..(new)│
   │                          Set-Cookie       │
   │                          refresh=eyJ..(new)│
   │                                       ◀───┤
   │                                           │
   ├── (재시도 GET /games/solo/start) ────────▶│
   │                                       ◀───┤
   │   {rounds: [...]}                         │
```

### 4.2 동기/비동기 적절성

| 호출 | 동기/비동기 | 적절성 |
|------|----------|------|
| `/auth/login` → cookie set | 동기 | ✅ — 로그인은 즉시 반영 필수 |
| `/auth/refresh` → cookie set | 동기 | ✅ — access 만료 시 즉시 갱신 필수 |
| `/auth/logout` → epoch++ + revoke + cookie clear | 동기 | ✅ — logout 후 즉시 모든 device 무효화 |
| Web 의 401 → refresh → 재시도 | 비동기 (Promise chain) | ✅ — 사용자 인지 불요 |

### 4.3 메시지 포맷 — 응답 body 변경

| Endpoint | Before body | After body | 호환성 |
|----------|-----------|----------|------|
| POST `/auth/login` | `{accessToken: string}` | `{}` (cookie 로 set) | **브레이킹** — web 마이그레이션 동시 |
| POST `/auth/register` | 동일 | 동일 | 동일 |
| POST `/auth/refresh` | (없음) | `{}` (cookie set) | 신규 |
| POST `/auth/logout` | (없음) | `{}` | 신규 |

→ **batch 전환 필수**. `apps/web` 마이그레이션이 PR 동일 머지 단위 안에 포함되어야 (분리 시 web 에서 accessToken undefined → setToken 실패 → 즉시 로그아웃).

### 4.4 CORS / Origin 검증

- 현재 `main.ts` 가 이미 `credentials: true` + `corsOrigin` comma-split. **추가 작업 0**.
- `OriginGuard` (ADR-020 §4.2.1 E) 는 PR-10c (CSRF) 에 분리 → PR-10a 범위 외.

---

## 5. 차원 ④ — 데이터 흐름 (Data Flow)

### 5.1 신규 데이터

#### `refresh_tokens` (신규)

```
PK: jti (uuid)
COL: userId (uuid, FK users.id ON DELETE CASCADE)
COL: familyId (uuid)        — rotation chain 공통 ID
COL: generation (int)       — chain 내 순번
COL: expiresAt (timestamp)
COL: revokedAt (timestamp, nullable)
COL: replacedBy (uuid, nullable, FK refresh_tokens.jti)
COL: createdAt (timestamp)
INDEX: (userId, familyId)
```

생명 주기:
- INSERT: `/auth/login`, `/auth/register` (family 생성), `/auth/refresh` (family 연장)
- UPDATE: `/auth/refresh` (revokedAt + replacedBy 기존 jti) / `/auth/logout` (모든 active revoke)
- DELETE: 절대 안 함 (감사 로그 보존). Cleanup job 은 별도 cron (expiresAt + 30d 후) — PR-10a 범위 외.

#### `users.token_epoch` (ALTER)

```sql
ALTER TABLE users ADD COLUMN token_epoch INTEGER NOT NULL DEFAULT 0;
```

생명 주기:
- INSERT: 기본 0
- UPDATE: `/auth/logout` 시 ++ (해당 user 의 모든 access 토큰 즉시 무효화)
- 매 요청: `JwtStrategy.validate` 가 payload.epoch 와 비교

### 5.2 마이그레이션 롤백 가능성

| 마이그레이션 | up() | down() | 데이터 손실 |
|-----------|-----|------|---------|
| `1714000009000-AddTokenEpoch` | ALTER ADD COLUMN ... DEFAULT 0 NOT NULL | ALTER DROP COLUMN | 없음 (epoch 카운터만 유실) |
| `1714000010000-AddRefreshTokens` | CREATE TABLE | DROP TABLE | refresh 토큰 모두 손실 → 재로그인 필요 (의도된 동작) |

→ down 모두 작성 가능. ADR-007 §3.3 "DB 마이그레이션이 롤백 가능한가?" PASS.

### 5.3 데이터 정합성 / 트랜잭션 경계

#### `RefreshTokenService.refresh()` 트랜잭션

```ts
await this.dataSource.transaction(async (m) => {
  // 1) 기존 jti 의 replacedBy + revokedAt 갱신
  await m.update(RefreshTokenEntity, { jti: payload.jti, replacedBy: IsNull() }, {
    revokedAt: new Date(),
    replacedBy: newJti,
  });
  // 2) 새 jti 삽입
  await m.insert(RefreshTokenEntity, { jti: newJti, ... });
});
```

**race**: 두 요청이 동시 같은 jti 로 refresh 호출. WHERE replacedBy IS NULL 조건이 first-wins 보장 (UPDATE affected rows = 0 → throw `UnauthorizedException('refresh_lost_race')`). Redis SETNX 가 grace window 안 두 번째 호출을 fail-open 처리 (정상 사용자의 retry 추정).

#### `auth.controller.logout` 트랜잭션 (선택)

```ts
@Post('logout')
async logout(@CurrentUser() user, @Res({ passthrough: true }) res) {
  await this.dataSource.transaction(async (m) => {
    await m.update(User, { id: user.sub }, { tokenEpoch: () => 'token_epoch + 1' });
    await m.update(RefreshTokenEntity, { userId: user.sub, revokedAt: IsNull() }, { revokedAt: new Date() });
  });
  res.clearCookie('access');
  res.clearCookie('refresh');
}
```

→ epoch++ 와 refresh revoke 의 partial commit 방지 (둘 다 안 되어야 logout 실패 — 다시 시도 가능).

### 5.4 ADR-018 epoch 와 분리

ADR-018 의 `user_token_hash_active_epoch` (사용자 hash salt rotation 용 — answer_history.user_token_hash_epoch 컬럼과 연동) 는 본 PR-10a 의 `users.token_epoch` (JWT 인증 무효화용) 와 **별도 컬럼**.

| 구분 | ADR-018 | PR-10a |
|------|--------|-------|
| 컬럼 | `users.user_token_hash_active_epoch` | `users.token_epoch` |
| 용도 | hash salt rotation → 이전 trace 재현 차단 | JWT logout/revoke → access token 강제 무효화 |
| 트리거 | salt rotation cron | logout endpoint |
| 회귀 | rotation 후에만 ++ | logout 시마다 ++ |

→ 충돌 없음. ADR-020 §4.2.1 B 의 "ADR-018 epoch 통합" 문구는 **패턴 재사용** 의미 (epoch++ 후 매 요청 검증) — 같은 컬럼 사용이 아님. ADR-020 §4.2.1 B 코드 예시의 `incrementTokenEpoch` 는 `users.token_epoch` 컬럼 대상.

### 5.5 PII / 감사 로그

`refresh_tokens` 테이블 의 `userId` 는 PII (FK users.id). 감사 로그는 분리:
- `ops_event_log` 의 `kind='refresh_reuse_detected'` / `kind='refresh_family_revoked'` / `kind='logout_all_revoked'` 이벤트 추가 (PR-10a 후속 또는 본 PR 안 — TBD)
- userId hash (ADR-016 §7) 적용 — `userTokenHash` 컬럼만 기록

---

## 6. 테스트 추가/수정 (TDD 단계)

### 6.1 신규 테스트

| 테스트 파일 | 케이스 수 | 영역 |
|-----------|--------|------|
| `1714000009000-AddTokenEpoch.test.ts` | 3 | up() / down() / default 0 |
| `1714000010000-AddRefreshTokens.test.ts` | 4 | up() / down() / 부분 unique 인덱스 / FK ON DELETE |
| `refresh-token.service.test.ts` | **11+** | rotation 정상 / reuse detection / family revoke / Redis SETNX grace / DB rollback / replacedBy chain / generation ++ / expiresAt 검증 / revoked 거부 / 만료 거부 / mutex 타임아웃 |
| `auth.service.test.ts` | +4 (수정) | refresh secret 분리 / epoch claim / 로그인 시 family 생성 / register 시 family 생성 |
| `auth.controller.test.ts` | +6 (수정) | login Set-Cookie 헤더 / register Set-Cookie / refresh endpoint 401 reuse / logout cookie clear / logout epoch++ / Res passthrough 검증 |
| `jwt.strategy.test.ts` | **신규** 5 | cookie extractor 우선 / Bearer fallback (dual-mode) / epoch 일치 / epoch 불일치 401 / 만료 401 |
| `users.service.test.ts` | +2 (수정) | incrementTokenEpoch atomic / getTokenEpoch |
| **합계 신규 / 수정** | **31+ (cumulative new) + 12 modified** | — |

→ ADR-020 §4.2.1 I 절 "11+ TDD cases" 충족 (refresh-token.service 단독으로 11+ 만족).

### 6.2 기존 테스트 회귀 위험

| 기존 테스트 | 영향 | 수정 필요 |
|-----------|-----|--------|
| `auth.controller.test.ts` (login/register 응답 body 검증) | accessToken body 검증 → Set-Cookie 헤더 검증 | ✅ 필수 |
| 9 컨트롤러의 e2e 테스트 (`Authorization: Bearer ${token}`) | dual-mode 트랜지션 동안 둘 다 PASS, 후속에서 cookie 만 PASS | dual-mode 기간 0 — 마이그레이션 1 PR 안에 진행 |
| Web 컴포넌트 테스트 | hasToken/getToken/setToken mock 변경 | ✅ |

### 6.3 e2e 테스트 (PR-10a 머지 직전 검증)

- [ ] **Tailscale spike** — http://api.local 에서 secure:false + Lax cookie 동작 (사용자 환경)
- [ ] **OriginGuard 미적용 확인** — PR-10a 는 OriginGuard 도입 안 함 (PR-10c)
- [ ] **임시 완화 24h → 정식 30m 회귀** — `.env` / `.env.example` / `env.validation.ts` default 일괄 변경

---

## 7. ADR-018 / 다른 ADR 와의 상호작용

| ADR | 영향 | 조치 |
|-----|-----|------|
| ADR-016 §7 (userId hash) | 영향 없음 — `users.id` UUID 자체는 변경 없음 | — |
| ADR-018 §4 (salt rotation) | 컬럼 분리 (5.4 참조) — `user_token_hash_active_epoch` ≠ `token_epoch` | 마이그레이션 컬럼명 충돌 없음 |
| ADR-019 §5.3 (SR daily cap) | 영향 없음 — review_queue 는 userId UUID 만 참조 | — |
| ADR-020 §4.1 (helmet) | 영향 없음 — helmet 은 cookie 헤더 처리 안 함 | — |
| ADR-020 §4.3 (auth rate limit) | 영향 없음 — Throttler 는 IP 기반 | — |
| **ADR-007** (변경 영향 분석) | 본 문서 자체 | SYSTEM 4차원 + 합의(consensus-010) 완료 |

---

## 8. 실패 시나리오 — 사후 결과 (Reviewer 검증용)

PR-10a 머지 후 다음 4 시나리오 모두 통과해야 함:

1. **로그인 → 30분 동안 인증 유지** — access cookie 만료 직전에 임의 endpoint 호출 → 200
2. **30분 후 → 첫 호출에서 401 → /auth/refresh 자동 → 재시도 200** — web 자동 흐름
3. **로그아웃 → 모든 활성 access 즉시 401** — epoch++ 검증
4. **2개 탭 동시 refresh → 한 탭만 새 토큰 발급, 다른 탭은 grace** — Redis SETNX 의 fail-open 검증

추가 보안:
5. **refresh 토큰 재사용 (탈취 시나리오) → family 전체 revoke + 401** — reuse detection 검증

---

## 9. 머지 전 선결 조건 체크리스트 (ADR-020 §4.2.1 I 재확인)

- [x] **Tailscale spike** — Session 13 확정. dev/staging = Tailscale HTTP IP only, production URL 미정. `secure: NODE_ENV==='production'` 분기 + dev `Domain` 미설정 (host-only) 패턴 채택. RFC 6265 표준 행위 — 추가 검증 불필요.
- [x] **ADR-007 변경 영향 분석** — 본 문서 (Session 13 작성)
- [ ] **refresh_tokens migration TDD** — 4 케이스 (up/down/index/FK)
- [ ] **token_epoch ALTER TABLE migration TDD** — 3 케이스 (up/down/default)
- [ ] **OriginGuard 글로벌 등록 + CSRF token 폐기 e2e** — PR-10c 범위 (PR-10a 직전 아님)
- [ ] **임시 완화 24h → 정식 30m 회귀** — `.env` / `.env.example` / `env.validation.ts` default
- [ ] **운영 URL 결정 follow-up** (PR-10a 후속) — IP 구매 후 `secure:true` + `COOKIE_DOMAIN` 명시 (또는 도메인 미설정 host-only 유지) 결정. 코드 변경 0 — env 만 추가.

---

## 10. 결론

본 PR-10a 는 SYSTEM 등급 변경이지만, JwtAuthGuard 추상화 덕분에 9 컨트롤러 / 12 endpoint 코드 변경 0. 핵심 위험은 (1) web 마이그레이션과 api 머지의 **batch 동시성** (응답 body 브레이킹), (2) Redis SETNX 의 fail-open 정책, (3) Tailscale dev 환경의 secure 쿠키 분기 + Domain 속성 처리.

dual-mode 트랜지션 (cookie + Bearer 1주일 병행) 로 (1) 완화. (2) 는 ADR-020 §4.2.1 A 합의로 채택. (3) 은 Session 13 환경 사실 확정으로 RFC 6265 표준 행위 안에서 처리 가능 — 추가 spike 불필요.

다음 단계: 본 plan 의 Phase 1 (마이그레이션 RED-first) 부터 PR-10a 코드 작업 진입.

---

## 11. 변경 이력

| 일자 | 변경 |
|------|-----|
| 2026-04-29 | 초안 작성 (Session 13). consensus-010 기반 4차원 영향 매핑. |
| 2026-04-29 (보강) | 사용자 환경 사실 반영 (Tailscale HTTP IP only, localhost 접근 불가, production URL 미정). §3.3 시나리오 D 갱신 / §9 spike 완료 + 운영 URL follow-up 추가 / §10 결론 갱신. |
