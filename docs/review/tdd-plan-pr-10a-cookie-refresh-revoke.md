# TDD Plan — PR-10a (httpOnly cookie + refresh rotation + revoke epoch)

> ADR-020 §4.2.1 I 절 "머지 전 선결 조건" 의 세 번째 항목 (refresh_tokens migration TDD 11+ cases) + 네 번째 항목 (token_epoch ALTER TABLE migration TDD) 충족용 단계 분해
>
> **상위 결정**: ADR-020 §4.2.1 부속서 (Session 12, consensus-010) — Reviewer 의 5결정 그대로 이행
>
> **상위 매핑**: `docs/review/impact-pr-10a-cookie-refresh-revoke.md` (ADR-007 SYSTEM 4차원 분석)

**작성**: 2026-04-29 Session 13
**대상 PR**: PR-10a
**예상 LOC**: api +700 / -10 / web +40 / -90 / docs +50 (≈ 1.5k)
**예상 작업 시간**: 2.0~2.5 d (Agent A 추정 vs ADR-020 §6 일정 2d 의 중간)
**TDD case 합계**: 31+ 신규 / 12 수정

---

## 0. 사전 조건 (PR-10a 코드 작업 시작 직전)

다음 두 항목이 끝난 뒤 본 plan 의 Phase 1 진입:

- [x] **Tailscale spike** — 사용자 환경 사실 확정 (Session 13, 2026-04-29):
  - dev/staging = `http://100.102.41.122:3002` (Tailscale HTTP IP only) — `localhost` 접근 불가
  - 운영 URL = IP 구매 후 별도 결정 (현재 미정)
  - 결론: `secure: NODE_ENV==='production'` 분기 그대로. dev 는 `secure:false` + `Domain` 속성 미설정 (RFC 6265 §4.1.2.3 — IP 에 Domain 불가 → host-only cookie). 추가 spike 불필요.
- [x] **ADR-007 변경 영향 분석** — `docs/review/impact-pr-10a-cookie-refresh-revoke.md` (완료)
- [x] **TDD plan** — 본 문서 (완료)

---

## 1. 단계 분해 개요

```
Phase 1: 마이그레이션 (token_epoch + refresh_tokens) — RED-only test 우선
Phase 2: RefreshTokenEntity + Repository 등록
Phase 3: 순수 헬퍼 (signRefreshPayload / parseRefreshPayload)
Phase 4: RefreshTokenService — rotation 로직 (11+ cases)
Phase 5: UsersService 확장 — incrementTokenEpoch / getTokenEpoch
Phase 6: AuthService 리팩토링 — refresh secret 분리 + epoch claim
Phase 7: JwtStrategy 리팩토링 — dual-mode extractor + epoch 검증
Phase 8: AuthController 리팩토링 — logout / refresh endpoint + Res passthrough
Phase 9: main.ts cookie-parser + env.validation refine
Phase 10: Web 마이그레이션 — api-client + auth-storage 삭제 + 6 페이지
Phase 11: e2e 검증 + 임시 완화 24h → 정식 30m 회귀
```

각 Phase 는 **RED (실패 테스트) → GREEN (최소 구현) → REFACTOR (정리)** 사이클. 다음 Phase 진입 전 직전 Phase 의 모든 테스트 GREEN 필수.

---

## 2. Phase 1 — 마이그레이션 (소요 ~2h)

### 2.1 의존성

- 입력: `apps/api/src/migrations/` 디렉토리 (기존 1714000008000 까지 존재)
- 출력: 2 신규 마이그레이션 파일 + 2 신규 test 파일
- 후속 Phase 차단: Phase 2 (entity 가 테이블 의존), Phase 5 (token_epoch 컬럼 의존)

### 2.2 신규 파일

```
apps/api/src/migrations/1714000009000-AddTokenEpoch.ts
apps/api/src/migrations/1714000009000-AddTokenEpoch.test.ts
apps/api/src/migrations/1714000010000-AddRefreshTokens.ts
apps/api/src/migrations/1714000010000-AddRefreshTokens.test.ts
```

### 2.3 TDD 케이스 — `1714000009000-AddTokenEpoch.test.ts` (3 cases)

