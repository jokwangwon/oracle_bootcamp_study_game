# 문서 인덱스 (Documentation Index)

> **프로젝트 문서 전체 구조 및 읽는 순서**

**최종 업데이트**: 2026-04-06

---

## 문서 읽는 순서 (권장)

### 1. 시작하기
1. **[README.md](../README.md)** — 프로젝트 개요, 비전, 개발 방법론
2. **[PROJECT_CONSTITUTION.md](constitution/PROJECT_CONSTITUTION.md)** — 프로젝트 헌법 (최상위 규칙)

### 2. 프로젝트 설계 (Oracle DBA 학습 게임)
3. **[oracle-dba-learning-game-design.md](architecture/oracle-dba-learning-game-design.md)** — Oracle DBA 학습 게임 SDD (3+1 합의 완료)

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
│   └── oracle-dba-learning-game-design.md       # Oracle DBA 학습 게임 SDD
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
│   └── ...
│
├── sessions/                             # 세션 로그
│   └── ...
│
└── review/                               # 검토 보고서
    └── ...
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
