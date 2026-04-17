# 운영 초기 100건 모니터링 파이프라인 설계 (SDD)

> **ADR-011 채택 조건 #3** — primary OSS(M3 Qwen3-Coder-Next) 운영 배포 직후 첫 100건의 AI 문제 생성에 대한 MT3/MT4 재측정 + 이상 케이스 로그 + 게이트 판정 파이프라인.

| 항목 | 값 |
|---|---|
| **문서 유형** | SDD (Specification-Driven Design) |
| **버전** | **v1.1 (2026-04-16 — MT6/MT7/MT8 확장)** |
| **상태** | **승인 — Phase A/B 구현 완료. v1.1은 MVP-A/B/C 병행 확장 범위** |
| **선행 문서** | `docs/decisions/ADR-011-oss-primary-model-m3.md`, `docs/architecture/oss-model-evaluation-design.md` §1.6, `docs/rationale/oss-primary-model-selection-2026-04-15.md`, `docs/review/consensus-004-problem-format-redesign.md` |
| **관련 ADR** | ADR-009 (LangChain + Langfuse), ADR-011 (M3 primary), **ADR-013 (3단 채점), ADR-014 (캡스톤), ADR-016 (LLM-judge 안전), ADR-017 (MT6/MT7/MT8 신설)** |
| **후속 산출물** | MVP-A~C 확장 구현, dashboard UI, 알림 채널 결정 ADR, ADR-019 트리거 조건 |

---

## 1. 목적과 비목적

### 1.1 목적

1. **ADR-011 P1(M3 운영 개시) 직후 첫 100건의 실사용 문제 생성을 계산적으로 재측정**하여 R2(Claude 생성 Gold Set) 기준과 실 도메인(수강생 실제 학습 범위) 간 gap을 정량화한다.
2. **MT3/MT4 합격선 drift를 5% 이상으로 조기 감지**하여 Phase 3(Gold Set 확대) 또는 scope/prompt 보정 트리거를 자동 생성한다.
3. **수강생 신고 + 관리자 리뷰 이벤트를 구조화 로그로 보존**하여 P2(3개월 후 M4 이중 라우팅 재검토) 회의에 쓸 근거 데이터를 축적한다.

### 1.2 비목적

- 부트캠프 수강생 전체 학습 진도/성적 분석 (`user_progress` 도메인)
- Langfuse trace를 대체하는 LLM observability (Langfuse가 단일 진실 소스)
- A/B 실험 플랫폼 (P2 이후 별도 SDD)
- SLO/SLA 선언 (운영 1개월 후 별도 ADR에서 결정)

### 1.3 명확한 정의

| 용어 | 정의 |
|---|---|
| **초기 100건** | `ai_questions.source='ai-realtime'` row가 **DB 시점으로** 1~100번째에 생성된 문제 (rolling이 아닌 fixed window). 101번째 이후는 Phase B로 진입. |
| **재측정** | 평가 하네스의 `scope-whitelist` + `blank-consistency` assertion을 동일 함수(패키지 공유)로 운영 DB row에 재실행. |
| **이상 케이스** | (a) 관리자가 `status='rejected'` 처리 / (b) assertion 재측정 fail / (c) 수강생이 "정답 오류" 신고 / (d) 해당 문제의 `user_progress` 오답률 >70%. |
| **게이트 breach** | §1.6 기준 중 하나라도 기준 미달. |

---

## 2. 관측 대상과 기준 (SDD `oss-model-evaluation-design.md` §1.6 재진술)

