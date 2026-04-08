# Oracle DBA 학습 게임 설계 (SDD)

> **Oracle DBA 부트캠프 용어/함수 암기를 위한 멀티플레이어 웹 게임 시스템 설계**

**최종 수정**: 2026-04-08
**상태**: 설계 확정 (3+1 합의 검증 완료)
**상위 문서**: `PROJECT_CONSTITUTION.md` 제3조, 제4조
**관련 ADR**: ADR-008 (기술 스택 결정)

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
| 게임 모드 | 솔로 / 랭킹 경쟁 / 실시간 멀티플레이어 |
| 콘텐츠 | AI 자동 생성 (노션 수업 자료 기반) |
| 학습 범위 | 주차별 점진 확장 (커리큘럼 연동) |

### 1.4 성공 기준

- 수강생들이 자주 접속하여 플레이한다
- 면접/손코딩 전 학습 도구로 활용된다
- 주차별 새 콘텐츠가 자동으로 추가된다

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
| **GameModule** | 5개 게임 모드 엔진, 점수 계산, 랭킹 | ContentModule, Redis |
| **ContentModule** | AI 문제 생성, 문제 풀 관리, 주차별 범위 | BullMQ, LLM API |
| **WebSocketGateway** | 실시간 대전, 방 관리, 동시 답변 판정 | GameModule, Redis |

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
| AI | Claude API / OpenAI API | 콘텐츠 생성, structured output |
| Deploy | Docker Compose | 단일 VPS (4GB RAM) |

---

## 3. 게임 모드 설계

### 3.1 공통 게임 엔진

모든 게임 모드는 `GameMode` 인터페이스를 구현한다 (Strategy Pattern).

```typescript
interface GameMode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly supportedTopics: Topic[];

  generateRound(config: RoundConfig): Promise<Round>;
  evaluateAnswer(round: Round, answer: PlayerAnswer): EvaluationResult;
  calculateScore(result: EvaluationResult): number;
}

interface RoundConfig {
  topic: Topic;          // 예: 'sql-basics', 'plsql-functions'
  week: number;          // 주차 (학습 범위 제한)
  difficulty: Difficulty; // EASY | MEDIUM | HARD
  timeLimit: number;     // 초 단위
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

#### Mode 1: 빈칸 타이핑 (BlankTypingMode)

**학습 효과**: SQL 문법이 손에 익음 (Motor Memory + Active Recall)

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
- **난이도 조절**: EASY(1개 빈칸) → MEDIUM(2-3개) → HARD(전체 구문 작성)
- **채점**: 정확 일치 (대소문자 무시) + 부분 점수 (오타 허용도 설정 가능)

#### Mode 2: 용어 맞추기 (TermMatchMode)

**학습 효과**: 용어 ↔ 의미 양방향 연결

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

### 3.3 주제별 게임 모드 매핑

| 수업 주제 | 추천 게임 모드 | 이유 |
|-----------|---------------|------|
| SQL 기초 | 빈칸 타이핑, 용어 맞추기 | 기본 문법 반복 |
| SQL 함수 | 결과 예측, 용어 맞추기 | 함수 동작 이해 |
| PL/SQL | 빈칸 타이핑, 시나리오 | 구문 구조 + 프로시저 작성 |
| Administration | 시나리오, 카테고리 분류 | 관리 명령어 체계화 |
| 권한 관리 | 시나리오 (시각적) | ORA 에러 → GRANT/REVOKE |
| Backup & Recovery | 카테고리 분류, 시나리오 | 백업 유형 분류 + 복구 절차 |
| Performance Tuning | 결과 예측, 시나리오 | 실행 계획 분석 |
| SQL Tuning | 결과 예측, 빈칸 타이핑 | 힌트 구문, 인덱스 |
| RAC | 카테고리 분류, 시나리오 | 아키텍처 구성요소 이해 |

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

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│  노션 수업    │     │  범위 추론      │     │  문제 생성        │
│  자료 입력    │────▶│  (AI Analysis)  │────▶│  (AI Generation)  │
│              │     │                │     │                  │
│  - 코드 예제  │     │  - 주차 판별    │     │  - 모드별 문제    │
│  - 필기 노트  │     │  - 키워드 추출  │     │  - 난이도별 생성  │
│  - 강사 자료  │     │  - 범위 태깅    │     │  - 정답 + 해설    │
└──────────────┘     └────────┬───────┘     └────────┬─────────┘
                              │                      │
                              ▼                      ▼
                     ┌────────────────┐     ┌──────────────────┐
                     │  키워드         │     │  검증             │
                     │  화이트리스트   │     │  (Validation)     │
                     │                │     │                  │
                     │  주차별 허용    │────▶│  - 키워드 매칭    │
                     │  용어/함수 목록 │     │  - 스키마 검증    │
                     └────────────────┘     │  - 범위 이탈 차단 │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  문제 풀 저장     │
                                            │  (Question Pool)  │
                                            │                  │
                                            │  주차별 50문제+   │
                                            │  모드별 태깅      │
                                            └──────────────────┘
```

