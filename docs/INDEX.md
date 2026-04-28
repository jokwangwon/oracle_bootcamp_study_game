# 문서 인덱스 (Documentation Index)

> **프로젝트 문서 전체 구조 및 읽는 순서**

**최종 업데이트**: 2026-04-24 저녁 (Session 7 완결 — ADR-019 SM-2 + 오답 노트 + ADR-020 UX 재설계 초안 / 13 PR 누적 / 695 → 936+1s / +241 tests / consensus-008·009 두 3+1 합의 성공)

---

## 문서 읽는 순서 (권장)

### 1. 시작하기
1. **[README.md](../README.md)** — 프로젝트 개요, 비전, 개발 방법론
2. **[PROJECT_CONSTITUTION.md](constitution/PROJECT_CONSTITUTION.md)** — 프로젝트 헌법 (최상위 규칙)

### 2. 프로젝트 설계 (Oracle DBA 학습 게임)
3. **[oracle-dba-learning-game-design.md](architecture/oracle-dba-learning-game-design.md)** — Oracle DBA 학습 게임 SDD (3+1 합의 완료)
3-1. **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** — SDD ↔ 실제 코드 매핑 + 진행률 (살아있는 체크리스트)

### 3. 아키텍처 이해
4. **[harness-engineering-design.md](architecture/harness-engineering-design.md)** — 하네스 엔지니어링 설계
4. **[multi-agent-system-design.md](architecture/multi-agent-system-design.md)** — 3+1 멀티 에이전트 합의 시스템
5. **[automated-review-questionnaire-design.md](architecture/automated-review-questionnaire-design.md)** — 자동화 검토 질문지 (3+1 합의 완료)
6. **[idea-driven-stack-decision-design.md](architecture/idea-driven-stack-decision-design.md)** — 아이디어 기반 스택 결정 (3+1 합의 완료)
7. **[generative-ai-asset-pipeline-design.md](architecture/generative-ai-asset-pipeline-design.md)** — 생성 AI 에셋 파이프라인 (3+1 합의 완료)
8. **[generative-ai-extensibility-design.md](architecture/generative-ai-extensibility-design.md)** — 생성 AI 확장성: 학습/모델교체/확장 (3+1 합의 완료)
9. **[ai-backend-stack-convention.md](architecture/ai-backend-stack-convention.md)** — AI 백엔드 스택 가이드라인: Python 분리 기준 (3+1 합의 완료)
10. **[environment-and-docker-design.md](architecture/environment-and-docker-design.md)** — 환경 변수 중앙 관리 + Docker-First (3+1 합의 완료)
11. **[change-impact-analysis-design.md](architecture/change-impact-analysis-design.md)** — 변경 영향 분석: 의존성/장애 사전 검증 (3+1 합의 완료)
12. **[oss-model-evaluation-design.md](architecture/oss-model-evaluation-design.md)** — OSS 모델 자체 호스팅 평가 설계 (초안, 사용자 검토 + 3+1 합의 대기)

### 3. 원칙 문서
5. **[ARCHITECTURE_PRINCIPLES.md](constitution/ARCHITECTURE_PRINCIPLES.md)** — 아키텍처 10대 원칙
6. **[CODE_QUALITY_PRINCIPLES.md](constitution/CODE_QUALITY_PRINCIPLES.md)** — 코드 품질 원칙

### 4. 개발 가이드
7. **[DEVELOPMENT_GUIDE.md](guides/DEVELOPMENT_GUIDE.md)** — 개발 프로세스, Git 규칙
8. **[TEST_STRATEGY.md](guides/TEST_STRATEGY.md)** — 테스트 전략 (70% 커버리지)

### 5. AI 에이전트 지시사항
9. **[CLAUDE.md](../CLAUDE.md)** — Claude Code 하네스 규칙 (매 세션 자동 로드)

---

## 문서 구조