| 지표 | 기준 | Breach 조치 | 범위 |
|---|---|---|---|
| MT3 재측정 pass | ≥ 95% | scope 확장 또는 prompt 재점검 | 전체 모드 |
| MT4 재측정 pass | ≥ 93% | prompt constraint 재점검 | `answer_format='single-token'` (빈칸) 전용 |
| **MT6 — free-form-canonical-match rate** (v1.1 신설) | ≥ 80% | Layer 1 AST 커버리지 개선 or Layer 2 튜닝 | `answer_format='free-form'` 전용 |
| **MT7 — capstone-step-consistency** (v1.1 신설) | 0 (하루 합산, 무결성 지표) | capstone_templates seed CI 강화 | 캡스톤 세션 전체 |
| **MT8 — llm-judge-invocation-ratio** (v1.1 신설) | ≤ 10% | Layer 1/2 커버리지 개선 → ADR-019 승격 검토 | 전체 채점 |
| 수강생 "정답 오류" 신고율 | ≤ 5% | 관리자 리뷰 큐 확대 + Phase 3 트리거 | 전체 |
| `p95` 지연 (AI 워커 실측) | ≤ 60s | BullMQ concurrency / num_ctx 검토 | 전체 |
| 이상 케이스 샘플링 | 10% 무작위 + 관리자 플래그 전수 | Langfuse trace + `ops_event_log` 저장 | 전체 |

> MT3/MT4는 SDD `oss-model-evaluation-design.md` §1.6 기준. MT6/MT7/MT8은 ADR-017에서 신설 — 각각 ADR-013/014/013의 운영 게이트 역할.

---

## 3. 데이터 모델

> **실제 스키마 정렬 (2026-04-16)**: 기존 테이블명은 `questions`(단수)이며 PK는 UUID(`@PrimaryGeneratedColumn('uuid')`)다. 본 SDD의 `ai_questions` / `BIGINT` 표기는 `questions` / `UUID`로 읽는다. TypeORM `synchronize: true`(dev)로 entity만 추가해도 스키마가 동기화되므로 본 Phase A에서 별도 SQL migration 파일은 작성하지 않고, entity 추가 + 회귀 테스트로 대체한다. 프로덕션 migration은 초기 배포 ADR에서 별도 처리.

### 3.1 신규 테이블: `ops_question_measurements`

**1 행 = 1 AI 문제의 운영 시점 재측정 결과.** 운영 배포 후 AI 문제가 `status='pending_review'`로 저장되는 직후 동기 inline으로 생성.

```sql
CREATE TABLE ops_question_measurements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  measured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- v1.1: 차원 분리 (ADR-017)
  mode             VARCHAR(32) NOT NULL,  -- 'blank-typing' | 'term-match' | 'result-predict' | 'category-sort' | 'scenario-sim' | 'multiple-choice'
  answer_format    VARCHAR(32) NOT NULL,  -- 'single-token' | 'free-form' | 'multiple-choice' | 'reorder' | 'drag-compose' | 'output-select'
  grading_method   VARCHAR(32),           -- 'ast' | 'keyword' | 'llm-v1' | 'held' | 'admin-override' (v1.1, ADR-013)

  -- 기존 지표
  mt3_pass         BOOLEAN NOT NULL,
  mt3_out_of_scope JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  mt4_pass         BOOLEAN,       -- blank 모드 외에는 NULL
  mt4_failures     JSONB,         -- blank/answer 불일치 상세 (nullable)

  -- v1.1 신규 지표 (ADR-017)
  mt6_canonical_match  BOOLEAN,   -- Layer 1 AST 해결 여부. free-form 외에는 NULL.
  mt7_step_dag_violation BOOLEAN DEFAULT FALSE,  -- 캡스톤 step DAG 위반 여부 (측정 시점)
  mt8_layer3_invoked   BOOLEAN NOT NULL DEFAULT FALSE,  -- LLM-judge 호출 여부

  latency_ms       INTEGER NOT NULL,
  model_digest     TEXT NOT NULL, -- verifyApprovedModel currentDigest
  grader_digest    TEXT,          -- v1.1: 채점 harness 버전 or LLM digest (ADR-013/016)
  window_index     INTEGER,       -- 1..100 (첫 100건), 이후 NULL
  UNIQUE (question_id)
);
CREATE INDEX idx_ops_measurements_window
  ON ops_question_measurements(window_index)
  WHERE window_index IS NOT NULL;
CREATE INDEX idx_ops_measurements_format
  ON ops_question_measurements(answer_format, measured_at DESC);
CREATE INDEX idx_ops_measurements_layer3
  ON ops_question_measurements(mt8_layer3_invoked, measured_at DESC)
  WHERE mt8_layer3_invoked = TRUE;
```

