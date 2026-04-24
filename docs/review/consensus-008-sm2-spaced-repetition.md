# Consensus 008 — SM-2 Spaced Repetition (ADR-019)

| 항목 | 값 |
|------|---|
| 날짜 | 2026-04-24 |
| 세션 | Session 7 Phase 1 |
| 의사결정자 | 3+1 에이전트 합의 (Agent A/B/C + Reviewer) + 사용자 Q1~Q5 결정 |
| 주제 | SM-2 알고리즘 기반 일일 복습 큐 도입 (MVP-B 범위) |
| 관련 ADR | ADR-013 / ADR-014 / ADR-016 §6 / ADR-018 §4,§8 / **ADR-019 (본 합의로 확정)** |
| 사전 문서 | `docs/rationale/sm2-spaced-repetition-brief-v1.md` (Phase 0) |

---

## 0. Phase 0 사용자 결정

Phase 0 자동화 검토 질문지 결과 (2026-04-24):

| # | 질문 | 사용자 결정 |
|---|------|-----------|
| C1 | 목적 | (d) 목적 3가지 모두 (망각 방지 + 학습 효율 + 지속 동기) |
| C2 | 범위 | (a) R1~R6 — 단 D1=(d) 와 모순으로 R6 기각 → 최종 R1~R5 |
| C3 | 성공 기준 | (b) 복습 예정 대비 실제 복습 완료율 ≥ 70% |
| D1 | 활성화 트리거 | (d) foundation 게이트 없음 — 1회 답변부터 즉시 SR 편입 |
| D2 | 혼합 정책 | (a) SR 먼저 + 소진 후 random `min(N, M)` |

---

## 1. Agent 분석 결과 요약

### 1.1 Agent A (구현 분석가)

**판정**: 조건부 채택 — 3.5~4.5일 추정.

- pure function 분리 가능: `sm2Next(prev, quality, anchor)` + `mapAnswerToQuality(...)`
- entity 스키마 상세 제시: `(user_id, question_id) PK + ease_factor numeric(4,3) + interval_days int + repetition int + due_at timestamptz + last_reviewed_at timestamptz + last_quality smallint?`
- migration 번호 `1714000007000`
- 인덱스: `(user_id, due_at)` partial
- `submitAnswer` 에서 `DataSource.transaction` 으로 answer_history + review_queue UPSERT 묶기 권고
- PR 분할 제안: PR1 pure fn → PR2 entity/migration → PR3 upsert 통합 → PR4 API → PR5 `/solo/start` 통합 → PR6 e2e

**A-CRITICAL 3건 (1인 지적)**:
1. `findDue` 가 `gameMode` 필터링 누락 시 UX 파괴 — `JOIN questions` 로 필터 필수
2. 비로그인 경로 (userId null) 시 SR 완전 스킵 분기
3. WORM 트리거 (migration 1714000002000) 의 `review_queue` 복제 금지 — ADR-019 에 명시적 부정문

### 1.2 Agent B (품질/안전성 검증가)

**판정**: 조건부 채택 — **1인 지적 CRITICAL 4건 격상 필요**.

**B-CRITICAL 4건**:

- **B-C1**: `review_queue.user_id` 평문만 저장 → ADR-018 §4 D3 Hybrid 대칭성 위반. `user_token_hash` + `user_token_hash_epoch` 컬럼 필수. `answer_history` / `ops_event_log` 가 이미 해당 컬럼 보유.
- **B-C2**: 동시 제출 race UPSERT 원자성 미명시. `ON CONFLICT (user_id, question_id) DO UPDATE` + `DataSource.transaction` 또는 advisory lock 필요.
- **B-C3**: `gradingMethod in ('held', 'admin-override')` 분기 규정 부재. held 는 isCorrect 미확정 → SR 편입 스킵. admin-override 는 appeal 인정 후 상태 → 기존 SR row overwrite.
- **B-C4**: D1=(d) 즉시 편입의 per-user 일일 상한 부재 → bot / noise 학습자 테이블 팽창. 권장 50/day + `ops_event_log(kind='sr_queue_overflow')`.