```
docs/
├── INDEX.md                              # 현재 문서 (문서 인덱스)
├── CONTEXT.md                            # 프로젝트 현재 상태
├── IMPLEMENTATION_STATUS.md              # SDD ↔ 코드 매핑 (살아있는 체크리스트)
│
├── constitution/                         # 헌법 및 원칙
│   ├── PROJECT_CONSTITUTION.md           # 프로젝트 헌법 (11개 조항)
│   ├── ARCHITECTURE_PRINCIPLES.md        # 아키텍처 10대 원칙
│   └── CODE_QUALITY_PRINCIPLES.md        # 코드 품질 원칙
│
├── architecture/                         # 설계 문서
│   ├── harness-engineering-design.md     # 하네스 엔지니어링 설계
│   ├── multi-agent-system-design.md      # 3+1 멀티 에이전트 합의 시스템
│   ├── automated-review-questionnaire-design.md  # 자동화 검토 질문지
│   ├── idea-driven-stack-decision-design.md      # 아이디어 기반 스택 결정
│   ├── generative-ai-asset-pipeline-design.md   # 생성 AI 에셋 파이프라인
│   ├── generative-ai-extensibility-design.md    # 생성 AI 확장성
│   ├── ai-backend-stack-convention.md           # AI 백엔드 스택 가이드라인
│   ├── environment-and-docker-design.md         # 환경 변수 + Docker-First
│   ├── change-impact-analysis-design.md         # 변경 영향 분석
│   ├── oracle-dba-learning-game-design.md       # Oracle DBA 학습 게임 SDD
│   └── oss-model-evaluation-design.md           # OSS 모델 평가 SDD (초안)
│
├── guides/                               # 개발 가이드
│   ├── DEVELOPMENT_GUIDE.md              # 개발 프로세스, Git 규칙
│   └── TEST_STRATEGY.md                  # 테스트 전략
│
├── decisions/                            # ADR (Architecture Decision Records)
│   ├── ADR-000-template.md               # ADR 템플릿
│   ├── ADR-001-automated-review-questionnaire.md  # 자동화 검토 질문지
│   ├── ADR-002-idea-driven-stack-decision.md      # 아이디어 기반 스택 결정
│   ├── ADR-003-generative-ai-asset-pipeline.md   # 생성 AI 에셋 파이프라인
│   ├── ADR-004-generative-ai-extensibility.md    # 생성 AI 확장성
│   ├── ADR-005-ai-backend-stack-guideline.md     # AI 백엔드 스택
│   ├── ADR-006-environment-and-docker.md         # 환경 변수 + Docker
│   ├── ADR-007-change-impact-analysis.md         # 변경 영향 분석
│   ├── ADR-008-oracle-dba-game-tech-stack.md    # Oracle DBA 게임 기술 스택
│   ├── ADR-009-langchain-langfuse-stack.md      # LangChain + Langfuse 강제
│   ├── ADR-010-oss-eval-harness-fix.md          # OSS 평가 하네스 P0 수정
│   ├── ADR-011-oss-primary-model-m3.md          # M3 Qwen3-Coder-Next primary 확정
│   ├── ADR-012-answer-format-axis.md            # answerFormat 축 직교 확장 (v2.9)
│   ├── ADR-013-grading-pyramid.md               # 역피라미드 3단 채점 (v2.9)
│   ├── ADR-014-capstone-structure.md            # 주차별 미니 + 최종 2트랙 캡스톤 (v2.9)
│   ├── ADR-015-realtime-prebuilt-pool.md        # 실시간 사전 풀 매칭 (v2.9)
│   ├── ADR-016-llm-judge-safety.md              # LLM-judge 안전 프로토콜 (v2.9, D3 Hybrid 반영 2026-04-22)
│   ├── ADR-017-mt6-mt7-mt8-metrics.md           # 운영 지표 MT6/MT7/MT8 (v2.9)
│   ├── ADR-018-user-token-hash-salt-rotation.md # USER_TOKEN_HASH_SALT rotation 정책 (2026-04-22)
│   ├── ADR-019-sm2-spaced-repetition.md         # SM-2 Spaced Repetition 도입 (2026-04-24)
│   └── ADR-020-ux-redesign.md                   # UX 재설계: Tailwind + shadcn/ui + R4 토론 + R6 voting (2026-04-24)
│
├── sessions/                             # 세션 로그
│   └── ...
│
├── review/                               # 3+1 합의 보고서
│   ├── consensus-001-oracle-dba-game.md                        # Oracle DBA 게임 합의
│   ├── consensus-002-oss-model-evaluation.md                   # OSS 모델 평가 SDD 합의 (REQUEST_CHANGES)
│   ├── consensus-004-problem-format-redesign.md                # 문제 형태 재설계 합의 (v2.9, 2026-04-16)
│   ├── consensus-005-llm-judge-safety-architecture.md          # MVP-B Session 4 LLM-judge 안전 합의 (2026-04-17)
│   ├── consensus-006-adr-018-salt-rotation.md                  # ADR-018 salt rotation 합의 (2026-04-22)
│   ├── consensus-007-session-6-grading-wiring.md               # Session 6 PR#1/#2 grading 배선 합의 (2026-04-23)
│   ├── consensus-008-sm2-spaced-repetition.md                  # SM-2 SR 합의 (2026-04-24)
│   └── consensus-009-ux-redesign.md                            # UX 재설계 합의 (2026-04-24, CRITICAL 5건 Session 4 룰)
│
└── rationale/                            # 판단 근거 (의사결정 narrative)
    ├── oss-model-selection-rationale.md           # OSS 모델 자체 호스팅 후보 선정 근거 (2026-04-09)
    ├── exaone-license-extract.md                  # EXAONE LICENSE 사본 + 유료 부트캠프 적용 분석
    ├── oss-eval-failure-analysis-2026-04-14.md    # R1 전원 FAIL 원인 분석 + 3+1 합의 원문
    ├── oss-primary-model-selection-2026-04-15.md  # R2 결과 + M3 primary 확정 3+1 합의 원문
    ├── notion-mcp-permission-policy.md            # Notion MCP 권한 3단 정책 + 판단 근거
    ├── ux-redesign-brief-v1.md                    # UX 재설계 브리프 v1 (Phase 0 입력)
    ├── sm2-spaced-repetition-brief-v1.md          # SM-2 SR 도입 Phase 0 브리프 (2026-04-24)
    ├── main-page-design-brief.md                  # 메인 페이지 디자인 브리프 v1 (2026-04-28, 외부 도구/디자이너 핸드오프)
    ├── main-page-redesign-concept-d.md            # 메인 페이지 시안 D 구현 핸드오프 v1 (2026-04-28, PR-8b)
    ├── play-and-mistakes-design-brief.md          # 플레이+오답 노트 디자인 브리프 v1 (2026-04-28, /play/solo 3 phase + /review/mistakes, 시안 D 톤 확장)
    ├── play-and-mistakes-redesign-concept-beta.md  # 플레이+오답 시안 β (Flow Glass) 구현 핸드오프 v1 (2026-04-28, PR-9a~9d, 트랙 분기 + 옵션 1 다중 모드 + 적응형 난이도)
    ├── solo-play-config-design-brief.md            # /play/solo config phase 시각 풍부함 brief v1 (2026-04-28, PR-9a 후속 시안 도출용 입력)
    └── solo-play-config-redesign-concept-epsilon.md # /play/solo config 시안 ε (Hero Mirror) 구현 핸드오프 v1 (2026-04-28, PR-9a' polish, Hero anchor + split form + day picker + stats strip)
```