> **MT6/MT7/MT8 nullable 규칙**: MT6은 `answer_format='free-form'`에만 값, 그 외 NULL. MT7은 캡스톤 step 측정 시에만 의미, 그 외 FALSE. MT8은 항상 값 (채점은 전 모드).

`window_index`는 **측정 시점에 "이미 측정된 `source='ai-realtime'` row 수 + 1"** 로 계산 (§4.1). UUID PK 순서를 가정하지 않는다.

### 3.2 신규 테이블: `ops_event_log`

**수강생 신고 / 관리자 reject / 시스템 알림의 통합 구조화 로그.**

```sql
CREATE TABLE ops_event_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind         VARCHAR(32) NOT NULL, -- CHECK는 entity enum으로 대체
  question_id  UUID REFERENCES questions(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX idx_ops_event_log_kind_time ON ops_event_log(kind, created_at DESC);
-- 수강생 중복 신고 방지
CREATE UNIQUE INDEX uq_ops_event_student_report
  ON ops_event_log(user_id, question_id)
  WHERE kind = 'student_report_incorrect';
```

`kind` 허용값 (v1.1 확장 — ADR-017):
- 기존: `'student_report_incorrect' | 'admin_reject' | 'gate_breach' | 'measurement_fail'`
- v1.1 신규: `'mt6_breach' | 'mt7_breach' | 'mt8_breach' | 'capstone_similarity_alert' | 'grading_appeal' | 'admin_override'`

각 kind는 entity enum으로 강제. `payload` 스키마는 kind별 `Zod` schema로 검증 (`apps/api/src/modules/ops/event-payloads.ts`).

### 3.3 기존 테이블 변경 — 없음

초기 설계의 `ai_questions.monitored_until` 컬럼은 제거. `window_index`가 `ops_question_measurements`에 이미 존재하고, Phase A에서는 `questions` 본체를 건드리지 않아도 조회가 가능하다 (§4.3 집계 쿼리).

> Langfuse는 이미 trace/generation을 저장하므로 중복 저장하지 않는다. `ops_question_measurements`는 판정 결과만, Langfuse는 raw trace만 담는다.

---

## 4. 처리 흐름

### 4.1 A 경로 — AI 문제 생성 직후 (synchronous inline)

```
AiQuestionGenerator.generate(input)
  └─ QuestionPoolService.save({ status: 'pending_review', ... })
      └─ [NEW] OpsMeasurementService.measureSync(question)
          ├─ scope-whitelist assertion 재실행 → mt3_pass
          ├─ blank-consistency assertion 재실행 → mt4_pass
          ├─ ai_questions.sequence_number 조회 → window_index (1..100 or null)
          └─ ops_question_measurements INSERT
```

- **동기 inline 선택 이유**: 첫 100건은 전수 측정 필수이므로 retry/재시도 비용보다 latency 노출이 더 안전. latency_ms는 이미 AI 호출에서 수집된 값 재사용.
- **실패 시**: 측정 실패도 `ops_event_log(kind='measurement_fail')`로 기록. 문제 저장 자체는 막지 않음 (운영 연속성 > 완벽성).

### 4.2 B 경로 — 수강생 신고 / 관리자 reject (이벤트 기반)

| 이벤트 | 트리거 | `ops_event_log` kind |
|---|---|---|
| 수강생이 문제 답안을 "정답 오류"로 플래그 (신규 UI) | `POST /api/questions/:id/report` | `student_report_incorrect` |
| 관리자가 review UI에서 reject | `PATCH /api/questions/:id/review { action: 'reject' }` | `admin_reject` |
| 주기 집계 배치가 breach 감지 | cron 1시간 간격 | `gate_breach` |

