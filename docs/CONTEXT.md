# 프로젝트 컨텍스트 (Project Context)

> **AI 에이전트가 세션 시작 시 반드시 읽어야 하는 현재 상태 문서**

**최종 업데이트**: 2026-04-16 (**ADR-011 채택 조건 3건 모두 완료** — digest pin 자동화 + 메타 편향 주의문 SDD v2.8 + operational-monitoring SDD v1.0 + Phase A 구현. 다음 마일스톤: ChatAnthropic→ChatOllama 운영 교체)

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
- ✅ **OpsModule Phase A 구현 (2026-04-16)** — `ops_question_measurements` + `ops_event_log` entity + `OpsMeasurementService.measureSync` (MT3 ScopeValidator 재사용, MT4 pure helper, fail-safe ops_event_log) + `POST /api/questions/:id/report` (JwtAuth + 중복 차단) + `AiQuestionGenerator` `@Optional()` 통합. 36 files / **317 tests passed** (신규 16). modelDigest는 `'pending-migration'` (ChatOllama 교체 시 실 digest로 전환).
- ✅ **SDD §4 AI 콘텐츠 파이프라인 v2 설계** — 3+1 합의(consensus-003) + 사용자 결정 반영. v1 중앙 허브(키워드 화이트리스트) 구조 유지 + 5단계 확장 (노션 증분 추출 → LLM 문서 정리 → 범위 분석 → 문제 생성 → 검증/저장). **하이브리드 오케스트레이션**: Stage 간 BullMQ(영속성/재시도/스케줄) + Stage 내부 LangChain Runnable(Langfuse trace 전 구간). notion_sync_state/notion_documents 테이블 설계. 입력 sanitization + 원본 보존 안전 장치.
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

1. **운영 모델 교체 (단계 10, ADR-011 P1)** — `LlmClient` 기본 provider를 `ChatAnthropic` → `ChatOllama(qwen3-coder-next:latest)`로. 동시에 AiQuestionGenerator의 `modelDigest='pending-migration'`을 `verifyApprovedModel().currentDigest`로 전환. BullMQ 워커 boot 시 pin 검증 hook 연결.
2. **operational-monitoring Phase B** — 운영 개시 후 100건 축적 시점에 1시간 cron + `gate_breach` 이벤트 생성 + Phase A 데이터로 첫 window 리포트 작성 (`docs/operations/monitoring-window-1.md`).
3. **BullMQ 워커 + 노션 import (MVP 1단계 잔여)** — feature/oss-model-eval 브랜치 main merge 후 feature/mvp-phase1으로 복귀.
4. **(P4 후순위)** M5 Llama 3.3 num_ctx 튜닝, Ollama schema-constrained decoding 파일럿
5. **(후순위)** Anthropic 크레딧 충전 후 Phase 0 Claude 베이스라인

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