| # | 케이스명 | RED → GREEN |
|---|--------|----------|
| 1.1 | `up() 후 users.token_epoch 컬럼 존재 + NOT NULL + DEFAULT 0` | RED: 컬럼 information_schema 조회 실패. GREEN: ALTER TABLE 실행 |
| 1.2 | `down() 후 users.token_epoch 컬럼 제거` | RED: 컬럼 여전히 존재. GREEN: ALTER TABLE DROP COLUMN |
| 1.3 | `기존 user 행에 token_epoch=0 자동 채움` | RED: NULL. GREEN: NOT NULL DEFAULT 0 |

### 2.4 TDD 케이스 — `1714000010000-AddRefreshTokens.test.ts` (4 cases)

| # | 케이스명 | RED → GREEN |
|---|--------|----------|
| 1.4 | `up() 후 refresh_tokens 테이블 생성 + PK jti uuid` | RED: 테이블 부재. GREEN: CREATE TABLE |
| 1.5 | `userId FK + ON DELETE CASCADE` | RED: FK 부재. GREEN: REFERENCES users(id) ON DELETE CASCADE |
| 1.6 | `(userId, familyId) 인덱스 존재` | RED: 인덱스 부재. GREEN: CREATE INDEX |
| 1.7 | `down() 후 refresh_tokens 테이블 제거` | RED: 테이블 존재. GREEN: DROP TABLE |

**검증 명령**:

```bash
npm run test --workspace=apps/api -- migrations/1714000009000
npm run test --workspace=apps/api -- migrations/1714000010000
```

**Phase 1 종료 기준**: 7 케이스 GREEN. `verify-ops-schema.ts` 패턴(격리 schema 시뮬레이션, line 138 of CONTEXT.md) 재사용 권장.

---

## 3. Phase 2 — RefreshTokenEntity (소요 ~30m)

### 3.1 의존성

- 입력: Phase 1 의 마이그레이션
- 출력: `refresh-token.entity.ts` + AuthModule 의 `TypeOrmModule.forFeature([..., RefreshTokenEntity])`

### 3.2 신규 파일

```
apps/api/src/modules/auth/entities/refresh-token.entity.ts
```

### 3.3 별도 테스트 없음

→ entity 는 마이그레이션 + service 테스트로 간접 검증. 단독 unit test 불요 (TDD 가이드 §3 "테스트 가능한 행동 단위" 충족 안 함).

### 3.4 코드 (참조)

```ts
@Entity('refresh_tokens')
@Index(['userId', 'familyId'])
export class RefreshTokenEntity {
  @PrimaryColumn('uuid') jti!: string;
  @Column('uuid') userId!: string;
  @Column('uuid') familyId!: string;
  @Column({ type: 'integer', default: 0 }) generation!: number;
  @Column({ type: 'timestamp' }) expiresAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) replacedBy!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
```

**Phase 2 종료 기준**: typecheck + AuthModule 부팅 성공.

---

## 4. Phase 3 — 순수 헬퍼 (소요 ~1h)

### 4.1 의존성

- 입력: 없음 (외부 의존 0)
- 출력: `refresh-token.utils.ts` + test
- 후속 Phase 차단: Phase 4 (service 가 헬퍼 사용)

### 4.2 신규 파일

```
apps/api/src/modules/auth/refresh-token.utils.ts
apps/api/src/modules/auth/refresh-token.utils.test.ts
```

### 4.3 TDD 케이스 (4 cases — 순수 함수)

| # | 함수 | 케이스 |
|---|-----|------|
| 3.1 | `buildRefreshClaims({userId, familyId, generation, expiresIn})` | userId / familyId / generation / iat / exp 정확 반환 |
| 3.2 | `parseRefreshClaims(payload)` | 누락 필드 시 throw / 정상 시 typed return |
| 3.3 | `computeRefreshExpiry(now, durationStr)` | "14d" → +14d / "30m" → +30m / 잘못된 포맷 throw |
| 3.4 | `isRefreshExpired(token, now)` | exp < now → true / exp > now → false |

**Phase 3 종료 기준**: 4 케이스 GREEN, ≥ 90% line coverage on the utils file (작은 모듈 — 충분한 커버리지 달성 가능).

---

## 5. Phase 4 — RefreshTokenService (소요 ~6h)

**핵심 단계**. PR-10a 의 가장 큰 risk surface. 3+1 합의 (consensus-010) 의 모든 Reviewer 결정이 본 service 에 응축.

