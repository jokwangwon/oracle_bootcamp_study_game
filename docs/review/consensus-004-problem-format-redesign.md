# 3+1 합의 보고서 — 문제 형태 재설계 (SQLD 대비 + 템플릿형 캡스톤)

**날짜**: 2026-04-16
**유형**: FEAT (모드/채점/캡스톤 확장)
**범위**: SYSTEM (SDD §3 게임 모드 + §4 콘텐츠 + §5 DB 스키마 + §6 실시간)
**상위 설계**: `docs/architecture/oracle-dba-learning-game-design.md` (v2.8 → v2.9 개정 예정)
**관련 ADR**: ADR-008, ADR-009, ADR-010, ADR-011 / **파생 신규**: ADR-012 ~ ADR-019

---

## Phase 0: 사용자 요청 브리프

### 원문

> 문제의 형태나 기획에 관해 재 설계를 하기 위해서 의논을 나누어보려고 합니다.
> 코딩 테스트 처럼 SQLD 시험 준비하는 다른 웹사이트들 처럼 문제의 형태를 추가해보고자 합니다.
> 최종적으로 해당 게임에서 얻어갈수 있는 부분은 간단한 프로젝트 만들기까지 유도하는 형태로 진행되었으면 좋겠습니다.

### 1차 명확화 질의응답

| # | Reviewer 질문 | 사용자 답변 |
|---|---|---|
| 1 | 실제 SQL 실행 환경 제공 여부 | **객관식/작성형 위주, 실 실행 환경 미제공** |
| 2 | 최종 프로젝트 = 포트폴리오형 vs 챌린지형 | **챌린지 완결형** (게임 내 완결, 외부 공유 없음) |
| 3 | 5모드 유지 vs 전면 재설계 | **유지+확장이 전제이나 유지 타당성 검토 필요** |

### 분류
- **유형**: FEAT (primary, confidence 95%)
- **범위**: SYSTEM (게임 모드 / 채점 / DB / 실시간 4영역 교차)
- **에이전트 합의**: **필수** (CLAUDE.md §3 — SDD 명세 검토 = 3+1 필수)

---

## Phase 1: 3+1 에이전트 독립 분석

### Agent A — 구현 분석가

**핵심 판단**: 조건부 YES. 객관식 즉시 가능, 작성형은 **3단 채점 파이프라인** 필요, 캡스톤은 신규 entity 불가피. **5모드 전면 유지는 비용 대비 효과 낮음 — 2+1 축소 권고**.

**대표 제안**:
- `MultipleChoiceContent` 신설 + `GameModeId` 확장
- 3단 채점: Tier-1(토큰 정규화) → Tier-2(AST `node-sql-parser`) → Tier-3(LLM-judge)
- 캡스톤 3-entity: `capstone_templates`/`capstone_steps`/`capstone_sessions` + `depends_on_step_ids` DAG
- **`answerFormat` 축 도입** (모드 축과 독립)
- SDD 개정 범위: §1.3 / §2.2 / §3.1 / §3.2 / §3.3 / §4.3 / §4.4 / §5.1 / §7.1 / §9 + ADR-011 주의문
- 로드맵: MVP-A(객관식, 2주) → MVP-B(작성형, 3주) → MVP-C(캡스톤, 3주) → MVP-D(옵션)

**주요 리스크**: LLM-judge 자기검증 편향(M3 생성+M3 채점), Oracle 방언 미커버, DAG 순환, promptfoo R3 regression, `GameSessionService.activeRounds` Map이 다단계 세션 부적합.

### Agent B — 품질/안전성 검증가

**핵심 판단**: 조건부 SAFE. **"5모드 유지 + 작성형 + 캡스톤" 3중 결합은 합성 리스크** (교육 중복·운영 부담·재플레이성 손실). 안전장치 없으면 UNSAFE 전환.

**대표 제안**:
- **헌법 제3조(계산적 > 추론적) 위반 위험**: 작성형 LLM 채점 도입은 계산적 canonicalization 선행 강제
- **채점 파이프라인 역피라미드 필수**: Layer 1(AST, 필수) → Layer 2(키워드, 필수) → Layer 3(LLM, UNKNOWN일 때만)
- **LLM 인젝션 방어**: user 메시지 경계 태그 `<student_answer>` + 길이 제한 + instruction 정규식 스캔
- **Mode 1 HARD / Mode 3 직접입력 / Mode 5 expectedSql이 이미 작성형의 맹아** — 중복 재평가 권고
- **캡스톤 재플레이성**: 주제 팩 ≥ 4종 + `userId × 주차` 시드 변형
- **`ops_question_measurements`**: `mode` 컬럼 + **MT6(free-form-canonical-match) / MT7(capstone-step-consistency) / MT8(llm-judge-invocation-ratio)** 신설
- `answer_history.answer` text 허용 + `grading_method` + `grader_digest` + WORM
- **Bloom's Taxonomy 공백**: Remember/Understand 과잉투자, Analyze/Evaluate 공백 — 작성형을 Analyze로 재포지셔닝
- **Qwen3-Coder는 코드 생성 튜닝, 채점 최적 아님** → 채점 LLM 별도 pin 검토