---

## 우선순위별 문서

### CRITICAL (반드시 읽어야 함)
- `PROJECT_CONSTITUTION.md` — 프로젝트 헌법 (모든 개발의 기준)
- `harness-engineering-design.md` — 하네스 엔지니어링 (핵심 설계 철학)
- `multi-agent-system-design.md` — 3+1 에이전트 합의 (검증 시스템)

### HIGH (개발 시작 전)
- `ARCHITECTURE_PRINCIPLES.md` — 아키텍처 원칙
- `CODE_QUALITY_PRINCIPLES.md` — 코드 품질 원칙
- `DEVELOPMENT_GUIDE.md` — 개발 프로세스
- `TEST_STRATEGY.md` — 테스트 전략

---

## 문서 간 관계

```
PROJECT_CONSTITUTION.md (헌법)
    ↓
    ├─→ ARCHITECTURE_PRINCIPLES.md (제3조, 제6조 상세화)
    ├─→ CODE_QUALITY_PRINCIPLES.md (제5조 상세화)
    ├─→ harness-engineering-design.md (제3조 상세화)
    └─→ multi-agent-system-design.md (제4조 상세화)

CLAUDE.md (에이전트 지시사항)
    ↓
    ├─→ 헌법 참조
    ├─→ 하네스 설계 참조
    └─→ 멀티에이전트 설계 참조
```

---

## 문서 업데이트 이력

