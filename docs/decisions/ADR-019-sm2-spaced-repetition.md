# ADR-019 — SM-2 Spaced Repetition 도입

| 항목 | 값 |
|------|---|
| 상태 | Accepted (2026-04-24) |
| 제안 세션 | Session 7 Phase 1 |
| 선행 문서 | `docs/rationale/sm2-spaced-repetition-brief-v1.md` (Phase 0 브리프), `docs/review/consensus-008-sm2-spaced-repetition.md` (3+1 합의 원문) |
| 관련 ADR | ADR-013 (3단 채점), ADR-014 (캡스톤 구조), ADR-016 (LLM-judge 안전 §6 WORM), ADR-018 (salt rotation §4 D3 Hybrid §8 금지 6) |
| 정정 | consensus-004 및 design 본문에 "ADR-018 SM-2" 로 오기재된 부분은 본 **ADR-019** 로 교정 (ADR-018 번호는 salt rotation 이 선점함) |

---

## 1. 배경

`answer_history` 엔티티는 Session 1 부터 "향후 Spaced Repetition (SM-2/FSRS) 알고리즘이 이 테이블을 입력으로 사용한다" 는 주석을 통해 SR 존재 계약을 선언해 왔다 (`apps/api/src/modules/users/entities/answer-history.entity.ts:15`). consensus-004 에서 Agent C 단독 제안된 "`review_queue` 테이블 + due_at 기반 일간 복습, foundation 통과 후 활성" 이 채택되었고, MVP-B 범위에 포함되어 있다 (`docs/architecture/oracle-dba-learning-game-design.md` §MVP-B).

PR #14 (Session 6 PR #2) 머지로 free-form 채점 경로에 `partialScore` / `gradingMethod` / `rationale` / `user_token_hash` / `user_token_hash_epoch` 가 `answer_history` 에 WORM 저장되기 시작했다. SR 이 읽어야 할 입력 컬럼이 충분히 준비된 상태.

학습자 ~20명 규모 MVP 에서 **망각 곡선 기반 재노출**, **약한 문제 집중**, **매일 학습 동기 유지** 세 목적을 동시에 달성하기 위해 SM-2 를 채택한다.

---

## 2. 결정 요약

| 항목 | 결정 |
|------|------|
| 알고리즘 | **SM-2 canonical** + **SM-2-lite clamp (ease ∈ [2.3, 2.6]) 항상 ON** (사용자 Q3=b) |
| 엔티티 | `review_queue` 신규 테이블 — 파생/캐시 성격 (WORM 아님) |
| 즉시 편입 | 1회 답변 순간부터 SR 편입 (사용자 D1=d, foundation 게이트 없음) |
| 일일 신규 편입 상한 | **100/user/day** (사용자 Q4=a). 초과 시 drop + `ops_event_log(sr_queue_overflow)` |
| `/solo/start` 혼합 정책 | **SR 상한 70%** (`ceil(M × 0.7)`). 신규 최소 30% 보장 (Reviewer 수정, 사용자 Q2=권장) |
| quality 매핑 | `base - hintPenalty` — **timePenalty 제거** (사용자 Q5=a, 서버 재계산 부재 조작 유인 차단) |
| held / admin-override | held → SR 편입 스킵 / admin-override → overwrite (Agent B-C3) |
| 트랜잭션 | Tx1 (answer_history INSERT critical) / Tx2 (review_queue UPSERT 보조, try/catch + ops_event_log) — fail-open |
| 성공 지표 | **복합 지표**: primary 7일 retention (평균 quality ≥ 3.5) + secondary 복습 완료율 ≥ 70% + guard quality 0~1 비율 < 20% (Reviewer 격상, 사용자 Q1=권장) |
| UI | MVP: 세션 헤더 "오늘 복습 N" 뱃지만. review-only 모드는 MVP-C |

---

## 3. 알고리즘 공식 (pure function)

### 3.1 `sm2Next(prev, quality, anchor)`

```
function sm2Next(prev, quality, anchor = new Date()):
  if quality < 3:
    repetition = 0
    intervalDays = 1
  else:
    repetition = prev.repetition + 1
    if repetition == 1: intervalDays = 1
    elif repetition == 2: intervalDays = 6
    else: intervalDays = round(prev.intervalDays * prev.easeFactor)

  ease = prev.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  ease = max(1.3, ease)             # SM-2 canonical lower bound

  # SM-2-lite clamp (사용자 Q3=b 항상 ON)
  ease = clamp(ease, 2.3, 2.6)

  dueAt = anchor + intervalDays days
  return { easeFactor: ease, intervalDays, repetition, dueAt,
           lastReviewedAt: anchor, lastQuality: quality }
```