**B-HIGH**:
- `review_queue` 가 "파생/캐시 테이블" 임을 ADR-019 에 명문화 필요 (후속 세션 WORM 오혼동 방지)
- C3=(b) 측정 공식 조작 가능성 — 큐 비면 자동 100%, 분모 변동 취약
- `timeTakenMs` / `hintsUsed` 클라 조작 유인 → 서버 재계산 강제
- SR update 실패 시 fail-open + ops_event_log

### 1.3 Agent C (대안 탐색가)

**판정**: MVP 80% 채택 — 조기 수정 2건 권고.

- **조기 수정 1 (C3 복합 지표)**: primary 7일 retention (평균 quality ≥ 3.5) + secondary 복습 완료율 ≥ 70% + guard quality 0~1 비율 < 20%
- **조기 수정 2 (D2 SR 상한 70%)**: `ceil(M × 0.7)` — 신규 학습 최소 30% 보장
- quality 매핑 공식: `base - hintPenalty - timePenalty` (조합식) + clamp [0,5]
- 첫 리뷰 간격 `1일 → 2일` 검토 (피로) — Reviewer 가 기각
- `algorithm_version` 컬럼 (FSRS 전환 대비)
- SM-2-lite (초기 6~8주 ease clamp [2.3, 2.6]) 권장
- 활성화 UI: MVP 자동 통합 + 세션 헤더 뱃지. review-only 모드는 MVP-C
- 유지/수정 평가: C1 유지 / C2+D1 유지 / **C3 수정** / D1 유지 / **D2 수정**

---

## 2. Reviewer 사실 확인

코드·문서 직접 열람 4건:

- **A-CRITICAL #3 (WORM 복제)**: migration 1714000002000 확인 — `answer_history` 한정 UPDATE 트리거. `review_queue` 는 UPSERT 필수 → 복제 금지가 맞다.
- **B-C1 (D3 Hybrid 대칭)**: `answer-history.entity.ts:108-121` 에 `user_token_hash` / `user_token_hash_epoch` 컬럼 주석이 "DB 한정 감사·분석용" 명시. `review_queue` 도 분석 테이블이나 **WORM 아님 → salt rotation 후 과거 hash 보존 불필요** (UPSERT 시 현재 epoch 재계산). 스키마 대칭은 채택, 운영 대칭은 명시적 구분.
- **B-C3 (held/admin-override)**: `grading.types.ts:24` 에 `'held'` / `'admin-override'` 실존. orchestrator 에서 all UNKNOWN 시 `held` 경로 구현 확인.
- **ADR 번호**: ADR-018 이 salt rotation 으로 선점. 본 합의의 SM-2 는 **ADR-019** 로 확정.

---

## 3. 합의율

| 분류 | 건수 | 비고 |
|------|------|------|
| 일치 (3 Agent 동의) | 7 | SM-2 채택 · pure function 분리 · 핵심 컬럼 · migration 번호 · `(user_id, due_at)` 인덱스 · `algorithm_version` · D1=(d) |
| 부분 일치 | 3 | C3 측정 (A·B vs C) · D2 혼합 (A·B vs C) · `findDue` + `pickRandom` 통합 (A vs B·C 무언급) |
| 불일치 | 1 | 첫 리뷰 간격 (A·B 1일 / C 1~2일) |
| 누락 (1인 지적) | 8 | B-C1~4 + A-CRITICAL 3 + C의 SM-2-lite clamp |
| **1인 CRITICAL** | **4건** | 모두 Agent B (B-C1~C4) |

---

## 4. CRITICAL 처리 결정 (Session 4 격상 룰)

### 4.1 B-C1 — `review_queue.user_token_hash` + `_epoch` 컬럼

**판정**: **조건부 반영** (컬럼 추가, 운영 정책은 가변 캐시로 구분)

- 스키마 대칭성: 채택 — `user_token_hash varchar(32)` + `user_token_hash_epoch smallint` 추가
- 운영 대칭성: **구분** — `review_queue` 는 WORM 아님. salt rotation 후 UPSERT 시 현재 epoch 로 재계산. 과거 epoch 비보존.
- ADR-019 §4.1 "파생/캐시 테이블 성격" 에 명문화.

