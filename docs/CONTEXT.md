# 프로젝트 컨텍스트 (Project Context)

> **AI 에이전트가 세션 시작 시 반드시 읽어야 하는 현재 상태 문서**

**최종 업데이트**: 2026-04-09 (저녁 — OSS 평가 트랙 단계 2~4 + week2-transactions 추가)

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
- ✅ **테스트 118개 GREEN** (단계 2~4 후)
- ✅ 1주차 sql-basics 시드 (빈칸 15 + 용어 15 + 화이트리스트, 멱등 부트 INSERT)
- ✅ **2주차 transactions 시드 (빈칸 15 + 용어 15 + 화이트리스트 24개)** ← 본 세션 추가
- ✅ 솔로 게임 종료 흐름 (`/finish` + `user_progress` 가중평균 갱신 + `answer_history` 자동 INSERT)
- ✅ 로그인/회원가입 UI + 인증 가드 + 전역 헤더 (토큰 헬퍼)
- ✅ AI 클라이언트 인프라 — `LlmClient` + **`LlmClientFactory`** (ollama provider 분기, opts override) + LangChain ChatAnthropic + ChatOllama + Langfuse callback
- ✅ `@anthropic-ai/sdk` 제거 (ADR-009 §마이그레이션)
- ✅ AI 문제 생성 파이프라인 — PromptManager + AiQuestionGenerator + BullMQ Processor + REST 엔드포인트
- ✅ **OSS 모델 평가 인프라** — Ollama 컨테이너, Langfuse self-host, sanity-check 5/5 PASS, EXAONE 4.0 GGUF import, Gold Set A/B 30+30
- 🔴 BullMQ 워커 + AI 문제 생성
- 🔴 노션 import → 범위 추론
- 🔴 **promptfoo 평가 하네스** (단계 5) — 다음 세션 시작점

### OSS 모델 평가 트랙 (feature/oss-model-eval 브랜치) — 단계 진행도

| 단계 | 작업 | 상태 | 커밋 |
|---|---|---|---|
| 0 | extractOracleTokens 공용 utils + TDD | ✅ | `c4bd454` |
| 1 | docker-compose 평가 인프라 + sanity check | ✅ | `9373de7` |
| 2 | EXAONE 4.0 GGUF 수동 import + 5/5 sanity | ✅ | `bab498a` |
| 3 | LlmClientFactory + ChatOllama + format/parser 실증 | ✅ | `f048951` |
| 4 | Gold Set A 30 + Gold Set B 30 (합성 → 검수 → 컴파일) | ✅ | `7c8850e` |
| (추가) | week2-transactions 시드 30 + 화이트리스트 24 | ✅ | `16dfbc9` |
| **5** | **promptfoo 설정 + assertion 7개 + langfuse-wrapped provider** | 🔴 다음 |
| 6 | 결과 JSON schema (감사용 N-05) + report-generator | 🔴 |
| 7 | eval.controller (관리자 전용 트리거) | 🔴 |
| 8 | Phase 0 Claude 베이스라인 R0 (300 호출) | 🔴 |
| 9 | R1~R4 평가 라운드 실행 | 🔴 |
| 10 | ADR-010 + 운영 모델 교체 | 🔴 |

### 다음 세션 우선순위

1. **단계 5 진입** — promptfoo 설정 + assertion 7개 (MT1~MT5/MT8 + korean-features) + langfuse-wrapped provider
2. **단계 6** — 결과 JSON schema + report-generator
3. **단계 7** — eval.controller
4. **단계 8** — Phase 0 Claude 베이스라인 (Anthropic API 크레딧 충전 필요)

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
