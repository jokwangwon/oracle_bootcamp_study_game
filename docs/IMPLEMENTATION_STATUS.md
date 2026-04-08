# 구현 현황 (Implementation Status)

> **SDD 챕터 ↔ 실제 코드 매핑 + 진행률 추적**

**최종 업데이트**: 2026-04-08
**기준 SDD**: `docs/architecture/oracle-dba-learning-game-design.md`
**현재 브랜치**: `feature/mvp-phase1`

---

## 문서 사용법

이 문서는 **SDD의 청사진 ↔ 실제 코드 ↔ 남은 작업**을 한눈에 보여주는 살아있는 체크리스트다.

- **체크박스** `- [x]` / `- [ ]`: SDD에 명시된 항목의 완료 여부
- **코드 위치** `path:line`: 해당 항목이 구현된 파일 (없으면 `—`)
- **상태 라벨**:
  - `✅ 구현 완료` — SDD 의도대로 동작
  - `🟡 부분 구현` — 일부만 구현됨 (보강 필요)
  - `🔴 미구현` — SDD에 있지만 코드 없음
  - `⚪ MVP 후순위` — SDD에 있으나 MVP 1단계 이후로 의도적 보류

세션 시작 시 이 문서를 먼저 확인하면 "어디부터 이어 작업할지" 즉시 파악할 수 있다.
SDD를 변경했다면 반드시 이 문서도 함께 갱신한다.

---

## 1. 현재 MVP 단계: **1단계 (Week 1-2)**

| 단계 | 목표 | 진행률 |
|------|------|--------|
| **1단계** | 솔로 퀴즈 (빈칸타이핑 + 용어맞추기) + AI 문제 생성 | **약 60%** |
| 2단계 | 결과예측 + 카테고리분류 + 랭킹 | 0% (⚪) |
| 3단계 | 시나리오 시뮬레이션 + 실시간 대전 | 0% (⚪) |

### 1단계 진행률 상세

| 영역 | 상태 | 비고 |
|------|------|------|
| 인증 (JWT + bcrypt) | ✅ | refresh 토큰만 미구현 |
| 사용자/진도 엔티티 | ✅ | 진도 갱신 로직은 미구현 |
| 게임 모드 엔진 (Strategy Pattern) | ✅ | 모드 2개 |
| 솔로 게임 세션 | 🟡 | 메모리 보관, 종료/요약/진도반영 미구현 |
| 문제 풀 조회 | ✅ | 누적 화이트리스트 적용 |
| 학습 범위 검증 | ✅ | 계산적 키워드 매칭 |
| 시드 데이터 (사전 생성 문제 풀) | 🔴 | **현재 DB 빈 상태 → 게임 실행 불가** |
| AI 문제 생성 워커 (BullMQ) | 🔴 | 패키지만 설치, 코드 없음 |
| 노션 import → 범위 추론 | 🔴 | 미시작 |
| 프론트 솔로 화면 | 🟡 | 로그인 화면 없음, 임시 토큰 |
| Docker Compose 환경 | ✅ | postgres/redis/api/web 정의 완료 |
| 테스트 (Vitest) | ✅ | 4 파일 / 29 케이스 GREEN |

> **다음 세션 우선순위 제안**: 시드 데이터 작성 → 프론트에서 실제 게임이 돌아가는 것을 확인 → 그 다음 BullMQ 워커.

---

## 2. SDD §2 시스템 아키텍처

### 2.1 모듈 구조 매핑

| SDD 모듈 | 코드 위치 | 상태 |
|---------|-----------|------|
| AuthModule | `apps/api/src/modules/auth/auth.module.ts` | ✅ |
| UserModule | `apps/api/src/modules/users/users.module.ts` | ✅ |
| GameModule | `apps/api/src/modules/game/game.module.ts` | 🟡 (모드 2/5) |
| ContentModule | `apps/api/src/modules/content/content.module.ts` | 🟡 (조회만, AI 생성 X) |
| **WebSocketGateway** | — | 🔴 (⚪ MVP 3단계) |