### 4.2 범위 추론 (Scope Inference)

노션 자료를 분석하여 학습 범위를 자동 추론한다.

```
입력: 노션 문서 (마크다운/텍스트)

Step 1: 키워드 추출
  → SQL 키워드, 함수명, Oracle 고유 용어 식별
  → 예: SELECT, NVL, TO_CHAR, GRANT, TABLESPACE...

Step 2: 주차/주제 매핑
  → 추출된 키워드를 커리큘럼 매핑 테이블과 대조
  → 커리큘럼: SQL → PL/SQL → Admin → Backup → Perf → SQL Tuning → RAC

Step 3: 범위 태깅
  → 각 키워드에 (주차, 주제, 난이도) 태그 부여
  → 새로운 키워드 발견 시 → 해당 주차 화이트리스트에 추가
```

### 4.3 문제 생성 (Question Generation)

```
입력: (주차, 주제, 게임모드, 난이도, 수량)

게임모드별 생성 프롬프트:

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
```

### 4.4 검증 파이프라인 (Validation)

계산적 검증을 우선 적용하고, 추론적 검증은 보조로만 사용한다.

```
생성된 문제
    │
    ▼
① 스키마 검증 (Zod) — 계산적
  → 필수 필드 존재 여부, 타입 검증
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
④ 문제 풀 저장
  → status: 'pending_review' (관리자 승인 대기)
  → 또는 status: 'active' (자동 승인 — 검증 통과 시)
```

### 4.5 사전 생성 문제 풀 (Pre-generated Pool)

AI API 장애 시에도 게임이 가능하도록 각 주차별 최소 50문제를 사전 생성하여 캐싱한다.

| 주차 | 주제 | 모드별 최소 문제 수 |
|------|------|-------------------|
| 1주차 | SQL 기초 | 빈칸 15 + 용어 15 + 결과예측 10 + 분류 5 + 시나리오 5 |
| 2주차 | SQL 함수 | 빈칸 10 + 용어 15 + 결과예측 15 + 분류 5 + 시나리오 5 |
| ... | ... | ... |

---

## 5. 데이터 모델

### 5.1 PostgreSQL ERD

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    users     │     │   game_sessions  │     │   questions      │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)      │     │ id (PK)          │     │ id (PK)          │
│ username     │──┐  │ host_id (FK)     │     │ topic            │
│ email        │  │  │ mode             │     │ week             │
│ password_hash│  │  │ status           │     │ game_mode        │
│ role         │  │  │ config (JSONB)   │     │ difficulty       │
│ created_at   │  │  │ created_at       │     │ content (JSONB)  │
└──────────────┘  │  └──────────────────┘     │ answer (JSONB)   │
                  │                            │ explanation      │
