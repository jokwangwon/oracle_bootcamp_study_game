# SM-2 Spaced Repetition 도입 브리프 v1

> **문서 성격**: Phase 0 자동화 검토 질문지 (ADR-001 프로토콜)
> **대상 기능**: SM-2 기반 일일 복습 큐
> **다음 단계**: 3+1 합의 → ADR-019 → SDD 반영 → TDD 구현

---

## 1. 배경

### 1.1 누적된 결정의 연쇄

| 근거 | 출처 | 정리 |
|------|------|------|
| `answer_history` 테이블 설계 시 SR 입력 용도 명시 | `apps/api/src/modules/users/entities/answer-history.entity.ts:15` — "향후 Spaced Repetition (SM-2/FSRS) 알고리즘이 이 테이블을 입력으로 사용한다" | 본 기능의 **존재 계약** 이 엔티티 주석 시점부터 선언됨 |
| consensus-004 Agent C 단독 제안 채택 | `docs/review/consensus-004-problem-format-redesign.md:143,191` | "`review_queue` 테이블 + due_at 기반 일간 복습. foundation 수준 통과 이후 활성." |
| MVP-B 범위로 확정 | `docs/architecture/oracle-dba-learning-game-design.md:1260,1269` | "MVP-B 포함 (foundation 통과 이후 활성)" |
| 캡스톤 과의 결합 기대 | ADR-014 §동기 부족 보완 | "주차별 완결 후 학습 내용을 SR 큐로 이전해 장기 기억 강화" |

### 1.2 번호 충돌 정정

- consensus-004 및 design 문서에 "ADR-018" 로 가리비되어 있으나 **ADR-018 번호는 이미 user_token_hash salt rotation 에 할당됨**.
- 본 기능의 최종 ADR 번호는 **ADR-019** 로 확정 (다음 세션에서 작성).

### 1.3 이 결정이 해결하는 기존 문제

1. **학습 효과의 시간 감쇄** — 1주차 학습 후 2~3주 뒤 90% 망각. 부트캠프 종료 후 실무 복귀 시점의 리콜률 낮음.
2. **풀 랜덤 샘플링의 학습 비효율** — 현재 `/api/games/solo/start` 은 난이도·주제·모드만 필터. 이미 완벽히 맞춘 문제와 자주 틀린 문제가 동일 확률. 복습 효율 최적화 여지 큼.
3. **`answer_history` WORM 저장만 수행 → 활용 부재** — 데이터는 쌓이는데 학습 루프가 소비하지 않음.

---

## 2. 레퍼런스

| 알고리즘 | 요약 | 선택 이유 후보 |
|---------|------|---------------|
| **SuperMemo SM-2** (1988, Piotr Woźniak) | 각 (user, question) 에 ease_factor(초기 2.5) · interval_days · repetition_count 유지. quality 0~5 로 평가 후 다음 interval 갱신. q<3 이면 리셋. | 가장 검증된 간격 반복 알고리즘. 구현 단순(40줄). Anki 근간. |
| **FSRS** (2022, Free Spaced Repetition Scheduler) | Weibull 분포 기반 예측 모델. 파라미터 17개. 학습 데이터로 fit. | 정확도 higher 하지만 초기 데이터 부족 시 오히려 나쁨. 튜닝 복잡. |
| **Leitner Box** (1972) | 5개 박스 순환. 맞으면 다음 박스, 틀리면 박스1 복귀. | 직관적이나 간격 자동 조정 부재. 학습 초기 적합. |

**consensus-004 에서 SM-2 방향성 이미 암시**. FSRS 는 "초기 데이터 부족" 이라는 MVP 특성에 부적합. Leitner 는 간격 유연성 부족.

→ **SM-2 채택이 지배적 가설**. 본 Phase 0 는 이를 전제로 세부 운영 정책을 결정.

---

## 3. 현재 상태 스냅샷

### 3.1 있는 것

- `answer_history` 테이블 (WORM 설치 대기) — `userId` × `questionId` × `isCorrect` × `score` × `hintsUsed` × `createdAt` × `gameMode` + (free-form 경로 추가) `partialScore` × `gradingMethod`
- `UserTopicProgress` — `user × topic × week` 의 누적 통계 (`totalCorrectAnswers`, `accuracy`, `streak`)
- `/api/games/solo/start` — random pool 샘플링 + 난이도·주제·모드 필터
- `/api/games/solo/finish` — 세션 종료 시 progress 갱신