### 2.2 기술 스택 설치 상태

| 레이어 | 패키지 | 설치 | 사용 |
|--------|--------|------|------|
| Next.js 14 + App Router | `next` | ✅ | ✅ |
| NestJS 10 | `@nestjs/*` | ✅ | ✅ |
| Socket.IO | `socket.io`, `@nestjs/platform-socket.io` | ✅ | 🔴 import 0건 |
| BullMQ | `bullmq`, `@nestjs/bullmq` | ✅ | 🔴 import 0건 |
| TypeORM + pg | `typeorm`, `pg` | ✅ | ✅ |
| ioredis | `ioredis` | ✅ | 🔴 import 0건 |
| Anthropic SDK | `@anthropic-ai/sdk` | ✅ | 🔴 import 0건 |
| bcrypt + JWT | `bcrypt`, `@nestjs/jwt`, `passport-jwt` | ✅ | ✅ |
| Zod | `zod` | ✅ | ✅ |

> 의존성은 모두 깔려 있어, 워커/게이트웨이를 추가할 때 별도 설치가 필요 없다.

---

## 3. SDD §3 게임 모드

### 3.1 GameMode 인터페이스 (Strategy Pattern)

- [x] `GameMode` 인터페이스 — `packages/shared/src/types/game.ts:77`
- [x] `RoundConfig`, `Round`, `PlayerAnswer`, `EvaluationResult` — `packages/shared/src/types/game.ts`
- [x] `GameModeRegistry` — `apps/api/src/modules/game/modes/game-mode.registry.ts`

> ⚠ **SDD ↔ 코드 drift**: SDD §3.1은 `generateRound: Promise<Round>`(async)로 정의했지만 실제 인터페이스는 동기. 현재 AI 실시간 생성이 없어 동기로도 충분하지만, AI 생성 워커가 들어오면 인터페이스를 async로 바꿔야 함.

### 3.2 5개 게임 모드

| # | 모드 | SDD 위치 | 코드 위치 | 테스트 | 상태 |
|---|------|---------|-----------|--------|------|
| 1 | 빈칸 타이핑 | §3.2 Mode 1 | `apps/api/src/modules/game/modes/blank-typing.mode.ts` | 11 | ✅ |
| 2 | 용어 맞추기 | §3.2 Mode 2 | `apps/api/src/modules/game/modes/term-match.mode.ts` | 10 | ✅ |
| 3 | 결과 예측 | §3.2 Mode 3 | — | — | ⚪ MVP 2단계 |
| 4 | 카테고리 분류 | §3.2 Mode 4 | — | — | ⚪ MVP 2단계 |
| 5 | 시나리오 시뮬레이션 | §3.2 Mode 5 | — | — | ⚪ MVP 3단계 |

### 3.3 게임 모드 컨텐츠 타입 (Discriminated Union)

| 타입 | 정의 | Zod 스키마 |
|------|------|-----------|
| `BlankTypingContent` | ✅ `packages/shared/src/types/question.ts:16` | ✅ `question.schema.ts:9` |
| `TermMatchContent` | ✅ `:26` | ✅ `:23` |
| `ResultPredictContent` | ✅ `:32` | ✅ `:29` |
| `CategorySortContent` | ✅ `:39` | ✅ `:36` |
| `ScenarioContent` | ✅ `:48` | ✅ `:49` |

> 5개 컨텐츠 타입과 Zod 스키마는 모두 정의돼 있다. 모드 구현만 추가하면 된다.

### 3.4 JSON Config (모드별 점수/시간 설정)

- [ ] SDD §3.4의 mode config JSON (timeLimit, blanksPerRound, scoring 가중치 등)을 외부 설정으로 분리 — 🔴
  - 현재는 각 모드 내 상수로 하드코딩 (`BASE_SCORE`, `HINT_PENALTY_PER_USE` 등)
  - 헌법 8-2조(하드코딩 금지)와 충돌 가능성 — 차후 정리 필요