### 5.1 의존성

- 입력: Phase 1~3
- 출력: `refresh-token.service.ts` (~150 LOC) + test (~250 LOC, 11+ cases)
- 후속 Phase 차단: Phase 6 (AuthService 가 호출), Phase 8 (AuthController 가 호출)

### 5.2 신규 파일

```
apps/api/src/modules/auth/refresh-token.service.ts
apps/api/src/modules/auth/refresh-token.service.test.ts
```

### 5.3 TDD 케이스 (11+ cases — ADR-020 §4.2.1 I 충족)

| # | 시나리오 | RED → GREEN |
|---|--------|----------|
| 4.1 | **rotation 정상** — 활성 jti 로 refresh 호출 → 새 jti 발급 + 기존 jti revoke + replacedBy 갱신 | RED: 호출 실패 / GREEN: 트랜잭션 + insert + update |
| 4.2 | **reuse detection — revokedAt 존재** → family 전체 revoke + `UnauthorizedException('refresh_reuse_detected')` | RED: 정상 발급됨 / GREEN: family revoke 트리거 |
| 4.3 | **reuse detection — replacedBy 존재** (이미 회전된 토큰 재사용) → 동일 동작 | RED / GREEN 동일 |
| 4.4 | **만료된 refresh** → `UnauthorizedException('refresh_expired')` (jti 는 DB 그대로 보존) | RED: 만료 무시 / GREEN: expiresAt < now 차단 |
| 4.5 | **DB 에 없는 jti** → `UnauthorizedException('refresh_not_found')` (탈취된 토큰) | RED: 정상 / GREEN: findOne null check |
| 4.6 | **Redis SETNX mutex 정상** — 동시 두 호출, 첫째만 rotation, 둘째는 grace (`reissueWithoutRotation`) | RED: 둘 다 rotation / GREEN: NX flag + grace path |
| 4.7 | **Redis SETNX 다운 (mock 실패)** → fail-open: grace path 진입 | RED: throw / GREEN: catch + grace |
| 4.8 | **family 전체 revoke** — 활성 토큰 N개를 일괄 update | RED: 일부만 revoke / GREEN: WHERE userId AND familyId AND revokedAt IS NULL |
| 4.9 | **트랜잭션 롤백** (insert 실패 mock) → 기존 jti 의 revokedAt 도 롤백 | RED: 부분 commit / GREEN: dataSource.transaction 적용 |
| 4.10 | **generation 증가** — 기존 generation N → 새 jti generation N+1 | RED: 0 고정 / GREEN: stored.generation + 1 |
| 4.11 | **expiresAt 14d** (env JWT_REFRESH_EXPIRES_IN 기반) | RED: 다른 값 / GREEN: addDays/computeRefreshExpiry |
| 4.12 | **revokeAllForUser** — logout 호출 시 모든 활성 refresh revoke | RED: 일부만 / GREEN: bulk update |

### 5.4 mock 전략

- **TypeORM**: `getRepositoryToken(RefreshTokenEntity)` 의 mock + `dataSource.transaction` mock (vi.fn().mockImplementation)
- **Redis**: ioredis mock — `set` 메서드만 (반환 'OK' / null)
- **JwtService**: 실제 JwtModule 사용 (signAsync / verifyAsync — REFRESH_SECRET 별도 secret)

**Phase 4 종료 기준**: 12 케이스 GREEN, branch coverage ≥ 85%, family revoke 가 race 없이 동작 (4.6 4.7).

---

## 6. Phase 5 — UsersService 확장 (소요 ~1h)

### 6.1 의존성

- 입력: Phase 1 (token_epoch 컬럼)
- 출력: `users.service.ts` 의 신규 메서드 2 + test 2 cases
- 후속 Phase 차단: Phase 7 (JwtStrategy validate 가 getTokenEpoch 호출), Phase 8 (logout 이 incrementTokenEpoch 호출)

### 6.2 변경 파일

```
apps/api/src/modules/users/users.service.ts (수정)
apps/api/src/modules/users/users.service.test.ts (수정)
```

### 6.3 TDD 케이스 (2 cases 추가)