**주요 리스크**: 작성형 다중정답 처리실패(S등급), LLM 인젝션(A), 캡스톤 답안 공유(A), 실행환경 없는 작성형 = "문법 맞히기" 환원(A), 기존 MT3/MT4 게이트 새 모드 미적용(A).

### Agent C — 대안 탐색가

**핵심 판단**: 부분 수정 제안. SQLD 실 시험은 객관식+단답형 → "실 실행 없음" 결정은 정답. **"5모드 유지"보다 "기초/실전 트랙 분리"가 베스트 프랙티스**. 14주 누적 캡스톤이 동기 유지에 유리.

**대표 제안**:
- 벤치마킹: solvesql/HackerRank/LeetCode는 실행형 → 직접 불가. **SQLD 기출 객관식+단답형 구조가 본 프로젝트에 적합**. 프로그래머스 "Kit"와 Duolingo "Streak/리그/XP" 동기 패턴 차용.
- 5모드 재구성 권고: **기초 트랙(빈칸·용어·분류, 1~4주차) + 실전 트랙(결과예측·시나리오·신규 작성형, 5~14주차)**
- 작성형 4형태 구체화: ① 빈칸 확장(2~3칸) ② **쿼리 재배열** ③ **SELECT 절 구성(드래그앤드롭)** ④ 정답 출력 테이블 선택
- 캡스톤: **14주 누적 1개 프로젝트 + 주차별 체크포인트** 하이브리드
- 학습 경로: **주차 게이트 + SM-2 Spaced Repetition 2-레이어**
- **챌린지 완결형 → Socket.IO 실시간 대전 우선순위 하향 + 비동기 주간 리그로 대체 검토**
- distractor 품질 assertion 부재 지적

---

## Phase 2~4: Reviewer 교차 비교 + 중재

### 2.1 만장일치 합의 (3명 동의)

| # | 합의 항목 | 비고 |
|---|-----------|------|
| C1 | 객관식 모드 신설은 즉시 구현 가능 | `MultipleChoiceContent` 디자인 일치 |
| C2 | **계산적 검증 > LLM-judge 우선** (CLAUDE.md §2) | 헌법 제3조 준수 |
| C3 | 기존 Mode 1 HARD / Mode 3 / Mode 5는 **이미 작성형의 맹아** | 새 모드보다 확장 재정의 적합 |
| C4 | `answer_history` 스키마 확장 (text + grading_method + grader_digest) | 작성형 수용 필수 |
| C5 | LLM-judge 도입 시 프롬프트 인젝션 방어 필수 | 경계 태그 + 길이 제한 + 메시지 분리 |
| C6 | 운영 모니터링에 mode 차원 + 신규 MT 지표 추가 | ops_question_measurements 확장 |
| C7 | SDD §3.1/§3.2/§3.3/§4.3/§4.4/§5.1/§7.1/§9 + ADR-011 주의문 개정 필요 | 문서 우선 원칙 |
| C8 | SQL 실행환경 부재는 근본 제약 — 보완책 필수 | 토큰/AST/dry-run 조합 |

### 2.2 Reviewer 중재 결정 (부분 일치 / 불일치)

#### 쟁점 1: 5모드 유지 여부

| 에이전트 | 입장 |
|---|---|
| A | 2+1 축소 (3모드 Phase 3+ 이관) |
| B | 중복 재평가 (통합/재정의 선호) |
| C | 기초/실전 트랙 분리 |

**Reviewer 1차 권고**: 트랙 분리(C) + feature flag(A).
**사용자 최종 결정**: **5모드 전면 유지 + 주차 독립 + `answerFormat` 축 직교 확장** (트랙 분리 거부).

> **채택**: 5모드는 그대로 유지하되, 새로운 축(`answerFormat`)을 직교 확장으로 추가한다. 주차별 역할 재배치는 하지 않는다.

#### 쟁점 2: 작성형의 정의

