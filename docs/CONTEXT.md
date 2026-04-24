# 프로젝트 컨텍스트 (Project Context)

> **AI 에이전트가 세션 시작 시 반드시 읽어야 하는 현재 상태 문서**

**최종 업데이트**: 2026-04-24 (**Session 6 PR #2 전체 머지 + 3+1 사후 검증 hotfix + Session 7 SM-2 Phase 0/1 + ADR-019 + PR-1 머지**): 오늘 4 PR 누적 머지. PR #14 (`6b8ee7f`, consensus-007 §5 free-form 채점 배선 7 커밋 C2-1~C2-7) → 3+1 사후 검증 (합의율 25%, Agent B CRITICAL-1 단독 격상 `persistHeldAnswer` 7항 누락 확인) → PR #15 (`d24b0aa`, hotfix: persistHeldAnswer 재설계 + 16 hex 탐지 + privacy helper ai/ 이동 + multi-agent §7.3/7.4 합의율 패턴 관찰 기록) → PR #16 (`fda3ba9`, Q2=b 이행 ops_event_log D3 Hybrid 대칭 user_token_hash/epoch 컬럼) → PR #17 (`254cd45`, Session 7 SM-2 Phase 0 브리프 + Phase 1 합의 consensus-008 + ADR-019 + PR-1 review_queue entity/migration 1714000007000). **695 → 779 + 1 skipped (+84 tests)** / typecheck clean / pre-commit 전 커밋 자동 통과. `ENABLE_FREE_FORM_GRADING=false` 프로덕션 기본 유지 (Q2, 실 활성은 수동 전환). **다음: Session 7 PR-2~6 순차 (`sm2Next` + `mapAnswerToQuality` pure fn → submitAnswer Tx 분리 → pickQuestions 70% 상한 + API → UI 뱃지 → 집계)**. 전면 UI 재설계 (brief R4~R7, ADR-020 가칭) 는 별도 세션 대기 유지.

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
- 🟡 **Session 7 진행 중 (PR-1/6 머지, 2026-04-24)** — SM-2 Spaced Repetition. Phase 0 브리프 + Phase 1 3+1 합의 (consensus-008, 36.8% / B-C1~C4 격상 전원 반영 + A-CRITICAL 3 반영) + 사용자 Q1~Q5 (복합지표/70%상한/clamp 항상 ON/cap=100/timePenalty 제거) + ADR-019 + PR #17 `254cd45`. review_queue entity + migration 1714000007000 + ReviewModule 스켈레톤 (764 → 779+1s / +15). consensus-004 "ADR-018 SM-2" → ADR-019 정정. **PR-2~6 대기**.
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

### 다음 세션 우선순위 (2 트랙 병행)

**트랙 X — 전면 UI 재설계 (별도 세션 권장)** — PR #11 `ux-redesign-brief-v1.md` 기반.

- **Phase 0 검토 질문지 작성** (ADR-001) — 브리프 §5 시드 6개 활용:
  1. 레퍼런스 4종 중 가장 가까운 하나 / 피해야 할 것
  2. R1~R7 중 MVP-C 이전 반드시 필요한 것
  3. 커뮤니티 심도: (a) 질문/답변만 (b) + upvote (c) + 댓글 (d) + 실시간 반응
  4. 학습 진지함 vs 끄투온라인 캐주얼 톤 트레이드오프
  5. Mobile-first 여부
  6. 다크모드 선호도
- **Phase 1 3+1 합의** → ADR-020 (가칭) UX 재설계 + SDD UI 섹션 + Tailwind CSS + shadcn/ui 도입 결정
- **구현 순서 제안** (ADR 통과 후): 홈 재설계 → 솔로 랜덤 진입 (R3) → 문제당 토론 쓰레드 entity/API/UI → Discord 스타일 반응 → Mobile 대응

**트랙 Y — MVP-B Session 6 PR #2 (PR #1 관측 1일 후, Q5=B)**

**0순위 — PR #1 (PR #8) 프로덕션 배포 + 관측 (사용자 Q5=B)**
- **staging 부팅 smoke** — migration 1714000004000 자동 실행 → `user_token_hash_salt_epochs` active row 1건 자동 시드 확인 + `ops_event_log(kind='salt_rotation', payload={bootstrap:true})` 1건 기록 확인.
- **프로덕션 배포 1일 관측**:
  - `pii_masker_triggered` 이벤트 기대값 = 0 (호출자 코드 정합 확인용). 발생 시 즉시 원인 조사.
  - `answer_history` INSERT 경로 회귀 없음 (MC/BlankTyping/TermMatch 게임 모드 동작 유지).
  - pre-commit Layer 3-a3 (prompt template PII grep) 실사용 중 false positive 확인.
- 이상 없으면 **PR #2 세션 개시**. 이상 발견 시 hotfix PR 선행.

**최우선 — MVP-B Session 6/10 PR #2 (free-form 채점 배선, 7 커밋 / consensus-007 §5)**
1. **C2-1**: `LlmClient.invoke(messages, opts?: { metadata?: WhitelistedMetadata })` + `sessionId` 전파. `PlayerAnswer.sessionId` 축 신설 → `GameSessionService` → `GradingOrchestrator` → `LlmJudgeGrader`. 기존 호출자 회귀 0 (optional).
2. **C2-2**: `GradingMeasurementService.measureGrading()` 신규 — `OpsMeasurementService.measureSync` 와 시맨틱 분리. `ast_failure_reason` / `judge_invocation_count` / `llm_timeout` 등 채점 차원 일관 기록.
3. **C2-3**: `GradingModule` AppModule 등록 (격리 해제). wiring smoke test (DI 해결 확인, Ollama lazy 연결로 부팅 영향 0).
4. **C2-4**: `GameSessionService.gradeFreeForm()` private 추출 + `answerFormat==='free-form'` 분기 + `ENABLE_FREE_FORM_GRADING` env kill-switch (Q2=false 프로덕션 기본). MC/single-token 회귀 없음.
5. **C2-5**: `LLM_JUDGE_TIMEOUT_MS=8000` env (Q1) + held fallback + **HTTP 에러 응답 (Q3=B)**. `answer_history.gradingMethod='held'` persist 유지로 감사 체인 보존. `ops_event_log(kind='llm_timeout')` 기록.
6. **C2-6**: `GradingResult → EvaluationResult` 변환 + 7항 persist (gradingMethod/graderDigest/gradingLayersUsed/partialScore/rationale/sanitizationFlags/astFailureReason) + `user_token_hash_epoch` 채움 (PR #1 C1-6 `ActiveEpochLookup` 재사용).
7. **C2-7**: E2E `OLLAMA_INTEGRATION` env gate (nightly). Langfuse mock 송신 payload 전수 캡처 → userId 파생정보 0건 assert.

**최우선 — 합의 산출물 백로그 (Session 3/4 에서 연기)**
- **Session 6+**: 에러 타입 행동 분기 (`truly_invalid_syntax` → 즉시 FAIL). 현재 기록만, 행동 분기는 Rewriter 와 함께.
- **Session 6+**: 전처리 Rewriter (`(+)` → ANSI JOIN, `NVL` → `COALESCE`). `grader_digest` 재현성 재설계 선행 필요.

**Session 7~10**
- Session 7: SM-2 복습 간격 시스템
- Session 8: dry-run 채점 모드 (개발 편의)
- Session 9: 작성형 gold set 15+건 (Mode 1 variants 준비)
- Session 10: Mode 1 variants 실제 도입 + free-form seed 가동

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
- **(조건부)** ADR-019 채점 모델 분리 — MT8 breach 3회/월 또는 `grading_appeals` ≥ 10건/주 시 트리거.

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