| # | 메서드 | 케이스 |
|---|------|------|
| 5.1 | `incrementTokenEpoch(userId)` | atomic increment (UPDATE ... SET token_epoch = token_epoch + 1) — 동시 호출 시도 N → 결과 N |
| 5.2 | `getTokenEpoch(userId)` | 정상 read / 없는 user → throw NotFoundException |

**Phase 5 종료 기준**: 2 케이스 GREEN. 기존 users.service.test.ts 회귀 0.

---

## 7. Phase 6 — AuthService 리팩토링 (소요 ~2h)

### 7.1 의존성

- 입력: Phase 4 (RefreshTokenService) + Phase 5 (UsersService.getTokenEpoch)
- 출력: `auth.service.ts` 의 issueToken / login / register 수정 (refresh + epoch claim)
- 후속 Phase 차단: Phase 8 (AuthController 가 issueToken 호출)

### 7.2 변경 파일

```
apps/api/src/modules/auth/auth.service.ts (수정)
apps/api/src/modules/auth/auth.service.test.ts (수정 — 4 케이스 추가)
```

### 7.3 TDD 케이스 (4 cases 추가)

| # | 케이스 |
|---|------|
| 6.1 | `login → access JWT 에 sub/username/epoch claim 포함` |
| 6.2 | `login → refresh JWT 가 별도 secret(JWT_REFRESH_SECRET) 으로 sign` |
| 6.3 | `login → RefreshTokenService.create 호출 (family 신규 발급)` |
| 6.4 | `register → 동일 동작 (family 신규 발급)` |

### 7.4 issueToken 시그니처 변경

```ts
private async issueToken(userId: string, username: string): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}> {
  const epoch = await this.usersService.getTokenEpoch(userId);
  const familyId = randomUUID();
  const jti = randomUUID();
  const refreshExpiresAt = computeRefreshExpiry(new Date(), JWT_REFRESH_EXPIRES_IN);

  const accessToken = this.jwtService.sign({ sub: userId, username, epoch });
  const refreshToken = this.jwtService.sign(
    { sub: userId, jti, familyId, generation: 0 },
    { secret: JWT_REFRESH_SECRET, expiresIn: JWT_REFRESH_EXPIRES_IN },
  );

  await this.refreshTokens.create({ jti, userId, familyId, generation: 0, expiresAt: refreshExpiresAt });

  return { accessToken, refreshToken, refreshExpiresAt };
}
```

**Phase 6 종료 기준**: 4 추가 케이스 GREEN, 기존 회귀 0.

---

## 8. Phase 7 — JwtStrategy 리팩토링 (소요 ~1.5h)

### 8.1 의존성

- 입력: Phase 5 (getTokenEpoch)
- 출력: `jwt.strategy.ts` 의 dual-mode extractor + validate epoch 검증
- 후속 Phase 차단: Phase 8 (cookie-aware request)

### 8.2 변경 파일

```
apps/api/src/modules/auth/strategies/jwt.strategy.ts (수정)
apps/api/src/modules/auth/strategies/jwt.strategy.test.ts (신규)
```

### 8.3 TDD 케이스 (5 cases — 신규 파일)

| # | 시나리오 |
|---|------|
| 7.1 | **cookie 우선** — request.cookies.access 가 존재하면 그것을 사용 |
| 7.2 | **Bearer fallback** — cookie 없으면 Authorization 헤더로 fallback (dual-mode 트랜지션 1주일) |
| 7.3 | **epoch 일치** — payload.epoch === DB.token_epoch → validate PASS |
| 7.4 | **epoch 불일치** — payload.epoch < DB.token_epoch (logout 후) → `UnauthorizedException('token_revoked')` |
| 7.5 | **만료** — 기존 동작 보존 (passport-jwt 의 ignoreExpiration:false) |