**파라미터 기원**: Piotr Woźniak (1988) SM-2 원식. 하한 1.3 은 canonical, 상한 2.6 은 MVP 수렴 안정용.

### 3.2 `mapAnswerToQuality(input)` (최종)

```
function mapAnswerToQuality({ isCorrect, partialScore, hintsUsed, gradingMethod }):
  # B-C3 반영
  if gradingMethod == 'held': return null            # SR 편입 스킵
  # admin-override 는 overwrite 경로에서 별도 처리

  # partialScore null (MC/BlankTyping/TermMatch all-or-nothing) fallback
  ps = partialScore ?? (isCorrect ? 1 : 0)

  base = isCorrect
    ? (ps == 1 ? 5 : ps >= 0.7 ? 4 : 3)
    : (ps >= 0.3 ? 2 : ps > 0 ? 1 : 0)
  hintPenalty = min(hintsUsed, 2)
  # timePenalty 제거 (사용자 Q5=a, 서버 재계산 부재)
  quality = clamp(base - hintPenalty, 0, 5)
  return quality
```

**timePenalty 제거 근거**: 현재 `answer.submittedAt` 이 클라이언트 기준 값으로 그대로 저장됨 (`apps/api/src/modules/game/modes/blank-typing.mode.ts:62` 등). 서버 측 `Round.startedAt` 미존재 → 서버 재계산 불가 → 클라 조작 유인이 quality 보상으로 직결. 서버 재계산 경로 보강은 **ADR-019 §8 기술 부채** 로 분리.

---

## 4. 스키마

```sql
CREATE TABLE review_queue (
  user_id               UUID         NOT NULL,
  question_id           UUID         NOT NULL,
  ease_factor           NUMERIC(4,3) NOT NULL DEFAULT 2.500,
  interval_days         INT          NOT NULL DEFAULT 0,
  repetition            INT          NOT NULL DEFAULT 0,
  due_at                TIMESTAMPTZ,
  last_reviewed_at      TIMESTAMPTZ,
  last_quality          SMALLINT,
  algorithm_version     VARCHAR(16)  NOT NULL DEFAULT 'sm2-v1',
  user_token_hash       VARCHAR(32),
  user_token_hash_epoch SMALLINT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX idx_review_queue_user_due
  ON review_queue (user_id, due_at)
  WHERE due_at IS NOT NULL;
```

### 4.1 테이블 성격 — "파생/캐시" (Agent B HIGH)

**`review_queue` 는 파생 / 캐시 테이블이다**. `answer_history` 를 입력으로 하는 SM-2 상태의 materialized projection. 다음 성질을 갖는다:

1. **WORM 아님** — UPDATE 가 정상 동작. `(user_id, question_id)` 행이 매 답변마다 갱신.
2. **재생성 가능** — `answer_history` 를 시간순 replay 하면 전체 `review_queue` 를 재구성할 수 있다 (재해 복구 루트).
3. **`user_token_hash` 는 가변** — salt rotation 발생 시 다음 UPSERT 가 현재 epoch 로 재계산한다. `answer_history` 와 달리 과거 epoch 를 보존하지 않는다 (캐시 특성).
4. **WORM 트리거 설치 금지** (Agent A-CRITICAL #3) — `answer_history` 트리거 (migration 1714000002000) 를 `review_queue` 에 복제하는 행위는 SM-2 를 불능화시킨다.

### 4.2 `algorithm_version` 컬럼

`'sm2-v1'` default. 향후 FSRS 전환 시 별도 value 로 marking → 기존 행 마이그레이션 경로 확보 (Agent C 제안).

### 4.3 `user_token_hash` + `user_token_hash_epoch` (Agent B-C1)

ADR-018 §4 D3 Hybrid 대칭성. `answer_history` / `ops_event_log` 가 이미 보유하는 축. `review_queue` 도 동일 스키마 축으로 감사 일관성 확보. **단 가변 캐시** 라 salt rotation 후 다음 UPSERT 에서 새 epoch 로 재계산되며, 과거 epoch 는 보존되지 않는다 (answer_history 와의 운영 대칭성 차이 — 본 조항 §4.1-3 참조).

---

## 5. 통합 경로

### 5.1 `submitAnswer` 후처리 (Tx 분리)

```
async submitAnswer(answer):
  ...
  # Tx1: WORM critical path
  await dataSource.transaction(async em => {
    await historyRepo.save(historyInput)
  })

  # Tx2: SR 보조 (fail-open)
  if answer.playerId:           # 게스트 스킵 (A-CRITICAL #2)
    try:
      if gradingResult?.gradingMethod == 'admin-override':
        await reviewQueueService.overwriteAfterOverride(...)
      elif gradingResult?.gradingMethod != 'held':  # held 스킵 (B-C3)
        quality = mapAnswerToQuality(...)
        await reviewQueueService.upsertAfterAnswer(userId, questionId, quality)
    catch (err):
      await gradingMeasurement.recordSrUpsertFail({ userId, questionId, error })
      logger.warn(err)
  ...
```

- `answer_history` 는 반드시 성공 (WORM, critical).
- `review_queue` 실패는 학습자 응답을 막지 않는다 (fail-open). 관측은 `ops_event_log(kind='sr_upsert_failed')` 로.
- UPSERT 원자성 (B-C2): PostgreSQL `INSERT ... ON CONFLICT (user_id, question_id) DO UPDATE SET ...` 단일 statement.

### 5.2 `/solo/start` — `pickQuestions(..., { srRatio: 0.7 })`

```
srLimit = ceil(rounds * 0.7)
dueQuestions = await findDue(userId, { topic, week, gameMode, difficulty }, srLimit)
remaining = rounds - dueQuestions.length
randomQuestions = remaining > 0
  ? await pickRandom({ topic, week, gameMode, difficulty }, remaining, { excludeIds: dueQuestions.map(q => q.id) })
  : []
return [...dueQuestions, ...randomQuestions]
```

- SR 상한 70% — **70% 는 상한**. SR 큐가 7 미만이면 random 이 부족분을 보충 (Reviewer 수정, 사용자 Q2=권장).
- `gameMode` 필터 (A-CRITICAL #1): `findDue` 는 `JOIN questions` 로 `gameMode/topic/week/difficulty` 정합 필터링 수행.
- 게스트 (userId null): SR 경로 완전 스킵, 기존 random only.

### 5.3 일일 신규 편입 상한 (B-C4)

```
env: SR_DAILY_NEW_CAP=100

async upsertAfterAnswer(userId, questionId, quality):
  existing = await findOne({ userId, questionId })
  if !existing:
    todayInsertedCount = await count({ userId, createdAt >= today })
    if todayInsertedCount >= SR_DAILY_NEW_CAP:
      await gradingMeasurement.recordSrQueueOverflow({ userId, questionId })
      return   # drop
  # UPSERT (ON CONFLICT)
  ...
```

env 로 튜닝 가능. drop 된 문제는 다음 날 첫 답변 시 새로 편입.

---

## 6. 성공 지표 (복합, Reviewer 격상)

### 6.1 Primary — 7일 retention

```
SELECT AVG(latest.last_quality) AS retention_quality
FROM review_queue latest
WHERE latest.last_reviewed_at >= NOW() - INTERVAL '7 days'
  AND latest.repetition >= 2      -- r2 이상 (1회 복습 완료 후)
```

목표: `≥ 3.5` (대조군 없이 절대값).

### 6.2 Secondary — 복습 완료율 (사용자 결정 C3=b 보존)

```
completed = COUNT(*) WHERE last_reviewed_at > (last_reviewed_at - interval_days days) - epsilon
scheduled = COUNT(*) WHERE due_at <= NOW()
rate = completed / scheduled
```

목표: `≥ 70%`.

### 6.3 Guard — quality 0~1 비율

```
low_rate = COUNT(*) FILTER (WHERE last_quality <= 1) / COUNT(*)
```

경보: `> 20%` → 학습자가 벽에 부딪히는 신호, 간격 완화 검토.

### 6.4 대시보드 범위

학생 미공개 (B HIGH — "학생이 지표 인지 시 쉬운 문제만 골라 조작" 유인). 관리자 전용 대시보드.

---

## 7. 제외 / 연기 항목

| 항목 | 이유 | 재검토 시점 |
|------|------|-----------|
| 서버 측 `Round.startedAt` + 서버 재계산 | 기존 시스템 부채 (본 ADR-019 §3.2 timePenalty 제거와 연결) | Session 8+ 별도 PR |
| review-only 모드 UI (`/solo/start?mode=review-only`) | MVP 자동 통합 우선, UX 분기 증가 회피 | MVP-C 도달 후 |
| SR 전용 대시보드 UI | Grafana SQL 쿼리만 고정, UI 는 수요 검증 후 | MVP-C |
| FSRS 전환 | SM-2 데이터 3개월+ 확보 후 | MVP-C 후반 |
| Redis ZSET `by:due_at` 캐시 | MVP 규모에서 PostgreSQL 단일 테이블 충분 | peak rps ≥ 50 도달 |
| `SR_EASE_CLAMP` off 전환 | 사용자 Q3=b 항상 ON | 데이터 6개월+ 확보 후 (ease 변동성 관측 기반) |
| foundation 게이트 | 사용자 D1=d 폐기 (1회 답변부터 SR 편입) | 재도입 시 ADR 필요 |

---

## 8. 기술 부채 (연결 ADR / 해소 예약)

### 8.1 timeTakenMs 서버 재계산 경로 부재 (Agent B HIGH)

- **현 상태**: `answer.submittedAt` 을 `timeTakenMs` 로 직접 저장 (`blank-typing.mode.ts:62` 등). 서버 측 round 시작 시각 미기록.
- **ADR-019 완화책**: quality 공식에서 timePenalty 제거 (§3.2).
- **해소 계획**: `Round.startedAt: number` 필드 추가 + mode 에서 `timeTakenMs = answer.submittedAt - round.startedAt` + 프론트 클라이언트 `epoch ms` 전송으로 교정. Session 8+ 별도 세션.
- **재도입 조건**: 해소 후 quality 공식에 timePenalty 재도입 검토.

### 8.2 race 조건 방어 (B-C2 부속)

MVP 규모 (~1.7 rps) 에서 동일 user × 동일 question 동시 제출 가능성 극히 낮음. 그러나 브라우저 재시도·더블클릭 시나리오 가능. `ON CONFLICT DO UPDATE` 로 충분하지만 향후 `SELECT ... FOR UPDATE` 또는 advisory lock 재검토 — 50 rps 도달 시.

---

## 9. 구현 로드맵

| PR | 범위 | 선행 조건 |
|----|------|-----------|
| PR-1 | `review_queue` entity + migration 1714000007000 + ReviewModule 스켈레톤 + 본 ADR + consensus-008 + 브리프 Q1~Q5 업데이트 | 본 ADR 수락 |
| PR-2 | `sm2Next` + `mapAnswerToQuality` pure function + 단위 테스트 (TDD) | PR-1 |
| PR-3 | `submitAnswer` Tx1/Tx2 분리 + `ReviewQueueService.upsertAfterAnswer` + `overwriteAfterOverride` + 일일 상한 + ops_event_log | PR-2 |
| PR-4 | `GET /api/solo/review-queue` + `pickQuestions(..., { srRatio: 0.7 })` + `/solo/start` 통합 | PR-3 |
| PR-5 | Next.js `/solo` 세션 헤더 "오늘 복습 N" 뱃지 UI | PR-4 |
| PR-6 | `sr_metrics_daily` 집계 쿼리 (primary / secondary / guard) + consensus-008 §6 measurement 반영 | PR-4 |

---

## 10. 결정 소급 / 변경 기록

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-24 | 본 ADR 최초 Accepted | Phase 0 브리프 + Agent A/B/C 독립 분석 + Reviewer 합의 + 사용자 Q1~Q5 |

---

## 11. 참조

- `docs/rationale/sm2-spaced-repetition-brief-v1.md` — Phase 0 질문지 원본
- `docs/review/consensus-008-sm2-spaced-repetition.md` — 3+1 합의 보고서 원문 (사실 확인 섹션 포함)
- `apps/api/src/modules/users/entities/answer-history.entity.ts:15` — SR 입력 계약 최초 선언
- `docs/review/consensus-004-problem-format-redesign.md` §143, §191, §263 — 원래 "ADR-018 SM-2" 오기재 (본 ADR-019 로 정정)
- `docs/architecture/oracle-dba-learning-game-design.md` §MVP-B — SR 범위
- `docs/decisions/ADR-014-capstone-structure.md` §동기 보완 — 캡스톤 + SR 결합
- `docs/decisions/ADR-018-user-token-hash-salt-rotation.md` §4 D3 Hybrid — 본 ADR 대칭성 축
