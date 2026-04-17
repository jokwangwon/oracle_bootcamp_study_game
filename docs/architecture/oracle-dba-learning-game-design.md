# Oracle DBA 학습 게임 설계 (SDD)

> **Oracle DBA 부트캠프 용어/함수 암기를 위한 멀티플레이어 웹 게임 시스템 설계**

**최종 수정**: 2026-04-16 (v2.9 — 문제 형태 재설계 반영)
**상태**: 설계 확정 (3+1 합의 검증 완료, §4 파이프라인 v2 + 문제 형태 재설계 v2.9 반영)
**상위 문서**: `PROJECT_CONSTITUTION.md` 제3조, 제4조
**관련 ADR**: ADR-008 (기술 스택), ADR-009 (LangChain+Langfuse), ADR-010 (하네스 수정), ADR-011 (M3 primary), **ADR-012 (answerFormat 축), ADR-013 (3단 채점), ADR-014 (캡스톤), ADR-015 (실시간 사전 풀), ADR-016 (LLM-judge 안전), ADR-017 (MT6/MT7/MT8)**
**관련 합의**: `docs/review/consensus-001-oracle-dba-game.md`, `docs/review/consensus-004-problem-format-redesign.md`

---

## 1. 개요

### 1.1 문제 정의

Oracle DBA 부트캠프에서 배우는 SQL, PL/SQL, Administration 등의 용어와 함수는 양이 많고 체계적 암기가 어렵다. 교재를 반복해서 읽는 수동적 학습은 효과가 낮고, 면접/손코딩 시 즉각적인 회상(Active Recall)이 필요하다.

### 1.2 해결 방안

**게임 기반 능동적 학습 플랫폼**을 구축한다. 타이핑, 분류, 예측 등 다양한 인터랙션으로 직접 참여하며 암기하고, 실시간 멀티플레이어 경쟁으로 동기를 부여한다.

### 1.3 핵심 특성

| 항목 | 내용 |
|------|------|
| 대상 | 부트캠프 수강생 ~20명 |
| 플랫폼 | 웹 (브라우저) |
| 게임 모드 | 솔로 / 랭킹 경쟁 / 실시간 멀티플레이어 + **주차별 미니 캡스톤 / 최종 캡스톤(SQL·PL-SQL 2트랙)** |
| **문제 형태(v2.9)** | `GameMode × AnswerFormat` 직교 축 — answerFormat: multiple-choice / free-form / reorder / drag-compose / output-select / single-token (ADR-012) |
| 콘텐츠 | AI 자동 생성 (노션 수업 자료 기반) + 관리자 승인(`status='approved'`) |
| 학습 범위 | 주차별 점진 확장 (커리큘럼 연동) |
| 실시간 콘텐츠 | 실시간 중 AI 생성 금지 — 사전 생성 + 승인된 문제 풀 랜덤 매칭 (ADR-015) |
| 챌린지 완결 | 14주 코스 완결 + 주차별 미니 캡스톤 + 최종 캡스톤 선택 수료 (ADR-014) |

### 1.4 성공 기준

- 수강생들이 자주 접속하여 플레이한다 (주차별 신규 릴리스 + SR 복습 큐가 반복 동기 제공)
- 면접/손코딩 전 학습 도구로 활용된다
- 주차별 새 콘텐츠가 자동으로 추가된다
- **최종 캡스톤 완수율 ≥ 60% 목표** (SQL 또는 PL-SQL 트랙 1개 이상)

### 1.5 Primary OSS 모델 (ADR-011)

문제 생성 및 LLM-judge 채점에 사용되는 primary 모델은 **Qwen3-Coder-Next 80B MoE** (`qwen3-coder-next:latest`)로 확정되었다.

| 항목 | 값 |
|------|------|
| 모델 | Qwen3-Coder-Next 80B MoE (`qwen3-coder-next:latest`) |
| 추론 엔진 | Ollama 0.20.4 |
| 라이선스 | Apache 2.0 |
| Digest pin | `apps/api/src/modules/ai/eval/pins/` (fail-closed 부팅 검증) — ADR-011 조건 #2 |
| 운영 게이트 | MT3/MT4/MT5 + p95 ≤ 60s (C7) |
| 100건 모니터링 | `OpsModule` Phase A/B 완료 — ADR-011 조건 #3 |

### 1.6 메타 편향 주의문

