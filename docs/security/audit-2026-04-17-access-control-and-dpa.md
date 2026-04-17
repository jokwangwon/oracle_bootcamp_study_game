# 보안 점검 핸드오프 — 접근 제어 · 클라이언트 신뢰 · 외부 API 데이터 흐름

> **작성일**: 2026-04-17
> **성격**: 분석 결과 + 구현 대상 핸드오프 (본 세션에서는 코드 수정 없음)
> **수신 에이전트**: 아래 "Action Items" 를 TDD 로 구현할 후속 에이전트
> **상위 문서**: `CLAUDE.md §2 하네스`, `docs/architecture/oss-model-evaluation-design.md §7.4`, `ADR-011`

---

## 0. 병행 작업 경계 (Coordination Boundary)

**현재 병행 중으로 가정되는 작업**: MVP-B Session 3 — Layer 1 `AstCanonicalGrader` (ADR-013)

| 구분 | 경로 / 자원 | 병행 에이전트 | 본 핸드오프 |
|---|---|---|---|
| `apps/api/src/modules/grading/**` | 🔒 **변경 금지** | ✅ 작업 중 | ❌ 건드리지 않음 |
| `package.json` (`node-sql-parser` 추가) | ⚠️ 순차 처리 | dep 추가 중 | helmet / throttler 추가 필요 → **병행 에이전트 dep 추가 완료 후 rebase 후 추가** |
| `apps/api/src/main.ts` | ✅ 자유 | 미관여 | ✅ 본 핸드오프 전용 |
| `apps/api/src/modules/ai/llm-client.ts` | ✅ 자유 | 미관여 | ✅ 본 핸드오프 전용 |
| `apps/api/src/modules/game/game-session.service.ts` | ⚠️ 검토 | 간접 (GradingOrchestrator 호출부는 Session 6 이후) | ✅ finishSolo 만 |
| `.env.example` | ⚠️ 순차 | 미관여 추정 | ✅ 새 변수 추가 |
| `apps/api/src/config/env.validation.ts` | ⚠️ 순차 | 미관여 추정 | ✅ 새 키 validator |

**작업 원칙**:
1. `grading/` 하위 파일은 절대 touch 금지.
2. `package.json` 수정이 필요한 P0-1b (Langfuse fail-closed)·P1-4 (helmet)·P1-5 (throttler) 는 **병행 에이전트 커밋 병합 후** 진행.
3. 브랜치: 별도 `feature/security-hardening-2026-04` 브랜치에서 진행, MVP-B 브랜치 병합 충돌 지점 최소화.
4. 작업 시작 전 `git pull` → `git log feature/oss-model-eval..` 로 병행 커밋 확인.

---

## 1. 검증된 발견 사항

### 1.1 백엔드 접근 제어 — 🟢 대체로 양호

| Method | Path | Guard | 근거 |
|---|---|---|---|
| POST | `/auth/register`, `/auth/login` | 없음 (의도적 공개) | `auth.controller.ts:31,36` |
| POST | `/games/solo/*` | `JwtAuthGuard` | `game.controller.ts:93` |
| POST | `/questions/generate`, GET `/questions/generate/:jobId` | `JwtAuthGuard` | `ai-question.controller.ts:58` |
| GET | `/questions` | `JwtAuthGuard` | `content.controller.ts:8` |
| POST | `/eval/run` | `JwtAuthGuard + EvalAdminGuard` | `eval.controller.ts:115` |
| PATCH | `/questions/:id/review` | `JwtAuthGuard + EvalAdminGuard` | `admin-review.controller.ts:32` |
| POST | `/notion/sync` | `JwtAuthGuard + EvalAdminGuard` | `notion.controller.ts:27` |
| POST | `/questions/:id/report` | `JwtAuthGuard` | `question-report.controller.ts:19` |
| GET | `/users/me`, `/users/me/progress` | `JwtAuthGuard` | `users.controller.ts:13` |

**강점**
- `EvalAdminGuard` 는 **fail-closed** 확인됨 — `apps/api/src/modules/ai/eval/eval-admin.guard.ts:47-51` 에서 whitelist 비면 `ForbiddenException`.
- JWT `ignoreExpiration: false` (`jwt.strategy.ts:16`), `bcrypt` rounds=12.

