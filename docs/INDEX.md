# 문서 인덱스 (Documentation Index)

> **프로젝트 문서 전체 구조 및 읽는 순서**

> ⚠️ **2026-05-04 MVP ARCHIVE FREEZE** — 본 저장소는 `mvp-freeze-2026-05-04` tag로 동결됨. ADR-022 (Hermes Agent 메인 도입) 결정으로 신규 시스템은 별도 위치에서 from-scratch 구축. 본 INDEX의 모든 문서는 archive 자산으로 위치 변경됨. 신규 시스템 진입 후 본 INDEX는 더 이상 갱신되지 않음. 상세: [`docs/operations/mvp-archive-manifest.md`](operations/mvp-archive-manifest.md), [`docs/decisions/ADR-022-hermes-agent-main-adoption.md`](decisions/ADR-022-hermes-agent-main-adoption.md), [`docs/sessions/SESSION_2026-05-04.md`](sessions/SESSION_2026-05-04.md), [`docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md`](rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md).

**최종 업데이트**: 2026-05-04 (**Session 17 — 메타 피벗: MVP 동결 + Hermes Agent 메인 도입**). 1기 운영 가정 무효화 발견 — 사용자 메모리 11개 중 다수가 미래 1기 운영 시뮬레이션이었음 (`project_actual_state.md`). consensus-014 §C3(LangGraph 메인) 번복 + consensus-015 3층 분리안 부분 번복. 합의 번복 3회 누적, ADR-022 §10에 이력 명시. 신규 docs 4개. 권고 순서 1~4 완료, 5(신규 시스템 초기화)는 사용자 결정 대기. **이전**: 2026-04-29 (**Session 15 — ADR-021 (Community Hub) + PR-13 (통합 e2e 하네스) docs PR (consensus-013)**). 3+1 합의 (Agent A·B·C 병렬 + Reviewer). **합의율 만장일치 12.5% (1/8) / 유효 100% (8/8)**. 결정 8건 (도메인 / 카테고리 / 라우트 / 권한 / Header / 모더레이션 + PR-13 우선순위 + PR-13 도구). **CRITICAL 격상 3건**: middleware PUBLIC_PATHS 모순 (Q-R5-11 번복 확정) / PR-13 1주 선행 머지 / audit log 부재 (CWE-778, ADR-016 §7 D3 Hybrid 재사용). **옵션 공간 재오픈** (Agent C 단독 제안 옵션 F=Q&A mview / G=virtual root question 시드) — consensus-012 의 5개 매트릭스 Gap 메우기. **사용자 결정 12건 (Q-R6-01~12) — 항목별 검토 패턴**. Reviewer 권장 대비 변경 4건: Q-R6-02 격상 (외부 채널 부재 — Slack 미사용, Zoom 만, 정보 공유 커뮤니티 없음 → 카테고리 1기 도입 4종 notice/free/study/resource) / Q-R6-09 격상 (강사 = operator role, 학생 글 수정 코드 강제) / Q-R6-10 종속 격상 (1기 3-tier user/operator/admin) / Q-R6-12 변경 (시안 D §3.4 비대칭 3-카드 → 4-카드, Community 카드 추가). **사용자 결정 12건 채택값**: Q-R6-04 옵션1 (read 인증 필수) / Q-R6-06 옵션1 (audit log 1기) / Q-R6-11 옵션1 (PR-13 1주 선행) / Q-R6-01 옵션 G (virtual root) / Q-R6-02 후보2 (4종) / Q-R6-03 옵션2 (path segment) / Q-R6-05 옵션1 (이중 방어) / Q-R6-07 옵션1 (NestJS 기본 + CI) / Q-R6-09 옵션2 (operator) / Q-R6-10 자동 (3-tier) / Q-R6-12 옵션3 (4번째 카드) / Q-R6-08 N/A. **신규 docs 9개**: consensus-013 + ADR-021 + community-hub-design + community-rbac-design + community-moderation-design + audit-log-design + integrated-e2e-harness-design + tdd-plan + impact. **패치 docs 2개**: ADR-020 §11 + 시안 D §1·§3.4 (4-카드). **추정 분량**: ADR-021 docs 1d (본 PR) + PR-13 코드 4d (Phase 2 1주 선행) + ADR-021 코드 4분할 6d (Phase 3 = 마이그레이션 1d + API/RBAC 2d + UI 2d + 모더레이션 1.5d). **다음 세션 0순위**: PR-13 코드 PR (Phase 2, 1주 선행 머지). **이전 (Session 14)**: PR-12 web 토론 페이지 코드 PR (PR #60, Phase 4~7, 22 commits). Phase 4~7 5건 + 라이브 외부 노트북 hotfix 11건 + UX 결정 4건 + placeholder 2건. 149 web tests 신규 GREEN (api 1284 회귀 0). CRITICAL 5건 해소 (consensus-012 매핑). hotfix 11건 패턴 = 단위 테스트가 통합 차원 결함 미검출 → PR-13 가동 근거. **이전 (Session 13 후속4)**: PR-12 web 토론 페이지 docs PR (consensus-012). 3+1 합의 (만장일치 6.7% / 유효 100%) + 사용자 결정 15건 모두 권장 채택 ("전부 권장"). CRITICAL 5건 해소 + 신규 docs 4파일 + ADR-020 §4.2.1 C/§5.3/§6/§9/§11 패치. **이전 (Session 13 후속3)**: **PR-10c CSRF Origin guard 코드 머지 (PR #56, 1175+1s → 1218+1s, +43 cases)**. consensus-011 CRITICAL 3건 패치 (URL parse + protocol/host:port exact match / production CORS_ORIGIN fail-closed 이중 안전망 / SkipOriginCheck decorator + ORIGIN_GUARD_MODE=report 1주 관측 + 한국어 학습 힌트 + ORIGIN_GUARD_DISABLED kill-switch). 가드 순서 OriginGuard 글로벌 → ThrottlerGuard / JwtAuthGuard 컨트롤러. **PR-10 시리즈 완료** (10a httpOnly cookie + 10b R4 discussion + 10c CSRF Origin guard). 사용자 작업: `.env CORS_ORIGIN` 부트캠프 표준값 + `ORIGIN_GUARD_MODE=report` + API 재기동. 1주 후 enforce. 다음 세션 0순위: PR-12 (web 토론 페이지 + rehype-sanitize + hot/top raw query, 2.5d). **이전 (Session 13 후속2)**: PR-10c 위협 모델 재합의 (consensus-011) + ADR-020 §4.2.1 E·I·K 갱신 docs PR. 3+1 합의 (만장일치 35.7% / 유효 92.9%) + 사용자 6결정 모두 추천값 채택 (a/a/a/b/a/a). CRITICAL 3건 식별 (startsWith bypass / CORS_ORIGIN fail-OPEN / 운영 회귀) → §4.2.1 E 절 명세 17 → 25~30 LOC 갱신 + §K 절 신설 (PR-10c 머지 전 추가 선결 조건 + 미래 재검토 트리거 4종). CSRF token 폐기 = 명목상 작업 0 (csurf/xsrf grep 0건). Sec-Fetch-Site hybrid 채택 거부 (Tailscale HTTP 환경에서 미전송). 다음 작업: 본 docs PR 머지 → 코드 PR (Phase 1~3, ~140 LOC + 33 cases TDD) → 1주 Report-Only 관측 → enforce 전환.)

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
│   ├── oss-model-evaluation-design.md           # OSS 모델 평가 SDD (초안)
│   ├── pr-12-discussion-page-design.md          # PR-12 web 토론 페이지 SDD (2026-04-29 후속4, consensus-012, 사용자 결정 15건 채택)
│   ├── community-hub-design.md                  # ADR-021 Community Hub 도메인 모델 + 카테고리 + 라우트 SDD (2026-04-29 Session 15, consensus-013)
│   ├── community-rbac-design.md                 # ADR-021 1기 3-tier RBAC + RolesGuard + 이중 방어 SDD (2026-04-29 Session 15)
│   ├── community-moderation-design.md           # ADR-021 모더레이션 1기/2기/3기 단계 SDD (2026-04-29 Session 15)
│   ├── audit-log-design.md                      # ADR-021 audit log CWE-778 + WORM + ADR-016 §7 D3 Hybrid 재사용 SDD (2026-04-29 Session 15)
│   └── integrated-e2e-harness-design.md         # PR-13 통합 e2e 하네스 SDD (NestJS testing + Playwright smoke + MSW + 5종 안전장치, 2026-04-29 Session 15)
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
│   ├── ADR-020-ux-redesign.md                   # UX 재설계: Tailwind + shadcn/ui + R4 토론 + R6 voting (2026-04-24)
│   └── ADR-021-community-hub.md                 # Community Hub: 자유게시판 + 카테고리 4종 + 1기 3-tier RBAC + 모더레이션 + audit log (2026-04-29 Session 15, consensus-013)
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
│   ├── consensus-009-ux-redesign.md                            # UX 재설계 합의 (2026-04-24, CRITICAL 5건 Session 4 룰)
│   ├── consensus-010-pr-10-security.md                         # PR-10 보안 합의 (2026-04-28, Session 12)
│   ├── consensus-011-pr-10c-csrf.md                            # PR-10c CSRF 위협 모델 재합의 (2026-04-28 후속, Session 13)
│   ├── consensus-012-pr-12-discussion-page.md                  # PR-12 web 토론 페이지 합의 (2026-04-29 후속4, Session 13, 만장일치 6.7% / 유효 100% / 사용자 결정 15건 모두 채택)
│   ├── consensus-013-adr-021-community-hub.md                  # ADR-021 Community Hub + PR-13 합의 (2026-04-29 Session 15, 만장일치 12.5% / 유효 100% / 사용자 결정 12건 — Reviewer 권장 대비 변경 4건)
│   ├── impact-pr-10a-cookie-refresh-revoke.md                  # PR-10a 변경 영향 분석 (2026-04-29, ADR-007 SYSTEM 4차원)
│   ├── impact-pr-12-discussion-page.md                         # PR-12 변경 영향 분석 (2026-04-29 후속4, ADR-007 SYSTEM 4차원, HIGH 등급)
│   ├── impact-adr-021-community-hub.md                         # ADR-021 변경 영향 분석 (2026-04-29 Session 15, ADR-007 4차원)
│   ├── tdd-plan-pr-10a-cookie-refresh-revoke.md                # PR-10a TDD 단계 분해 plan (2026-04-29, 11 Phase / 40+ cases)
│   ├── tdd-plan-pr-12-discussion-page.md                       # PR-12 TDD 단계 분해 plan (2026-04-29 후속4, 7 Phase / ~103 cases)
│   └── tdd-plan-adr-021-community-hub.md                       # ADR-021 + PR-13 TDD 단계 분해 plan (2026-04-29 Session 15, ~335 신규 cases)
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
| 2026-04-28 | **Session 10 — 보안 게이트 2 PR + UX 디자인 시스템 4 PR (7 PR 머지, 955+1s → 976+1s)** — 보안 트랙: (1) PR #37 PR-7 (CRITICAL-B5) `.githooks/pre-commit` Layer 3-a3 재귀 + `findPromptFilesRecursively` helper + tmp fs fixture 단위 테스트 3종. (2) PR #38 PR-3a (CRITICAL-B1) **3+1 합의 87% 가중** — helmet@^7.2 + production-only HSTS + `applySecurityMiddleware` + supertest e2e 18 cases. PR-3 → 3a/3b/3c 분할 결정. ADR-020 §4.1 분할 명세 + multi-agent §7.3 패턴 신규 사례. UX 트랙: (3) PR #39 4 화면 통합 brief (624 LOC, 시안 D 톤 확장). (4) PR #40 시안 β Flow Glass concept (963 LOC, 옵션 1 다중 모드 + 신규 트랙 분기 ranked vs practice + 적응형 난이도). (5) PR #41 PR-9a (시안 β §3.1 코드 — `<TrackSelector>`/`<ModeMultiSelect>`/`<ConfigForm>` + `lib/play/{types,mock}` + URL `?track=practice` + Suspense + 토큰 2종 `--feedback-correct/incorrect`. config phase 만, playing/finished PR-8 톤 일시 유지). (6) PR #42 solo-play-config 시각 풍부함 brief (455 LOC, 8 약점 분해). (7) PR #43 시안 ε Hero Mirror concept (793 LOC, 단일 PR-9a' polish 명세 — Hero anchor + split form + WeekDayPicker + WeeklyStatsStrip + 토큰 6종 예약). 신규 의존성: helmet/supertest. 머지 충돌 사고 1건 (PR #40 INDEX.md, `git merge origin/main` 으로 두 행 보존 해결). 외부 노트북 검증 0회 (사용자가 PR-9a 검증 전 시안 ε 도출 결정). | PR #37, PR #38, PR #39, PR #40, PR #41, PR #42, PR #43, `SESSION_2026-04-28-session-10.md` |
| 2026-04-28 | **Session 11 — PR-9a' 시안 ε (Hero Mirror) polish 단일 PR 완주 (1 PR 머지, 11 commit, +1391/−312)** — PR #45. 시안 ε §11 의 11단계 작업 순서 그대로 진행. **신규 토큰 6종** (`--difficulty-easy/medium/hard` foreground + `-bg` background) + Tailwind `theme.extend.colors.difficulty.{easy,medium,hard}.{DEFAULT,bg}` 매핑. **신규 컴포넌트 4종**: (a) `<CodePreviewPanel>` 추출 — `<HeroLivePanel>` Layer 1+2+3 generic 화 + `bottomSlot?` 확장 (home 의 풍부한 ticker 수용). (b) `<ConfigHero>` Hero anchor — 시간대별 인사 4분기 + 신규 사용자 분기 + 명시적 confirm 패턴 (`추천으로 시작` 자동 채움 후 다시 시작). (c) `<WeekDayPicker>` — input + 20-dot strip + 4 상태 우선순위 (선택 > 오늘 > 완료 > 미진행) + 키보드 (좌/우 / Home / End) + 양방향 sync. (d) `<WeeklyStatsStrip>` — 4 metric (풀이 / 정답률 / 연속 / 일평균), null 시 silent. **시각 upgrade 3종**: `<TrackSelector>` 22 → 36px 아이콘 + stats row (`liveUserCount` prop → `rankedStats`/`practiceStats` 2종); `<ModeMultiSelect>` 가로 wrap → 세로 list + lucide 아이콘 매핑 5종 + 메타 색 분기 (`accuracyPct < 50%` → `text-error`); `<ConfigForm>` split layout (좌 주제+주차 / 우 모드+난이도) + 난이도 chip 3중 인코딩 (색 + 강도 dot `●●○○○` 등 + 라벨). **`lib/code/types.ts` 추출** — `CodeSegment`/`CodeLine`/`CodeSegmentKind` 를 home → 중립 위치, home/types 는 re-export 유지. **page.tsx 6 영역 통합** (Hero → 섹션 라벨 → Track → Form → Strip → CTA) + `ConfigContainer` `max-w-5xl` 분리 (playing/finished 720 유지). mock 6종 + page.tsx mock 상수 7종 (`MOCK_NICKNAME` 등 — `useUser()` 도입 시 1:1 swap 지점). `getMockLiveUserCount()` 제거. ADR-020 §11 +1 행 (PR-9a' 항목). `/play/solo` 8.83 → **15.3 kB**. 테스트 976+1s 그대로 (web only). 3+1 합의 0회 (시각 polish, §11 가 작업 순서 명시 → 의사결정 분기 없음). 외부 노트북 검증 0회 (PR description 미체크 항목으로 남김 — 다음 세션 처리 권장). | PR #45, `SESSION_2026-04-28-session-11.md` |
| 2026-04-28 | **Session 12 — CTA 즉시 시작 (PR #47) + 정식 PR-10 3+1 합의 (PR #48 — consensus-010) + 임시 완화 + ADR-020 §4.2.1 부속서** — (1) PR #47 — 시안 ε §3.1.4 명시적 confirm 패턴 제거. `startGame(overrides?: Partial<SoloConfigSelection>)` 시그니처 확장 → `추천으로 시작` / `이어서 학습` 클릭 시 자동 폼 채움 + 즉시 게임 시작 (1 클릭). 사용자 피드백 "다시 시작 클릭은 redundant". concept-epsilon §3.1.4/§7.3/§13.1/§16 변경. (2) **PR #48 — 정식 PR-10 3+1 합의 가동** (CLAUDE.md §3 보안 변경). Agent A·B·C 병렬 분석 + Reviewer — **합의율 70%** (만장일치 7 / 부분 4 / 불일치 3 / 누락 채택 5). 사용자 5결정 (a/a/b/b/a): Q-R1 임시 `JWT_EXPIRES_IN=24h` (PR-10a 머지까지) / Q-R2 SameSite=Lax + Origin (CSRF token 폐기 검토) / Q-R3 정식 30m/14d (학습 세션 1~2h) / Q-R4 PR-10 → 10a (cookie+refresh+revoke 2d) / 10b (R4+sanitize+vote 2d) / 10c (CSRF 1d) 3분할 / Q-R5 ADR-020 §4.2.1 부속서. **CRITICAL 4건 해소**: refresh rotation reuse detection 알고리즘 (Redis SETNX mutex + family revocation, B 지적) / logout access revoke (token_epoch ALTER + ADR-018 epoch 통합, B 단독 지적) / Tailscale + SameSite 정책 (Lax 채택, A 지적) / 5도메인 단일 PR 인지 부하 (분할). 변경: `.env.example` JWT_EXPIRES_IN 24h + 코멘트 / ADR-020 §2 결정 표 + §4.2 분할 명시 + §4.2.1 부속서 신설 (A~J 9 sub-section, 200+ LOC) + §6 PR 분할표 (12 → 14 PR) + §11 변경 이력 2 행 / 신규 합의 보고서 `consensus-010-pr-10-security.md`. **머지 전 선결 조건 6건** (Tailscale spike + ADR-007 분석 + refresh_tokens migration TDD + token_epoch ALTER TDD + OriginGuard e2e + 임시 완화 회귀). 사용자 즉시 작업: `.env JWT_EXPIRES_IN=24h` + API 컨테이너 재기동. **테스트 976+1s 그대로** (web/api 코드 변경 거의 0 — page.tsx 1 파일만, 빌드 15.3 → 15.4 kB 변화 없음 사실상). PR-10a/10b/10c 코드 작업은 별도 세션. | PR #47, PR #48, `consensus-010-pr-10-security.md`, `ADR-020-ux-redesign.md` §4.2.1, `SESSION_2026-04-28-session-12.md` |
| 2026-04-29 | **Session 13 — PR-10a 머지 전 선결 조건 docs (PR #50) + PR-10a 11 phase 코드 (PR #51, 1037+1s GREEN, +59 cases)** — (1) PR #50 — ADR-007 SYSTEM 4차원 영향 분석 (502L) + PR-10a TDD plan (644L). 9 컨트롤러/12 endpoint 의존성 매핑 + Phase 1~11 단계 분해 + 42 신규 TDD case. Tailscale spike 는 환경 사실 확정 (HTTP IP only, localhost 불가, production URL 미정) 으로 `secure: NODE_ENV==='production'` + RFC 6265 host-only cookie 결론, 추가 spike 불필요. (2) **PR #51 — PR-10a 11 phase 자율 진행** (`a626ff1` ~ `0f8126a`). Phase 1 token_epoch + refresh_tokens migration 11 cases / Phase 2 RefreshTokenEntity / Phase 3 utils 13 cases (buildClaims/parseClaims/computeExpiry/isExpired) / Phase 4 RefreshTokenService 12 cases (rotation + reuse detection revokedAt/replacedBy + Redis SETNX 5s mutex + family revoke + grace path + Redis 다운 fail-open + 트랜잭션) / Phase 5 UsersService.incrementTokenEpoch atomic 4 cases / Phase 6 AuthService refresh+epoch claim+logout 4 cases / Phase 7 JwtStrategy dual-mode (cookie+Bearer) + epoch validate 5 cases / Phase 8 AuthController logout/refresh+cookie set/clear (dev/prod 분기) 10 cases / Phase 9 cookie-parser middleware + env.validation refine 4건 (JWT_EXPIRES_IN 30m default + JWT_REFRESH_SECRET + JWT_REFRESH_EXPIRES_IN + COOKIE_DOMAIN IPv4 거부) / Phase 10 web credentials:include + 401 auto-refresh interceptor + Header me() polling / Phase 11 .env.example JWT_EXPIRES_IN 24h → 30m 정식 회귀. **CRITICAL 4건 해소** (consensus-010 Reviewer 결정 #7/#8/D/E). dual-mode 1주일 — Bearer extractor + auth-storage 폐기는 follow-up PR. 신규 의존성 cookie-parser + @types/cookie-parser. **사용자 작업**: `.env` JWT_EXPIRES_IN 30m 회귀 + JWT_REFRESH_SECRET 신규 + API 재기동. | PR #50, PR #51, `impact-pr-10a-cookie-refresh-revoke.md`, `tdd-plan-pr-10a-cookie-refresh-revoke.md`, `SESSION_2026-04-29.md` |
| 2026-04-29 후속 | **Session 13 후속 — PR-10b R4 discussion + sanitize-html + vote 무결성 머지 (PR #53, 1037+1s → 1175+1s, +138 cases)** — Session 13 §8 0순위 이행. 환경 점검 4건 (swap 15 → 2.2GiB ollama 3 모델 keep_alive=0 unload / 11일째 좀비 claude 2개 SIGKILL / sshd ClientAliveInterval 60·CountMax 3 / jsonl 7d 이전 26개 archive — 9.8 → 1.7GB) → PR-10b 코드 7 commit 단일 PR. **Phase 1** `2fefb6a` — `1714000011000-AddDiscussion` (3 table + UNIQUE PK + value CHECK) + `1714000012000-AddDiscussionSelfVoteTrigger` plpgsql. **Phase 2** `53f65fc` — DiscussionThread/Post/Vote 3 entity + DiscussionModule. **Phase 3** `db9bfd0` — `sanitize-post-body` (12 allowedTags + a[href|title] + http/https/mailto + discard + lowerCaseTags) + sanitizeTitle. **OWASP XSS Cheat Sheet 50종 negative TDD** (script 12 + 이벤트핸들러 12 + 위험 scheme 8 + container 8 + css/style 6 + misc 4) + 25종 위험 토큰 regex 비잔존 (76 cases). **Phase 4a** `a0153fa` — Service Thread CRUD 5 메서드 + IDOR + composite cursor (createdAt, id) + soft-delete body mask (15). **Phase 4b** `da86cd3` — Post CRUD 4 메서드 + 1-level nested (parentId IsNull / parent.parentId !== null BadRequest) + thread.postCount++ cache (12). **Phase 4c** `f4dac82` — Vote + Accept. DataSource.transaction + `manager.increment(target, {id}, 'score', Δ)` atomic raw + self-vote 트리거 (PG ERRCODE=23514) → ForbiddenException 매핑. acceptPost 1-accept rule (14). **Phase 5** `c713fe4` — Controller 11 endpoint (read 4 + write 7) + class-validator DTO + cursor base64url helper + `discussion_write` named throttler (60s/5회) + AppModule 통합 (19). 의존성 신규 `sanitize-html ^2.17.3` + `@types/sanitize-html ^2.16.1`. **사용자 결정 11건 (Q1~Q11 권장값 채택, Q11 만 자체 조정 — auth-throttler 컨벤션 따라 e2e 대신 handler unit + Throttle 메타데이터 회귀)**. **ADR-020 §6 PR-10b 항목 7/10 완료** — 잔여 3종 (web 표시 측 sanitize / hot 정렬 raw query / HIGH-3 블러) 은 PR-12 / 별도 PR 이월. docs commit 충돌은 옵션 A 로 코드 PR 분리 + 본 docs PR (`docs/pr-10b-merge-followup`) 합류. | PR #53, `SESSION_2026-04-29.md` §10 |
| 2026-04-29 후속2 | **PR-10c CSRF 위협 모델 재합의 + ADR-020 §4.2.1 E·I·K 갱신 (consensus-011)** — ADR-020 §4.2.1 E "유보" 트리거. 3+1 합의 (Agent A·B·C 병렬 + Reviewer). 합의율 만장일치 35.7% / 유효 92.9%. 사용자 6결정 모두 추천값 (a/a/a/b/a/a): Q-S1 명세 그대로 + 패치 / Q-S2 SkipOriginCheck PR-10c 포함 / Q-S3 Report-Only + kill-switch 둘 다 / Q-S4 추가 위협 헤더 별도 PR / Q-S5 ADR docs PR 먼저 / Q-S6 가드 순서 Throttle→Origin→JwtAuth. **CRITICAL 3건 식별** — startsWith bypass (`example.com.attacker.com` / port prefix 우회) → URL 객체 parse + protocol/host:port exact match / CORS_ORIGIN fail-OPEN (`''.startsWith('')`=true) → fail-closed (boot-time + runtime 이중) / 운영 회귀 (학생 curl/Postman 차단) → SkipOriginCheck decorator + Report-Only 1주 + 한국어 학습 힌트 + ORIGIN_GUARD_DISABLED kill-switch. **§4.2.1 E 절 명세 17 → 25~30 LOC 갱신** + **§4.2.1 I 절 정정** (CSRF token e2e → PR-10c 분리) + **§4.2.1 K 절 신설** (PR-10c 머지 전 추가 선결 조건 + 미래 재검토 트리거 TR-CSRF-1/2/3/iron-session). **CSRF token 폐기 처리** — csurf/xsrf grep 0건 확인, 명목상 작업 0. **Sec-Fetch-Site hybrid (C 추천) 채택 거부 사유**: Tailscale HTTP only 환경에서 브라우저가 secure context 만 헤더 전송 → 단독 무력. 미래 production HTTPS 전환 시 TR-CSRF-1 트리거. | `consensus-011-pr-10c-csrf.md`, ADR-020 §4.2.1 E·I·K, §11 |
| 2026-04-29 후속3 | **PR-10c CSRF Origin guard 코드 머지 (PR #56, 1175+1s → 1218+1s, +43 cases)** — consensus-011 CRITICAL 3건 패치 반영 코드 3 commit. **Phase 1** `5014118` OriginGuard TDD 38 cases (Method 5 / CORS_ORIGIN env 6 / startsWith bypass 4 / 정규화 3 / Origin vs Referer 4 / Tailscale + invalid 4 / SkipOriginCheck + kill-switch 3 / 에러 응답 + Report-Only 4 / parseAllowedOrigins helper 4 / decorator export 1) — URL 객체 parse + protocol/host:port exact match + parseAllowedOrigins helper (양측 정규화 — lowercase + trailing slash 제거 + invalid 무시) + @SkipOriginCheck() decorator (Reflector handler/class 우선) + ORIGIN_GUARD_DISABLED kill-switch + ORIGIN_GUARD_MODE=report 분기 + 한국어 학습 힌트 (`-H "Origin: http://localhost:3000"` 안내). **Phase 2** `f226b98` env.validation refine (CORS_ORIGIN production fail-closed + ORIGIN_GUARD_MODE enum + ORIGIN_GUARD_DISABLED) + AppModule APP_GUARD provider 글로벌 등록 + env.validation.test fixture 갱신 (5 신규 회귀). **Phase 3** `f82df37` `.env.example` 부트캠프 표준값 (localhost + Tailscale 100.102.41.122:{3000,3002}) + 모드 docs. **CRITICAL 3건 패치 결과**: (1) startsWith bypass → URL 객체 parse + exact match. (2) CORS_ORIGIN fail-OPEN → env.validation refine (1차 boot 거부) + OriginGuard runtime InternalServerErrorException (2차 안전망). (3) 운영 회귀 → SkipOriginCheck decorator + Report-Only 1주 + 한국어 학습 힌트 + kill-switch. **가드 순서**: OriginGuard (APP_GUARD 글로벌) → ThrottlerGuard / JwtAuthGuard (컨트롤러 @UseGuards). 학생 curl/Postman 차단이 throttle 카운터 소모 없이 즉시 일어남. **PR-10 시리즈 완료** (10a + 10b + 10c). **사용자 작업**: `.env CORS_ORIGIN` 부트캠프 표준값 + `ORIGIN_GUARD_MODE=report` + `sudo docker compose restart api`. 1주 후 enforce 전환 follow-up commit. | PR #56, `SESSION_2026-04-29.md` §12 |
| 2026-04-29 후속4 | **PR-12 web 토론 페이지 docs PR (consensus-012)** — 3+1 합의 (Agent A·B·C 병렬 + Reviewer). 합의율 만장일치 6.7% (1/15) / 유효 100% (15/15). 사용자 결정 15건 (Q-R5-01~15) 모두 Reviewer 권장값 채택 ("전부 권장"). **CRITICAL 5건 해소**: (C-1) 저장 형식 모순 → Markdown raw + 클라 단독 sanitize / (C-2) 클라 sanitize schema → 서버=클라 1:1 단일 모듈 / (C-3) HIGH-3 마스킹 → 서버 정규식 + 클라 글라스 블러 이중 / (C-4) hot 공식 → Reddit log10 + PG expression index 마이그레이션 1714000012000 / (C-5) discussion read 비인증 → @Public() 4종 + JwtAuthGuard 7종 분리. **사용자 추가 질문** "커뮤니티는 어디에 추가할지" → 옵션 A (질문 종속) + 옵션 C 후속 ADR-021 분리. Header 변경 없음 (시안 D §3.1). 진입점 = solo finished CTA round 별 + Hero `todayQuestion` 우하단 메타 칩. **B 단독 5건 중 4건 채택 — 다관점 시스템 가치 입증** (특히 항목 11 비인증 = ADR-코드 불일치). **신규 docs 4파일** (consensus-012 + SDD pr-12-discussion-page-design.md + tdd-plan + impact) + **ADR-020 §4.2.1 C / §5.3 / §6 / §9 / §11 패치**. **신규 의존성 6종**: react-markdown@^9 / rehype-sanitize@^6 / swr@^2 / @radix-ui/react-tabs / @axe-core/react / vitest-axe. **신규 마이그레이션 1**: 1714000012000 expression index. **추정 신규 cases ~103** (백엔드 38 + web 65). **추정 분량 3.5d** (ADR-020 §6 추정 2.5d + axe-core + 외부 검증). | `consensus-012-pr-12-discussion-page.md`, `pr-12-discussion-page-design.md`, `tdd-plan-pr-12-discussion-page.md`, `impact-pr-12-discussion-page.md`, ADR-020 §4.2.1 C / §5.3 / §6 / §9 / §11 |

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