### 4.2 B-C2 — UPSERT 원자성

**판정**: **즉시 반영 (CRITICAL 확정)**

- `INSERT ... ON CONFLICT (user_id, question_id) DO UPDATE SET ...` 단일 statement 로 원자성 확보.
- `submitAnswer` 에서 `DataSource.transaction` 으로 묶되, **Tx1 (answer_history) / Tx2 (review_queue) 분리** (B HIGH fail-open 반영).

### 4.3 B-C3 — held / admin-override 분기

**판정**: **즉시 반영 (CRITICAL 확정)**

- `gradingMethod == 'held'` → SR 편입 스킵 (`mapAnswerToQuality` 가 null 반환)
- `gradingMethod == 'admin-override'` → overwrite 경로 (appeal 인정 후 신뢰도 최상, 기존 row 재산정)
- `mapAnswerToQuality` 앞단에 early-return 명시.

### 4.4 B-C4 — 일일 신규 편입 상한

**판정**: **반영 + 기본값 완화** (B 권장 50 → **100**)

- 사용자 Q4=(a) 로 100 확정. env `SR_DAILY_NEW_CAP=100` 로 운영 튜닝 가능.
- 초과 시 drop + `ops_event_log(kind='sr_queue_overflow')` 기록.
- **신규 편입만 제한** (기존 row UPDATE 는 무제한).

### 4.5 A-CRITICAL 3건

- A-C1 `gameMode` 필터: 즉시 반영 — `findDue(userId, { topic, week, gameMode, difficulty }, limit)`
- A-C2 비로그인 null: 즉시 반영 — `submitAnswer` 앞단 `if (!playerId) return;` 분기
- A-C3 WORM 복제 금지: 즉시 반영 — ADR-019 §4.1 에 명시적 부정문

---

## 5. 분류별 최종 결정

### 5.1 일치 항목 채택 (7건)

| # | 항목 |
|---|------|
| 1 | SM-2 알고리즘 채택 (FSRS/Leitner 기각 유지) |
| 2 | `sm2Next` + `mapAnswerToQuality` pure function 분리 |
| 3 | entity 핵심 컬럼 집합 |
| 4 | migration 번호 1714000007000 |
| 5 | 부분 인덱스 `(user_id, due_at) WHERE due_at IS NOT NULL` |
| 6 | `algorithm_version` 컬럼 (default `'sm2-v1'`) |
| 7 | D1=(d) 1회 답변부터 즉시 편입 |

### 5.2 부분 일치 해소

**C3 측정** (A·B 유지 vs C 복합) — **C 안 채택** (사용자 Q1=권장 확인)
- primary 7일 retention 평균 quality ≥ 3.5
- secondary 복습 완료율 ≥ 70% (사용자 결정 보존)
- guard quality 0~1 비율 < 20%

**D2 혼합** (A·B 유지 vs C 상한 70%) — **C 안 채택** (사용자 Q2=권장 확인)
- `ceil(M × 0.7)` SR + 나머지 random
- SR 큐 < 7 이면 random 으로 보충

**`findDue` + `pickRandom` 통합** — **A 안 채택**
- 단일 함수 `pickQuestions(userId, { ... }, limit, { srRatio: 0.7 })`

### 5.3 불일치 해소

**첫 리뷰 간격** — **SM-2 canonical 1일 유지** + SM-2-lite clamp 별개 채택

### 5.4 누락 (1인 지적) 판정

| 제안 Agent | 항목 | 판정 |
|-----------|------|------|
| B | B-C1~C4 | §4 에서 상세 판정 — 4건 모두 반영 |
| A | WORM 복제 / 게스트 null / gameMode | §4 에서 반영 |
| B (HIGH) | "파생/캐시 테이블" 명문화 | **채택** — ADR-019 §4.1 |
| B (HIGH) | timeTakenMs 클라 조작 유인 | **채택 — 사용자 Q5=(a) 로 quality 공식에서 timePenalty 제거** (서버 재계산은 §8 기술 부채로 분리) |
| B (HIGH) | SR update 실패 시 fail-open + ops_event_log | **채택** — Tx2 try/catch + `ops_event_log(kind='sr_upsert_failed')` |
| C | SM-2-lite ease clamp | **채택, 사용자 Q3=(b) 항상 ON** |
| C | quality 매핑 공식 | **채택 (timePenalty 제거 버전)** |
| C | 활성화 UI MVP 자동 통합 | **채택** — 세션 헤더 뱃지만 |