### 8.4 코드 (참조)

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: JwtPayload) {
    const currentEpoch = await this.users.getTokenEpoch(payload.sub);
    if (payload.epoch !== currentEpoch) {
      throw new UnauthorizedException('token_revoked');
    }
    return { sub: payload.sub, username: payload.username };
  }
}
```

**Phase 7 종료 기준**: 5 케이스 GREEN, 9 컨트롤러 e2e 회귀 0 (`req.user.sub` / `req.user.username` 형태 그대로).

---

## 9. Phase 8 — AuthController 리팩토링 (소요 ~3h)

### 9.1 의존성

- 입력: Phase 4, 5, 6, 7 모두 GREEN
- 출력: `auth.controller.ts` 의 login/register Res passthrough + logout/refresh endpoint 신설
- 후속 Phase 차단: Phase 9 (main.ts cookie-parser 등록 필요), Phase 10 (web)

### 9.2 변경 파일

```
apps/api/src/modules/auth/auth.controller.ts (수정)
apps/api/src/modules/auth/auth.controller.test.ts (수정 — 6 케이스 추가)
apps/api/src/modules/auth/auth.module.ts (수정 — RefreshTokenService provider)
```

### 9.3 TDD 케이스 (6 cases 추가)

| # | 시나리오 |
|---|------|
| 8.1 | `POST /auth/login` 응답에 `Set-Cookie: access=...; HttpOnly; Secure=isProd; SameSite=Lax; Domain=COOKIE_DOMAIN; Max-Age=1800` |
| 8.2 | `POST /auth/login` 응답에 `Set-Cookie: refresh=...; HttpOnly; Path=/api/auth; Max-Age=14d` (path scoping) |
| 8.3 | `POST /auth/login` 응답 body 가 `{}` (accessToken 제거) |
| 8.4 | `POST /auth/refresh` — 활성 refresh cookie → rotation → 새 cookie 2개 set |
| 8.5 | `POST /auth/refresh` — 재사용된 refresh → 401 + family revoke (Phase 4.2 위임) |
| 8.6 | `POST /auth/logout` — epoch++ + refresh revoke + cookie clear (`Set-Cookie: access=; Max-Age=0`) |

### 9.4 logout 트랜잭션

```ts
@Post('logout')
@UseGuards(JwtAuthGuard)
@HttpCode(204)
async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const userId = (req.user as { sub: string }).sub;
  await this.dataSource.transaction(async (m) => {
    await m.update(User, { id: userId }, { tokenEpoch: () => 'token_epoch + 1' });
    await m.update(RefreshTokenEntity, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  });
  res.clearCookie('access', { path: '/' });
  res.clearCookie('refresh', { path: '/api/auth' });
}
```

**Phase 8 종료 기준**: 6 추가 케이스 GREEN. e2e (auth-flow) 도 PASS.

---

## 10. Phase 9 — main.ts cookie-parser + env.validation refine (소요 ~1h)

### 10.1 의존성

- 입력: Phase 8 (cookie 기반 응답)
- 출력: cookie-parser middleware 등록 + env refine 4건
- 후속 Phase 차단: Phase 10 (web)

### 10.2 변경 파일

```
apps/api/package.json (cookie-parser + @types/cookie-parser 추가)
apps/api/src/main.ts (cookieParser middleware)
apps/api/src/config/env.validation.ts (refine 4건 + 신규 5건)
.env.example (정식 만료 회귀 + 신규 secret)
```

### 10.3 env.validation refine 추가

> **Session 13 보강 (2026-04-29)**: 사용자 환경 = dev/staging 모두 Tailscale HTTP IP only (`http://100.102.41.122:3002`), `localhost` 접근 불가. 운영 URL 은 IP 구매 후 별도 결정. RFC 6265 §4.1.2.3 — IP 주소는 `Domain` 속성 불가 (host-only cookie 만 가능). 따라서 `COOKIE_DOMAIN` 은 production-only 필수, dev/test 는 빈 문자열 허용 (Domain 속성 미설정 → host-only).