---

## 4. SDD §4 AI 콘텐츠 파이프라인

### 4.1 전체 흐름

```
노션 자료 → [범위 추론] → [문제 생성] → [검증] → 문제 풀 저장
   🔴          🔴            🔴          🟡         ✅
```

### 4.2 각 단계 상태

| 단계 | SDD | 코드 | 상태 |
|------|-----|------|------|
| 노션 자료 입력/import | §4.1 | — | 🔴 |
| 범위 추론 (키워드 추출) | §4.2 | — | 🔴 |
| 주차/주제 매핑 | §4.2 Step 2 | — | 🔴 |
| 범위 태깅 | §4.2 Step 3 | — | 🔴 (수동 INSERT만 가능) |
| AI 문제 생성 (LLM 호출) | §4.3 | — | 🔴 (`@anthropic-ai/sdk` 미사용) |
| BullMQ 워커 격리 | §4.3 | — | 🔴 (`bullmq` 미사용) |
| ① 스키마 검증 (Zod) | §4.4 ① | `packages/shared/src/schemas/question.schema.ts` | ✅ (스키마만, 호출처는 없음) |
| ② 키워드 화이트리스트 매칭 | §4.4 ② | `apps/api/src/modules/content/services/scope-validator.service.ts` | ✅ |
| ③ 중복 검사 (유사도) | §4.4 ③ | — | 🔴 |
| ④ 문제 풀 저장 | §4.4 ④ | `apps/api/src/modules/content/services/question-pool.service.ts:58` | ✅ (`save()` 메서드) |

### 4.3 사전 생성 문제 풀 (Pre-generated Pool)

- [ ] 1주차 SQL 기초 — 빈칸 15 + 용어 15 — 🔴
- [ ] 2주차 SQL 함수 — 빈칸 10 + 용어 15 — 🔴
- [ ] 시드 데이터 스크립트 (`apps/api/src/seed/`) — 🔴

> **이게 없으면 프론트에서 게임을 시작해도 "활성 문제 없음" 에러**가 난다 (`game-session.service.ts:54`).

---

## 5. SDD §5 데이터 모델

### 5.1 PostgreSQL 엔티티 매핑

| SDD 테이블 | 엔티티 클래스 | 상태 |
|-----------|---------------|------|
| `users` | `apps/api/src/modules/users/entities/user.entity.ts` | ✅ |
| `user_progress` | `apps/api/src/modules/users/entities/user-progress.entity.ts` | ✅ |
| `questions` | `apps/api/src/modules/content/entities/question.entity.ts` | ✅ |
| `weekly_scope` | `apps/api/src/modules/content/entities/weekly-scope.entity.ts` | ✅ |
| `game_sessions` | — | 🔴 (메모리 Map만) |
| `session_players` | — | 🔴 |
| `answer_history` | — | 🔴 (Spaced Repetition 도입 전제) |
| `rankings` | — | 🔴 (⚪ MVP 2단계) |

### 5.2 Redis 데이터 구조

| SDD 키 | 용도 | 상태 |
|--------|------|------|
| `game:room:{roomId}` | 실시간 게임 방 | 🔴 (⚪ MVP 3단계) |
| `ranking:week:{week}` | 주차별 랭킹 (Sorted Set) | 🔴 (⚪ MVP 2단계) |
| `ranking:total` | 전체 랭킹 | 🔴 (⚪ MVP 2단계) |
| `game:room:{roomId}:round:{roundId}:answers` | ZADD 동시 답변 판정 | 🔴 (⚪ MVP 3단계) |
| `cache:questions:week:{week}:mode:{mode}` | 문제 캐시 | 🔴 |
| `session:{sessionId}` | 사용자 세션 | 🔴 (현재 JWT만) |

> Redis는 컨테이너만 떠 있고 코드에서 사용 0건. MVP 2단계에서 랭킹을 도입할 때 ioredis 클라이언트 추가.

---

## 6. SDD §6 플레이 모드별 흐름