> 수강생 신고 엔드포인트는 **이번 설계 범위**. UI는 게임 결과 페이지의 각 문제에 "신고" 버튼 1개만 추가 (간단).

### 4.3 주기 집계 배치

**주기**: 1시간 (cron) — 초기 100건 단계에서는 DB 스캔 비용이 무시 가능.

**로직 (v1.1 확장 — ADR-017)**:
```sql
select
  count(*) filter (where mt3_pass)::float / count(*) as mt3_rate,
  count(*) filter (where mt4_pass)::float / count(*) filter (where mt4_pass is not null) as mt4_rate,
  -- v1.1 MT6: Layer 1 해결률 (free-form 전용)
  count(*) filter (where mt6_canonical_match) ::float /
    nullif(count(*) filter (where answer_format='free-form'), 0) as mt6_rate,
  -- v1.1 MT7: DAG 위반 건수 (하루 누적)
  count(*) filter (where mt7_step_dag_violation) as mt7_violations,
  -- v1.1 MT8: LLM-judge 호출 비율
  count(*) filter (where mt8_layer3_invoked)::float / count(*) as mt8_ratio,
  percentile_cont(0.95) within group (order by latency_ms) as p95_latency
from ops_question_measurements
where window_index is not null and window_index between 1 and 100;
```

**Breach 규칙 (v1.1 확장)**:
- 기존: MT3 < 0.95 / MT4 < 0.93 / p95 > 60000 → `gate_breach`
- **MT6 < 0.60 2시간 지속** → `mt6_breach` (ADR-013 Layer 1 커버리지 개선 트리거)
- **MT7 ≥ 1건 (24시간 내)** → `mt7_breach` **즉시 알람** (캡스톤 DAG 무결성, 사용자 블로킹 리스크)
- **MT8 > 0.15 4시간 지속** → `mt8_breach` (LLM-judge 과호출 → ADR-019 승격 검토)
- **`capstone_similarity_alert`**: `answer_history` edit distance < 10% 감지 시 즉시 (ADR-014 답안 공유 탐지)
- 수강생 신고율 > 5% / 7일 → `gate_breach` (기존 유지)

**ADR-019 승격 트리거**:
- MT8 breach 3회 / 월 **또는** `grading_appeals` ≥ 10건 / 주
- 트리거 시 별도 이벤트 `kind='adr019_trigger_review'` 생성 + 분기 대조 샘플링 자동 enqueue

### 4.4 100건 window 종료

`window_index=100`인 row가 측정된 직후 집계 배치가 **전 구간 요약 리포트**를 생성하여 `docs/operations/monitoring-window-1.md`로 저장 (첫 100건 고정 리포트). 이후는 rolling metric으로 전환.

---

## 5. 구현 단계 (Phase A/B/C)

| Phase | 범위 | 선행 조건 | 산출 |
|---|---|---|---|
| **A** (지금) | 데이터 수집만 — `ops_question_measurements` + `ops_event_log` 테이블 + inline 측정 + 수강생 신고 엔드포인트 | 본 설계서 사용자 검토 완료 | migration + service + TDD |
| **B** (운영 개시 직후) | 집계 cron + gate_breach 이벤트 생성 + DB-only 알림 | Phase A merge + M3 운영 개시 | NestJS Schedule + dashboard 조회 API |
| **C** (Phase B 안정화 후) | 관리자 대시보드 UI + Slack/email 알림 채널 | Phase B 2주 안정 가동 | Next.js 페이지 + 알림 채널 결정 ADR |

> **Phase A는 본 설계 승인 직후 TDD로 착수.** Phase B/C는 Phase A의 실측 데이터를 보고 재조정.

---

## 6. 결정 사항 (2026-04-16 사용자 승인)