**채택**: Agent C의 4형태(빈칸 확장 / 쿼리 재배열 / SELECT 구성 / 출력 테이블 선택)를 `answerFormat` 축 값으로 정규화한다. Agent B의 "기존 모드 하위모드 승격" 논리도 수용 — 새 `GameMode` 생성 없이 기존 모드에 variant 추가.

#### 쟁점 3: 캡스톤 구조

| 에이전트 | 입장 |
|---|---|
| A | 3-entity (templates/steps/sessions) + DAG |
| B | 주제 팩 ≥ 4종 + userId×주차 시드 |
| C | 14주 누적 + 주차별 체크포인트 |

**Reviewer 1차 권고**: C 누적 구조 + A 3-entity + B 안전장치.
**사용자 최종 결정**: **주차별 독립 미니 캡스톤 + 최종 캡스톤 2트랙(SQL / PL-SQL)**.

> **채택**: 14주 누적 구조는 채택하지 않는다. 주차마다 독립 실행 가능한 미니 캡스톤 + 코스 종료 시 SQL/PL-SQL 2트랙 최종 캡스톤으로 분리한다. A의 3-entity 스키마는 그대로 재사용 가능 (template당 step 수 축소).

#### 쟁점 4: 챌린지 완결형 vs 자주 접속

| 에이전트 | 입장 |
|---|---|
| B | SDD §1.4와 정면 충돌 — 반복 동기 필수 |
| C | 실시간 대전 강등 + 비동기 주간 리그 대체 |

**Reviewer 1차 권고**: 실시간 대전 강등.
**사용자 최종 결정**: **실시간 대전 유지. 단, 실시간 AI 생성 금지 — 사전 생성 문제 풀에서 랜덤 매칭**.

> **채택**: Socket.IO 실시간 대전 경로는 유지. 대신 실시간 중 AI 호출을 배제하여 p95 지연 불확실성을 제거한다. 사전 풀은 관리자 승인된 `status='approved'` 문제로 한정. 주간 릴리스(새 문제 풀 추가)로 "자주 접속" 동기 보강.

#### 쟁점 5: 학습 경로 / SR

Agent C만 SM-2 2-레이어 제안. **채택** (MVP-B 범위, 주차 게이트와 병행).

#### 쟁점 6: 채점 전용 모델 분리

Agent B만 언급. **조건부 채택** (ADR-019 후순위). MT8(LLM-judge 호출률) > 10% 게이트 breach 시 Phase 3 평가 항목으로 승격.

---

## 3. 최종 합의 설계 결정 (사용자 결정 반영 완료)

### 3.1 모드 구조 (§3.1 / §3.2 / §3.3)

1. **기존 5모드 전면 유지** — 빈칸타이핑 / 용어맞추기 / 결과예측 / 카테고리분류 / 시나리오시뮬레이션.
2. **트랙 분리 없음** — 주차별 제한은 기존 `week_min` 메커니즘 그대로 유지.
3. **`answerFormat` 축 신설 (직교 확장)** — 모드 × 답안형식 N:M 자유 조합.
   - 허용 값: `multiple-choice` / `free-form` / `reorder` / `drag-compose` / `output-select` / `single-token`
4. **객관식 전용 모드 추가** — `MultipleChoiceContent` + `GameModeId = 'multiple-choice'` (6번째 모드).
5. Mode 1 HARD에 variant: `'multi-blank' | 'reorder' | 'select-compose'` (작성형 4형태 중 ①②③).

### 3.2 채점 파이프라인 (§4.4 전면 개정)

6. **역피라미드 3단 파이프라인 (Agent A + B)**:
   - Layer 1: AST canonicalize (`node-sql-parser` + Oracle 방언 화이트리스트, **항상 실행**)
   - Layer 2: 키워드/토큰 커버리지 (계산적, 필수)
   - Layer 3: LLM-judge (**Layer 1/2가 UNKNOWN일 때만**, 호출률 모니터링)
7. **LLM-judge 안전 프로토콜** — ADR-016 참조.
8. **결정적 dry-run 시뮬레이터** — PEG 파서 + 에러 타입 분류, MVP-B 필수.

### 3.3 캡스톤 (§3.2 + §5.1 신설)

9. **주차별 독립 미니 캡스톤** — 해당 주차의 주제 + 누적 키워드 화이트리스트 내에서 단일 프로젝트 형태. 주차 간 의존성 없음.
10. **최종 캡스톤 2트랙** — 코스 종료 시 학생이 하나 이상 선택:
    - **SQL 트랙**: DDL/DML/조인/서브쿼리/집계/튜닝 종합
    - **PL/SQL 트랙**: 프로시저/함수/트리거/패키지/예외처리/커서 종합