```ts
JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET 은 최소 32자'),
JWT_REFRESH_EXPIRES_IN: z.string().default('14d'),
COOKIE_DOMAIN: z.string().optional(),                  // dev=undefined 허용 (Tailscale IP host-only)
JWT_EXPIRES_IN: z.string().default('30m'),             // 회귀 — 기존 '15m' → '30m'
// CORS_ORIGIN 은 main.ts 가 이미 처리 — 별도 추가 불요

// 추가 refine — production-only 조건부
.refine(
  (cfg) => cfg.NODE_ENV !== 'production' || (cfg.COOKIE_DOMAIN && cfg.COOKIE_DOMAIN !== ''),
  {
    message: 'production 환경에서 COOKIE_DOMAIN 명시 필수 (IP 구매 후 결정)',
    path: ['COOKIE_DOMAIN'],
  },
)
.refine(
  (cfg) => !cfg.COOKIE_DOMAIN || !/^\d{1,3}(\.\d{1,3}){3}$/.test(cfg.COOKIE_DOMAIN),
  {
    message: 'COOKIE_DOMAIN 에 IP 주소 사용 불가 (RFC 6265 §4.1.2.3) — 도메인명 사용',
    path: ['COOKIE_DOMAIN'],
  },
)
.refine((cfg) => cfg.JWT_REFRESH_SECRET !== cfg.JWT_SECRET, {
  message: 'JWT_REFRESH_SECRET 이 JWT_SECRET 과 동일 — 재사용 금지',
  path: ['JWT_REFRESH_SECRET'],
})
.refine((cfg) => cfg.JWT_REFRESH_SECRET !== cfg.USER_TOKEN_HASH_SALT, {
  message: 'JWT_REFRESH_SECRET 이 USER_TOKEN_HASH_SALT 와 동일 — secret 재사용 금지',
  path: ['JWT_REFRESH_SECRET'],
})
.refine((cfg) => !cfg.LANGFUSE_SALT || cfg.JWT_REFRESH_SECRET !== cfg.LANGFUSE_SALT, {
  message: 'JWT_REFRESH_SECRET 이 LANGFUSE_SALT 와 동일 — secret 재사용 금지',
  path: ['JWT_REFRESH_SECRET'],
})
.refine((cfg) => uniqueCharRatio(cfg.JWT_REFRESH_SECRET) >= 0.5 || cfg.NODE_ENV !== 'production', {
  message: 'JWT_REFRESH_SECRET 엔트로피 부족 — openssl rand -base64 32 권장',
})
```

### 10.4 TDD 케이스 (env.validation.test.ts — 6 cases 추가)

| # | 케이스 |
|---|------|
| 9.1 | `JWT_REFRESH_SECRET 미설정 → throw` |
| 9.2 | `JWT_REFRESH_SECRET === JWT_SECRET → throw (refine 1)` |
| 9.3 | `JWT_REFRESH_SECRET === USER_TOKEN_HASH_SALT → throw (refine 2)` |
| 9.4 | `dev 에서 COOKIE_DOMAIN 미설정 → PASS` (Tailscale IP host-only 허용) |
| 9.5 | `production 에서 COOKIE_DOMAIN 미설정 → throw` |
| 9.6 | `COOKIE_DOMAIN=100.102.41.122 (IP) → throw` (RFC 6265 §4.1.2.3) |

### 10.5 main.ts

```ts
import cookieParser from 'cookie-parser';
// ...
app.use(cookieParser());
```

**Phase 9 종료 기준**: 4 케이스 GREEN, `.env.example` 의 `JWT_EXPIRES_IN=24h` 코멘트는 보존(머지 직전 회귀).

---

## 11. Phase 10 — Web 마이그레이션 (소요 ~3h)

### 11.1 의존성

- 입력: Phase 8 (cookie 기반 응답) + Phase 9 (cookie-parser 등록)
- 출력: 6 페이지 + 3 lib 의 토큰 의존 제거
- 후속 Phase 차단: Phase 11 (e2e)

### 11.2 변경/삭제 파일

| 파일 | 작업 |
|------|-----|
| `apps/web/src/lib/api-client.ts` | 수정 — `request()` 의 `token?` 파라미터 제거 + `credentials: 'include'` 추가 + 401 → /auth/refresh → 1회 재시도 wrapper |
| `apps/web/src/lib/auth-storage.ts` | **삭제** (45 LOC) |
| `apps/web/src/lib/home/data.ts` | 수정 — `hasToken()` → `useUser()` 훅 (또는 임시로 server-side `cookies().get('access')` SSR 분기) |
| `apps/web/src/components/Header.tsx` | 수정 — `hasToken/clearToken` 의존 제거 → `useUser()` 훅 + `apiClient.auth.logout()` |
| `apps/web/src/app/login/page.tsx` | 수정 — `setToken(accessToken)` 제거 + redirect 만 |
| `apps/web/src/app/register/page.tsx` | 동일 |
| `apps/web/src/app/play/solo/page.tsx` | 수정 — `getToken()` 제거 + `apiClient.solo.*(token, ...)` → `apiClient.solo.*(...)` |
| `apps/web/src/app/review/mistakes/page.tsx` | 동일 |