**보완 필요**
- CORS origin 이 **프론트 빌드용 접두사**인 `NEXT_PUBLIC_API_URL` 을 재사용 (`main.ts:18`) → 의미 혼선.
- `helmet` 미사용. 보안 헤더(X-Frame-Options, X-Content-Type-Options, HSTS) 전무.
- `@nestjs/throttler` 미사용. `/auth/login` brute-force · `/eval/run` spam 취약.

### 1.2 클라이언트 신뢰 경계 — 🟡 채점은 서버, 세션 집계는 클라이언트

- **정답 판정**: 서버 전담. `game-session.service.ts:96-127` `mode.evaluateAnswer()`.
- **정답/해설 노출**: 제출 응답에만 포함. `GET /api/questions` 에는 제외 (확인됨).
- **answer_history INSERT**: 서버 전담 (`game-session.service.ts:112-123`).
- **⚠️ 세션 합계**: `finishSolo` 가 클라이언트 계산한 `correctCount`, `totalScore` 를 **검증 없이 그대로 저장** (`game-session.service.ts:138-160`). 주석에 "MVP 단순 위임" 명시. 랭킹/대전 도입 전 `answer_history` 집계 교차 검증 필수.

### 1.3 외부 API 데이터 흐름 + DPA 필요성

| 서비스 | 데이터 | 제3자? | DPA |
|---|---|---|---|
| **Anthropic Claude** | 프롬프트·문서 스니펫·학생 답안 | ✅ SaaS (미국) | 🔴 **필수 (현재 미체결 추정)** |
| **Ollama** (운영 기본) | 동일 | ❌ 로컬 컨테이너 | 불필요 |
| **Langfuse** | 모든 LLM trace (프롬프트+응답 전문) | **조건부** | **조건부 (아래 1.4 참조)** |
| **Notion API** | 통합 토큰·워크스페이스 문서 | ✅ SaaS | 🔴 **필수 (조직 DPA 확인)** |

### 1.4 🔴 **Silent External Transmission 취약점 — Langfuse cloud fallback**

`apps/api/src/modules/ai/llm-client.ts:170-185` 원본:

```ts
private createLangfuseHandler(): CallbackHandler | null {
  const publicKey = this.config.get<string>('LANGFUSE_PUBLIC_KEY');
  const secretKey = this.config.get<string>('LANGFUSE_SECRET_KEY');
  const baseUrl =
    this.config.get<string>('LANGFUSE_HOST') ?? 'https://cloud.langfuse.com';
  // ...
}
```

**문제**: `LANGFUSE_HOST` 누락 + `LANGFUSE_PUBLIC_KEY` · `LANGFUSE_SECRET_KEY` 존재 시 → 모든 프롬프트·응답이 **Langfuse SaaS(클라우드)** 로 전송. `.env.example:77` 기본값은 self-host 이나, 운영 `.env` 에서 이 변수가 실수로 빠지면 소리 없이 유출.

**수정 방향**: cloud fallback 제거 → `LANGFUSE_HOST` 가 비어있으면 `null` 반환 (telemetry 비활성), 또는 명시적 opt-in (`LANGFUSE_ALLOW_CLOUD=true`).

### 1.5 🔴 **Anthropic 경로 잔존** (DPA 미체결 시 위험)

- `.env.example` 운영 기본값은 `LLM_PROVIDER=ollama` (ADR-011 P1 완료).
- 그러나 `llm-client.ts:136-148` 에 `anthropic` 분기 활성 → 운영 `.env` 가 `anthropic` 으로 설정되는 즉시 학생 답안·문서 스니펫이 Anthropic 서버로 송신.

**수정 방향**: `NODE_ENV === 'production'` 에서는 `anthropic` 금지, 또는 `ALLOW_ANTHROPIC_SAAS=true` 명시 opt-in.

### 1.6 🔴 **Notion 통합 토큰 노출 경로**

- `NOTION_API_TOKEN` 이 `.env` 평문 저장 (`.env.example:56`, `130`). git 커밋 이력 노출 여부 확인 필요.
- 동기화되는 문서에 수강생 정보(이름/연락처/성적) 포함 가능성 → 조직-Notion DPA 범위 확인.

---

## 2. Action Items (TDD · 우선순위별)

> **규칙**: 각 항목은 RED → GREEN → REFACTOR. 테스트 파일 경로 명시. 커밋 메시지는 Conventional Commits.