다음 한계는 본 SDD의 모든 후속 결정에 적용된다 (ADR-011 §조건 #4 + ADR-017 확장).

1. **Gold Set 메타 편향**: 평가용 Gold Set A/B(60문제)는 본 프로젝트 도메인 편향을 가질 수 있으며, 부트캠프 현장의 실제 문제 분포와 완전히 일치하지 않는다. 100건 운영 샘플로 지속 검증한다.
2. **Ollama digest 무결성**: Ollama 런타임은 remote registry와 digest 체인을 보장하지 않는다. 본 프로젝트는 수동 pin + fail-closed 부팅 검증으로 재현성을 확보한다.
3. **SDK 전환 부채**: `@anthropic-ai/sdk` 직접 호출은 ADR-009로 금지되었으며, LangChain + Langfuse 외부 체인만 사용한다. 과거 코드 잔존 시 제거 의무.
4. **20명 규모 통계 유의성**: R2 평가(M1~M4)는 소표본이다. primary 선정 이후 운영 데이터가 축적되기 전에는 "M3가 항상 최적"이라 단정하지 않는다. P2(3개월 후) 이중 라우팅 재검토 예약.
5. **자기검증 편향 (Self-grading Bias, v2.9 신설 — ADR-013 + ADR-017)**: M3는 문제 생성 및 Layer 3 LLM-judge 채점에 동시 사용된다. 동일 모델 내 일관된 해석으로 인해 다른 모델이 판단했다면 다르게 분류될 수 있는 경계 케이스가 숨을 수 있다. **MT8 호출률 ≤ 10%** 게이트 유지 + 분기별 "M3 생성 + 타 모델 채점" 대조 샘플링(≥ 50건) 수행.
6. **모델 목적 적합성 주의 (Training Objective Mismatch, v2.9 신설 — ADR-017)**: Qwen3-Coder는 코드 *생성*에 튜닝되었으며 코드 *평가*에 최적이 아닐 수 있다. MT8 breach 또는 `grading_appeals` 집중 발생 시 **ADR-019(채점 전용 모델 분리)** 승격 트리거.

---

## 2. 시스템 아키텍처

### 2.1 아키텍처 패턴: Modular Monolith + WebSocket Gateway

3+1 에이전트 만장일치로 결정. 20명 규모에서 Microservices는 과잉이며, 모듈러 모놀리스가 개발 속도와 운영 단순성의 최적 균형.

```
┌─────────────────────────────────────────────────────────┐
│                        Client (Browser)                  │
│                        Next.js (React)                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 솔로 모드 │  │ 랭킹 보드 │  │ 대전 로비 │  │ 관리자  │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────┬────┘ │
└────────┼─────────────┼─────────────┼─────────────┼──────┘
         │ HTTP/REST   │ HTTP/REST   │ WebSocket   │ HTTP
         ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│                    NestJS Backend                         │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Auth Module  │  │ Game Module   │  │ Content Module │ │
│  │ (JWT, Guard) │  │ (5 GameModes) │  │ (AI Pipeline)  │ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘ │
│         │                │                    │          │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────┴────────┐ │
│  │ User Module │  │ WebSocket    │  │ BullMQ Worker  │ │
│  │ (Profile,   │  │ Gateway      │  │ (노션 파싱 →   │ │
│  │  Progress)  │  │ (Socket.IO)  │  │  AI 문제 생성)  │ │
│  └─────────────┘  └──────────────┘  └───────┬────────┘ │
└──────────┬───────────────┬───────────────────┼──────────┘
           │               │                   │
           ▼               ▼                   ▼
    ┌────────────┐  ┌────────────┐      ┌────────────┐
    │ PostgreSQL │  │   Redis    │      │  LLM API   │
    │ (영속 데이터)│  │ (세션,캐시, │      │ (Claude /  │
    │            │  │  게임상태)  │      │  OpenAI)   │
    └────────────┘  └────────────┘      └────────────┘
```

### 2.2 모듈 구조

| 모듈 | 책임 | 의존성 |
|------|------|--------|
| **AuthModule** | JWT 인증, 사용자 등록/로그인, Guard | UserModule |
| **UserModule** | 프로필, 학습 진도, 답변 이력 | PostgreSQL |
| **GameModule** | 6개 게임 모드 엔진(기존 5 + MultipleChoice), 점수 계산, 랭킹 | ContentModule, GradingModule, Redis |
| **GradingModule** (v2.9 신설) | 역피라미드 3단 채점(AST → 키워드 → LLM-judge) + 답안 sanitize + appeal 큐 (ADR-013/016) | LlmClient, Langfuse |
| **CapstoneModule** (v2.9 신설) | 주차별 미니 캡스톤 + 최종 캡스톤(SQL/PL-SQL 2트랙) 템플릿·스텝·세션 관리 (ADR-014) | GameModule, GradingModule |
| **MatchModule** (v2.9 신설) | 실시간 대전 사전 풀 매칭, `status='approved'` 강제, 주차 동기화 (ADR-015) | WebSocketGateway, Redis |
| **ContentModule** | AI 문제 생성, 문제 풀 관리, 주차별 범위 | BullMQ, LLM API |
| **OpsModule** (기존) | 운영 지표(MT3/MT4 + **MT6/MT7/MT8 v2.9**) 집계 + gate_breach 이벤트 (ADR-017) | PostgreSQL, ScheduleModule |
| **NotionModule** (기존) | 노션 증분 동기화 + 범위 추론 (§4.2) | BullMQ |
| **WebSocketGateway** | 실시간 대전, 방 관리, 동시 답변 판정 | GameModule, MatchModule, Redis |

### 2.3 기술 스택 (3+1 합의 확정)

| 레이어 | 기술 | 선택 근거 |
|--------|------|-----------|
| Language | TypeScript (Full-Stack) | 3자 만장일치. 프론트-백 타입 공유 |
| Frontend | Next.js (App Router) | SSR, React 생태계 |
| Backend | NestJS | Guard/Pipe 구조적 보안 강제 |
| Realtime | Socket.IO | Room 기반 멀티플레이어, 자동 재연결 |
| Job Queue | BullMQ | AI 생성 비동기 격리 |
| Database | PostgreSQL | ACID, 관계형 데이터 |
| Cache/State | Redis | 게임 상태, 랭킹(Sorted Set), 세션 |
| AI Provider | Claude API / OpenAI API | 콘텐츠 생성, structured output |
| AI Abstraction | **LangChain JS** (`langchain`, `@langchain/core`, `@langchain/anthropic`) | 추상화/체인/Output Parser. SDK 직접 호출 금지 (ADR-009) |
| AI Observability | **Langfuse** (`langfuse` JS SDK) | Trace, Eval, Prompt Versioning. 프롬프트 코드 외부화 (ADR-009 + 헌법 §8-2) |
| Deploy | Docker Compose | 단일 VPS (4GB RAM) |

---

## 3. 게임 모드 설계

### 3.1 공통 게임 엔진

모든 게임 모드는 `GameMode` 인터페이스를 구현한다 (Strategy Pattern).

> **v2.9 변경**: `EvaluationResult`에 부분점수/채점 레이어/grader digest 필드 추가. `AnswerFormat` 축이 `RoundConfig`에 직교로 도입됨 (ADR-012).

```typescript
interface GameMode {
  readonly id: string;                  // 'blank-typing' | 'term-match' | 'result-predict' | 'category-sort' | 'scenario-sim' | 'multiple-choice'
  readonly name: string;
  readonly description: string;
  readonly supportedTopics: Topic[];
  readonly supportedFormats: AnswerFormat[];  // v2.9: 이 모드가 허용하는 답안 형식 subset

  generateRound(config: RoundConfig): Promise<Round>;
  evaluateAnswer(round: Round, answer: PlayerAnswer): Promise<EvaluationResult>;  // v2.9: async (LLM-judge 대응)
  calculateScore(result: EvaluationResult): number;
}

type AnswerFormat =
  | 'single-token'       // 기본 빈칸 타이핑 (1개)
  | 'free-form'          // 자유 SQL 작성 (3단 채점 대상)
  | 'multiple-choice'    // 4지선다 / N지선다
  | 'reorder'            // 섞인 절 순서 재배열
  | 'drag-compose'       // 토큰 풀 → 문장 조립
  | 'output-select';     // 여러 결과 테이블 중 정답 선택

interface RoundConfig {
  topic: Topic;              // 예: 'sql-basics', 'plsql-functions'
  week: number;              // 주차 (학습 범위 제한)
  difficulty: Difficulty;    // EASY | MEDIUM | HARD
  answerFormat: AnswerFormat; // v2.9: ADR-012 직교 축
  timeLimit: number;         // 초 단위
}

interface EvaluationResult {
  verdict: 'correct' | 'incorrect' | 'held';  // v2.9: 'held'는 LLM-judge UNKNOWN → 관리자 큐
  partialScore: number;                       // v2.9: 0.0 ~ 1.0 (부분점수)
  correctAnswer?: string | string[];          // 오답 시 정답 공개용
  explanation?: string;                       // 해설
  gradingMethod: 'ast' | 'keyword' | 'llm-v1' | 'held' | 'admin-override';  // v2.9: ADR-013
  gradingLayersUsed: Array<1 | 2 | 3>;        // v2.9: [1] / [1,2] / [1,2,3]
  graderDigest: string;                       // v2.9: AST/keyword는 harness 버전, LLM은 모델 sha256
  rationale?: string;                         // v2.9: LLM-judge 근거 (held/incorrect 시)
}

interface Round {
  question: Question;
  correctAnswers: string[];  // 정답 (복수 허용)
  hints?: string[];
  metadata: {
    source: 'pre-generated' | 'ai-realtime';
    topic: Topic;
    week: number;
  };
}
```

### 3.2 게임 모드 상세

> **v2.9 변경 개요**: 아래 기존 5개 모드는 **전면 유지**된다. 추가로 Mode 6 `MultipleChoice`가 신설되었고, Mode 1 HARD에 `variant: 'multi-blank' | 'reorder' | 'select-compose'` 옵션이 추가되었다 (ADR-012). 모든 모드는 `supportedFormats` 배열로 허용 답안 형식을 선언한다.

#### Mode 1: 빈칸 타이핑 (BlankTypingMode)

**학습 효과**: SQL 문법이 손에 익음 (Motor Memory + Active Recall)
**지원 answerFormat**: `single-token` (기본), `free-form` (HARD), `reorder` (HARD variant), `drag-compose` (HARD variant)

```
┌─────────────────────────────────────────┐
│  SELECT * ____ employees                │
│  WHERE salary > 3000                    │
│  ORDER ____ salary DESC;                │
│                                          │
│  빈칸 1: [FROM          ] ← 타이핑     │
│  빈칸 2: [BY            ] ← 타이핑     │
│                                          │
│  ⏱ 15초  |  💯 850점  |  🔥 3연속 정답 │
└─────────────────────────────────────────┘
```

- **문제 생성**: 실제 SQL문에서 키워드/함수를 마스킹
- **난이도 조절**: EASY(1개 빈칸) → MEDIUM(2-3개) → HARD(전체 구문 작성 / v2.9 variant: multi-blank / reorder / select-compose)
- **채점**:
  - EASY/MEDIUM(`single-token`): 계산적 정확 일치 (대소문자 무시) + 부분 점수
  - HARD(`free-form`): **ADR-013 역피라미드 3단 채점** (AST → 키워드 → LLM-judge, §4.4 참조)
  - HARD variant(`reorder`/`drag-compose`): 순서/집합 비교 계산적 채점

#### Mode 2: 용어 맞추기 (TermMatchMode)

**학습 효과**: 용어 ↔ 의미 양방향 연결
**지원 answerFormat**: `single-token`, `multiple-choice`

```
┌─────────────────────────────────────────┐
│  "NULL 값을 다른 값으로 대체하는        │
│   Oracle 전용 함수는?"                  │
│                                          │
│  정답 입력: [NVL           ] ← 타이핑   │
│                                          │
│  💡 힌트: N으로 시작합니다 (3글자)      │
│  ⏱ 10초  |  💯 1200점                  │
└─────────────────────────────────────────┘
```

- **양방향**: "설명→용어" 또는 "용어→설명 선택" 모두 지원
- **힌트 시스템**: 시간 경과에 따라 첫 글자 → 글자 수 → 카테고리 순으로 힌트 제공
- **보너스**: 힌트 없이 정답 시 추가 점수

#### Mode 3: 결과 예측 (ResultPredictMode)

**학습 효과**: 함수 동작 원리 깊이 이해
**지원 answerFormat**: `multiple-choice`, `output-select` (v2.9: 결과 테이블 선택), `single-token` (직접 입력)

```
┌─────────────────────────────────────────┐
│  다음 SQL의 실행 결과는?                │
│                                          │
│  SELECT NVL(NULL, '없음') FROM DUAL;    │
│                                          │
│  ① 없음                                │
│  ② NULL                                │
│  ③ 에러 발생                            │
│  ④ 빈 문자열                            │
│                                          │
│  선택: [①] 또는 직접 입력: [없음    ]   │
│  ⏱ 20초                                 │
└─────────────────────────────────────────┘
```

- **객관식 + 주관식 혼합**: 쉬운 문제는 객관식, 어려운 문제는 직접 입력
- **코드 실행 시뮬레이션**: SQL 결과를 예측하는 훈련
- **오답 시 해설**: 왜 그 결과가 나오는지 짧은 설명 제공

#### Mode 4: 카테고리 분류 (CategorySortMode)

**학습 효과**: 개념 체계화, 분류 능력
**지원 answerFormat**: `drag-compose` (드래그앤드롭 기본)

```
┌─────────────────────────────────────────┐
│  다음 명령어를 올바른 카테고리로         │
│  분류하세요:                             │
│                                          │
│  [GRANT] [CREATE] [SELECT] [REVOKE]     │
│  [DROP]  [INSERT] [ALTER]  [COMMIT]     │
│                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ DDL │ │ DML │ │ DCL │ │ TCL │      │
│  │     │ │     │ │     │ │     │      │
│  │     │ │     │ │     │ │     │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                          │
│  드래그앤드롭으로 분류  |  ⏱ 30초      │
└─────────────────────────────────────────┘
```

- **드래그앤드롭 UI**: 직관적 인터랙션
- **주제별 카테고리 변형**: SQL 분류, 권한 유형, 백업 유형, 데이터 타입 등
- **연속 분류**: 맞출수록 한 번에 더 많은 항목 제시

#### Mode 5: 시나리오 시뮬레이션 (ScenarioMode)

**학습 효과**: 종합 응용력, 실무 감각
**지원 answerFormat**: `free-form` (SQL 작성, 3단 채점), `multiple-choice` (쉬운 단계), `single-token`

```
┌─────────────────────────────────────────┐
│  📋 시나리오:                           │
│                                          │
│  신입 사원 user1이 employees 테이블을   │
│  조회하려 하지만 권한이 없습니다.       │
│                                          │
│  ⚠ ORA-00942: table or view does not    │
│     exist                                │
│                                          │
│  DBA로서 해결하세요:                     │
│                                          │
│  SQL> [GRANT SELECT ON employees        │
│        TO user1;                    ]    │
│                                          │
│  ⏱ 45초  |  단계: 1/3                  │
└─────────────────────────────────────────┘
```

- **다단계 문제**: 하나의 시나리오를 여러 단계로 해결
- **실제 에러 메시지 기반**: ORA-XXXXX 에러 → 원인 파악 → 해결 SQL 작성
- **시각적 표현**: 권한 부족 → 자물쇠 아이콘, 해결 → 열림 등
- **채점**: `free-form` step은 ADR-013 3단 채점, 나머지는 계산적

#### Mode 6: 객관식 (MultipleChoiceMode) — v2.9 신설 (ADR-012)

**학습 효과**: SQLD 시험 대비 + 실시간 대전 핵심 모드 (단일 선택 ≤ 3초 판정)
**지원 answerFormat**: `multiple-choice` (단일/복수 선택)

```
┌─────────────────────────────────────────┐
│  다음 중 Oracle에서 NULL 처리 함수로     │
│  가장 적합한 것은?                      │
│                                          │
│  (a) ISNULL(x, 0)                       │
│  (b) NVL(x, 0)                          │
│  (c) IFNULL(x, 0)                       │
│  (d) COALESCE(x, 0)  ※ ANSI 표준        │
│                                          │
│  선택: ( ) a  (●) b  ( ) c  ( ) d       │
│  ⏱ 15초  |  💯 800점                   │
└─────────────────────────────────────────┘
```

- **distractor(오답 선지) 품질**: `mc-distractor-plausibility` assertion(promptfoo) 도입 검토 (ADR-017 주의사항)
- **복수 선택**: `multi: true`로 허용 시 집합 비교
- **실시간 대전 기본 모드**: 판정 지연 ≤ 100ms로 Socket.IO 라운드 적합 (ADR-015)
- **채점**: Set equality 비교 (대소문자 무시). LLM-judge 비호출.

### 3.3 주제별 게임 모드 매핑

> **v2.9**: 주차 제한(`week_min`)은 그대로 유지. `answerFormat` 축은 주차와 **무관**하게 직교 적용(사용자 결정 2026-04-16). 트랙 분리 없음.

| 수업 주제 | 추천 게임 모드 | 권장 answerFormat 조합 | 이유 |
|-----------|---------------|----------------------|------|
| SQL 기초 | 빈칸 타이핑, 용어 맞추기, **객관식** | single-token, multiple-choice | 기본 문법 반복 + SQLD 대비 |
| SQL 함수 | 결과 예측, 용어 맞추기, **객관식** | multiple-choice, output-select | 함수 동작 이해 |
| PL/SQL | 빈칸 타이핑, 시나리오 | free-form, multiple-choice | 구문 구조 + 프로시저 작성 |
| Administration | 시나리오, 카테고리 분류 | drag-compose, free-form | 관리 명령어 체계화 |
| 권한 관리 | 시나리오 (시각적) | free-form, multiple-choice | ORA 에러 → GRANT/REVOKE |
| Backup & Recovery | 카테고리 분류, 시나리오 | drag-compose, multiple-choice | 백업 유형 분류 + 복구 절차 |
| Performance Tuning | 결과 예측, 시나리오 | output-select, free-form | 실행 계획 분석 |
| SQL Tuning | 결과 예측, 빈칸 타이핑 | reorder, multiple-choice | 힌트 구문, 인덱스 |
| RAC | 카테고리 분류, 시나리오 | drag-compose, multiple-choice | 아키텍처 구성요소 이해 |
| **캡스톤(주차별)** | 혼합 (3~7 step) | 모든 형식 혼합 | 주차 학습 종합 (ADR-014) |
| **최종 캡스톤 SQL** | 혼합 (10~15 step) | free-form(50%) + mc(20%) + blank(20%) + output-select(10%) | DDL/DML/조인/집계/튜닝 종합 |
| **최종 캡스톤 PL-SQL** | 혼합 (10~15 step) | free-form(60%) + mc(20%) + blank(20%) | 프로시저/트리거/예외 종합 |

**의미 없는 조합 금지**: `term-match × reorder`, `category-sort × single-token` 등 교육 효과 낮은 조합은 시드 0건 정책. `AiQuestionGenerator`가 `supportedFormats` 화이트리스트 밖 조합 요청 시 422 응답.

### 3.4 게임 모드 JSON Config 예시

```json
{
  "id": "blank-typing",
  "name": "빈칸 타이핑",
  "config": {
    "timeLimit": { "easy": 20, "medium": 15, "hard": 10 },
    "blanksPerRound": { "easy": 1, "medium": 3, "hard": 5 },
    "scoring": {
      "base": 100,
      "timeBonus": true,
      "streakMultiplier": 1.5
    },
    "hints": {
      "enabled": true,
      "penaltyPercent": 30
    }
  }
}
```

---

## 4. AI 콘텐츠 파이프라인

### 4.1 전체 흐름

> **v2 변경 (2026-04-10)**: 3+1 합의(consensus-003) + 사용자 Q1~Q4 결정 반영.
> v1 다이어그램의 중앙 허브 구조(키워드 화이트리스트)를 유지하면서,
> 상단에 노션 추출 + LLM 정리 단계를 추가하고 검증 단계를 강화.
> **하이브리드 오케스트레이션**: Stage 간 전환은 BullMQ (영속성/재시도/스케줄),
> 각 Stage 내부는 LangChain Runnable로 감싸서 Langfuse trace 전 구간 적용.

```
┌──────────────┐
│  트리거       │  cron (BullMQ RepeatableJob) / 관리자 수동 호출
│  (Trigger)   │  POST /api/notion/sync
└──────┬───────┘
       │                          ┌─────────────────────────────┐
       │                          │  하이브리드 오케스트레이션    │
       │                          │                             │
       │                          │  Stage 간: BullMQ           │
       │                          │   → 영속성 (Redis)          │
       │                          │   → 재시도/실패 복구        │
       │                          │   → 스케줄/큐잉             │
       │                          │   → 진행률 모니터링          │
       │                          │                             │
       │                          │  Stage 내부: LangChain      │
       │                          │   → Runnable 래핑           │
       │                          │   → Langfuse trace 전 구간  │
       │                          │   → 입출력 타입 안전         │
       │                          └─────────────────────────────┘
       ▼
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│  노션 추출    │     │  LLM 문서      │     │  범위 추론        │
│  + 캐시      │────▶│  정리/구조화   │────▶│  (Scope Inference)│
│  (Stage 1)   │     │  (Stage 2)     │     │  (Stage 3)       │
│              │     │                │     │                  │
│  - 증분 동기화│     │  - sanitization│     │  - 주차 판별      │
│  - 마크다운   │     │  - 구조화 정리 │     │  - 키워드 추출    │
│    변환/보존  │     │  - 원본 병행   │     │  - 범위 태깅      │
│  - 상태 추적  │     │    저장        │     │  - MVP: 수동 입력 │
│              │     │                │     │                  │
│ Runnable     │     │ Runnable       │     │ Runnable         │
│ Lambda       │     │ Sequence       │     │ Lambda/Sequence  │
└──────────────┘     └────────────────┘     └────────┬─────────┘
                                                      │
  ◀──── BullMQ 큐: notion-sync ────▶                  │
  (Stage 1→2→3 하나의 Job, stage별 progress 갱신)      │
                                                      │
                      ┌───────────────────────────────┘
                      │
                      ▼
             ┌────────────────┐
             │  키워드         │  ◀── 중앙 허브 (v1 구조 유지)
             │  화이트리스트   │
             │  (weekly_scope) │
             │                │
             │  주차별 허용    │
             │  용어/함수 목록 │
             └───┬────────┬───┘
                 │        │
        ┌────────┘        └────────┐
        ▼                          ▼
┌──────────────────┐     ┌──────────────────┐
│  문제 생성        │     │  검증             │
│  (Stage 4)       │     │  (Stage 5)       │
│  (AI Generation)  │     │  (Validation)     │
│                  │     │                  │
│  - 모드별 문제    │────▶│  ① 스키마 (Zod)   │
│  - 난이도별 생성  │     │  ② 키워드 매칭    │
│  - 정답 + 해설    │     │  ③ 중복 검사      │
│  - Langfuse trace│     │  ④ sanitization   │
│                  │     │  ⑤ 범위 이탈 차단 │
│ Runnable         │     │                  │
│ Sequence         │     │ RunnableLambda   │
│ (AiQuestion      │     │ (ScopeValidator) │
│  Generator 재사용)│     │                  │
└──────────────────┘     └────────┬─────────┘
                                  │
  ◀──── BullMQ 큐: ai-question-generation ────▶
  (Stage 4→5 하나의 Job)                       │
                                               │
                                  ┌────────────┘
                                  ▼
                         ┌──────────────────┐
                         │  문제 풀 저장     │
                         │  (Question Pool)  │
                         │                  │
                         │  status:          │
                         │  'pending_review' │
                         │  주차별·모드별    │
                         └──────────────────┘
```

**v1 대비 변경 사항:**

| 영역 | v1 | v2 (현재) |
|------|-----|----------|
| 상단 | 노션 입력 1박스 | 트리거 + 노션 추출(증분) + LLM 정리 + 범위 추론 (4박스) |
| 중앙 | 키워드 화이트리스트 (중앙 허브) | **그대로 유지** — weekly_scope 테이블 |
| 검증 | 키워드 매칭, 스키마, 범위 차단 (3항목) | + 중복 검사, sanitization (5항목) |
| 저장 | status 미명시 | status='pending_review' 명시 |
| 오케스트레이션 | 미명시 | **하이브리드** — BullMQ(Stage 간) + LangChain Runnable(Stage 내부) |

**하이브리드 오케스트레이션 원칙:**

1. **Stage 간 전환 = BullMQ**
   - 영속성: Redis에 Job 상태 저장 → crash 시 마지막 성공 Stage부터 재개
   - 재시도: `attempts`, `backoff` 내장
   - 스케줄: `RepeatableJob`으로 cron 지원
   - 모니터링: `job.updateProgress({ stage: N })` + Bull Board
   - 동시 실행 방지: Job ID에 `database_id` 포함

2. **Stage 내부 = LangChain Runnable**
   - 모든 Stage를 `RunnableLambda` 또는 `RunnableSequence`로 래핑
   - LLM 호출 Stage(2, 3, 4)는 `ChatModel.pipe(StructuredOutputParser)`
   - 비-LLM Stage(1, 5)도 `RunnableLambda`로 래핑하여 Langfuse trace 통합
   - Langfuse `CallbackHandler`가 전 구간에 걸쳐 자동 trace

3. **BullMQ 큐 구성:**
   - `notion-sync`: Stage 1→2→3 (하나의 Job, stage별 progress 갱신)
   - `ai-question-generation`: Stage 4→5 (기존 큐 재사용)
   - `notion-sync` Job 완료 시 `ai-question-generation` Job을 자동 enqueue (BullMQ FlowProducer)

```typescript
// Stage 내부 LangChain Runnable 구성 예시 (의사 코드)

// Stage 1: 노션 추출 (계산적이지만 Runnable로 래핑 → Langfuse trace)
const stage1 = new RunnableLambda({ func: notionDeltaExtract });

// Stage 2: LLM 문서 정리
const stage2 = RunnableSequence.from([
  new RunnableLambda({ func: inputSanitize }),
  chatModel.pipe(structuredOutputParser),
  new RunnableLambda({ func: saveStructuredContent }),
]);

// Stage 3: 범위 분석 (MVP: 수동, Phase 2: LLM)
const stage3 = new RunnableLambda({ func: scopeAnalysisOrManual });

// Stage 4: 문제 생성 (기존 AiQuestionGenerator — 이미 LangChain)
const stage4 = RunnableSequence.from([
  promptTemplate,
  chatModel.pipe(structuredOutputParser),
]);

// Stage 5: 검증 + 저장 (계산적이지만 Runnable로 래핑)
const stage5 = new RunnableLambda({ func: validateAndSave });
```

### 4.2 노션 추출 + 범위 추론 (Notion Sync & Scope Inference)

> **v2 변경 (2026-04-10)**: 3+1 합의(consensus-003) 반영.
> Stage 1~3의 상세 설계. 증분 동기화, LLM 문서 정리, 상태 관리 추가.

#### 4.2.1 Stage 1 — 노션 증분 추출 + 마크다운 캐시

**Notion API 클라이언트**: `@notionhq/client` SDK 직접 사용.
LangChain NotionAPILoader는 증분 추출(delta sync)을 지원하지 않으므로 채택하지 않는다.
Notion은 LLM 공급자가 아니므로 ADR-009 적용 범위 밖이다.

**LangChain 래핑**: Notion API 호출 자체는 `@notionhq/client`이지만,
Stage 1 전체를 `RunnableLambda`로 감싸서 Langfuse trace에 포함시킨다.
이는 파이프라인 전 구간의 관측 가능성(observability)을 보장한다.

**증분 추출 전략:**

```
1. notion_sync_state 테이블에서 last_synced_at 조회
2. Notion DB query: filter = { last_edited_time: { after: last_synced_at } }
3. has_more + next_cursor 페이지네이션으로 전체 변경분 수집
4. 각 페이지의 블록을 마크다운으로 변환 (계산적)
5. 마크다운 원본을 notion_documents 테이블에 저장 (캐시)
6. notion_sync_state.last_synced_at 갱신
```

**동기화 상태 테이블:**

```sql
CREATE TABLE notion_sync_state (
  id            SERIAL PRIMARY KEY,
  database_id   VARCHAR(36) NOT NULL UNIQUE,  -- Notion DB ID
  last_synced_at TIMESTAMPTZ,                 -- 마지막 성공 동기화 시각
  last_cursor   TEXT,                         -- 페이지네이션 커서 (실패 복구용)
  status        VARCHAR(20) DEFAULT 'idle',   -- idle | syncing | error
  error_message TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**마크다운 캐시 테이블:**

```sql
CREATE TABLE notion_documents (
  id              SERIAL PRIMARY KEY,
  notion_page_id  VARCHAR(36) NOT NULL UNIQUE,  -- Notion 페이지 ID
  title           TEXT NOT NULL,
  raw_markdown    TEXT NOT NULL,                 -- 원본 마크다운 (불변 보존)
  structured_content TEXT,                       -- Stage 2 LLM 정리 결과
  week            INT,                           -- Stage 3에서 매핑
  topic           VARCHAR(50),                   -- Stage 3에서 매핑
  last_edited_at  TIMESTAMPTZ,                   -- Notion 측 수정 시각
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**엣지 케이스 처리:**

| 시나리오 | 대응 |
|---------|------|
| 노션 페이지 삭제/이동 | 404 → soft-delete (notion_documents.status='deleted'), 기존 scope 유지 |
| 리치 텍스트/임베드/DB 뷰 | 지원 블록 타입 화이트리스트, 미지원 타입은 skip + 로깅 |
| API rate limit (3 req/s) | BullMQ rate limiter 또는 p-limit으로 동시성 제어 |
| 동기화 중 실패 | last_cursor로 이어서 재개, status='error' + error_message 기록 |

**트리거:**

| 방식 | 구현 | 용도 |
|------|------|------|
| cron 스케줄 | BullMQ `RepeatableJob` | 주기적 자동 동기화 (주기는 관리자 설정) |
| 수동 호출 | `POST /api/notion/sync` (관리자 전용) | 즉시 동기화 필요 시 |

두 방식 모두 동일한 BullMQ `notion-sync` 큐를 사용한다.
동시 트리거 방지: BullMQ Job ID에 `database_id` 포함하여 중복 job 거부.

**환경변수 (ADR-006 정합):**

```env
NOTION_API_TOKEN=secret_...            # Notion integration token (read-only scope)
NOTION_DATABASE_ID=abc123...           # 대상 노션 DB ID
NOTION_SYNC_CRON=0 0 * * 1            # cron 표현식 (기본: 매주 월요일 자정)
```

#### 4.2.2 Stage 2 — LLM 문서 정리/구조화

> **사용자 결정 Q4**: LLM 문서 정리는 자동화 로직에 필수.
> 3+1 합의에서 제거가 권고되었으나, 사용자가 유지를 결정함.
> Agent B의 위험 완화 방안을 적용한다.

**목적**: 노션 원문(코드 예제, 필기, 강사 자료 혼합)을 LLM이 문제 생성에 활용하기 좋은 구조로 정리한다.

**프로세스:**

```
입력: notion_documents.raw_markdown (원본)

Step 1: 입력 sanitization (계산적, LLM 호출 전)
  → 코드 블록과 일반 텍스트 분리
  → 지시형 텍스트 패턴 필터링 (프롬프트 인젝션 방지)
  → 길이 제한 (모델 컨텍스트 윈도우 고려)

Step 2: LLM 구조화 (추론적)
  → LangChain ChatModel + StructuredOutputParser
  → Langfuse trace 자동 기록
  → 프롬프트: Langfuse Prompt Management 등록
  → 출력: 주제별 정리된 학습 내용 (코드 예제 포함)

Step 3: 결과 저장
  → notion_documents.structured_content에 저장
  → raw_markdown은 불변 보존 (감사 추적)
  → 원본과 정리 결과 양쪽 모두 접근 가능
```

**안전 장치:**
- 원본(`raw_markdown`)은 절대 덮어쓰지 않는다
- 정리 결과의 키워드 누락 체크: `extractOracleTokens(원본)` ⊆ `extractOracleTokens(정리결과)` 계산적 후검증
- 후검증 실패 시: 경고 로깅 + 원본 기반 fallback

#### 4.2.3 Stage 3 — 범위 분석

```
MVP (현재):
  → 관리자가 수동으로 weekly_scope 키워드 입력
  → 시드 데이터 패턴 유지 (week1-sql-basics.scope.ts 등)

Phase 2 (자동화):
  입력: notion_documents.structured_content (Stage 2 결과)

  Step 1: 키워드 추출
    → SQL 키워드, 함수명, Oracle 고유 용어 식별
    → extractOracleTokens() 계산적 추출 우선
    → LLM 보조: 문맥 기반 키워드 보완 (계산적 추출이 놓치는 암묵적 용어)

  Step 2: 주차/주제 매핑
    → 추출된 키워드를 커리큘럼 매핑 테이블과 대조
    → 커리큘럼: SQL → PL/SQL → Admin → Backup → Perf → SQL Tuning → RAC

  Step 3: 범위 태깅
    → 각 키워드에 (주차, 주제, 난이도) 태그 부여
    → 새로운 키워드 발견 시 → 해당 주차 화이트리스트에 추가

  Step 4: weekly_scope upsert
    → 기존 키워드와 병합 (추가만, 삭제는 관리자 수동)
```

### 4.3 문제 생성 (Question Generation)

> **구현 강제 사항** (ADR-009): 모든 LLM 호출은 LangChain Chat Model을 통해 이루어지며, Langfuse Callback Handler가 자동으로 trace를 기록한다. 프롬프트는 Langfuse Prompt Management로 외부화되어 코드에 하드코딩되지 않는다. 출력은 LangChain `StructuredOutputParser` + 기존 `questionContentSchema` (Zod)로 검증된다.

```
입력: (주차, 주제, 게임모드, 난이도, 수량)

게임모드별 생성 프롬프트 (Langfuse Prompt Management에 등록):

BlankTyping:
  "다음 조건의 SQL문을 생성하고, 지정된 키워드를 빈칸으로 마스킹하세요.
   주차: {week}, 주제: {topic}, 난이도: {difficulty}
   사용 가능한 키워드: {whitelist}
   출력 형식: { sql: string, blanks: [{position, answer, hint}] }"

TermMatch:
  "다음 키워드에 대한 설명 문제를 생성하세요.
   키워드 목록: {whitelist에서 랜덤 선택}
   출력 형식: { term: string, description: string, category: string }"

ResultPredict:
  "다음 조건의 SQL 실행 결과 예측 문제를 생성하세요.
   사용 함수: {whitelist에서 함수만 필터}
   출력 형식: { sql: string, result: string, options: string[], explanation: string }"

CategorySort:
  "다음 주제의 카테고리 분류 문제를 생성하세요.
   주제: {topic}
   출력 형식: { items: [{name, category}], categories: string[] }"

Scenario:
  "다음 주제의 시나리오 문제를 생성하세요.
   주제: {topic}, 난이도: {difficulty}
   출력 형식: { scenario: string, steps: [{description, expectedSql, hint}], oraError?: string }"

---

v2.9 신규 프롬프트 (ADR-012 answerFormat 축):

MultipleChoice:
  "다음 조건의 Oracle SQL 객관식 문제를 생성하세요.
   주차: {week}, 주제: {topic}, 난이도: {difficulty}
   사용 가능한 키워드: {whitelist}
   선지 수: {optionCount} (기본 4)
   제약: distractor(오답 선지)는 '명백한 오답'이 아니라 '잘 아는 사람이 아니면 헷갈릴 수준'으로 생성.
   출력 형식: { stem: string, options: [{id: 'a'|'b'|'c'|'d', text: string}], correctIds: string[], explanation: string, multi?: boolean }"

FreeFormSql:
  "다음 조건의 자유 SQL 작성 문제를 생성하세요.
   주차: {week}, 주제: {topic}, 난이도: {difficulty}
   사용 가능한 키워드: {whitelist}
   요구사항: 정답 SQL은 최소 2개 이상의 동치 표현을 함께 제공 (ANSI JOIN vs (+), 서브쿼리 vs JOIN 등).
   출력 형식: { prompt: string, schemaDDL: string, correctSqls: string[], keyTokens: string[], explanation: string }"

Reorder:
  "다음 조건의 SQL 절 재배열 문제를 생성하세요.
   주차: {week}, 주제: {topic}
   출력 형식: { prompt: string, shuffledClauses: string[], correctOrder: number[], explanation: string }"

DragCompose:
  "다음 조건의 토큰 풀 조립 문제를 생성하세요.
   주차: {week}, 주제: {topic}
   출력 형식: { prompt: string, tokenPool: string[], correctSequence: string[], distractorTokens: string[], explanation: string }"

OutputSelect:
  "다음 SQL의 실행 결과 테이블을 4개의 후보 중 정답 하나로 제시하세요.
   출력 형식: { sql: string, candidateTables: [{id, rows: string[][]}], correctId: string, explanation: string }"

Capstone (ADR-014 — 주차별 미니 + 최종 2트랙):
  "다음 주제의 캡스톤 단계를 생성하세요.
   kind: 'weekly' | 'final', track?: 'sql' | 'plsql', topicPack: {pack},
   schema: {schemaDDL}, stepOrder: {n}, 이전 step: {previousSteps}
   출력 형식: { prompt: string, answerFormat: AnswerFormat, questionContent: {...}, correctAnswer: string[], dependsOnStepIds: string[] }"
```

### 4.4 검증 파이프라인 (Validation)

> **v2.9 재구성**: "문제 생성 검증"과 "답안 채점"을 별도 서브섹션으로 분리. CLAUDE.md §2 "계산적 > 추론적" 원칙 공통 적용.

#### 4.4.1 문제 생성 검증 (기존)

계산적 검증을 우선 적용하고, 추론적 검증은 보조로만 사용한다.

```
생성된 문제
    │
    ▼
① 스키마 검증 (Zod) — 계산적
  → 필수 필드 존재 여부, 타입 검증
  → answerFormat별 discriminated union 분기 (v2.9)
  → 실패 시: 재생성 요청 (최대 2회)
    │
    ▼
② 키워드 화이트리스트 매칭 — 계산적
  → 문제에 사용된 용어가 해당 주차 범위 내인지 확인
  → 범위 이탈 시: 해당 문제 폐기
    │
    ▼
③ 중복 검사 — 계산적
  → 기존 문제 풀과 유사도 비교 (정답 + 구조 해시)
  → 80% 이상 유사 시: 폐기
    │
    ▼
④ sanitization — 계산적 (ADR-016)
  → Unicode control char 제거, 코드 블록 구분자 정규화
  → instruction 의심 키워드 스캔 → [SUSPICIOUS] 플래그
    │
    ▼
⑤ answerFormat 호환성 검사 (v2.9)
  → GameMode.supportedFormats 배열에 포함되는지 확인
  → 미호환 시: 422 응답, 큐에서 폐기
    │
    ▼
⑥ 문제 풀 저장
  → status: 'pending_review' (관리자 승인 대기)
  → 관리자 approval 후 status: 'approved' — 실시간 풀 진입 자격 (ADR-015)
```

#### 4.4.2 답안 채점 파이프라인 — 역피라미드 3단 (v2.9 신설, ADR-013)

자유 SQL 작성(`answerFormat = 'free-form'`) 답안은 실 Oracle 실행 없이 다음 3단 파이프라인으로 채점한다. 상위 레이어에서 판정 시 하위는 호출하지 않는다.

```
학생 답안 제출
    │
    ▼
Layer 1 — AST Canonicalize (계산적, 항상 실행)
  → node-sql-parser + Oracle 방언 화이트리스트
  → identifier case fold, alias 통일, 공백/주석 제거, 절 순서 표준화
  → 정답 템플릿(question.answer 배열)과 구조적 동치 비교
  │
  ├─ PASS → is_correct = true, 종료
  ├─ FAIL → is_correct = false, 종료
  └─ UNKNOWN (방언 미지원) → Layer 2
    │
    ▼
Layer 2 — Keyword/Token Coverage (계산적, 필수)
  → extractOracleTokens (기존 재사용)
  → coverage = |T_expected ∩ T_student| / |T_expected|
  → extra_penalty = |T_student \ allowlist(week)| * 0.05
  → partial_score = max(0, coverage - extra_penalty)
  │
  ├─ partial_score ≥ 0.95 → PASS
  ├─ partial_score < 0.3 → FAIL
  └─ AMBIGUOUS → Layer 3
    │
    ▼
Layer 3 — LLM-judge (추론적, UNKNOWN/AMBIGUOUS일 때만)
  → ADR-016 안전 프로토콜 전체 적용:
    · <student_answer> 경계 태그 + 길이 제한 2048
    · instruction 정규식 스캔 → [SUSPICIOUS_INPUT] 헤더
    · temperature=0, seed=42
    · StructuredOutputParser + Zod schema 강제
    · Langfuse PII 필터 (해시 저장)
  → 출력: { verdict: PASS|FAIL|UNKNOWN, rationale, confidence }
  │
  ├─ verdict = PASS → is_correct = true
  ├─ verdict = FAIL → is_correct = false
  └─ verdict = UNKNOWN → grading_method='held', 관리자 큐 이관
```

**제약**:
- Layer 1 미실행 시 Layer 3 호출 차단 (런타임 assert)
- **MT8 게이트 — Layer 3 호출률 ≤ 10%** (ADR-017 `llm-judge-invocation-ratio`)
- 실시간 대전에서 `free-form` 비허용 (ADR-015, 채점 지연 우려)

**기록**: `answer_history`에 `grading_method` / `grading_layers_used` / `partial_score` / `grader_digest` 누적. WORM(append-only) 강제 (ADR-016).

### 4.5 사전 생성 문제 풀 (Pre-generated Pool)

> **v2.9 갱신 (ADR-015)**: AI API/Ollama 장애 대비 역할 + **실시간 대전 전용 풀**(AI 호출 배제) 역할 겸직. `status='approved'` 강제.

주차별 × answerFormat 조합당 **최소 50문제** 하한 유지. 일간 cron `realtime-pool-refill`이 하한 미달 시 BullMQ 생성 배치를 자동 enqueue.

| 주차 | 주제 | 모드 × answerFormat 조합 최소 수 |
|------|------|---------------------------------|
| 1주차 | SQL 기초 | blank-typing×single-token 15 + term-match×single-token 15 + **multiple-choice×mc 20** + result-predict×mc 10 + category-sort×drag 5 + scenario×free-form 5 |
| 2주차 | SQL 함수 | blank×single-token 10 + term×single-token 15 + **mc×mc 20** + result-predict×output-select 15 + scenario×free-form 5 |
| ... | ... | ... |

**주간 릴리스**: 관리자가 매주 새 `approved` 배치를 공개 → 실시간 풀 갱신 + "오늘의 챌린지" 유도.

---

## 5. 데이터 모델

### 5.1 PostgreSQL ERD

> **v2.9 변경**: `questions.answer_format` 컬럼 추가 (ADR-012), `answer_history` 확장(grading_method/grader_digest/partial_score, WORM), 신규 엔티티 `capstone_templates`/`capstone_steps`/`capstone_sessions` (ADR-014), `grading_appeals` (ADR-016), `ops_question_measurements`/`ops_event_log` 컬럼 확장 (ADR-017).

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│    users     │     │   game_sessions  │     │     questions      │
├──────────────┤     ├──────────────────┤     ├────────────────────┤
│ id (PK)      │     │ id (PK)          │     │ id (PK)            │
│ username     │──┐  │ host_id (FK)     │     │ topic              │
│ email        │  │  │ mode             │     │ week               │
│ password_hash│  │  │ status           │     │ game_mode          │
│ role         │  │  │ config (JSONB)   │     │ answer_format      │ ← v2.9
│ created_at   │  │  │ created_at       │     │ difficulty         │
└──────────────┘  │  └──────────────────┘     │ content (JSONB)    │
                  │                            │ answer (JSONB)     │
┌──────────────┐  │  ┌──────────────────┐     │ explanation        │
│ user_progress│  │  │ session_players  │     │ status             │  'pending_review' | 'approved'
├──────────────┤  │  ├──────────────────┤     │ source             │
│ id (PK)      │  │  │ session_id (FK)  │     │ created_at         │
│ user_id (FK) │──┘  │ user_id (FK)     │     └────────────────────┘
│ topic        │     │ score            │
│ week         │     │ answers (JSONB)  │     ┌────────────────────┐
│ total_score  │     │ rank             │     │  answer_history    │ (WORM, v2.9 확장)
│ games_played │     └──────────────────┘     ├────────────────────┤
│ accuracy     │                              │ id (PK)            │
│ streak       │     ┌──────────────────┐     │ user_id (FK)       │
│ last_played  │     │   weekly_scope   │     │ question_id (FK)   │
└──────────────┘     ├──────────────────┤     │ answer (text)      │
                     │ id (PK)          │     │ is_correct         │
┌──────────────┐     │ week             │     │ partial_score      │ ← v2.9 (0..1)
│  rankings    │     │ topic            │     │ time_taken_ms      │
├──────────────┤     │ keywords (JSONB) │     │ game_mode          │
│ id (PK)      │     │ source_url       │     │ answer_format      │ ← v2.9
│ user_id (FK) │     │ created_at       │     │ grading_method     │ ← v2.9
│ topic        │     └──────────────────┘     │ grading_layers_used│ ← v2.9 (int[])
│ week         │                              │ grader_digest      │ ← v2.9
│ score        │                              │ created_at         │
│ rank         │                              └────────────────────┘
│ updated_at   │
└──────────────┘

v2.9 신규 — 캡스톤 (ADR-014)

┌────────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  capstone_templates     │    │  capstone_steps       │    │  capstone_sessions    │
├────────────────────────┤    ├──────────────────────┤    ├──────────────────────┤
│ id (PK)                │    │ id (PK)              │    │ id (PK)              │
│ slug (uniq)            │    │ template_id (FK)     │    │ user_id (FK)         │
│ kind 'weekly'|'final'  │    │ step_order           │    │ template_id (FK)     │
│ track 'sql'|'plsql'|null│◀──│ prompt               │    │ seed                 │
│ week (nullable)        │    │ answer_format        │    │ started_at           │
│ title                  │    │ question_content jsb │    │ completed_at         │
│ description            │    │ correct_answer[]     │    │ status               │
│ schema_ddl             │    │ depends_on_step_ids[]│    │ step_progress (jsonb)│
│ topic_pack             │    └──────────────────────┘    └──────────────────────┘
│ total_steps            │
│ status 'draft'|'approved'│
└────────────────────────┘

v2.9 신규 — Grading Appeals (ADR-016, WORM의 override 경로)

┌──────────────────────────┐
│     grading_appeals       │
├──────────────────────────┤
│ id (PK)                  │
│ answer_history_id (FK)   │
│ user_id (FK)             │
│ reason                   │
│ status 'pending'|'resolved'|'rejected' │
│ admin_reviewer (FK users)│
│ resolution               │
│ created_at               │
│ resolved_at              │
└──────────────────────────┘

기존 (OpsModule, v2.9 컬럼 확장 — ADR-017)

┌──────────────────────────────┐    ┌──────────────────────┐
│ ops_question_measurements     │    │   ops_event_log       │
├──────────────────────────────┤    ├──────────────────────┤
│ id (PK)                      │    │ id (PK)              │
│ question_id (FK)             │    │ kind (varchar)       │  v2.9 신규 kind: mt6_breach /
│ mode                  ← v2.9 │    │ payload (jsonb)      │   mt7_breach / mt8_breach /
│ answer_format         ← v2.9 │    │ created_at           │   capstone_similarity_alert /
│ grading_method        ← v2.9 │    └──────────────────────┘   grading_appeal / admin_override
│ mt3_scope_violation          │
│ mt4_blank_consistency        │
│ mt6_canonical_match   ← v2.9 │
│ mt7_step_consistency  ← v2.9 │
│ mt8_llm_invocation    ← v2.9 │
│ measured_at                  │
└──────────────────────────────┘
```

### 5.2 핵심 테이블 설명

| 테이블 | 용도 | 핵심 필드 |
|--------|------|-----------|
| `users` | 사용자 계정 | role: 'player' \| 'admin' |
| `user_progress` | 주차/주제별 학습 진도 | accuracy (정답률), streak (연속 정답) |
| `questions` | 문제 풀 | content (JSONB), **`answer_format` (v2.9)**, status: `'pending_review'` \| `'approved'` |
| `answer_history` | 답변 이력 (WORM, **v2.9 확장**) | `is_correct`, `partial_score`, `grading_method`, `grading_layers_used`, `grader_digest`, `answer_format` — UPDATE 권한 회수(ADR-016) |
| `game_sessions` | 멀티플레이어 세션 | mode, config (JSONB — 모드별 설정) |
| `session_players` | 세션 참가자 | score, rank, answers (JSONB — 라운드별 답변) |
| `weekly_scope` | 주차별 학습 범위 | keywords (JSONB — 허용 키워드 리스트) |
| `rankings` | 주차/주제별 랭킹 | Redis Sorted Set의 영속화 스냅샷 |
| **`capstone_templates`** (v2.9, ADR-014) | 캡스톤 템플릿 정의 | `kind`(weekly/final), `track`(sql/plsql), `week`, `topic_pack`, `schema_ddl` |
| **`capstone_steps`** (v2.9, ADR-014) | 단계별 문제 | `step_order`, `answer_format`, `question_content`, `depends_on_step_ids` (DAG) |
| **`capstone_sessions`** (v2.9, ADR-014) | 사용자별 실행 상태 | `seed` (hash(userId, week, templateId)), `step_progress` (jsonb, append-only) |
| **`grading_appeals`** (v2.9, ADR-016) | 채점 이의제기 | `answer_history_id`, `status`, `admin_reviewer`, `resolution` |
| `ops_question_measurements` (v2.9 컬럼 확장) | 운영 지표 샘플 | `mode`, `answer_format`, `grading_method`, MT3/MT4/**MT6/MT7/MT8** |
| `ops_event_log` (v2.9 kind 확장) | 운영 이벤트 | kind 신규: `mt6_breach` / `mt7_breach` / `mt8_breach` / `capstone_similarity_alert` / `grading_appeal` / `admin_override` |

### 5.3 Redis 데이터 구조

```
# 실시간 게임 방 상태
game:room:{roomId} → Hash {
  host, mode, status, currentRound, players[]
}

# 실시간 랭킹 (주차별)
ranking:week:{week} → Sorted Set {
  userId: score
}

# 전체 랭킹
ranking:total → Sorted Set {
  userId: totalScore
}

# 동시 답변 순서 판정
game:room:{roomId}:round:{roundId}:answers → Sorted Set {
  userId: timestamp (ZADD로 원자적)
}

# 문제 캐시 (주차별)
cache:questions:week:{week}:mode:{mode} → List [questionId, ...]

# 사용자 세션
session:{sessionId} → Hash { userId, ... }
```

---

## 6. 플레이 모드별 흐름

### 6.1 솔로 모드

```
사용자 → 주차/모드/난이도 선택
    │
    ▼
문제 풀에서 문제 로드 (캐시 우선)
    │
    ▼
라운드 시작 (타이머)
    │
    ├── 정답 → 점수 계산 (시간 보너스 + 연속 정답)
    │         → 다음 문제
    │
    └── 오답 → 정답 + 해설 표시
              → answer_history 기록
              → 다음 문제
    │
    ▼
세트 완료 → 결과 요약 (정답률, 점수, 취약 분야)
         → user_progress 업데이트
         → 랭킹 반영
```

### 6.2 실시간 대전 모드

> **v2.9 재정의 (ADR-015)**: Socket.IO 경로 유지. **실시간 중 AI 문제 생성 금지** — `status='approved'` 사전 생성 풀에서 랜덤 매칭. p95 지연 불확실성 제거.

**핵심 제약**:
- 실시간 라운드 = `MatchService.startBattle()`이 **DB 조회만** 수행 (AI 호출 0건)
- 문제 조건: `status = 'approved'` AND `week ≤ 두 플레이어 current_week 교집합` AND `answer_format IN {multiple-choice, single-token, output-select}`
- **`free-form` 실시간 비허용** (채점 지연 우려, ADR-013 Layer 3 호출 가능성)
- 라운드 수 5 / 문제당 60초 / 배틀 최대 10분

```
호스트 → 방 생성 (answerFormat 화이트리스트 적용)
    │
    ▼
참가자 입장 (WebSocket 연결, current_week 교환)
    │
    ▼
게임 시작 (호스트 트리거)
    │
    ▼
MatchService.pickQuestions()
  → SELECT * FROM questions
    WHERE status='approved'
      AND week ≤ min(users.current_week)
      AND answer_format IN (allowed_formats)
    ORDER BY RANDOM()
    LIMIT 5
  → Redis 배틀 상태 저장
    │
    ▼
┌─ 라운드 루프 ──────────────────────────────┐
│                                              │
│  서버 → 전체 플레이어에게 동일 문제 전송     │
│      │                                       │
│      ▼                                       │
│  각 플레이어 → 답변 제출 (WebSocket)          │
│      │                                       │
│      ▼                                       │
│  Redis ZADD로 답변 순서 원자적 기록           │
│      │                                       │
│      ▼                                       │
│  채점 (계산적만 — MC: set eq / ST: normalize │
│        / OS: id 비교)                        │
│      │                                       │
│      ▼                                       │
│  전원 답변 또는 타임아웃                      │
│      │                                       │
│      ▼                                       │
│  라운드 결과 브로드캐스트                     │
│  (정답, 순위, 점수, explanation)             │
│                                              │
└─ 반복 ──────────────────────────────────────┘
    │
    ▼
게임 종료 → 최종 랭킹 → session_players 저장 + Redis ZADD 랭킹 반영
```

**매칭 대기열 timeout**: 30초 이내 매칭 실패 시 솔로 모드 전환 안내(v2.9 기본). AI 봇 매칭은 후순위 옵션.

### 6.3 네트워크 끊김 처리

```
클라이언트 WebSocket 끊김 감지
    │
    ▼
Socket.IO 자동 재연결 시도 (최대 5회, 지수 백오프)
    │
    ├── 재연결 성공 → 서버에서 현재 게임 상태 동기화
    │                → 놓친 라운드는 0점 처리, 진행 중 라운드 참여 가능
    │
    └── 재연결 실패 → 해당 플레이어 "disconnected" 처리
                     → 게임은 나머지 플레이어로 계속 진행
```

---

## 7. API 설계

### 7.1 REST API (NestJS)

```
# 인증
POST   /api/auth/register          # 회원가입
POST   /api/auth/login             # 로그인 → JWT 발급
POST   /api/auth/refresh           # 토큰 갱신

# 사용자
GET    /api/users/me               # 내 프로필
GET    /api/users/me/progress      # 내 학습 진도
GET    /api/users/me/history       # 내 답변 이력

# 문제
GET    /api/questions              # 문제 목록 (필터: week, mode, difficulty)
POST   /api/questions/generate     # AI 문제 생성 요청 (비동기, Job Queue)
GET    /api/questions/generate/:jobId  # 생성 진행 상태 조회
PATCH  /api/questions/:id/review   # 문제 승인/거부 (admin)

# 게임
POST   /api/games/solo/start       # 솔로 게임 시작
POST   /api/games/solo/answer      # 솔로 답변 제출
POST   /api/games/solo/finish      # 솔로 게임 종료

# 랭킹
GET    /api/rankings               # 랭킹 조회 (필터: week, topic, period)
GET    /api/rankings/me            # 내 순위

# 주차 범위
GET    /api/scope                  # 주차별 학습 범위 목록
POST   /api/scope/import           # 노션 자료 import → 범위 추론 (비동기, BullMQ notion-sync 큐)
PATCH  /api/scope/:weekId          # 주차 범위 수동 편집 (admin)

# 노션 동기화 (v2 추가)
POST   /api/notion/sync            # 수동 노션 동기화 트리거 (admin, §4.1 Stage 1~3)
GET    /api/notion/sync/status     # 동기화 상태 조회

# 캡스톤 (v2.9 추가 — ADR-014)
GET    /api/capstones                         # 사용자가 수행 가능한 캡스톤 목록 (weekly + final)
POST   /api/capstones/:templateId/start       # 세션 시작 (seed 생성, status='in_progress')
POST   /api/capstones/sessions/:sessionId/submit-step  # 단계별 답안 제출 (3단 채점 적용)
GET    /api/capstones/sessions/:sessionId     # 진행 상태 조회 (step_progress)
POST   /api/capstones/sessions/:sessionId/finish       # 완료 처리 (배지/진도 갱신)
POST   /api/admin/capstones/templates         # 템플릿 생성 (admin)
PATCH  /api/admin/capstones/templates/:id     # 템플릿 승인/수정 (admin)

# 채점/이의제기 (v2.9 추가 — ADR-016)
POST   /api/grading/:answerHistoryId/appeal   # 이의제기 제출
GET    /api/admin/grading/appeals             # 큐 조회 (admin)
PATCH  /api/admin/grading/appeals/:id/resolve # 해결/기각 (admin, answer_history WORM 유지)

# 실시간 풀 관리 (v2.9 추가 — ADR-015)
GET    /api/admin/realtime-pool/status        # 주차별 × answerFormat 하한 현황
POST   /api/admin/realtime-pool/refill        # 하한 미달 조합 수동 refill 트리거
```

### 7.2 WebSocket Events (Socket.IO)

```
# 방 관리
client → 'room:create'     { mode, week, rounds, maxPlayers }
client → 'room:join'       { roomId }
client → 'room:leave'      { roomId }
server → 'room:updated'    { room state }
server → 'room:player_joined'  { player info }
server → 'room:player_left'    { player info }

# 게임 진행
client → 'game:start'      { roomId }  (호스트만)
server → 'game:round_start'    { round, question, timeLimit }
client → 'game:answer'     { roomId, roundId, answer }
server → 'game:round_result'   { correctAnswer, rankings, scores }
server → 'game:finished'       { finalRankings, stats }

# 연결 관리
server → 'player:reconnected'  { currentState }
server → 'player:disconnected' { playerId }
```

---

## 8. 배포 아키텍처

### 8.1 Docker Compose 구성

```yaml
# docker-compose.yml (개요)
services:
  frontend:        # Next.js (port 3000)
  backend:         # NestJS + Socket.IO (port 3001)
  worker:          # BullMQ Worker (AI 문제 생성)
  postgres:        # PostgreSQL (port 5432)
  redis:           # Redis (port 6379)
```

### 8.2 인프라 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| VPS | 2 vCPU, 4GB RAM | 4 vCPU, 8GB RAM |
| 디스크 | 20GB SSD | 40GB SSD |
| 네트워크 | 10Mbps | 100Mbps |
| 동시접속 | 20명 | 50명 |

### 8.3 환경 변수

```env
# .env.example
DATABASE_URL=postgresql://user:pass@postgres:5432/oracle_game
REDIS_URL=redis://redis:6379
JWT_SECRET=
LLM_API_KEY=              # Claude API 또는 OpenAI API key
NOTION_API_TOKEN=          # 노션 연동용 (선택)
NODE_ENV=production
```

---

## 9. MVP 로드맵

### 9.1 로드맵 — v2.9 재구성 (consensus-004)

v2 계획이었던 "3단계 점진 출시"(솔로→랭킹→실시간)는 이미 현재 구현이 1단계 2/5 모드 + 실시간 미구현 상태에서 멈춰 있다. v2.9는 **문제 형태 재설계(ADR-012~017)** 기준으로 MVP-A ~ MVP-D로 재분할한다.

| 단계 | 기간 | 범위 | 핵심 DOD | 관련 ADR |
|------|------|------|----------|---------|
| **MVP-A** | 2주 | 객관식 모드 (Mode 6) + `answer_format` 컬럼 + MT6 스켈레톤 + 실시간 대전 사전 풀 매칭(MC 전용) | 객관식 100건 pass-rate ≥ 95% / Socket.IO 라운드 E2E | 012, 015, 017 |
| **MVP-B** | 4주 | `free-form` 4형태(빈칸 확장/재배열/드래그/출력선택) + **역피라미드 3단 채점** + LLM-judge 안전 프로토콜 + `answer_history` WORM + dry-run 시뮬레이터 + **SM-2 Spaced Repetition** | Layer 1 커버 ≥ 80% / MT8 ≤ 10% / Langfuse PII 필터 통과 | 012, 013, 016, 017, 018 |
| **MVP-C** | 3주 | **주차별 미니 캡스톤** + 3-entity 스키마 + 주제 팩 4종 + `userId×주차` 시드 변형 + MT7 | capstone_session E2E / 답안 공유 탐지 건수 운영 가시성 확보 | 014, 016, 017 |
| **MVP-C'** | 2주 | **최종 캡스톤 2트랙 (SQL / PL-SQL)** + 관리자 review UI | 트랙별 step ≥ 10 / 승인 완료 템플릿 각 4주제 | 014 |
| **MVP-D** | 2주 | 주간 릴리스 파이프라인 정식 개시 + `grading_appeals` UI + `mc-distractor-plausibility` assertion | 주간 cron `realtime-pool-refill` 정상 / appeal 흐름 E2E | 015, 016, 017 |

### 9.2 MVP 이후 검토 항목 (v2.9 갱신)

| 항목 | 도입 조건 | 관련 ADR |
|------|-----------|---------|
| Spaced Repetition (SM-2/FSRS) | **MVP-B 포함 (foundation 통과 이후 활성)** | 018 (P2) |
| 채점 전용 모델 분리 | MT8 breach 3회/월 또는 `grading_appeals` ≥ 10건/주 | 019 (P2) |
| Ollama schema-constrained decoding 파일럿 | MVP-A/B 안정 후 | 011 P4 |
| M4 이중 라우팅 재검토 | 부트캠프 피드백 ≥ 100건 축적 후 (ADR-011 P2, 3개월) | 011 |
| Knowledge Tracing (DKT/BKT) / IRT | `answer_history` ≥ 1000건/user 축적 후 | (미정) |
| 오프라인 모드 (IndexedDB 캐싱) | 사용자 요청 시 | — |
| 주제별 시각적 테마 | 기본 게임 안정화 후 | — |
| 커뮤니티 문제 기여 | 사용자 수 확대 시 | — |

---

## 10. 3+1 합의 검증 결과 요약

### 10.1 CRITICAL 이슈 및 해결

| 이슈 | 발견자 | 해결 |
|------|--------|------|
| 끝말잇기(끄투) 메커니즘 Oracle에 부적합 | 사용자 직접 지적 | 5가지 학습 특화 게임 모드로 전면 재설계 |
| AI 콘텐츠 품질/범위 이탈 | A, B, C (3자 일치) | 사전 문제 풀 + 키워드 화이트리스트 + 관리자 승인 |
| 동시 답변 경합 조건 | B (단독) | Redis ZADD 원자적 순서 판정 |

### 10.2 핵심 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 아키텍처 | Modular Monolith | 3자 만장일치, 20명 규모 적합 |
| 언어 | TypeScript Full-Stack | 3자 만장일치, 타입 공유 |
| 백엔드 | NestJS | B안 채택, 구조적 보안 강제 |
| 실시간 | Socket.IO | 3자 일치, Room 기반 |
| DB | PostgreSQL + Redis | A, B 일치, C도 PG 대안 인정 |
| AI 콘텐츠 | 반자동 (AI 생성 → 검증 → 승인) | C 제안, B 검증 방식 결합 |
| MVP 전략 | 3단계 점진 출시 | C 제안 채택 |

---

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1 | 2026-04-08 | 초기 설계 확정 (3+1 합의 검증 완료) |
| v2 | 2026-04-10 | §4 AI 콘텐츠 파이프라인 v2 — 3+1 합의(consensus-003) + 사용자 Q1~Q4 결정 반영. §4.1 다이어그램을 v1 중앙 허브 구조 유지 + 5단계 확장. §4.2 노션 증분 추출 + LLM 문서 정리 + 범위 분석 상세 설계 추가. §7.1 노션 동기화 API 추가. **하이브리드 오케스트레이션**: Stage 간 BullMQ(영속성/재시도/스케줄) + Stage 내부 LangChain Runnable(Langfuse trace 전 구간). |
| v2.8 | 2026-04-16 | §1.5 primary OSS 모델(ADR-011) + §1.6 메타 편향 주의문 4항(Gold Set / Ollama digest / SDK 전환 / 20명 규모) 신설. OpsModule Phase A/B 구현 완료. |
| **v2.9** | **2026-04-16** | **문제 형태 재설계 — 3+1 합의(consensus-004) + 사용자 최종 결정 반영. ADR-012~017 동반 생성.** §1.3 `answerFormat` 축 + 캡스톤 2계층 추가. §1.6 메타 편향 주의문에 **자기검증 편향(5항) / 모델 목적 적합성(6항)** 추가. §2.2 GradingModule/CapstoneModule/MatchModule 신설. §3.1 `GameMode`·`EvaluationResult` 확장 (`supportedFormats`, `partialScore`, `gradingMethod`, `graderDigest`). §3.2 **Mode 6 MultipleChoice 신설** + Mode 1 HARD variant(reorder/select-compose). §3.3 주제 매핑에 answerFormat 열 + 캡스톤 3행 추가. §4.3 MultipleChoice/FreeFormSql/Reorder/DragCompose/OutputSelect/Capstone 프롬프트 신설. §4.4 **답안 채점 역피라미드 3단 서브섹션(§4.4.2)** 신설. §4.5 실시간 풀 하한 정책 + 주간 릴리스. §5.1 ERD에 capstone_* 3entity + grading_appeals + answer_format 컬럼 + answer_history WORM + ops 컬럼 확장. §6.2 실시간 대전 사전 풀 기반 재정의(`free-form` 비허용). §7.1 `/api/capstones/*` + `/api/grading/*/appeal` + `/api/admin/realtime-pool/*` 추가. §9 MVP-A~D 로드맵 재구성. |

---

**이 문서는 3+1 에이전트 합의를 거쳐 설계가 확정되었습니다.**
**v2.9 다음 단계: operational-monitoring v1.1 반영 → CONTEXT/INDEX/MEMORY 동기화 → MVP-A (객관식 모드 + 실시간 사전 풀 매칭) TDD 착수**