11. **3-entity 스키마 (Agent A)** — `capstone_templates` / `capstone_steps` / `capstone_sessions` + `depends_on_step_ids` DAG 검증 (주차별 미니 + 최종 2트랙 공용).
12. **재플레이성 안전장치 (Agent B)** — 주제 팩 ≥ 4종 + `seed = hash(userId, week, templateId)` 변형. 답안 공유 탐지 이상 유사도 모니터링.

### 3.4 실시간 대전 (§6.2 재정의)

13. **Socket.IO 경로 유지** — SDD §2.1 WebSocket Gateway 설계 보존.
14. **실시간 AI 생성 금지** — 실시간 세션은 **`status='approved'` 사전 생성 풀에서 랜덤 매칭**. p95 지연 불확실성 제거.
15. **주간 릴리스 리듬** — 관리자가 매주 새 문제 batch를 approved 상태로 전환 → 실시간 풀 갱신.

### 3.5 동기 구조 (§1.4 / §9)

16. **챌린지 완결형 + 주간 접속 동기** — 2중 레이어로 §1.4 모순 해소:
    - 완결형: 14주 코스 완결 + 최종 캡스톤 선택 수료
    - 접속형: 주차별 미니 캡스톤 / 주간 신규 문제 / 비동기 랭킹 / SM-2 복습 큐
17. **SM-2 Spaced Repetition (Agent C)** — `review_queue` 테이블 + due_at 기반 일간 복습. foundation 수준 통과 이후 활성.

### 3.6 운영 모니터링 (operational-monitoring-design.md 확장)

18. **`ops_question_measurements`에 컬럼 추가**: `mode`, `answer_format`, `grading_method`.
19. **신규 지표** (ADR-017):
    - **MT6**: free-form-canonical-match rate (Layer 1 통과율, 목표 ≥ 80%)
    - **MT7**: capstone-step-consistency (DAG 위반 0)
    - **MT8**: llm-judge-invocation-ratio (목표 ≤ 10%)
20. **`answer_history` WORM** — UPDATE 권한 회수, append-only 트리거. `grading_appeal` 이벤트 별도.

### 3.7 안전장치 · 거버넌스

21. **ADR-011 주의문 갱신** — "M3 생성 + M3 채점" 자기검증 편향 명시 + MT8 게이트 도입.
22. **Langfuse PII 필터링** — 답안 평문 저장 금지, 해시 + 길이 + 키워드 빈도만 로그.

---

## 4. 필수 안전장치 체크리스트

- [ ] 계산적 검증 선행 강제 — Layer 1 미실행 시 Layer 3 호출 차단(런타임 assert)
- [ ] 프롬프트 인젝션 방어 — 경계 태그 + 길이 제한 + 정규식 스캔 3중
- [ ] `answer_history` WORM — UPDATE 권한 회수, append-only 트리거
- [ ] Langfuse PII 필터 — 답안 원문 저장 금지
- [ ] 캡스톤 주제 팩 ≥ 4종 — 단일 템플릿 운영 금지
- [ ] `userId × 주차` 시드 변형 — 답안 공유 방지
- [ ] DAG 순환 검사 — `capstone_steps` CI 검증
- [ ] MT8 게이트 — LLM-judge 호출률 > 10% 시 `gate_breach`
- [ ] 자기검증 편향 모니터 — 분기별 M3 생성 + 타 모델 채점 대조 ≥ 50건
- [ ] promptfoo R3 regression — 객관식 / 작성형 전용 case 추가
- [ ] `GameSessionService` 리팩터 — 다단계 세션 지원 (캡스톤 필수)
- [ ] Oracle 방언 커버리지 — `DUAL` / `ROWNUM` / `CONNECT BY` / `(+)` 조인 AST 대응
- [ ] 실시간 대전 사전 풀 `status='approved'` 강제 — 실시간 중 AI 호출 차단

---

## 5. 단계별 로드맵