### P0 — 즉시 (이번 주, 병행 에이전트 완료 후)

#### P0-1. Langfuse cloud fallback 제거 (🔴 silent exfiltration 차단)

- **파일**: `apps/api/src/modules/ai/llm-client.ts:170-185`
- **변경 내용**:
  - `baseUrl` 계산에서 `?? 'https://cloud.langfuse.com'` 제거
  - `LANGFUSE_HOST` 가 비어있거나 미설정이면 `return null` (현재 keys 없을 때와 동일 경로)
  - 필요 시 `LANGFUSE_ALLOW_CLOUD=true` opt-in 플래그 도입
- **테스트** (`apps/api/src/modules/ai/__tests__/llm-client.spec.ts` 또는 신규):
  1. `LANGFUSE_PUBLIC_KEY` · `LANGFUSE_SECRET_KEY` 설정 + `LANGFUSE_HOST` 미설정 → `createLangfuseHandler()` 가 `null` 반환
  2. 3개 모두 설정 + self-host URL → `CallbackHandler` 반환
  3. `LANGFUSE_HOST='https://cloud.langfuse.com'` 명시 + `LANGFUSE_ALLOW_CLOUD=true` → 통과, 없으면 throw
- **환경변수**: `env.validation.ts` 에 `LANGFUSE_HOST` optional 유지, `LANGFUSE_ALLOW_CLOUD` (boolean, default false) 추가
- **문서 업데이트**: `.env.example:77` 주석에 "LANGFUSE_HOST 미설정 시 텔레메트리 비활성. SaaS 사용은 LANGFUSE_ALLOW_CLOUD=true 명시" 추가
- **커밋**: `fix(security): langfuse cloud fallback 제거 (silent exfiltration 차단)`

#### P0-2. Anthropic provider 운영 환경 차단

- **파일**: `apps/api/src/modules/ai/llm-client.ts:135-148`
- **변경 내용**:
  - `opts.provider === 'anthropic'` 분기 진입 시:
    - `process.env.NODE_ENV === 'production'` AND `process.env.ALLOW_ANTHROPIC_SAAS !== 'true'` → `throw Error('Anthropic SaaS 호출은 DPA 체결 후 ALLOW_ANTHROPIC_SAAS=true 로만 활성화 가능')`
- **테스트**:
  1. dev 환경 + anthropic + API key → 통과 (기존 동작)
  2. prod 환경 + anthropic + flag false → throws
  3. prod 환경 + anthropic + flag true + API key → 통과
- **env.validation.ts**: `ALLOW_ANTHROPIC_SAAS` optional boolean 추가
- **커밋**: `fix(security): anthropic provider 운영 차단 (DPA 미체결 fail-closed)`

#### P0-3. CORS_ORIGIN 환경변수 분리

- **파일**: `apps/api/src/main.ts:17-20`
- **변경 내용**:
  ```ts
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  ```
- `.env.example` 에 `CORS_ORIGIN=http://localhost:3000` 추가 + `NEXT_PUBLIC_API_URL` 과 분리된 의미 주석
- `env.validation.ts` 에 `CORS_ORIGIN` optional string
- **테스트**: `main.ts` 는 bootstrap 이라 단위 테스트 어려움 → e2e 또는 config 단위 테스트로 대체. 최소한 `env.validation.ts` 의 새 키 인식 테스트.
- **커밋**: `refactor(security): CORS_ORIGIN 환경변수 분리 (NEXT_PUBLIC 접두사 혼선 해소)`

### P1 — 2주 내 (MVP-B Session 3 병합 후)

#### P1-4. helmet 도입