### 3.2 없는 것

- `review_queue` 테이블 (SR 메타 유지소)
- `due_at` 기반 우선 샘플링 로직
- "foundation 통과" 정의
- SR 큐와 random pool 의 혼합 정책
- quality (0~5) 매핑 규칙

---

## 4. 요구사항 후보

| # | 항목 | 설명 | 우선순위 후보 |
|---|------|------|-------------|
| R1 | `review_queue` 엔티티 + migration | `(user_id, question_id)` PK + `ease_factor` + `interval_days` + `repetition_count` + `due_at` + `last_reviewed_at` | MVP 필수 |
| R2 | SM-2 알고리즘 pure function | quality 입력 → 다음 `ease`/`interval`/`repetition` 계산 | MVP 필수 |
| R3 | `answer_history` → quality 매핑 | `isCorrect` + `partialScore` + `hintsUsed` + `timeTakenMs` → 0~5 | MVP 필수 |
| R4 | 오늘의 복습 큐 조회 API | `GET /api/solo/review-queue` — `due_at <= NOW()` AND user 본인 | MVP 필수 |
| R5 | `/solo/start` 가 SR 큐를 우선 샘플링 | SR 큐에 오늘자 복습 있으면 우선, 없으면 random pool | 정책 결정 필요 |
| R6 | foundation 통과 이전엔 SR 비활성 | "첫 학습 단계에서는 신규 노출 집중" 원칙 | 정책 결정 필요 |
| R7 | 일일 복습 상한 (optional) | 50건 초과 시 difficulty × 오래됨 우선 | MVP 후순위 |
| R8 | 복습 성과 통계 (optional) | 대시보드에 "오늘 복습률" | MVP 후순위 |

---

## 5. Phase 0 자동화 검토 질문지

> `docs/architecture/automated-review-questionnaire-design.md` §3 구조.

### 5.1 필수 3개 (C1~C3)

**C1 — 목적 (Why)**
이 변경이 해결하는 핵심 문제는 무엇입니까?
후보 (사용자는 이 중 선택 또는 자유 서술):
- (a) **망각곡선 기반 장기 기억 강화** — 부트캠프 종료 후에도 리콜률 유지
- (b) **학습 효율 최적화** — 이미 숙달한 문제 반복 노출 최소화, 약한 문제 집중
- (c) **학습 지속 동기 유지** — 매일 "오늘의 복습" 제공으로 접속 유도
- (d) 위 모두

**C2 — 범위 (Scope)**
본 기능이 건드릴 **MVP-B 범위의 한계** 는 어디까지입니까?
후보:
- (a) `review_queue` + SR 알고리즘 + `/solo/start` 통합까지 (R1~R5 + R6)
- (b) (a) + 일일 상한 + 대시보드 통계 (R1~R8)
- (c) **최소 버전** — `review_queue` + SM-2 pure function + 조회 API 만, `/solo/start` 통합은 후속 (R1~R4)

**C3 — 성공 기준 (Success)**
어떤 지표로 "성공" 을 측정합니까?
후보:
- (a) **7일 retention 으로 측정한 리콜률** (기존 learner 대조군 대비 +X%p)
- (b) **복습 예정 문제 대비 실제 복습 완료율** ≥ 70%
- (c) **총 학습 시간 대비 정답률 증가 속도** (SR 도입 전후 비교)
- (d) 수강생 설문 주관 평가만 (MVP 간소화)

### 5.2 동적 질문 2개 (D1~D2)

**D1 — foundation 통과 정의 (활성화 트리거)**
SR 큐가 활성화되기 전에 "foundation 통과" 를 어떻게 정의할지 결정이 필요합니다.
후보:
- (a) **해당 주차 문제 70% 이상 최소 1회 정답** — 빠른 활성 (1~2일 내 SR 시작)
- (b) **주차 완료** (모든 주차 문제 1회 이상 시도) — 보수적. 1주일 후 SR 시작
- (c) **미니 캡스톤 통과** (MVP-C 도입 시) — 가장 보수적. 구조적 이해 확인 후
- (d) **foundation 게이트 없음** — 1회 답변 순간부터 바로 SR 큐 편입. 학습 초기에도 망각 방지 혜택
- (e) 사용자 지정 다른 기준