| 단계 | 기간 | 범위 | 핵심 DOD |
|------|------|------|----------|
| **ADR 작성 (P0)** | 1~2일 | ADR-012~017 6건 + ADR-018/019 후순위 기록 | 문서 우선 원칙 (CLAUDE.md §1) |
| **SDD v2.9 개정** | 2~3일 | §1.3 / §2.2 / §3.1 / §3.2 / §3.3 / §4.3 / §4.4 / §5.1 / §6.2 / §7.1 / §9 | ADR 병합 후 |
| **MVP-A** | 2주 | 객관식 모드 + `answerFormat` 컬럼 + MT6 스켈레톤 | 객관식 100건 pass-rate ≥ 95%, 테스트 TDD |
| **MVP-B** | 4주 | 작성형 4형태 + 3단 채점 + dry-run + SM-2 + `answer_history` WORM | Layer 1 커버 ≥ 80%, MT8 ≤ 10% |
| **MVP-C** | 3주 | 주차별 미니 캡스톤 + 3-entity + 주제 팩 4종 + MT7 | `capstone_session` E2E, 답안 공유 탐지 ≥ 0건/주 |
| **MVP-C'** | 2주 | 최종 캡스톤 2트랙 (SQL / PL-SQL) | 트랙별 step ≥ 10, 관리자 승인 완료 |
| **MVP-D (옵션)** | 2주 | 실시간 대전 사전 풀 매칭 정식 개시 + 주간 릴리스 파이프라인 | Socket.IO 라운드 E2E, p95 ≤ 3s |

---

## 6. 최종 합의 후 남는 상위 5 리스크

| # | 리스크 | 심각도 | 완화책 |
|---|---|---|---|
| R1 | 자기검증 편향 (M3 생성 + M3 채점) | 高 | MT8 게이트 + 분기 타모델 대조 + ADR-019 채점 모델 분리 |
| R2 | SQL 실행환경 부재 → "문법 맞히기" 환원 | 高 | dry-run 시뮬레이터 + AST canonicalize + output-select variant로 의미 검증 보강 |
| R3 | 캡스톤 답안 공유 (ChatGPT/단톡방) | 中高 | 주제 팩 4종 + userId×주차 시드 + WORM 로그 + 이상 유사도 탐지 |
| R4 | 실시간 사전 풀 소진 / 주간 릴리스 지연 | 中 | BullMQ 사전 생성 큐 + 관리자 review UI 우선순위 ↑ + 풀 하한 알람 |
| R5 | Oracle 방언 파서 커버리지 부족 | 中 | `node-sql-parser` 커스텀 확장 + 방언별 전용 테스트 스위트 |

---

## 7. 후속 ADR 목록 (P0/P1/P2 우선순위)

| ADR | 제목 | 우선순위 | 상태 |
|---|---|---|---|
| **ADR-012** | `answerFormat` 축 직교 확장 + 객관식 모드 신설 | P0 | 작성 중 |
| **ADR-013** | 역피라미드 3단 채점 파이프라인 (AST → 키워드 → LLM-judge) | P0 | 작성 중 |
| **ADR-014** | 주차별 독립 미니 캡스톤 + 최종 캡스톤 SQL/PL-SQL 2트랙 | P0 | 작성 중 |
| **ADR-015** | 실시간 대전 재정의 — 사전 생성 풀 기반 랜덤 매칭 | P0 | 작성 중 |
| **ADR-016** | LLM-judge 안전 프로토콜 (인젝션 방어 + PII 필터 + WORM) | P0 | 작성 중 |
| **ADR-017** | MT6/MT7/MT8 운영 지표 신설 + ADR-011 주의문 갱신 | P0 | 작성 중 |
| **ADR-018** | SM-2 Spaced Repetition 도입 (foundation 수준 이후) | P2 | MVP-B 착수 전 작성 |
| **ADR-019** | 채점 전용 모델 분리 검토 (자기검증 편향 대응) | P2 | MT8 breach 트리거 |

---

## 8. 사용자 최종 결정 기록 (2026-04-16)

| Reviewer 제안 | 사용자 결정 | 반영 |
|---|---|---|
| 기초/실전 트랙 분리 (안 α) | ❌ 거부 | 5모드 전면 유지 + `answerFormat` 축 직교 확장으로 대체 |
| 14주 누적 캡스톤 | ❌ 거부 | 주차별 독립 미니 캡스톤 + 최종 캡스톤 2트랙(SQL/PL-SQL) |
| Socket.IO 실시간 대전 강등 | ❌ 거부 | 실시간 유지, 단 실시간 AI 생성 금지 → 사전 생성 풀 랜덤 매칭 |
| ADR → SDD v2.9 → MVP-A 순서 | ✅ 승인 | ADR-012~017 작성 즉시 착수 |

---

**관련 문서**:
- `docs/architecture/oracle-dba-learning-game-design.md` (SDD, v2.9로 개정 예정)
- `docs/architecture/operational-monitoring-design.md` (MT6/MT7/MT8 확장)
- `docs/decisions/ADR-011-oss-primary-model-m3.md` (주의문 갱신)
- `docs/review/consensus-001-oracle-dba-game.md` (초기 설계 합의)
- `CLAUDE.md` §2 (계산적 > 추론적), §3 (3+1 합의)
