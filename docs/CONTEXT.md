# 프로젝트 컨텍스트 (Project Context)

> **AI 에이전트가 세션 시작 시 반드시 읽어야 하는 현재 상태 문서**

**최종 업데이트**: 2026-04-29 (**Session 15 — ADR-021 (Community Hub) + PR-13 (통합 e2e 하네스) docs PR (consensus-013)**): 3+1 합의 (Agent A·B·C 병렬 + Reviewer). **합의율 만장일치 12.5% (1/8) / 유효 100% (8/8)**. 결정 8건 (도메인 / 카테고리 / 라우트 / 권한 / Header / 모더레이션 + PR-13 우선순위 + PR-13 도구). **CRITICAL 격상 3건**: middleware PUBLIC_PATHS 모순 (Q-R5-11 번복 확정) / PR-13 1주 선행 머지 / audit log 부재 (CWE-778, ADR-016 §7 D3 Hybrid 재사용). **옵션 공간 재오픈** (Agent C 단독 제안 옵션 F=Q&A mview 50LOC / G=virtual root question 시드 10LOC) — consensus-012 의 5개 매트릭스 Gap 메우기. **사용자 결정 12건 (Q-R6-01~12, 항목별 검토 패턴)** — Reviewer 권장 대비 **변경 4건**: Q-R6-02 격상 (외부 채널 부재 — Slack 미사용, Zoom 만, 정보 공유 커뮤니티 없음 → 카테고리 1기 도입 4종 notice/free/study/resource) / Q-R6-09 격상 (강사 = operator role, 학생 글 수정 코드 강제) / Q-R6-10 종속 격상 (1기 3-tier user/operator/admin) / Q-R6-12 변경 (시안 D §3.4 비대칭 3-카드 → 4-카드, Community 카드 추가). **사용자 결정 채택값**: Q-R6-04 옵션1 (read 인증 필수) / Q-R6-06 옵션1 (audit log 1기) / Q-R6-11 옵션1 (PR-13 1주 선행) / Q-R6-01 옵션 G (virtual root) / Q-R6-02 후보2 (4종) / Q-R6-03 옵션2 (path segment) / Q-R6-05 옵션1 (이중 방어) / Q-R6-07 옵션1 (NestJS 기본 + CI) / Q-R6-09 옵션2 (operator) / Q-R6-10 자동 (3-tier) / Q-R6-12 옵션3 (4번째 카드) / Q-R6-08 N/A. **신규 docs 9개**: consensus-013 + ADR-021 + community-hub-design + community-rbac-design + community-moderation-design + audit-log-design + integrated-e2e-harness-design + tdd-plan + impact. **패치 docs 2개**: ADR-020 §11+§12 (ADR-021 행 추가 + 참조) + 시안 D §1·§3.4 (비대칭 4-카드 + Community 카드 §3.4.4 신규). **PR-13 도구**: NestJS testing + supertest (보유) + Playwright smoke 1~2개 (신규 ARM64 호환) + MSW (신규) + 5종 안전장치 (DB schema 격리 + secret scanner gitleaks + Langfuse no-op fallback + GB10 ulimit + 환경변수 격리). **PR-13 회귀 매트릭스**: Session 14 hotfix 11건 모두 차단 (DI 누락 / IMMUTABLE / contract mismatch / SWR loop / throttle 부적합 / vote shape / self-vote / docker env). **추정 분량**: ADR-021 docs 1d (본 PR) + PR-13 코드 4d (Phase 2 1주 선행) + ADR-021 코드 4분할 6d (Phase 3 = 마이그레이션 1d + API/RBAC 2d + UI 2d + 모더레이션 1.5d). **신규 마이그레이션 5종**: 1714000020000 virtual root question 시드 + 1714000021000 category 컬럼 + 1714000022000 role 컬럼 + 1714000023000 audit_log 테이블 + 1714000024000 reports + 1714000025000 모더레이션 컬럼. **다음 작업**: 본 docs PR 머지 → Session 16 (PR-13 코드 PR Phase 2 1주 선행) → ADR-021 코드 PR 4분할 (Phase 3). **이전 (Session 14)**: PR-12 web 토론 페이지 코드 PR (PR #60, Phase 4~7, 22 commits): Phase 4~7 5건 + 라이브 외부 노트북 hotfix 11건 + UX 결정 4건 + placeholder 2건. 149 web tests 신규 GREEN (api 1284 회귀 0). CRITICAL 5건 해소 (consensus-012 매핑 — Markdown raw + sanitize-schema 동등성 + RelatedQuestionBlur 2차 방어 + Phase 1~3 백엔드 의존 + UUID 검증). hotfix 11건 패턴: 단위 테스트가 통합 차원 결함 미검출 → PR-13 가동 근거. 사용자 결정 5건 (D1 docs A 패턴 / D2 좋아요 단순화 / D3 인증 게이트 2단계 변경 — 모든 페이지 차단 → 메인 공개로 완화 → Q-R5-11=a 사실상 번복 / D4 Hero CTA / D5 다음 세션 ADR-021). **이전 (Session 13 후속4)**: PR-12 web 토론 페이지 docs PR (consensus-012, 만장일치 6.7% / 유효 100% / 사용자 결정 15건 모두 권장 채택): 3+1 합의 (Agent A·B·C 병렬 + Reviewer). CRITICAL 5건 해소: 저장 형식 Markdown raw + 단일 sanitize schema + HIGH-3 이중 마스킹 + Reddit hot expression index + read 비인증 @Public 패치. 사용자 추가 질문 "커뮤니티는 어디에 추가할지" → 옵션 A (질문 종속) + 옵션 C 후속 ADR-021 분리. 진입점 = solo finished CTA round 별 + Hero `todayQuestion` 우하단 메타 칩. Header 변경 없음 (시안 D §3.1). B 단독 지적 5건 중 4건 채택 — 항목 11 비인증 처리는 ADR-코드 불일치 (controller line 115). 신규 docs 4파일 + ADR-020 §4.2.1 C / §5.3 / §6 / §9 / §11 패치. 신규 의존성 6종 + 마이그레이션 1714000012000 expression index + 신규 cases ~103. **다음 작업**: 본 docs PR 머지 → 코드 PR (PR-12-code, 7 phase, 14 commit, 추정 3.5d). **이전 (Session 13 후속3)**: PR-10c CSRF Origin guard 코드 머지 (PR #56, 1175+1s → 1218+1s, +43 cases): consensus-011 CRITICAL 3건 패치 반영 코드 3 commit 단일 PR 머지. **Phase 1** `5014118` OriginGuard TDD 38 cases (URL parse + protocol/host:port exact match + parseAllowedOrigins helper + @SkipOriginCheck decorator + ORIGIN_GUARD_DISABLED kill-switch + ORIGIN_GUARD_MODE=report 분기 + 한국어 학습 힌트). **Phase 2** `f226b98` env.validation refine (CORS_ORIGIN production fail-closed + MODE enum + DISABLED) + AppModule APP_GUARD provider 글로벌 등록 + env.validation.test fixture 갱신 (5 신규 회귀). **Phase 3** `f82df37` `.env.example` 부트캠프 표준값 (localhost + Tailscale 2종) + 모드 docs. 가드 순서 = OriginGuard (글로벌) → ThrottlerGuard (컨트롤러) → JwtAuthGuard (컨트롤러). **PR-10 시리즈 완료** (10a httpOnly cookie + 10b R4 discussion + 10c CSRF Origin guard). **사용자 작업**: `.env CORS_ORIGIN` 부트캠프 표준값 추가 + `ORIGIN_GUARD_MODE=report` 1주 관측 + `sudo docker compose restart api`. 1주 후 enforce 전환 follow-up commit. **다음 세션 0순위**: PR-12 (web 토론 페이지 + rehype-sanitize + hot/top raw query, 2.5d). **이전 (Session 13 후속2): PR-10c CSRF 위협 모델 재합의 + ADR-020 §4.2.1 E·I·K 갱신 (consensus-011)**: ADR-020 §4.2.1 E "유보" 트리거. 3+1 합의 (Agent A·B·C 병렬 + Reviewer) 합의율 만장일치 35.7% / 유효 92.9%. 사용자 6결정 모두 추천값 채택 (a/a/a/b/a/a). **CRITICAL 3건 식별** — (1) startsWith bypass (`example.com.attacker.com` / Tailscale port prefix 우회) → URL 객체 parse + exact match. (2) CORS_ORIGIN fail-OPEN (`''.startsWith('')`=true) → fail-closed (env.validation refine + runtime 이중). (3) 운영 회귀 (학생 curl/Postman 차단) → SkipOriginCheck decorator + Report-Only 1주 + 한국어 학습 힌트 + ORIGIN_GUARD_DISABLED kill-switch. §4.2.1 E 절 명세 17 → 25~30 LOC 갱신 + §4.2.1 I 절 정정 + §4.2.1 K 절 신설 (머지 전 추가 선결 조건 + 미래 재검토 트리거 TR-CSRF-1/2/3/iron-session). CSRF token 폐기 = 명목상 작업 0 (csurf/xsrf grep 0건). Sec-Fetch-Site hybrid 거부 (Tailscale HTTP 환경 미전송). **다음 작업**: 본 docs PR 머지 → 코드 PR Phase 1~3 (~140 LOC + 33 cases TDD) → 1주 Report-Only 관측 → enforce 전환. **이전 (Session 13 후속): PR-10b 본 작업 머지 (PR #53, 1037+1s → 1175+1s, +138 cases)**: Session 13 0순위 (§8) 이행. 환경 점검 (swap 만재 회복 — ollama 3 모델 unload 로 15→2.2GiB / 11일째 좀비 claude 2개 SIGKILL / sshd ClientAlive 60·3 / jsonl 7d 이전 26개 archive) → PR-10b 코드 7 commit 단일 PR 머지. **Phase 1** `2fefb6a` 3-table + self_vote trigger / **Phase 2** `53f65fc` 3 entity + Module 스켈레톤 / **Phase 3** `db9bfd0` sanitize-post-body 화이트리스트 + **OWASP XSS Cheat Sheet 50종 negative TDD** (76 cases) / **Phase 4a** `a0153fa` Thread CRUD + IDOR + composite cursor (15) / **Phase 4b** `da86cd3` Post CRUD + 1-level nested (12) / **Phase 4c** `f4dac82` Vote + Accept (DataSource.transaction + manager.increment atomic + self-vote 트리거 ForbiddenException 매핑 + 1-accept rule, 14) / **Phase 5** `c713fe4` Controller 11 endpoint + class-validator DTO + cursor base64url + `discussion_write` named throttler (60s/5회) + AppModule 통합 (19). 의존성 신규 `sanitize-html ^2.17.3` + `@types/sanitize-html ^2.16.1`. **사용자 결정 11건 (Q1~Q11 권장값 채택, Q11 만 자체 조정 — auth-throttler 컨벤션)**. **ADR-020 §6 PR-10b 항목 7/10 완료**, 잔여 3종 (web 표시 측 sanitize / hot 정렬 raw query / HIGH-3 블러) 은 PR-12 / 별도 PR 이월. docs commit 충돌은 옵션 A 로 코드 PR 분리 + 본 docs PR (`docs/pr-10b-merge-followup`) 합류. **다음 세션 0순위**: PR-10c (CSRF Origin guard 또는 폐기, 1d) — 위협 모델 재합의 필수. **1순위**: PR #45 외부 검증 (4번째 세션 잔존). **2순위**: PR-12 (web 토론 페이지 + rehype-sanitize + hot/top raw query).

---

## 프로젝트 성격

**이 프로젝트는 "AI 자동화 개발 방법론 템플릿"이다.**

새 아이디어로 개발을 시작할 때, 이 프로젝트의 문서/설정 파일을 가져와 적용한다.

```
사용법:
  1. 새 프로젝트 생성
  2. 이 템플릿의 파일을 복사
  3. 아이디어를 제시하면 Phase 0부터 자동화 개발 시작
```

---

## 릴리스: v1.0.0

### 포함된 설계 체계

| 문서 | ADR | 설명 |
|------|-----|------|
| 프로젝트 헌법 | — | 12개 조항 (제8-2조 환경 관리 포함) |
| 하네스 엔지니어링 설계 | — | 8-Layer 피드백 루프 |
| 3+1 멀티에이전트 설계 | — | 합의 기반 의사결정 시스템 |
| 아키텍처/코드 품질 원칙 | — | 10대 원칙 + 코드 품질 기준 |
| 자동화 검토 질문지 | ADR-001 | Phase 0: 아이디어 → 브리프 |
| 아이디어 기반 스택 결정 | ADR-002 | Phase 1: 스택 통합 결정 |
| 생성 AI 에셋 파이프라인 | ADR-003 | Guide-First 에셋 생성 |
| 생성 AI 확장성 | ADR-004 | Config 기반 모델 교체 + 학습 안내 |
| AI 백엔드 스택 가이드라인 | ADR-005 | 로컬 추론 시 Python 분리 |
| 환경 변수 + Docker-First | ADR-006 | 하드코딩 제로 + 중앙 관리 |
| 변경 영향 분석 | ADR-007 | 의존성/장애 사전 검증, 자동 분류 |
| 개발 가이드 | — | SDD+TDD 워크플로우 |
| 테스트 전략 | — | 70% 커버리지 목표 |

### 개발 파이프라인 (확정)

```
Phase 0: 자동화 검토 질문지 (필수3 + 동적2)
Phase 1: 3+1 합의 (아이디어 + 스택 + 에셋 식별)
    ├── Phase 2-3: SDD → TDD (코드)
    └── 에셋 파이프라인 (비코드, Guide-First, 병렬)
Phase 4: 통합 테스트 + 배포
```

### v1.0.0에서의 알려진 제한사항

다음 항목은 v1.0.0에 포함되지 않으며, 실제 프로젝트에서 아이디어에 맞게 구현한다:

- Phase 2~3(합의→SDD→테스트→코드) 변환 자동화
- 복합 기능 분해 메커니즘
- 런타임 AI 코드 패턴
- 프로젝트 스캐폴딩 자동화
- Phase 간 게이트/롤백 규칙
- 실동작 CI Pipeline

> 이 제한사항은 템플릿의 한계가 아니라, **프로젝트별로 아이디어에 맞게 구현해야 할 부분**이다.

---

## 현재 진행 중: Oracle DBA 학습 게임

### Phase 0 → Phase 1 완료 (2026-04-08)

이 템플릿을 적용한 첫 번째 프로젝트. Oracle DBA 부트캠프 수강생 ~20명을 위한 학습 게임.

**3+1 합의 완료 → SDD 설계 문서 작성 완료.**

| 문서 | 경로 | 설명 |
|------|------|------|
| SDD 설계서 | `docs/architecture/oracle-dba-learning-game-design.md` | 전체 시스템 설계 |
| 합의 보고서 | `docs/review/consensus-001-oracle-dba-game.md` | Phase 0 브리프 + 3+1 합의 |
| ADR-008 | `docs/decisions/ADR-008-oracle-dba-game-tech-stack.md` | 기술 스택 결정 |

### 확정 기술 스택

- **아키텍처**: Modular Monolith + WebSocket Gateway
- **언어**: TypeScript (Full-Stack)
- **프레임워크**: Next.js + NestJS + Socket.IO + BullMQ
- **저장소**: PostgreSQL + Redis
- **배포**: Docker Compose (단일 VPS)

### 게임 모드 (5가지)

1. 빈칸 타이핑 — SQL 문법 암기
2. 용어 맞추기 — 용어 ↔ 의미 연결
3. 결과 예측 — 함수 동작 이해
4. 카테고리 분류 — 개념 체계화
5. 시나리오 시뮬레이션 — 종합 응용력

### MVP 로드맵

- **1단계** (Week 1-2): 솔로 퀴즈 (빈칸타이핑 + 용어맞추기) + AI 문제 생성
- **2단계** (Week 3-4): 결과예측 + 카테고리분류 + 랭킹
- **3단계** (Week 5+): 시나리오 시뮬레이션 + 실시간 대전

### 진행 현황

상세 매핑은 **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** 참조 (SDD ↔ 코드 ↔ 남은 작업).

요약:
- ✅ 모노레포 스캐폴딩 (NestJS + Next.js + shared)
- ✅ Docker Compose 환경 (postgres/redis/api/web + ollama + langfuse v3 풀 인프라 5컨테이너)
- ✅ 게임 모드 2/5 (BlankTyping, TermMatch) + Strategy Pattern
- ✅ 솔로 게임 start/answer + 프론트 플레이 화면
- ✅ 인증 (JWT + bcrypt), 학습 범위 검증 (계산적 키워드 매칭)
- ✅ **테스트 291개 GREEN** (하네스 P0 수정 후, 32 파일)
- ✅ 1주차 sql-basics 시드 (빈칸 15 + 용어 15 + 화이트리스트, 멱등 부트 INSERT)
- ✅ **2주차 transactions 시드 (빈칸 15 + 용어 15 + 화이트리스트 24개)** ← 본 세션 추가
- ✅ 솔로 게임 종료 흐름 (`/finish` + `user_progress` 가중평균 갱신 + `answer_history` 자동 INSERT)
- ✅ 로그인/회원가입 UI + 인증 가드 + 전역 헤더 (토큰 헬퍼)
- ✅ AI 클라이언트 인프라 — `LlmClient` + **`LlmClientFactory`** (ollama provider 분기, opts override) + LangChain ChatAnthropic + ChatOllama + Langfuse callback
- ✅ `@anthropic-ai/sdk` 제거 (ADR-009 §마이그레이션)
- ✅ AI 문제 생성 파이프라인 — PromptManager + AiQuestionGenerator + BullMQ Processor + REST 엔드포인트
- ✅ **OSS 모델 평가 인프라** — Ollama 컨테이너, Langfuse self-host, sanity-check 5/5 PASS, EXAONE 4.0 GGUF import, Gold Set A/B 30+30
- ✅ **promptfoo 평가 하네스 (단계 5)** — assertion 7개 (MT1~MT5/MT8 + korean-features) + langfuse-wrapped provider + build-eval-prompt + promptfoo-testcases adapter + promptfoo.config.yaml + README. 운영 AQG schema를 `eval/output-schemas.ts`로 추출하여 단일 진실 소스
- ✅ **결과 schema + report-generator (단계 6)** — `reports/schema.v1.ts` (감사용 고정 Zod schema, EVAL_RESULT_SCHEMA_VERSION=1) + `reports/aggregate.ts` (mulberry32 seeded PRNG + bootstrap CI + macro stratified + Cohen's d + Bonferroni, 외부 stat 라이브러리 의존 없음) + `reports/report-generator.ts` (단일 라운드 + 다중 라운드 비교 markdown) + `reports/promptfoo-adapter.ts` (promptfoo-agnostic RawCallRecord[] → EvalRoundResultV1 + parsePromptfooRawJson). 263 cases / typecheck OK
- ✅ **eval.controller + runner + admin guard (단계 7)** — `eval-runner.service.ts` (PromptfooExecutor/EvalFileSystem 격리 + roundId R-{ISO} + ENOENT→503 변환 + result.json/report.md 저장) + `eval-admin.guard.ts` (ENV `EVAL_ADMIN_USERNAMES` whitelist fail-closed) + `eval.controller.ts` (POST /api/eval/run, JwtAuthGuard + EvalAdminGuard 체인) + `eval.module.ts` (AiModule과 분리, 기본 promptfoo executor + 기본 fs). AppModule 등록 + .env.example/env.validation에 EVAL_* 추가. 287 cases / typecheck OK (신규 24)
- ✅ **standalone 평가 스크립트 (단계 8)** — promptfoo CLI 호환 문제로 standalone runner 작성 (`scripts/run-eval-standalone.ts`). LlmClient → Ollama 직접 호출, 기존 assertion 7개 + schema.v1 + report-generator 재사용. `run-all-models.sh` 배치 스크립트로 `nohup` 백그라운드 실행.
- ✅ **OSS 5개 모델 R1 평가 완료** (2026-04-13 KST) — 전원 MT3/MT4 합격선 미달. M5는 runner crash. 결과: `apps/eval-results/R-{timestamp}/`
- ✅ **전체 FAIL 원인 분석 + P0 하네스 수정 (2026-04-14)** — 3+1 합의(ADR-010). 토크나이저 근본 버그 수정(리터럴 제외), MT4 answer 화이트리스트 검증 제거, scope.ts JOB/DNAME/alias 확장, prompt constraint 추가. `SeedService.syncScopes()` 추가.
- ✅ **R2 재평가 완료 (2026-04-14~15)** — M1~M4 전원 크래시 없이 완료. **M3 Qwen3-Coder-Next 80B MoE만 전 게이트 PASS** (C3 98.3% / C4 96.7% / p95 44.9s / MT5 98.3%). M1/M2 EXAONE은 C4+C7 이중 FAIL, M4는 C7 지연만 FAIL. artifact: `R-2026-04-14T10-08-59Z` ~ `R-2026-04-14T12-10-27Z`.
- ✅ **ADR-011 — M3 primary OSS 확정 (2026-04-15)** — 3+1 합의 프로토콜 가동. 기각 대안 6건 기록. 운영 배포 전 게이트 3건(digest pin / 모니터링 / 메타 편향 주의문) 대기. 로드맵 P1~P4 예약(P2: 3개월 후 M4 이중 라우팅 재검토). EXAONE commercial license 문의 불필요로 전환 (Apache 2.0).
- ✅ **SDD §1.4/1.5/1.6 신설 (2026-04-16, v2.8 patch)** — primary 선정 결과 표 + digest pin 대상(manifest `5d55cac5…` / blob `30e51a7c…`) + **메타 편향 주의문 4항** + 운영 100건 모니터링 게이트(조건 3 앵커). ADR-011 채택 조건 4 이행 완료.
- ✅ **Ollama digest pin 자동화 (2026-04-16, ADR-011 조건 #2)** — `apps/api/src/modules/ai/eval/pins/` (verify + types + JSON 시드) + `pin-model.ts` CLI + `run-eval-standalone.ts` fail-closed gate + `run-all-models.sh` `EXTRA_ARGS` 호환. M3 digest `ca06e9e4087c…` 시드. **TDD 10 cases**.
- ✅ **operational-monitoring SDD v1.0 (2026-04-16, ADR-011 조건 #3 설계)** — 사용자 Q1/Q2/Q4 권장안 채택. fixed window(`questions.id` 1~100) / 신고 사유 드롭다운 3종 / 1시간 cron / Phase B 알림 결정 보류 / digest는 pin 파이프라인 재사용.
- ✅ **OpsModule Phase A 구현 (2026-04-16)** — `ops_question_measurements` + `ops_event_log` entity + `OpsMeasurementService.measureSync` (MT3 ScopeValidator 재사용, MT4 pure helper, fail-safe ops_event_log) + `POST /api/questions/:id/report` (JwtAuth + 중복 차단) + `AiQuestionGenerator` `@Optional()` 통합. modelDigest는 `'pending-migration'`.
- ✅ **단계 10 운영 모델 교체 (2026-04-16)** — `ModelDigestProvider` boot 시 fail-closed 검증 (anthropic/ollama 분기) + `LlmClient` anthropic 키 누락 fail-closed + `env.validation` LLM_PROVIDER에 'ollama' 추가 + `OLLAMA_BASE_URL`/`OLLAMA_PORT`/`DIGEST_PIN_SKIP` 정식 등록 + `.env.example` 권장값을 ollama로 전환. AiQuestionGenerator `modelDigest`가 verifyApprovedModel 결과로 자동 채워짐. ADR-011 P1 운영 개시 코드 준비 완료. 사용자 작업: `.env` `LLM_PROVIDER=ollama`로 변경 후 재기동.
- ✅ **operational-monitoring Phase B (2026-04-16)** — `OpsAggregationService` 1시간 cron + `evaluateGates` pure helper + `gate_breach` 이벤트 + 100건 window 종료 시 `docs/operations/monitoring-window-1.md` 자동 리포트 (멱등). `@nestjs/schedule` + ScheduleModule 등록. 11 cases TDD.
- ✅ **OpsModule synchronize 실 DB 검증 (2026-04-16)** — `apps/api/src/scripts/verify-ops-schema.ts` 격리 schema 시뮬레이션. 4개 테이블 (ops_* 2 + notion_* 2) 자동 생성 + 부분 unique index `WHERE kind='student_report_incorrect'` 정확 적용 + UUID PK + jsonb default + INSERT/SELECT 모두 정상.
- ✅ **Notion Stage 1 (2026-04-16, SDD §4.2.1)** — `NotionModule` 신설. entity 2개 (notion_sync_state, notion_documents) + `NotionApi` 추상화 + `RealNotionApi`(@notionhq/client v5 dataSources/blocks) + `notion-markdown.ts` 변환 utils (paragraph/heading/list/code/quote/divider 화이트리스트 + 미지원 블록 보존) + `NotionSyncService` 증분 동기화(last_synced_at + cursor 페이지네이션 + soft-delete + status 'syncing/idle/error') + BullMQ `notion-sync` 큐 + Processor + RepeatableJob (NOTION_SYNC_CRON, 미설정 시 disabled) + `POST /api/notion/sync` (JwtAuthGuard + EvalAdminGuard 재사용). 신규 20 cases. Stage 2(LLM 정리) / Stage 3(자동 범위 추론) 후순위.
- ✅ **관리자 review API + 결과 페이지 정답/해설 노출 (2026-04-16)** — `EvaluationCore`/`EvaluationResult` 분리 (mode는 채점만, session이 정답/해설 채움) + `game-session.submitAnswer`가 `correctAnswer`/`explanation` 응답에 포함 + `AdminReviewService` (pending_review만 review, reject 시 ops_event_log(admin_reject)) + `PATCH /api/questions/:id/review` 컨트롤러 (관리자 가드). 신규 6 cases. **42 files / 360 tests passed**.
- ✅ **SDD §4 AI 콘텐츠 파이프라인 v2 설계** — 3+1 합의(consensus-003) + 사용자 결정 반영. v1 중앙 허브(키워드 화이트리스트) 구조 유지 + 5단계 확장 (노션 증분 추출 → LLM 문서 정리 → 범위 분석 → 문제 생성 → 검증/저장). **하이브리드 오케스트레이션**: Stage 간 BullMQ(영속성/재시도/스케줄) + Stage 내부 LangChain Runnable(Langfuse trace 전 구간). notion_sync_state/notion_documents 테이블 설계. 입력 sanitization + 원본 보존 안전 장치.
- ✅ **문제 형태 재설계 v2.9 합의 완료 (2026-04-16, consensus-004)** — 3+1 합의 + 사용자 4개 결정 반영:
  - 결정1: `answerFormat` 직교 축 추가 (5모드 유지, 트랙 분리 없음) — 사용자 결정
  - 결정2: 주차별 독립 미니 캡스톤 + 최종 캡스톤 2트랙 (SQL / PL-SQL) — 사용자 결정
  - 결정3: 실시간 대전 유지 + 실시간 AI 생성 금지 + 사전 생성 풀 랜덤 매칭 — 사용자 결정
  - 결정4: ADR → SDD → MVP-A 순서 승인 — 사용자 결정
  - **ADR-012~017 6건 작성 완료**: answerFormat 축 / 역피라미드 3단 채점(AST→키워드→LLM-judge) / 캡스톤 구조 / 실시간 사전 풀 / LLM-judge 안전(인젝션+PII+WORM) / MT6-7-8 지표
  - **SDD v2.9 개정 완료**: §1.3 문제형태 추가 + §1.5/§1.6 신설(primary 모델 + 메타편향 6항) + §2.2 3개 모듈 신설 + §3.1 EvaluationResult 확장 + §3.2 Mode 6 신설 + §3.3 매핑 확장 + §4.3 신규 프롬프트 5종 + **§4.4.2 3단 채점 신설** + §5.1 ERD 확장 + §6.2 실시간 재정의 + §7.1 API 확장 + §9 MVP-A~D 재구성 + §11 v2.9 이력
  - **operational-monitoring v1.1 개정 완료**: MT6(free-form-canonical-match) / MT7(capstone-step-consistency) / MT8(llm-judge-invocation-ratio) 신설 + ops 컬럼 확장 + 6종 event kind 추가 + ADR-019 승격 트리거
- ✅ **MVP-A 완료 (2026-04-17, 커밋 4건)** — `452e9aa` Mode 6 객관식 + answerFormat 축 (20 TDD) / `6c282f2` MT6/MT7/MT8 스켈레톤 (ops 차원 컬럼 4 + event kind 3 + Gate breach 3종 / 10 TDD) / `1c29b3b` AI 생성 MC 분기 (AQG 3중 계산적 검증 / 6 TDD) / `a9895c4` MC promptfoo 하네스 + gold-set-mc 15건 (16 TDD). ADR-012 §1~4·§6·§7 이행. §5 Mode 1 variants는 MVP-B §10(free-form 합류 시).
- 🟡 **MVP-B 진행 중 (7/10 세션)** — Session 1~5 (~PR #6) 는 위 요약 유지. **Session 6 PR #1 (PR #8 `0c17e08`)**: consensus-007 3+1 합의 + 사용자 Q1~Q5 결정 → 8 커밋 (C0 docs + C1-1~C1-6, 653→695 tests / +42).
- ✅ **Session 6 PR #2 (PR #14 `6b8ee7f`, 2026-04-24)** — consensus-007 §5 free-form 채점 배선 7 커밋 C2-1~C2-7. 695 → 751+1s (+57).
  - `8049ed4` C2-1 LlmClient.invoke opts + sessionId 전파 / `3dc5b6d` C2-2 GradingMeasurementService + grading_measured event / `b3c7532` C2-3 GradingModule AppModule 등록 / `548cbd2` C2-4 gradeFreeForm + ENABLE_FREE_FORM_GRADING kill-switch / `3c5ff2f` C2-5 LLM_JUDGE_TIMEOUT_MS=8000 + held fallback + HTTP 503 / `e60a857` C2-6 answer_history 7항 persist + user_token_hash_epoch (migration 1714000005000) / `3a56c6e` C2-7 langfuse-payload-privacy helper + E2E gate.
- ✅ **PR #15 hotfix (`d24b0aa`)** — PR #14 사후 3+1 검증 (합의율 25% / 1인 CRITICAL 격상 1건). `b8334e9` : `persistHeldAnswer` 재설계 (buildAnswerHistoryInput 재사용) + `LlmJudgeTimeoutError.sanitizationFlags` 첨부 + recordHeldPersistFail 최후 방어선 + langfuse-payload-privacy ai/ 이동 + 16 hex boundary lookaround + multi-agent-system-design §7.3/7.4 합의율 패턴 관찰 기록. 751 → 754+1s (+3).
- ✅ **PR #16 (`fda3ba9`)** — Q2=b 이행. ops_event_log 에 user_token_hash/epoch 대칭 컬럼 (migration 1714000006000). GradingMeasurementService.resolveHashAndEpoch 자동 채움. 754 → 764+1s (+10).
- ✅ **Session 7 — ADR-019 SM-2 Spaced Repetition 완결 (6 PR, 2026-04-24)** — Phase 0 브리프 + Phase 1 3+1 합의 (consensus-008, 36.8% / B-C1~C4 격상 전원 반영 + A-CRITICAL 3 반영) + 사용자 Q1~Q5 (복합지표/70%상한/clamp 항상 ON/cap=100/timePenalty 제거) + ADR-019. consensus-004 "ADR-018 SM-2" → ADR-019 정정.
  - PR-1 (`254cd45`, PR #17) — review_queue entity + migration 1714000007000 + ReviewModule 스켈레톤. 764 → 779+1s (+15).
  - PR-2 (`3bb71a4`, PR #19) — `sm2Next` + `mapAnswerToQuality` pure function (sm2.ts 55 LOC, 외부 의존 0). 779 → 821+1s (+42).
  - PR-3 (`2151f7b`, PR #20) — `ReviewQueueService.upsertAfterAnswer` (일일 상한 100 + `sr_queue_overflow`) / `overwriteAfterOverride` (admin-override) + `submitAnswer` Tx2 배선 (held/guest/미주입 스킵, fail-open → `sr_upsert_failed`). D3 Hybrid hash/epoch fail-safe resolve. `SR_DAILY_NEW_CAP` env. 821 → 855+1s (+34).
  - PR-4 (`0996536`, PR #21) — `findDue` (review_queue JOIN questions) + `countDueForUser` + `pickQuestionsForSolo` `srLimit=ceil(rounds*0.7)` + `QuestionPoolService.pickRandom` excludeIds 옵션 + `GET /games/solo/review-queue`. 855 → 880+1s (+25).
  - PR-5 (`49ec20a`, PR #22) — Next.js `ReviewBadge` 컴포넌트 + `apiClient.solo.reviewQueue` + `/play/solo` config 단계 상단 배치. 로딩/에러 silent, 0건도 표시, aria-label 접근성.
  - PR-6 (`d7a2ac8`, PR #23) — `sr_metrics_daily` 테이블 + migration 1714000008000 + `SrMetricsService.computeMetrics` / `snapshotDaily` + `@Cron(EVERY_DAY_AT_MIDNIGHT)` + `evaluateSrMetricBreaches` pure fn + `sr_metric_breach` 이벤트. Primary retention / Secondary completion / Guard low_rate 3지표. 880 → 908+1s (+28).
- ✅ **Session 8 — ADR-020 PR-1/2/4/5/6 5 PR (2026-04-27)** — Tailwind 인프라 / theme token / next-themes / shadcn init / auth rate limit. 936 → 955+1s (+19). 단, PR #29/#30/#31 (PR-2/4/5) 가 stack 부모 feature 브랜치에 머지되어 main 미반영 (Session 9 PR #33 으로 복구).
- ✅ **Session 9 — ADR-020 PR-8 + PR-8b 시안 D 통합 (2026-04-28, 3 PR)** —
  - PR #33 (`a6713da`) — stack 머지 누락 PR-2/4/5 cherry-pick 복구 (3 commit)
  - PR #34 (`994e30b`, PR-8) — Header + 홈 + 로그인/회원가입 Tailwind 마이그레이션. inline-style → Tailwind utility + shadcn Button/Card/Input/Label
  - PR #35 (`76e4086`, PR-8b 시안 D 통합) — Hero 3-layer 글라스 패널 + Journey strip 20-day + 비대칭 1.4:1:1 카드 + 페이지 배경 블롭. Apple Vision 톤 (사용자 결정). 신규 토큰 5종 + 신규 web 6 파일 + 신규 디자인 문서 2종. 외부 노트북 검증 4회.
- ✅ **Session 10 — 보안 게이트 2 PR + UX 디자인 시스템 4 PR (2026-04-28, 7 PR 머지, 955+1s → 976+1s)** — 보안: PR #37 PR-7 (CRITICAL-B5 pre-commit Layer 3-a3 재귀) + PR #38 PR-3a (CRITICAL-B1 helmet, **3+1 합의 87% 가중**, PR-3 → 3a/3b/3c 분할). UX: PR #39 4 화면 통합 brief / PR #40 시안 β Flow Glass concept / PR #41 PR-9a (시안 β §3.1 코드 — TrackSelector / ModeMultiSelect / ConfigForm) / PR #42 solo-play-config 시각 풍부함 brief / PR #43 시안 ε Hero Mirror concept (PR-9a' polish 명세). 신규 의존성 helmet / supertest.
- ✅ **Session 11 — PR-9a' 시안 ε (Hero Mirror) polish 단일 PR (2026-04-28, PR #45 머지, 11 commit, +1391/−312)** — 신규 토큰 6종 + 컴포넌트 4 + 시각 upgrade 3 + `lib/code/types.ts` 추출 + page.tsx 6 영역 통합. `/play/solo` 8.83 → 15.3 kB. 메인 시안 D 톤이 `/play/solo` config phase 까지 확장된 **통합 디자인 시스템 phase 2 정착**. 외부 노트북 검증 0회 (PR description 미체크 항목 잔존).
- ✅ **Session 12 — CTA 즉시 시작 (PR #47) + 정식 PR-10 3+1 합의 (PR #48 — consensus-010) + 임시 완화 + ADR-020 §4.2.1 부속서 (2026-04-28, 3 PR 머지)** — PR #47 즉시 시작 / PR #48 합의율 70% 5결정 / docs PR #49 마무리. 임시 완화 `JWT_EXPIRES_IN=24h` (PR-10a 머지까지). 테스트 976+1s 그대로.
- ✅ **Session 13 — PR-10a 머지 전 선결 조건 docs (PR #50) + PR-10a 11 phase 코드 (PR #51) (2026-04-29, 2 PR 머지, 976+1s → 1037+1s, +59 cases)** —
  - PR #50 — ADR-007 SYSTEM 4차원 영향 분석 (502L) + PR-10a TDD plan (644L) + INDEX 진행 표기. Tailscale spike 는 환경 사실 확정 (HTTP IP only) 으로 추가 spike 불필요 결론.
  - **PR #51 — PR-10a 11 phase 자율 진행** — Phase 1 token_epoch+refresh_tokens migration / Phase 2 RefreshTokenEntity / Phase 3 utils 13 cases / Phase 4 RefreshTokenService rotation+reuse+SETNX+family revoke 12 cases / Phase 5 UsersService.incrementTokenEpoch 4 cases / Phase 6 AuthService refresh+epoch claim 4 cases / Phase 7 JwtStrategy dual-mode 5 cases / Phase 8 AuthController logout+refresh+cookie 10 cases / Phase 9 cookie-parser+env.validation refine / Phase 10 web credentials:include + 401 auto-refresh + Header me() polling / Phase 11 JWT_EXPIRES_IN 30m 회귀.
  - **CRITICAL 4건 해소**: refresh rotation reuse detection 알고리즘 (SETNX 5s mutex + family revoke + grace) / logout revoke (atomic incrementTokenEpoch + revokeAllForUser Promise.all) / dev secure cookie 분기 (Tailscale IP host-only RFC 6265) / SameSite=Lax (Discord/슬랙 UX 보존).
  - dual-mode 1주일 — cookie 우선 + Bearer fallback. **Follow-up PR**: Bearer extractor 제거 + auth-storage 폐기 + 응답 body 토큰 제거.
  - **사용자 즉시 작업**: `.env JWT_EXPIRES_IN=30m` + `JWT_REFRESH_SECRET=$(openssl rand -base64 32)` 추가 + API 컨테이너 재기동.
- 🔴 MVP-C (3주) — 주차별 미니 캡스톤 + 3-entity + 주제 팩 4종 + MT7. ADR-014
- 🔴 MVP-C' (2주) — 최종 캡스톤 2트랙(SQL/PL-SQL). ADR-014
- 🔴 MVP-D (2주) — 주간 릴리스 cron + grading_appeals UI + mc-distractor assertion. ADR-015/016/017
- 🔴 **실시간 대전 (ADR-015) — 후순위** (사용자 지시 2026-04-17 / memory `project_realtime_priority.md`). 솔로 학습 흐름이 우선
- 🔴 BullMQ 워커 + AI 문제 생성
- 🔴 노션 import → 범위 추론 (SDD §4.2 v2 설계 완료, 구현 대기)

### OSS 모델 평가 트랙 (feature/oss-model-eval 브랜치) — 단계 진행도

| 단계 | 작업 | 상태 | 커밋 |
|---|---|---|---|
| 0 | extractOracleTokens 공용 utils + TDD | ✅ | `c4bd454` |
| 1 | docker-compose 평가 인프라 + sanity check | ✅ | `9373de7` |
| 2 | EXAONE 4.0 GGUF 수동 import + 5/5 sanity | ✅ | `bab498a` |
| 3 | LlmClientFactory + ChatOllama + format/parser 실증 | ✅ | `f048951` |
| 4 | Gold Set A 30 + Gold Set B 30 (합성 → 검수 → 컴파일) | ✅ | `7c8850e` |
| (추가) | week2-transactions 시드 30 + 화이트리스트 24 | ✅ | `16dfbc9` |
| 5 | promptfoo 설정 + assertion 7개 + langfuse-wrapped provider + build-eval-prompt + testCase adapter | ✅ | `3688250` |
| 6 | 결과 JSON schema(N-05) + aggregate stats + report-generator + promptfoo-adapter | ✅ | `f8e19a9` |
| 7 | eval.controller + runner + admin guard + module + AppModule | ✅ | (커밋 예정) |
| 8 | standalone runner 작성 + M4 전체 평가 완료 | ✅ | `45dfca1` |
| 8-run | OSS 5개 모델 R1 평가 실행 | ✅ | `d6dee82` |
| 8.5 | **전원 FAIL → 3+1 합의 + P0 하네스 수정 + ADR-010** | ✅ | `b1a1c84`, `3197f8d` |
| 9 | R2 재평가 (수정된 하네스) + M3 유일 전 게이트 PASS | ✅ 2026-04-14~15 |
| 9.5 | **M3 primary 확정 — 3+1 합의 + ADR-011** | ✅ 2026-04-15 |
| 9.6 | Phase 0 Claude 베이스라인 (Anthropic 크레딧 충전 후) | 🔴 후순위 |
| **10** | **운영 모델 교체 — `ChatAnthropic` → `ChatOllama` (M3)** | 🔴 다음 세션 (ADR-011 채택 조건 3건 선행) |

### 다음 세션 우선순위

**0순위 — PR-12 코드 PR (PR-12-code, 추정 3.5d)** — docs PR 머지 후 즉시 진입 가능

- consensus-012 합의 결과 + SDD pr-12-discussion-page-design.md 그대로 7 phase 14 commit
- Phase 1 백엔드 sanitize Markdown raw 패치 / Phase 2 hot/top raw query + sort 별 cursor + 마이그레이션 1714000012000 / Phase 3 myVote join + HIGH-3 마스킹 + 비인증 read @Public / Phase 4 web sanitize-schema + DiscussionMarkdown + 76 OWASP / Phase 5 컴포넌트 11종 / Phase 6 페이지 라우트 + SWR + CTA / Phase 7 axe-core + 모바일 + 외부 검증
- 신규 의존성 6종 + 마이그레이션 1 + 신규 cases ~103 (1218+1s → ~1320+1s)

**1순위 — Report-Only → enforce 전환 (1주 후 follow-up commit)**

- `.env ORIGIN_GUARD_MODE=enforce` + 재기동
- Report-Only 1주 관측 결과 정리 (차단 사례 0건이면 그대로 / 학습 endpoint 차단 사례 발견 시 SkipOriginCheck() decorator 추가)

**1순위 — PR #45 외부 검증 잔존 (Session 11~13 4번째 세션 잔존)**

axe DevTools 라이트/다크 + 키보드 풀 플로우 (TrackSelector / ModeMultiSelect / WeekDayPicker / ConfigForm 난이도 chips) + 시안 ε 시각 일치. PR-10c 작업과 병렬 가능.

**2순위 — PR-12 (web 토론 페이지, 2.5d) + HIGH-3 블러 (별도 PR)**

PR-10b 후속 — web 측 표시.

- **PR-12**: Next.js 토론 페이지 + `VoteButton` + react-markdown + **rehype-sanitize** (defense in depth) + hot/top 정렬식 raw query (`LOG(GREATEST(ABS(score),1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000`) + `/play/solo` "토론 참여" 링크. PR-10b/10c 의존.
- **HIGH-3 related_question_id 블러** (별도 PR): `user_progress` 미풀이 본문 블러. user_progress 의존.

**4순위 — PR-10a follow-up (1주일 후, dual-mode 종료)**

- JwtStrategy Bearer extractor 제거 (cookie-only)
- api-client token 인자 제거
- auth-storage.ts 폐기 + 6 페이지 setToken/getToken 호출 정리
- API 응답 body 의 accessToken/refreshToken 제거

**5순위 — ADR-020 잔여 PR**

- **PR-3b** — CSP Report-Only + `/api/csp-report` + 1주 관측 (Session 10 PR-3 분할 후속)
- **PR-3c** — middleware nonce + inline style className 화 + CSP enforce
- **PR-9b** — playing phase 시안 β + framer-motion
- **PR-9c** — finished phase 시안 β
- **PR-9d** — `/review/mistakes` 시안 β
- ~~**PR-12**~~ — 2순위로 승격 (PR-10b 머지 후)

**6순위 — 시안 D / ε mock → 실 API 연결**

- `lib/home/data.ts` (Home) — todayQuestion / ticker / journey / cards / streak (concept-d §13)
- `apps/web/src/app/play/solo/page.tsx` mock 상수 7종 (`MOCK_NICKNAME` 등) — `useUser()` 훅 도입 시 1:1 swap
- 백엔드 endpoint 5종 신규 — `weekly-stats` / `recommended-preview` / `mode-stats` / `recommended-week` / `last-session`

**7순위 — 노션 자동 일자/주제 증가 (Session 12 사용자 피드백, 후속)**

현재 NotionSyncService 는 `notion_documents` 테이블만 갱신 — `weekly_scope`/`questions` 자동 증가 없음. Stage 2 (LLM 정리) + Stage 3 (자동 범위 추론) 미구현. 별도 ADR 가능성.

**8순위 — Session 8+ 기술 부채 (이월)**

- `Round.startedAt: number` 필드 + `timeTakenMs = answer.submittedAt - round.startedAt` + 프론트 epoch ms 전송 (ADR-019 §8.1)
- 해소 후 quality 공식 `timePenalty` 재도입 평가 (Q5=a 제거)

**9순위 — ADR-019 24h 관측 결과 (자동)**

`@Cron(EVERY_DAY_AT_MIDNIGHT)` 자동 실행: `sr_metrics_daily` 1행 INSERT. SR 혼합 편성 실사용 피드백 (2회차 이후 due 우선 편성).

**전체 14 PR 로드맵** (Session 12 갱신 — ADR-020 §6 참조):
1. Tailwind 인프라 ✅
2. theme token 브리지 + light 팔레트 ✅
3a. helmet + CSP ✅ / 3b CSP Report-Only / 3c middleware nonce + enforce
4. next-themes + Header 토글 ✅
5. shadcn/ui 초기화 ✅
6. auth rate limit (CRITICAL-B3) ✅
7. pre-commit Layer 3-a3 재귀 ✅
8. Header + `/`, `/login`, `/register` Tailwind ✅
9. `/play/solo` 시안 β/ε 시리즈 — 9a ✅ / 9a' ✅ / 9b playing / 9c finished / 9d mistakes
10a. **httpOnly cookie + refresh rotation + revoke epoch** (CRITICAL-B2) ✅ (PR #51, Session 13)
10b. **R4 discussion + sanitize-html + vote 무결성** (CRITICAL-B4) ✅ (PR #53, Session 13 후속)
10c. **CSRF Origin guard** ✅ (PR #56, Session 13 후속3) — consensus-011 CRITICAL 3건 패치
12. **discussion 페이지 + VoteButton + rehype-sanitize** ← **다음 0순위**
12. discussion 페이지 + VoteButton + rehype-sanitize

**Session 8+ 유보 (ADR-018 §10 트리거 조건)**
- R2 dual-salt overlap — salt rotation 후 24h 동안 구 salt 병행 수용. 현재는 없음.
- R3 `user_token_hash_epoch` 컬럼 전파 — answer_history 이외 테이블. (Session 5 에서 answer_history 만 추가)
- `grader_digest` 에 saltep 포함 — rotation 후 digest 재현성 이슈 발생 시
- Vault-age-sops 재평가 — 운영 규모 확대 시
- sqlglot Python 마이크로서비스 — Agent C 2순위 제안, MVP-B 이후

**병렬 운영 (기존 유지)**
- **사용자 작업: `.env` 운영 교체 완료 상태** — 2026-04-16 이후 기동 정상 (LLM_PROVIDER=ollama, digest 검증 통과).
- **`NOTION_DATABASE_ID` 사용자 입력 + 노션 sync 실증** — 2026-04-16 `POST /api/notion/sync`로 22건 동기화 이미 실증됨. Stage 2(LLM 정리) 진입 여부는 MVP-B 완료 후 결정.
- **프론트 결과 페이지 UI** — submitAnswer 응답의 correctAnswer/explanation 표시 (MC 도입으로 필요성 증가).

**MVP-B 이후 순차**
- **[MVP-C] 주차별 미니 캡스톤** — `CapstoneModule` 신설 + 3-entity 마이그레이션 + 주제 팩 4종 + `userId×주차` 시드. ADR-014.
- **[MVP-C'] 최종 캡스톤 2트랙 (SQL/PL-SQL)** — 각 트랙 10~15 step + 관리자 승인. ADR-014.
- **[MVP-D] 주간 릴리스 cron + mc-distractor-plausibility assertion + grading_appeals UI**. ADR-015/016/017.
- **실시간 대전 (ADR-015) — 후순위** (2026-04-17 사용자 결정). 위 과제 완료 후 개별 섹션으로 진행.

**후순위 (MVP 스프린트 병렬/이후)**
- **Notion Stage 2 (LLM 정리)** — input sanitization → ChatOllama → StructuredOutputParser → `notion_documents.structured_content`. raw_markdown 불변 보존.
- **Notion Stage 3 (자동 범위 추론)** — extractOracleTokens + LLM 보조 → 주차/주제 매핑 → weekly_scope upsert.
- **operational-monitoring Phase C** — 대시보드 UI + Slack/email 알림 채널 (Phase B 2주 안정 후).
- **2주차+ 시드 확장** — IMPLEMENTATION_STATUS §4.3 line 163~164 미작성 주차 채우기.
- **(P4 후순위)** M5 Llama 3.3 num_ctx 튜닝, Ollama schema-constrained decoding 파일럿.
- **(후순위)** Anthropic 크레딧 충전 후 Phase 0 Claude 베이스라인.
- **(후순위)** 채점 모델 분리 — MT8 breach 3회/월 또는 `grading_appeals` ≥ 10건/주 시 트리거 (별도 ADR 필요).
- **(후순위)** ADR-019 §7 제외/연기 항목: FSRS 전환 (SM-2 3개월+ 데이터 확보 후) / Grafana 대시보드 UI + Slack·email 알림 / SR_EASE_CLAMP off 재검토 (6개월+) / advisory lock 재검토 (peak rps ≥ 50).

### 환경/운영 메모

- **Claude Code root 실행 문제**: Write 도구 결과물이 root 소유. 매 세션 종료 시 또는 사용자 IDE 작업 직전에 `chown -R delangi:delangi apps docs scripts packages .gitignore apps/api/eval-results` 실행 필요.
- **Anthropic API 크레딧**: 본 세션 단계 4에서 "credit balance is too low" 에러 발견. 평가 라운드(R0~R4)에는 5모델 × 30~60문제 × 5 run = 750+ 호출 필요해 우회 불가. 단계 8 시작 전 충전 필수 (예상 $5~10).
- **`feature/oss-model-eval` 브랜치**에 단계 0~4 + week2 누적, main merge 시점은 단계 10 (ADR-010) 이후.

**MVP 1단계 잔여 (feature/mvp-phase1 브랜치)**:
1. 노션 import → 범위 추론 파이프라인 (LangChain + 노션 API)
2. 관리자 문제 review UI/API (`PATCH /api/questions/:id/review`)
3. 결과 페이지 취약 분야 분석 + 라운드 결과에 정답/해설 노출

---

## 새 프로젝트에서의 첫 단계

1. 이 템플릿 파일을 새 프로젝트에 복사
2. `CLAUDE.md` 읽기 (에이전트 규칙 확인)
3. 아이디어를 제시 → Phase 0(검토 질문지) 자동 시작
4. Phase 1(3+1 합의) → 기술 스택 확정
5. `.env.example` 기반 `.env` 생성
6. `docker compose up` → 개발 시작

---

**이 문서는 매 세션 시작 시 반드시 읽어야 합니다.**