| 날짜 | 변경 내용 | 관련 문서 |
|------|-----------|-----------|
| 2026-04-06 | 프로젝트 초기 문서 체계 수립 | 전체 문서 |
| 2026-04-06 | 자동화 검토 질문지 설계 (3+1 합의 완료) | `automated-review-questionnaire-design.md`, `ADR-001` |
| 2026-04-06 | 아이디어 기반 스택 결정 (3+1 합의 완료) | `idea-driven-stack-decision-design.md`, `ADR-002` |
| 2026-04-06 | 생성 AI 에셋 파이프라인 (3+1 합의 완료) | `generative-ai-asset-pipeline-design.md`, `ADR-003` |
| 2026-04-06 | 생성 AI 확장성 — 학습/모델교체/확장 (3+1 합의 완료) | `generative-ai-extensibility-design.md`, `ADR-004` |
| 2026-04-06 | AI 백엔드 스택 가이드라인 (3+1 합의 완료) | `ai-backend-stack-convention.md`, `ADR-005` |
| 2026-04-06 | 환경 변수 중앙 관리 + Docker-First (3+1 합의 완료) | `environment-and-docker-design.md`, `ADR-006` |
| 2026-04-06 | 변경 영향 분석 (3+1 합의 완료) | `change-impact-analysis-design.md`, `ADR-007` |
| 2026-04-08 | Oracle DBA 학습 게임 SDD + 기술 스택 결정 (3+1 합의 완료) | `oracle-dba-learning-game-design.md`, `ADR-008`, `consensus-001` |
| 2026-04-08 | MVP 1단계 스캐폴딩 + 구현 현황 매핑 문서 추가 | `IMPLEMENTATION_STATUS.md`, `SESSION_2026-04-08.md` |
| 2026-04-08 | AI 작업 시 LangChain + Langfuse 강제 (사용자 직접 결정) | `ADR-009`, SDD §2.3/§4.3, `IMPLEMENTATION_STATUS.md` |
| 2026-04-09 | OSS 모델 자체 호스팅 후보 선정 판단 근거 작성 (Solar Pro 2 / HyperCLOVA X SEED 제외, EXAONE 4.0 + 3.5 / Qwen3-Coder-Next / Qwen2.5-Coder 32B / Llama 3.3 70B 5개 확정) | `rationale/oss-model-selection-rationale.md` |
| 2026-04-09 | OSS 모델 자체 호스팅 평가 설계 SDD 초안 작성 (메트릭 7개 + Gold Set A/B + Ollama 인프라 + LlmClient ChatOllama 확장 + 운영 배포 게이트) | `architecture/oss-model-evaluation-design.md` |
| 2026-04-09 | OSS 모델 평가 SDD에 대한 3+1 합의 (REQUEST_CHANGES, HIGH 12 + MED 6 + LOW 5 + 누락 6, Q1~Q4 사용자 결정 필요) | `review/consensus-002-oss-model-evaluation.md` |
| 2026-04-09 | EXAONE LICENSE 사본 + 유료 부트캠프 적용 분석 (Section 2.1(a) 평가 안전 + Section 3.1 운영 회색지대) | `rationale/exaone-license-extract.md` |
| 2026-04-09 | OSS 모델 평가 SDD **v2** 작성 (HIGH 12 + MED 6 + LOW 5 + 누락 6 + Q1~Q4 결정 모두 반영, promptfoo 채택 + Langfuse self-host + Phase 0 신설) | `architecture/oss-model-evaluation-design.md` (v2) |
| 2026-04-09 | OSS 평가 단계 0~1 구현 — extractOracleTokens 공용 utils export(TDD 13 케이스) + docker-compose 평가 인프라(Langfuse v3 풀 인프라 6컨테이너 + Ollama) + sanity 4/4 PASS | `feature/oss-model-eval` 브랜치, `SESSION_2026-04-09.md` |
| 2026-04-09 | SDD v2.1 patch — Langfuse v2 → v3 풀 인프라 전환 (CLICKHOUSE_URL 오류로 사용자 결정 옵션 B) | `architecture/oss-model-evaluation-design.md` §6.1 + §16 |
| 2026-04-14 | OSS 5개 모델 R1 평가 전원 FAIL 원인 분석 + 하네스 P0 수정 4건 + 3+1 합의로 ADR-010 확정 | `rationale/oss-eval-failure-analysis-2026-04-14.md`, `ADR-010`, `SESSION_2026-04-14.md` |
| 2026-04-15 | **R2 재평가 완료 + M3 Qwen3-Coder-Next primary 확정** (3+1 합의, 6개 대안 기각, 로드맵 P1~P4 + 운영 게이트 3건) | `rationale/oss-primary-model-selection-2026-04-15.md`, `ADR-011`, `SESSION_2026-04-15.md` |
| 2026-04-16 | **문제 형태 재설계 v2.9 합의** (3+1 합의 + 사용자 4개 최종 결정: answerFormat 직교 축 / 주차별+최종 2트랙 캡스톤 / 실시간 사전 풀 매칭 / ADR→SDD→MVP 순서) | `review/consensus-004-problem-format-redesign.md` |
| 2026-04-16 | **ADR-012~017 6건 작성** (answerFormat 축 / 3단 채점 / 캡스톤 / 실시간 사전 풀 / LLM-judge 안전 / MT6-7-8 지표) | `decisions/ADR-012` ~ `ADR-017` |
| 2026-04-16 | **SDD v2.9 개정** (§1.3/§1.5/§1.6/§2.2/§3.1/§3.2/§3.3/§4.3/§4.4.2/§5.1/§6.2/§7.1/§9/§11 — 문제 형태 재설계 전면 반영) | `architecture/oracle-dba-learning-game-design.md` |
| 2026-04-16 | **operational-monitoring v1.1** — MT6/MT7/MT8 신설, ops 스키마 확장, ADR-019 승격 트리거 | `architecture/operational-monitoring-design.md` |
| 2026-04-16 | **운영 부팅 회귀 6건 수정 + env 노출** (병렬 2에이전트, 9초 간격 커밋) — shared tsconfig ESM→CJS / DI `@Optional()` 3곳 / AiModule TypeOrmModule / nest-cli assets / BullMQ jobId / docker-compose env 6건 / `DIGEST_PIN_SKIP` preprocess. 22건 Notion 동기화 실증 | `SESSION_2026-04-16.md`, 커밋 `327578a`, `afde74b` |
| 2026-04-17 | **MVP-A 완주 + MVP-B 2/10 착수** — 7 커밋, 84 신규 TDD (380 → 464). MVP-A: Mode 6 객관식 + answerFormat + MT6-8 스켈레톤 + AI MC 분기 + MC promptfoo 하네스. MVP-B: GradingModule 스켈레톤 + AnswerSanitizer + answer_history 메타 컬럼 + Layer 2 Keyword + Orchestrator(Layer 1/3 DI stub). 실시간 대전 후순위 결정. | `SESSION_2026-04-17.md`, 커밋 `452e9aa`/`6c282f2`/`1c29b3b`/`a9895c4`/`c38cc35`/`bc2ccaa` |
| 2026-04-17 야간 | **MVP-B Session 3 완료 (3 커밋, +49 TDD, 464 → 513)** — 3+1 합의 첫 실전 사용(정책 X 채택 + 보강 3종). (1) Layer 1 `AstCanonicalGrader` + `node-sql-parser@5.4.0` (MySQL→PG fallback, Oracle dialect 미지원 실측) + 방언 8종 매트릭스 + `ast_failure_reason` 4종 분류. (2) free-form seed Layer 0.5 사전검증 게이트 + SeedService 부팅 차단 + CLI. (3) MT6/MT8 집계 `ast_failure_reason IS NULL` 필터 + 리포트 투명 표기 + ADR-013 §기록 필드 부록. Rewriter·sqlglot은 Session 4+ 연기. **main 대비 27 커밋 — 머지 권장 포인트**. | `SESSION_2026-04-17.md` §9, 커밋 `b0e485d`/`589a570`/`6582d38`, `ADR-013` 부록 |
| 2026-04-17 저녁 | **하네스 점검 5 커밋** — (1) Layer 1 PostToolUse 실제 `tsc --noEmit` 훅 + 미지원 PreCommit 제거 (직전 세션 `.claude/settings.json`) (2) Layer 2/3 pre-commit 센서 활성화 (`typecheck`+`test`, 문서 전용 스킵, `core.hooksPath .githooks` 설정) (3) `settings.local.json` 212→48줄 트리밍 (위험 wildcard + 평문 비밀번호 + 일회성 명령 제거) (4) `.claude/agents/` 3+1 서브에이전트 4종 (+256 LoC) — 프롬프트 규약을 하네스 승격 (5) Notion MCP 권한 3단 정책 (allow/ask/deny) + 판단 근거 narrative. 별도: ESLint 뼈대 복구 (devDep + `.eslintrc.cjs` × 2, pre-commit 미연결). | `SESSION_2026-04-17.md` §8, 커밋 `dda09f0`/`235ceef`/`e62560e`/`964fcdc`/`f64c887`, `rationale/notion-mcp-permission-policy.md`, `.claude/agents/` |
| 2026-04-20 | **MVP-B Session 4 선행 PR (+33 TDD, 513 → 546)** — consensus-005 Langfuse PII CRITICAL 해소. `langfuse-masker.ts` (pure) + `MaskingLangfuseCallbackHandler` + `langfuse-trace-privacy.test.ts` Layer 4 스냅샷. Session 4 본 커밋 착수 조건 충족. **PR #2 merge**. | PR #2, 커밋 `0c96802`, `consensus-005-llm-judge-safety-architecture.md` |
| 2026-04-22 | **MVP-B Session 4 본 PR (+36 TDD, 546 → 582)** — consensus-005 §커밋1~3 구현. 커밋1: Layer 3 `LlmJudgeGrader` (Zod + StructuredOutputParser + OutputFixingParser, Ollama temp=0/seed=42/topK=1, Langfuse prompt 숫자 버전 pin, `grader_digest` 규약 + `GRADER_DIGEST_REGEX`) + ADR-016 §주의사항 "자동 갱신→명시적 승인" 수정. 커밋2: `user_token_hash` 컬럼 + HMAC-SHA256 salt + `USER_TOKEN_HASH_SALT` env required(min 16). 커밋3: `LAYER_3_GRADER` DI 배선 + PR 체크리스트 + Orchestrator+Layer3 통합 테스트. **PR #3 merge**. | PR #3, 커밋 `c6a9c37`/`cf03f39`/`d7a5c55` |
| 2026-04-22 | **CRITICAL 수선 PR (1 커밋)** — consensus-006 CRITICAL-1: `docker-compose.yml:229-252` api environment 블록에 `USER_TOKEN_HASH_SALT: ${USER_TOKEN_HASH_SALT}` 1줄 추가. PR #3 이후 main 재기동 불가 상태 해소. | PR #4, 커밋 `e436e1f` |
| 2026-04-22 | **ADR-018 분리 세션 (3+1 합의 + 사용자 Q1~Q4)** — consensus-006 합의 도출(CRITICAL 4건 전부 격상). 사용자 결정: Q1=b (D3 Hybrid: Langfuse=session_id 만, DB=hash) / Q2=a (외부 표준 인용 최소화) / Q3=a (R2 dual-salt 유보) / Q4=a (docker-compose 별도 PR = PR #4). ADR-018 v1 본문 + ADR-016 §7 연쇄 수정 + CLAUDE.md §8 참조 표 + INDEX/CONTEXT 동기화. | `consensus-006-adr-018-salt-rotation.md`, `ADR-018-user-token-hash-salt-rotation.md`, `ADR-016` §6/§7 개정 |
| 2026-04-22 | **MVP-B Session 5 6커밋 일괄 (+71 TDD, 582 → 653)** — ADR-018 §10 Session 5 이관 전량 + ADR-016 §6 WORM + §추가 이의제기 완주. (1) `4750e07` TypeORM migrations 인프라 + `user_token_hash_salt_epochs` 원장(partial unique / fingerprint) + `answer_history.user_token_hash_epoch`. (2) `6f3ffbe` `answer_history` WORM 트리거 (plpgsql `RAISE EXCEPTION` + BEFORE UPDATE FOR EACH ROW). (3) `03afe4b` `grading_appeals` 엔티티/endpoint + IORedis rate limiter (분당 10/일당 5) + `GradingAppealsModule` AppModule 등록 + `OpsEventKind` `grading_appeal`+`salt_rotation`. (4) `eba8514` `SaltRotationService` 단일 트랜잭션 + ADMIN_ACK 2-step 게이트 + `pnpm ops:rotate-salt` CLI. (5) `8af2d0d` `env.validation` refinement 4종 (placeholder/PREV 동일/secret 재사용/엔트로피) + pre-commit salt\|hmac\|token_hash + worm-regression vitest. (6) `ef12082` `langfuse-masker` `USER_TOKEN_HASH_PATTERNS` 2종 + Layer 4 trace privacy 스냅샷 (D3 Hybrid 최후 보루). GradingModule 미등록 유지. **PR #6 OPEN mergeable**. | PR #6, 커밋 `4750e07`/`6f3ffbe`/`03afe4b`/`eba8514`/`8af2d0d`/`ef12082`, `SESSION_2026-04-22.md` |
| 2026-04-23 | **MVP-B Session 6 PR #1 — 보안·인프라 가드 (+42 TDD, 653 → 695 / PR #8 merge)** — 3+1 합의 consensus-007 + 사용자 Q1~Q5 결정 → 8 커밋. (0) `c9af44e` `.claude/settings.local.json` 추적 해제. (1) `cd712bf` consensus-007 + ADR-016 §7(metadata 화이트리스트 4종)/§추가(LLM timeout 8000ms+held+HTTP 에러)/부록(Session 6) + ADR-018 §5(bootstrap seed fail-closed)/§10(epoch 캐시 trigger 100 rps). (2) `c252f41` C1-1 bootstrap active epoch seed migration (CRITICAL-1, fail-closed). (3) `eac7205` C1-2 Langfuse metadata 화이트리스트 가드 (CRITICAL-2, dev throw/prod drop+reporter). (4) `b13a3f4` C1-3 LlmJudgeGrader redactErrorMessage (HIGH-1). (5) `f923c87` C1-4 `OpsEventKind='pii_masker_triggered'` + `PiiMaskerEventRecorder` + `AiModule↔OpsModule` DI + session_id PK uuid schema test. (6) `79f67f5` C1-5 prompt template PII lint (pre-commit Layer 3-a3 + vitest). (7) `9b0f6e2` C1-6 `ActiveEpochLookup` + race 회귀 테스트 (PR #2 선행). **`ENABLE_FREE_FORM_GRADING` 부재 / GradingModule 미등록 유지 — PR #2 대기 (Q5=B: 1일 관측 후)**. | PR #8, 커밋 8건, `consensus-007-session-6-grading-wiring.md`, `SESSION_2026-04-23.md` |
| 2026-04-23 오후 | **tailscale 외부 접속 지원 + CORS origin 버그 수정 (1 커밋)** — 사용자가 tailscale (100.102.41.122) 로 첫 실플레이 시도. `main.ts:18` 의 CORS origin 이 api 자신의 URL(`NEXT_PUBLIC_API_URL`) 을 쓰던 **의미 역전 버그** 수정 — `CORS_ORIGIN` 전용 env 신설 (comma 구분 복수 origin). Next.js 는 `NEXT_PUBLIC_*` 을 빌드 타임 replacement 하므로 Dockerfile `ARG` + docker-compose `build.args` 경로 신설 → 외부 호스트 URL 브라우저 번들 주입 가능. `apps/web/public/.gitkeep` 추가 (빌드 선결 조건). | PR #10, 커밋 `7b6a86b` |
| 2026-04-23 오후 | **UX 재설계 브리프 v1 docs (docs-only)** — 실플레이 피드백 + 디자인 방향성 정리. 레퍼런스 4종 링크·요약 (programmers 가볍게 / Discord+Reddit 하이브리드 / 끄투온라인 라이트) + 현재 UX 문제 2건(즉시 피드백 부재 / 문맥 결여) + 요구사항 후보 R1~R7 + Phase 0 질문지 시드 6개. **결정 아님** — 다음 세션 Phase 0 입력 자료. | PR #11, 커밋 `a245819`, `ux-redesign-brief-v1.md` |
| 2026-04-23 오후 | **UX #1 즉시 피드백 + 헤더 로그인 반영 + UX #2 scenario/rationale (3 커밋, 695 GREEN 유지)** — (1) `aa79dec` UX #1 (brief §2.1): RoundPlayer `lastResult` state + FeedbackCard (정/오 뱃지 + 내 답 + 정답 + 해설) + "다음 라운드" 버튼 (Enter 가능) — EvaluationResult.correctAnswer/explanation 가 이미 응답에 있었는데 UI 가 버리던 문제. (2) `dee664f` 헤더 로그인 상태 즉시 반영: Header mount-only 체크 → `usePathname()` deps + 커스텀 이벤트 `AUTH_CHANGED_EVENT` + storage 이벤트 3계층 감지. (3) `bd328cb` UX #2 (brief §2.2): `Question`/`QuestionEntity` 에 `scenario`/`rationale` optional 필드 + `SeedService.insertQuestion()` 필드 전달 누락 버그 수정 + 1·2주차 seed 60건 전수 재작성 (blank 15+15 + term 15+15) + `ContextPanel`(📋 상황 — 풀이 중) / `FeedbackCard` 확장(💡 왜? — 제출 후) **스포일러 방지** (사용자 2차 피드백). 재시드 절차: `TRUNCATE weekly_scope CASCADE; TRUNCATE questions CASCADE;` + SEED_ON_BOOT=true. | PR #12, 커밋 `aa79dec`/`dee664f`/`bd328cb` |
| 2026-04-24 오전 | **Session 6 PR #2 (free-form 채점 배선, 7 커밋 C2-1~C2-7) + 3+1 사후 검증 hotfix (`persistHeldAnswer` 7항 누락 CRITICAL-1) + D3 Hybrid 대칭성 (`ops_event_log` user_token_hash/epoch)** — 4 PR 머지 (#14~#17). `ENABLE_FREE_FORM_GRADING=false` 프로덕션 기본. `multi-agent-system-design §7.3/7.4` 합의율 패턴 관찰 기록 신설. **695 → 779+1s (+84)**. | PR #14~#17, `SESSION_2026-04-24.md` §1~2 |
| 2026-04-24 오후 | **ADR-019 SM-2 Spaced Repetition 로드맵 완결 (PR-1~PR-6, 6 PR 연속 머지)** — Phase 0 브리프 + Phase 1 consensus-008 (합의율 36.8% / B-C1~C4 + A-CRITICAL 3 전원 반영) + 사용자 Q1~Q5. (PR-1) review_queue entity + migration 1714000007000. (PR-2) `sm2Next` + `mapAnswerToQuality` pure function (SM-2-lite clamp [2.3,2.6] 항상 ON, timePenalty 제거). (PR-3) `ReviewQueueService.upsertAfterAnswer/overwriteAfterOverride` + submitAnswer Tx2 (fail-open). (PR-4) `findDue` JOIN questions + `pickQuestionsForSolo` srLimit=ceil(rounds*0.7) + `GET /games/solo/review-queue` + `QuestionPoolService.pickRandom(excludeIds)`. (PR-5) Next.js `ReviewBadge` + `apiClient.solo.reviewQueue`. (PR-6) `sr_metrics_daily` 테이블 + `SrMetricsService` + `@Cron(EVERY_DAY_AT_MIDNIGHT)` + `evaluateSrMetricBreaches` (retention/completion/guard). **779 → 908+1s (+129)**. | PR #17~#23, `ADR-019`, `consensus-008`, `SESSION_2026-04-24.md` §3.6~3.10 |
| 2026-04-24 저녁 | **오답 노트 + UX v2 (PR #25) + ADR-020 UX 재설계 초안 (PR #26)** — 2 PR 머지 준비. (1) 오답 노트 — `UserMistakesService` + `GET /api/users/me/mistakes` (search/sort/status/topic/week/gameMode 필터 + summary 3차원 집계 + hasMore 페이지네이션). Next.js `/review/mistakes` 좌측 사이드바 블로그 스타일 (검색박스 + 섹션별 카운트 뱃지 + 활성 필터 chips). **+41 tests (908 → 936+1s + 2 신규 파일)**. (2) ADR-020 UX 재설계 Phase 1 완결 — 3+1 합의 consensus-009 (합의율 63% / Agent B 단독 CRITICAL 5건 Session 4 룰 전원 채택 / Reviewer 축자 검증) + 사용자 Q10~Q15 확정. 스택 = Tailwind v3.4 + shadcn/ui + Radix + next-themes (`defaultTheme="light"`). R4 = 3-테이블 + 1-level nested + Reddit hot. 보안 5종 (helmet+CSP / httpOnly 쿠키 / auth rate limit / vote UNIQUE / pre-commit Layer 3-a3 재귀). **12 PR 로드맵 (약 13일)** 확정. | PR #25, PR #26, `consensus-009-ux-redesign.md`, `ADR-020-ux-redesign.md` |
| 2026-04-27 | **Session 8 — ADR-020 12 PR 로드맵 본격 착수 (5 PR open, 936 → 955 +19 tests)** — PR #27 (PR-6 auth rate limit, `@nestjs/throttler` + `RedisRateLimiter` 일반화 / kind ∈ appeal·post·comment·vote / `AppealRateLimiter` thin wrapper 회귀 0 / CRITICAL-B3 해소) 독립. 4-stack: PR #28 (PR-1 tailwindcss@3.4 + postcss + utils 인프라) → PR #29 (PR-2 theme token 브리지 + light 팔레트 + `--accent-fg` WCAG AA 토큰 + 7곳 hardcoded 교체) → PR #30 (PR-4 next-themes ThemeProvider + Header Sun/Moon 토글 + mounted 가드 + aria) → PR #31 (PR-5 shadcn init new-york/slate + Button/Card/Dialog/Input/Label/DropdownMenu + tailwindcss-animate + `--accent`→`--brand` rename 22 위치 + shadcn HSL 토큰 풀세트 공존). 외부 노트북 (tailscale `100.102.41.122:3002`) docker compose `web` 재빌드 2회로 PR-4/PR-5 시각 검증. 사용자 디자인 평가 ("카드/배너/색감 밋밋") → 진짜 시각 변경은 **PR-8 부터**. ADR-020 §3.3 spec 후속 패치 권고 (`--brand` rename + `--accent-fg` 토큰). | PR #27, PR #28, PR #29, PR #30, PR #31, `SESSION_2026-04-27.md` |
| 2026-04-28 | **Session 9 — ADR-020 PR-8 Tailwind 마이그레이션 + PR-8b 시안 D 메인 페이지 통합 (3 PR 머지)** — (1) PR #33 stack 머지 누락 PR-2/4/5 cherry-pick 복구 (3 commit) — Session 8 stack PR base 자동 갱신 누락 사고 보정. (2) PR #34 PR-8 — Header / `/` / `/login` / `/register` inline-style → Tailwind utility + shadcn `Button`/`Card`/`Input`/`Label`. lucide 아이콘 + ArrowRight hover slide + role=alert 에러 + autoComplete. (3) PR #35 **PR-8b 시안 D 통합** — 사용자가 외부 도구로 도출한 시안 D 명세 (`main-page-redesign-concept-d.md`) 를 3 commit 으로 본 세션 구현. Apple Vision 글라스 톤 (사용자 결정): Hero 우측 3-layer 패널 (다크 탭바 → 다크 코드 → 라이트 글라스 티커) + Journey strip 20-day 4상태 막대 (color+위치+라벨 3중 인코딩) + 비대칭 1.4:1:1 카드 그리드 (Primary `bg-brand-gradient` + 모드 chips + 진행 박스 / Ranking 글라스 + 내 위치 highlight / Admin 글라스 + 🔒). 페이지 배경 fixed radial-gradient 블롭 2개. 신규 토큰 5종 (`--brand-strong`/`--code-bg`/`--code-tab-bg`/`--syntax-blank`/`--syntax-blank-fg`) + Tailwind 매핑 3종 (`brand-gradient` background-image / `grid-cols-20` / code+syntax colors). 신규 web 6 파일 (`lib/home/{types,mock,data}.ts` + `components/home/{hero-live-panel,journey-strip,feature-cards}.tsx`). ViewModel 인증/게스트 분기 — `'use client'` + localStorage 기반 (PR-10 후 RSC 환원 명시). 신규 디자인 문서 2종 (외부 도구 핸드오프용 `main-page-design-brief.md` + 시안 D 명세 `main-page-redesign-concept-d.md`). ADR-020 §11 변경 기록 2행 (PR-2/PR-5 토큰 rename + PR-8b 토큰 5종). 외부 노트북 검증 4회. 테스트 955+1s 그대로 (web 변경 only, build/typecheck 게이트). | PR #33, PR #34, PR #35, `main-page-design-brief.md`, `main-page-redesign-concept-d.md`, `SESSION_2026-04-28.md` |

---

## AI 에이전트를 위한 안내

이 프로젝트에서 개발을 도울 때:

1. **반드시 준수**: `PROJECT_CONSTITUTION.md` (헌법)
2. **설계 참고**: `docs/architecture/` 폴더의 설계 문서들
3. **코딩 스타일**: `DEVELOPMENT_GUIDE.md` 참고
4. **아이디어 검증**: 반드시 3+1 에이전트 합의 프로토콜 적용

**변경 사항 발생 시**:
- 관련 문서 업데이트 필수
- 이 INDEX.md의 업데이트 이력에 기록

---

**이 문서는 프로젝트의 모든 문서를 안내하는 인덱스입니다.**
**새로운 문서 추가 시 반드시 이 파일도 업데이트하세요.**