### 6.1 솔로 모드 (§6.1)

| 단계 | SDD | 코드 위치 | 상태 |
|------|-----|-----------|------|
| 주차/모드/난이도 선택 UI | §6.1 | `apps/web/src/app/play/solo/page.tsx:54` (config phase) | ✅ |
| 문제 풀 로드 | §6.1 | `game-session.service.ts:38` (`startSolo`) | ✅ |
| 라운드 시작 + 타이머 | §6.1 | `solo/page.tsx:175` (`RoundPlayer`) — 클라 측 타이머만 | 🟡 (서버 검증 없음) |
| 정답 → 점수 계산 (시간 보너스 + 연속) | §6.1 | `blank-typing.mode.ts:79`, `term-match.mode.ts:95` | 🟡 (연속 정답 보너스 미구현) |
| 오답 → 정답 + 해설 표시 | §6.1 | — | 🔴 (정답 노출 없음) |
| `answer_history` 기록 | §6.1 | — | 🔴 (테이블 자체 없음) |
| 세트 완료 → 결과 요약 | §6.1 | `solo/page.tsx:148` (finished phase) | 🟡 (취약 분야 분석 없음) |
| `user_progress` 업데이트 | §6.1 | — | 🔴 |
| 랭킹 반영 | §6.1 | — | 🔴 (⚪ MVP 2단계) |

### 6.2 실시간 대전 모드 (§6.2)

전체 🔴 / ⚪ MVP 3단계.

### 6.3 네트워크 끊김 처리 (§6.3)

전체 🔴 / ⚪ MVP 3단계 (WebSocket 종속).

---

## 7. SDD §7 API 설계

### 7.1 REST API 구현 매트릭스

| Method | Path | SDD | 코드 위치 | 상태 |
|--------|------|-----|-----------|------|
| POST | `/api/auth/register` | §7.1 | `auth.controller.ts:32` | ✅ |
| POST | `/api/auth/login` | §7.1 | `auth.controller.ts:37` | ✅ |
| POST | `/api/auth/refresh` | §7.1 | — | 🔴 |
| GET | `/api/users/me` | §7.1 | `users.controller.ts:18` | ✅ |
| GET | `/api/users/me/progress` | §7.1 | `users.controller.ts:24` | ✅ (조회만, 갱신 X) |
| GET | `/api/users/me/history` | §7.1 | — | 🔴 |
| GET | `/api/questions` | §7.1 | `content.controller.ts:13` | ✅ |
| POST | `/api/questions/generate` | §7.1 | — | 🔴 (BullMQ 종속) |
| GET | `/api/questions/generate/:jobId` | §7.1 | — | 🔴 |
| PATCH | `/api/questions/:id/review` | §7.1 | — | 🔴 (관리자 승인) |
| POST | `/api/games/solo/start` | §7.1 | `game.controller.ts:71` | ✅ |
| POST | `/api/games/solo/answer` | §7.1 | `game.controller.ts:76` | ✅ |
| POST | `/api/games/solo/finish` | §7.1 | — | 🔴 (진도 반영 트리거) |
| GET | `/api/rankings` | §7.1 | — | 🔴 (⚪ MVP 2단계) |
| GET | `/api/rankings/me` | §7.1 | — | 🔴 (⚪ MVP 2단계) |
| GET | `/api/scope` | §7.1 | — | 🔴 |
| POST | `/api/scope/import` | §7.1 | — | 🔴 (노션 import) |
| PATCH | `/api/scope/:weekId` | §7.1 | — | 🔴 (관리자 편집) |

**구현된 엔드포인트: 7 / 18 (39%)**

### 7.2 WebSocket Events (§7.2)

전체 🔴 / ⚪ MVP 3단계.

---

## 8. SDD §8 배포