| # | 결정 | 근거 |
|---|------|------|
| Q1 | **A안 — `ai_questions.id` 순서로 1~100번째 (fixed window)** | 단순, 감사 용이. §1.3 "초기 100건" 정의에 이미 편입됨 |
| Q2 | **A안 — 결과 페이지 "신고" 버튼 1개 + 사유 드롭다운 3종** (정답 오류 / SQL 오류 / 기타) | PII 노출 없음, UX 단순, 관리자 리뷰로 본문 확인 가능 |
| Q3 | **Phase B 진입 시 재결정** (Phase A는 DB-only) | Phase A 실측 데이터로 알림 우선순위 판단 |
| Q4 | **A안 — 1시간 cron** | 단순, 100건 window에서는 이 주기면 충분. 필요 시 Phase B에서 단축 |
| Q5 | **ADR-011 pin 파이프라인 재사용** — BullMQ 워커가 boot 시 `verifyApprovedModel()` 호출 + `currentDigest` in-memory 캐시 → 측정 시 join | 중복 조회 방지, pin drift 동시 차단 |

---

## 7. 예상 위험과 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Inline 측정이 AI 문제 저장을 지연시킴 | 수강생 체감 latency +100~200ms | 측정 자체가 pure 함수 + 동일 프로세스 → DB round-trip 1회만 추가. 실측 후 필요시 async 전환 |
| `ops_question_measurements` 테이블 폭증 (100건 이후에도 저장) | DB 용량 | Phase B에서 window_index IS NOT NULL만 hot, 나머지는 90일 후 partition 분리 |
| assertion이 운영 환경에서 평가 환경과 다른 동작 | MT3/MT4 재측정 오탐 | 평가/운영 모두 `@oracle-game/shared/utils/oracle-tokens` 동일 함수 의존 (ADR-010 이후 이미 공유). Phase A 구현 시 단위 테스트로 동일성 재검증 |
| 수강생 신고 악용 (특정 문제 집중 reject) | 데이터 왜곡 | `(user_id, question_id)` UNIQUE 제약 + 관리자 리뷰 대시보드에 신고자 분산 지표 추가 |

---

## 8. 테스트 전략 (Phase A)

- `OpsMeasurementService.measureSync` — `scope-whitelist` / `blank-consistency` assertion mock 주입 가능한 구조 + DB repository mock. 5+ 케이스 (mt3/mt4 pass 조합, blank 외 모드, 측정 실패, 순서 번호 100 경계)
- `ReportQuestionController.report` — 중복 신고 차단, 존재하지 않는 question_id, 인증 가드 → 4+ 케이스
- migration 검증 — 기존 `ai_questions` row에 대한 backfill 필요성 확인 (기본 NULL 허용)
- **통합 테스트**: `AiQuestionGenerator.generate` 호출 → `ops_question_measurements` row 검증 + `ops_event_log` measurement_fail 경로

---

## 9. 변경 이력

| 날짜 | 버전 | 변경 | 근거 |
|---|---|---|---|
| 2026-04-16 | **v0.1 (초안)** | 초안 작성 — ADR-011 채택 조건 #3 이행 + SDD `oss-model-evaluation-design.md` §1.6을 구현 단위로 확장 | 사용자 지시 + ADR-011 |
| 2026-04-16 | **v1.0** | 사용자 Q1/Q2/Q4 권장안 채택 → §6을 결정 사항 표로 교체. Phase A TDD 착수. | 사용자 직접 승인 |
| 2026-04-16 | **v1.1** | **MT6/MT7/MT8 신설 (ADR-017) + `ops_question_measurements` 차원 컬럼(mode/answer_format/grading_method) + `ops_event_log` kind 6종 확장 + ADR-019 승격 트리거 명시.** 문제 형태 재설계(consensus-004) 동반 확장. | ADR-012/013/014/016/017 |

---

**Phase A 구현 순서 (TDD)**:
1. DB migration — `ops_question_measurements`, `ops_event_log`, `ai_questions.monitored_until`
2. `OpsMeasurementService.measureSync` + 단위 테스트
3. `QuestionReportController` (수강생 신고 엔드포인트) + 단위 테스트
4. `AiQuestionGenerator`에 inline measure 호출 통합 + 기존 테스트 회귀 검증