┌──────────────┐  │  ┌──────────────────┐     │ status           │
│ user_progress│  │  │ session_players  │     │ source           │
├──────────────┤  │  ├──────────────────┤     │ created_at       │
│ id (PK)      │  │  │ session_id (FK)  │     └──────────────────┘
│ user_id (FK) │──┘  │ user_id (FK)     │
│ topic        │     │ score            │     ┌──────────────────┐
│ week         │     │ answers (JSONB)  │     │ answer_history   │
│ total_score  │     │ rank             │     ├──────────────────┤
│ games_played │     └──────────────────┘     │ id (PK)          │
│ accuracy     │                              │ user_id (FK)     │
│ streak       │     ┌──────────────────┐     │ question_id (FK) │
│ last_played  │     │   weekly_scope   │     │ answer           │
└──────────────┘     ├──────────────────┤     │ is_correct       │
                     │ id (PK)          │     │ time_taken_ms    │
┌──────────────┐     │ week             │     │ game_mode        │
│  rankings    │     │ topic            │     │ created_at       │
├──────────────┤     │ keywords (JSONB) │     └──────────────────┘
│ id (PK)      │     │ source_url       │
│ user_id (FK) │     │ created_at       │
│ topic        │     └──────────────────┘
│ week         │
│ score        │
│ rank         │
│ updated_at   │
└──────────────┘
```

### 5.2 핵심 테이블 설명

| 테이블 | 용도 | 핵심 필드 |
|--------|------|-----------|
| `users` | 사용자 계정 | role: 'player' \| 'admin' |
| `user_progress` | 주차/주제별 학습 진도 | accuracy (정답률), streak (연속 정답) |
| `questions` | 문제 풀 | content (JSONB — 모드별 다른 구조), status: 'active' \| 'pending_review' |
| `answer_history` | 답변 이력 (SR 대비) | is_correct, time_taken_ms — Spaced Repetition 알고리즘 적용용 |
| `game_sessions` | 멀티플레이어 세션 | mode, config (JSONB — 모드별 설정) |
| `session_players` | 세션 참가자 | score, rank, answers (JSONB — 라운드별 답변) |
| `weekly_scope` | 주차별 학습 범위 | keywords (JSONB — 허용 키워드 리스트) |
| `rankings` | 주차/주제별 랭킹 | Redis Sorted Set의 영속화 스냅샷 |

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

```
호스트 → 방 생성 (모드/주차/라운드수 설정)
    │
    ▼
참가자 입장 (WebSocket 연결)
    │
    ▼
게임 시작 (호스트 트리거)
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
│  전원 답변 또는 타임아웃                      │
│      │                                       │
│      ▼                                       │
│  라운드 결과 브로드캐스트                     │
│  (정답, 순위, 점수)                           │
│                                              │
└─ 반복 ──────────────────────────────────────┘
    │
    ▼
게임 종료 → 최종 랭킹 → session_players 저장
```

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
POST   /api/scope/import           # 노션 자료 import → 범위 추론 (비동기)
PATCH  /api/scope/:weekId          # 주차 범위 수동 편집 (admin)
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

### 9.1 3단계 점진적 출시

| 단계 | 기간 | 범위 | 핵심 가치 |
|------|------|------|-----------|
| **1단계** | Week 1-2 | 솔로 퀴즈 (빈칸타이핑 + 용어맞추기) + AI 문제 생성 | 학습 도구 가치 검증 |
| **2단계** | Week 3-4 | 결과예측 + 카테고리분류 + 랭킹 + 비동기 경쟁 | 경쟁 + 게임 다양성 |
| **3단계** | Week 5+ | 시나리오 시뮬레이션 + 실시간 대전 (WebSocket) | 멀티플레이어 경험 |

### 9.2 MVP 이후 검토 항목

| 항목 | 도입 조건 |
|------|-----------|
| Spaced Repetition (SM-2/FSRS) | answer_history 데이터 충분히 축적된 후 |
| 오프라인 모드 (IndexedDB 캐싱) | 사용자 요청 시 |
| 주제별 시각적 테마 | 기본 게임 안정화 후 |
| 커뮤니티 문제 기여 | 사용자 수 확대 시 |

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

**이 문서는 3+1 에이전트 합의를 거쳐 설계가 확정되었습니다.**
**다음 단계: TDD로 MVP 1단계 구현 시작**