**D2 — SR 큐와 random pool 의 혼합 정책**
`/solo/start` 호출 시 SR 큐에 오늘자 복습 N 건이 있고 학습자가 M 라운드 요청했을 때 (N > 0, M = 10 가정):
후보:
- (a) **SR 먼저, 소진 후 random** — `min(N, M)` 만큼 SR, 나머지 random
- (b) **7:3 비율** — SR 70% + random 30% (SR 큐 넉넉하면 7개, 모자라면 보충)
- (c) **사용자가 모드 선택** — UI 에 "복습 모드" 토글 버튼. 학습자가 의식적으로 선택
- (d) **Due 임박도 기반 자동** — `due_at` 이 오늘보다 2일 이상 지난 경우만 우선, 아니면 random 중심
- (e) 사용자 지정 다른 정책

---

## 6. 다음 단계

1. **본 브리프 사용자 검토** — C1~C3 + D1~D2 답변 수집
2. **Phase 1 — 3+1 합의 (Agent A/B/C + Reviewer)**
   - 알고리즘 (SM-2 vs FSRS vs 커스텀)
   - quality 매핑 공식 (R3 구현 디테일)
   - entity 스키마
   - 활성화 트리거 (D1 답변 반영)
   - 혼합 정책 (D2 답변 반영)
3. **ADR-019 작성** — Spaced Repetition 도입. consensus-004 의 "ADR-018" 오기재 정정도 본 ADR 에서 각주로 명시.
4. **SDD 반영** — `oracle-dba-learning-game-design.md` §6 (게임 루프) 확장
5. **TDD 구현** — 단계적 PR. 최소: R1+R2+R3 → R4 → R5/R6 → R7/R8

---

## 7. 관련 문서

- `docs/review/consensus-004-problem-format-redesign.md` §기각/채택 17, §ADR 후속 목록
- `docs/architecture/oracle-dba-learning-game-design.md` §MVP-B 범위
- `docs/decisions/ADR-014-capstone-structure.md` §동기 부족 보완
- `docs/architecture/automated-review-questionnaire-design.md` (본 Phase 0 프로토콜)

---

## 메타

| 항목 | 값 |
|------|---|
| 작성일 | 2026-04-24 |
| 작성자 | (메인 컨텍스트 에이전트) |
| 채택된 가설 | **SM-2 채택 지배적** (FSRS/Leitner 기각) |
| Phase 0 결정 완료 | 2026-04-24 (C1=d / C2=a+R6기각 / C3=b / D1=d / D2=a) |
| Phase 1 합의 완료 | 2026-04-24 → `docs/review/consensus-008-sm2-spaced-repetition.md` |
| Phase 1 추가 사용자 결정 | Q1=권장(C3 복합지표) · Q2=권장(D2 상한 70%) · Q3=b(clamp 항상 ON) · Q4=a(일일 상한 100) · Q5=a(timePenalty 제거) |
| 최종 ADR | **ADR-019** — `docs/decisions/ADR-019-sm2-spaced-repetition.md` |

## 8. Phase 1 이후 변경사항

본 브리프의 **R6 (foundation 게이트)** 는 사용자 Phase 0 결정 D1=(d) 로 **기각**. 최종 범위는 R1~R5.

Reviewer 가 Phase 1 3+1 합의에서 사용자 Phase 0 결정을 2건 조정:
- **C3 (b)** 단일 지표 → **복합 지표** (primary retention + secondary 완료율 + guard quality 저하) — 사용자 Q1 재확인 후 채택.
- **D2 (a)** `min(N, M)` → **SR 상한 70%** — 사용자 Q2 재확인 후 채택.

Phase 1 에서 Reviewer 가 추가로 확정:
- Q3: SM-2-lite ease clamp [2.3, 2.6] **항상 ON**
- Q4: 일일 신규 편입 상한 **100/user/day** (env `SR_DAILY_NEW_CAP`)
- Q5: quality 공식에서 **timePenalty 제거** (서버 재계산 부재에 따른 MVP 보수안, 해소는 기술 부채로 분리)

Agent B 1인 지적 CRITICAL 4건 (B-C1~C4) 전원 반영. Agent A CRITICAL 3건 전원 반영. 상세는 consensus-008 §4.