---

## 6. 사용자 추가 결정 (Q1~Q5)

Reviewer 가 사용자 Phase 0 결정을 덮어쓰거나 신설한 세부 항목 재확인.

| Q | 질문 | 사용자 결정 | 반영 위치 |
|---|------|-----------|----------|
| Q1 | C3 복합 지표 채택? | **(a) 권장 — 복합 지표 채택** | ADR-019 §6 |
| Q2 | D2 SR 상한 70% 채택? | **(a) 권장 — 70% 상한 채택** | ADR-019 §5.2 |
| Q3 | SM-2-lite ease clamp | **(b) 항상 ON** | ADR-019 §3.1 |
| Q4 | 일일 신규 편입 상한 | **(a) 100** | ADR-019 §5.3 |
| Q5 | timeTakenMs 처리 | **(a) quality 공식에서 timePenalty 제거** | ADR-019 §3.2, §8 부채 |

---

## 7. 실행 계획 (PR 분할 — ADR-019 §9 와 동일)

| PR | 범위 | TDD 범위 |
|----|------|---------|
| PR-1 | entity + migration + ReviewModule 스켈레톤 + 문서 3종 (ADR-019, 본 합의, 브리프 업데이트) | migration up/down, entity 로드 |
| PR-2 | `sm2Next` + `mapAnswerToQuality` pure fn | quality 0~5 전수 + clamp 경계 + held null + ease clamp |
| PR-3 | `submitAnswer` Tx 분리 + UPSERT + held/admin-override/일일 상한 | race / held 스킵 / overflow drop / fail-open |
| PR-4 | `pickQuestions(..., srRatio=0.7)` + `GET /api/solo/review-queue` + `/solo/start` 통합 | gameMode 필터 / 게스트 null / SR 7+random 3 비율 |
| PR-5 | Next.js 세션 헤더 "오늘 복습 N" 뱃지 | 스냅샷 + 0건 엣지 |
| PR-6 | `sr_metrics_daily` 집계 쿼리 + §6 지표 | primary/secondary/guard 집계 단위 테스트 |

---

## 8. 메타

- **합의율**: 일치 7 / 총 유효 쟁점 19 ≈ **36.8%** (구현 세부 검증 규모에서는 정상 범위, `multi-agent-system-design.md` §7.3 관찰 기록 참조)
- **유효 이견 반영 건수**: 11건
- **1인 CRITICAL 격상**: 4건 (모두 Agent B) — 전원 반영 (B-C4 만 기본값 50→100 완화)
- **사용자 결정 Reviewer 덮어쓰기**: 2건 (C3, D2) — 사용자 Q1/Q2 재확인 후 반영
- **사용자 신규 결정**: 3건 (Q3 clamp / Q4 상한 / Q5 timePenalty)

---

## 9. 참조 파일 (절대 경로)

- `docs/rationale/sm2-spaced-repetition-brief-v1.md`
- `docs/decisions/ADR-019-sm2-spaced-repetition.md`
- `docs/decisions/ADR-013-grading-pyramid.md`
- `docs/decisions/ADR-014-capstone-structure.md`
- `docs/decisions/ADR-016-llm-judge-safety.md`
- `docs/decisions/ADR-018-user-token-hash-salt-rotation.md`
- `apps/api/src/modules/users/entities/answer-history.entity.ts:15,108-121`
- `apps/api/src/migrations/1714000002000-AddAnswerHistoryWormTrigger.ts`
- `apps/api/src/modules/grading/grading.types.ts:24`
- `apps/api/src/modules/game/modes/blank-typing.mode.ts:62`

---

## 10. 다음 단계

1. 본 합의 문서 + ADR-019 + 브리프 Q1~Q5 업데이트 커밋 (PR-1 C0)
2. PR-1 entity + migration 순차 TDD
3. PR-2 ~ PR-6 순차 진행