- 의존성: `pnpm add helmet` (root workspace 아니라 `apps/api`)
- **파일**: `apps/api/src/main.ts:6` 이후 `app.use(helmet())`
- **테스트**: e2e 로 응답 헤더 확인 (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`)
- **커밋**: `feat(security): helmet 미들웨어 적용`

#### P1-5. @nestjs/throttler 도입

- 의존성: `pnpm add @nestjs/throttler`
- **범위**: `/auth/login` (10/min), `/auth/register` (5/min), `/eval/run` (2/min), `/notion/sync` (1/min), `/questions/generate` (20/hour), `/questions/:id/report` (10/hour)
- **파일**:
  - `apps/api/src/app.module.ts` 에 `ThrottlerModule.forRoot()` 등록
  - 각 controller 에 `@Throttle(...)` 또는 `@UseGuards(ThrottlerGuard)`
- **테스트**: controller spec 에서 rate limit 초과 시 429 반환 확인
- **커밋**: `feat(security): rate limiting 적용 (auth/eval/notion/aqg 엔드포인트)`

#### P1-6. finishSolo 서버측 교차 검증

- **파일**: `apps/api/src/modules/game/game-session.service.ts:138-160`
- **변경 내용**: `finishSolo` 내부에서 해당 세션의 `answer_history` 를 재조회 → `correctCount`, `totalScore` 계산 후 클라이언트 값과 불일치 시 서버 계산값 우선 + `ops_event_log` 에 `kind='client_total_mismatch'` 기록
- **테스트**: 클라이언트가 조작된 totalScore 전송 시 서버 값으로 대체되는지
- **커밋**: `fix(security): finishSolo 서버측 answer_history 교차 검증`

#### P1-7. Notion DPA 확인 (ops 태스크, 코드 아님)

- Notion 조직 플랜(Business/Enterprise) 기본 DPA 범위 확인
- `notion_documents.raw_markdown` 내 PII(수강생 이름/이메일/연락처) 스캔 스크립트 작성 → 발견 시 마스킹
- **산출물**: `docs/operations/notion-dpa-status.md`

### P2 — 다음 스프린트 (MVP-C 병행)

#### P2-8. activeRounds → Redis

- `game-session.service.ts:46` 의 in-memory Map → Redis 저장소
- 이미 주석에 명시된 TODO. 멀티 인스턴스 확장 전제 조건

#### P2-9. Langfuse / 내부 서비스 localhost 바인드

- `docker-compose.yml` 검토: `langfuse`, `postgres`, `redis`, `ollama` 포트 바인드
- 외부 접근 필요 없는 서비스는 `127.0.0.1:<port>:<container_port>` 로 변경

---

## 3. 테스트 체크리스트 (핸드오프 수신 에이전트가 종료 전 확인)

- [ ] P0 항목 각각 RED → GREEN → REFACTOR 사이클 완료
- [ ] `pnpm -w test` 전체 GREEN (기존 464 cases + 신규 테스트)
- [ ] `pnpm -w typecheck` clean
- [ ] `.env.example` 업데이트 (`LANGFUSE_ALLOW_CLOUD`, `ALLOW_ANTHROPIC_SAAS`, `CORS_ORIGIN`)
- [ ] `env.validation.ts` 업데이트 + validator 테스트
- [ ] 커밋 메시지 Conventional Commits 규칙 준수
- [ ] `docs/CONTEXT.md` 에 "P0-1/P0-2/P0-3 완료" 진행 현황 반영
- [ ] `docs/sessions/SESSION_<날짜>.md` 세션 로그 작성
- [ ] **`apps/api/src/modules/grading/**` 변경 없음 확인** (`git diff --stat` 로 검증)

---

## 4. 참조

- **SDD**: `docs/architecture/oss-model-evaluation-design.md` §7.4 (키 관리)
- **ADR-011**: `docs/decisions/ADR-011-*` (OSS primary 모델, Anthropic → Ollama 전환)
- **ADR-013**: 역피라미드 3단 채점 (병행 에이전트 작업 범위)
- **CLAUDE.md** §2 하네스 엔지니어링, §7 문서 의존 관계
- **원본 점검 리포트**: 본 파일 §1 에 요약. 상세 Explore 에이전트 출력은 세션 로그 참조.

---

## 5. 합의 프로토콜 권고

- P0-2 (Anthropic 차단) 는 **운영 정책 변경** → CLAUDE.md §3 에 따라 **3+1 합의 권장**
- P0-1 (Langfuse fallback 제거) 는 단순 버그 수정 수준 → 1개 에이전트 직접 처리 가능
- P0-3 (CORS env 분리) 는 refactor → 직접 처리
- P1-6 (finishSolo 교차 검증) 는 채점 신뢰 경계 변경 → **3+1 합의 권장**

---

**핸드오프 완료 시점**: 2026-04-17
**다음 체크포인트**: P0-1/P0-2/P0-3 커밋 후 본 문서 §2 에 완료 마크 + `docs/CONTEXT.md` 갱신