### 11.3 신규 훅 (useUser)

```ts
// apps/web/src/lib/use-user.ts
export function useUser(): { user: { id: string; username: string } | null; loading: boolean } {
  const [state, setState] = useState({ user: null, loading: true });
  useEffect(() => {
    apiClient.users.me()
      .then((u) => setState({ user: u, loading: false }))
      .catch(() => setState({ user: null, loading: false }));
  }, []);
  return state;
}
```

→ `/api/users/me` (이미 존재) 호출 → cookie 자동 첨부 → 인증 상태를 응답 200/401 로 판단.

### 11.4 api-client refresh 재시도 wrapper

```ts
async function request<T>(method, path, options = {}): Promise<T> {
  const doFetch = () => fetch(`${API_URL}/api${path}`, {
    method, headers: {'Content-Type': 'application/json'}, body: ...,
    credentials: 'include',  // 신규
    cache: 'no-store',
  });

  let res = await doFetch();
  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    // 1회만 refresh 시도
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshRes.ok) {
      res = await doFetch();
    } else {
      window.location.href = '/login';
      throw new Error('session_expired');
    }
  }
  if (!res.ok) throw new Error(`API ${method} ${path} failed: ${res.status}`);
  return res.json();
}
```

### 11.5 TDD 케이스

Web 단은 Vitest + React Testing Library 가 아닌 컴포넌트 테스트 없음 (기존 패턴). `npm run typecheck --workspace=apps/web` + `npm run build --workspace=apps/web` PASS 가 회귀 게이트.

**Phase 10 종료 기준**: typecheck + build PASS. 사용자 수동 검증 — 로그인 → /play/solo 게임 시작 → 30분 대기 → refresh 자동 → 게임 계속 → logout → 모든 cookie clear.

---

## 12. Phase 11 — e2e + 임시 완화 회귀 (소요 ~1.5h)

### 12.1 의존성

- 입력: Phase 1~10 모두 GREEN
- 출력: 정식 30m 회귀 + 사용자 spike 확인

### 12.2 e2e 시나리오 (PR-10a 머지 직전)

수동 검증 (사용자 환경 또는 staging):

- [ ] **Tailscale http://api.local 동작** — secure:false dev 분기 검증 (Phase 0 spike 결과 반영)
- [ ] **로그인 → 30분 동안 인증 유지** — access cookie 만료 직전
- [ ] **30분 후 첫 호출 → /auth/refresh 자동 → 재시도 200**
- [ ] **로그아웃 → 모든 활성 access 즉시 401** (epoch++)
- [ ] **2개 탭 동시 refresh → 한 탭만 새 토큰 발급** (Redis SETNX)
- [ ] **refresh 토큰 재사용 시뮬레이션 → family 전체 revoke** — 수동 SQL 로 oldJti 의 revokedAt 을 NULL 로 되돌린 뒤 그 토큰으로 refresh → 401 + 모든 family 토큰 revoke

### 12.3 임시 완화 24h → 정식 30m 회귀

```bash
# .env (사용자 환경)
JWT_EXPIRES_IN=30m  # 24h 에서 회귀

# .env.example 의 임시 완화 코멘트 제거 + JWT_EXPIRES_IN=30m

# env.validation.ts default
JWT_EXPIRES_IN: z.string().default('30m'),  // 기존 '15m' → '30m'

# 사용자 작업: API 컨테이너 재기동
sudo docker compose restart api
```

### 12.4 docs 업데이트

- `docs/CONTEXT.md` — Session 13 진행 상태 추가
- `docs/sessions/SESSION_2026-04-29-session-13.md` (또는 작업 일자)
- `docs/decisions/ADR-020-ux-redesign.md` §11 변경 이력 +1 행

**Phase 11 종료 기준**: 6 e2e 모두 PASS. PR-10a 머지 가능 상태.

---

## 13. 합계 메트릭