| 항목 | SDD | 코드 위치 | 상태 |
|------|-----|-----------|------|
| `docker-compose.yml` | §8.1 | `docker-compose.yml` | ✅ (postgres/redis/api/web) |
| `apps/api/Dockerfile` | §8.1 | `apps/api/Dockerfile` | ✅ |
| `apps/web/Dockerfile` | §8.1 | `apps/web/Dockerfile` | ✅ |
| BullMQ 워커 컨테이너 | §8.1 | — | 🔴 (워커 코드부터 부재) |
| `.env.example` | §8.3 | `.env.example` | ✅ |
| 환경변수 검증 (Zod) | 헌법 8-2조 | `apps/api/src/config/env.validation.ts` | ✅ |

> 워커 컨테이너 추가는 BullMQ 코드를 작성한 다음 docker-compose에 서비스 한 줄 추가하면 된다.

---

## 9. 헌법/원칙 준수 상태

| 조항 | 항목 | 상태 |
|------|------|------|
| 헌법 §3 | 계산적 검증 우선 (Zod + 화이트리스트) | ✅ |
| 헌법 §4 | TDD (RED → GREEN → REFACTOR) | ✅ (29 tests, REFACTOR 단계 미수행) |
| 헌법 §8-2 | 환경변수 중앙 관리, 하드코딩 금지 | 🟡 (모드 점수 가중치는 코드 내 상수) |
| ADR-005 | 로컬 추론 시 Python 분리 | ✅ (현재는 LLM API 호출만 → TS 충분) |
| ADR-006 | Docker-First | ✅ |
| ADR-007 | 변경 영향 분석 | 🟡 (이 문서 자체가 그 일환) |
| TEST_STRATEGY | 70% 커버리지 | ⚪ (커버리지 측정 미실행) |

---

## 10. 다음 작업 우선순위 (제안)

이전 합의/SDD를 존중하면서 "1단계 MVP 동작"을 가장 빠르게 만들기 위한 순서:

1. **시드 데이터 작성** — 1주차 sql-basics용 빈칸/용어 문제 30개를 SQL/JSON으로 작성하고 부트 시 INSERT
   - 이게 있어야 프론트에서 실제로 게임이 돈다
   - 헌법 §3 키워드 화이트리스트도 같이 시드
2. **솔로 게임 종료 흐름** — `POST /games/solo/finish` + `user_progress` 갱신 + `answer_history` 엔티티 추가
3. **로그인 UI** — 현재 임시 localStorage 토큰을 로그인/회원가입 화면으로 대체
4. **BullMQ 워커 + AI 문제 생성** — Anthropic SDK로 빈칸/용어 문제 생성, Zod 검증 → ScopeValidator → 풀 저장
5. **노션 import → 범위 추론** — 노션 API 또는 마크다운 업로드 → 키워드 추출 → `weekly_scope` 저장
6. **MVP 2단계 진입** — 결과예측/카테고리분류 모드 + 랭킹 (Redis Sorted Set)

---

## 부록 A. 디렉토리 트리 (실제)

```
oracle-dba-learning-game/
├── apps/
│   ├── api/                 (NestJS 10)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config/
│   │   │   │   ├── env.validation.ts
│   │   │   │   └── typeorm.config.ts
│   │   │   └── modules/
│   │   │       ├── auth/   ✅
│   │   │       ├── users/  ✅
│   │   │       ├── content/  🟡
│   │   │       └── game/   🟡 (mode 2/5)
│   │   └── Dockerfile
│   └── web/                 (Next.js 14)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx (홈)
│       │   │   └── play/solo/page.tsx
│       │   └── lib/api-client.ts
│       └── Dockerfile
├── packages/
│   └── shared/              (✅ dist 빌드 후 워크스페이스로 import)
│       └── src/
│           ├── types/{curriculum, game, question, user}.ts
│           ├── schemas/question.schema.ts
│           └── index.ts
├── docker-compose.yml       ✅
├── .env.example             ✅
├── turbo.json
└── package.json (workspaces)
```

---

**이 문서는 SDD ↔ 코드의 살아있는 동기화 표다.**
**기능을 추가/제거할 때마다 같은 PR에서 갱신한다.**