| 항목 | 값 |
|------|---|
| 신규 TDD 케이스 | 12+5+4+4+5+6+6 = **42 cases** (목표 11+ 충족) |
| 수정 TDD 케이스 | 12 (auth/users/auth.controller 회귀) |
| 신규 파일 | 9 (마이그 2 + entity + service + utils + strategy.test + useUser hook + 4 docs 일부) |
| 수정 파일 | 15+ |
| 삭제 파일 | 1 (auth-storage.ts) |
| 신규 의존성 | 2 (`cookie-parser` + `@types/cookie-parser`) |
| 마이그레이션 | 2 (token_epoch ALTER + refresh_tokens CREATE) |
| 환경변수 신규 | 5 (JWT_REFRESH_SECRET / JWT_REFRESH_EXPIRES_IN / COOKIE_DOMAIN — 또한 30m 회귀 1) |
| 작업 시간 | ~20h ≈ 2.5d (Phase 1: 2h + Phase 2: 0.5h + Phase 3: 1h + Phase 4: 6h + Phase 5: 1h + Phase 6: 2h + Phase 7: 1.5h + Phase 8: 3h + Phase 9: 1h + Phase 10: 3h + Phase 11: 1.5h) |

→ ADR-020 §6 일정 2d 보다 약간 초과. Reviewer 결정 ("PR-10a 머지까지 ~2d") 의 ±25% 안.

---

## 14. 회귀 게이트 (각 Phase 종료 시 자동)

```bash
# 매 Phase 종료 시
npm run typecheck --workspace=apps/api
npm run typecheck --workspace=apps/web
npm run test --workspace=apps/api -- --reporter=verbose
npm run lint
```

총 테스트 추정: 976+1s → 1015+ (40 케이스 추가).

---

## 15. 리스크 / 미해결

| # | 리스크 | 경감 |
|---|------|-----|
| 1 | Tailscale dev 환경에서 secure:false cookie 의 평문 노출 (XSS 시 cookie 탈취) | dev 한정 (사용자 본인 1명) — risk profile 무시 가능. production 은 `secure:true` 자동 활성 (NODE_ENV 분기) |
| 2 | dual-mode 트랜지션 동안 cookie/Bearer 양쪽 인증 우회 가능성 | dual-mode 1주일 한정. PR-10a 머지 1주일 후 후속 PR 로 Bearer extractor 제거 |
| 3 | Redis 다운 시 fail-open mutex → race window 짧게 발생 | ADR-020 §4.2.1 A 합의 채택 (부트캠프 환경 우선) |
| 4 | 마이그레이션 순서 (1714000009000 < 010000) 의 부분 적용 — 이미 운영 중인 DB 에서 010000 만 fail | 두 마이그레이션 모두 `down()` 작성 — 부분 적용 시 down 으로 롤백 가능 |
| 5 | OriginGuard 미적용 → CSRF 우회 가능성 | PR-10c 범위 (PR-10a 머지 후 1d). 24h~1주일 노출 — 부트캠프 신뢰 그룹 risk profile 안 |
| 6 | 운영 URL 결정 시 PR-10a 의 cookie 분기 재검토 필요 (IP 운영 vs 도메인 운영) | IP 구매 후 별도 follow-up PR — 현재 plan 의 `secure: NODE_ENV==='production'` + `COOKIE_DOMAIN` production-only refine 로 자동 활성. 운영 URL 이 IP 면 도메인 미설정 host-only cookie 로 운영 가능 (단, subdomain hijack 방어 미적용 → 운영 환경 risk profile 재평가 필요) |

---

## 16. 다음 행동 권장

1. **사용자**: 추가 spike 불필요. 본 plan 그대로 진입 가능
2. **에이전트**: 본 plan §2 (Phase 1 마이그레이션) 부터 RED-first TDD 진입 — PR-10a 본 작업

운영 URL 결정 시점은 후속 별개 작업 (IP 구매 후 follow-up PR — `secure:true` 가 자동 활성되므로 코드 변경 0, env 추가만).

---

## 17. 변경 이력

| 일자 | 변경 |
|------|-----|
| 2026-04-29 | 초안 작성 (Session 13). consensus-010 의 Reviewer 5결정 그대로 이행. ADR-020 §4.2.1 부속서 의 코드 예시를 Phase 분해. |
| 2026-04-29 (보강) | 사용자 환경 사실 반영 (Tailscale HTTP IP only, localhost 접근 불가, production URL 미정). §0 spike 완료 표시 / §10.3 `COOKIE_DOMAIN` production-only 조건부 + IP 거부 refine / §10.4 6 cases (4→6) / §13 42 cases / §15 risk #6 운영 URL 결정 추가 / §16 spike 불필요 명시 |
