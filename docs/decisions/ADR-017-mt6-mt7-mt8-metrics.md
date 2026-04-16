# ADR-017: 운영 지표 MT6 / MT7 / MT8 신설 + ADR-011 메타 편향 주의문 갱신

**상태**: Accepted
**날짜**: 2026-04-16
**의사결정자**: 3+1 에이전트 합의
**관련 합의**: `docs/review/consensus-004-problem-format-redesign.md`
**관련 ADR**: ADR-011 (M3 모델), ADR-013 (3단 채점), ADR-014 (캡스톤), ADR-016 (LLM-judge 안전)

---

## 맥락 (Context)

현행 `operational-monitoring-design.md` v1.0은 다음 지표로 운영 100건 모니터링을 수행:

- **MT3**: scope-whitelist 위반율 (키워드 화이트리스트 위반)
- **MT4**: blank-consistency (빈칸타이핑 정답 일관성)

ADR-012(answerFormat 축) + ADR-013(3단 채점) + ADR-014(캡스톤) 도입 후 신규 모드/형식/구조에 기존 MT3/MT4가 모두 적용되지 않는다:

- `multiple-choice`에는 MT4 불가 (blank 없음)
- `free-form`은 MT3 scope만 적용, canonicalization 통과율 별도 지표 필요
- 캡스톤 step 간 DAG 일관성은 기존 지표 범위 밖
- LLM-judge 호출률은 ADR-013의 핵심 게이트이나 현행 지표에 없음

Agent B는 `ops_question_measurements`에 `mode` 컬럼 + 신규 MT 지표를 필수안으로 지정했다.

또한 ADR-011 §1.6 메타 편향 주의문 4항은 "M3 생성" 기준으로 작성되어 있으며, ADR-013으로 M3가 채점에도 사용되므로 **"자기검증 편향"** 조항을 추가해야 한다.

## 결정 (Decision)

### 1. `ops_question_measurements` 스키마 확장

```sql
ALTER TABLE ops_question_measurements
  ADD COLUMN mode VARCHAR(32),               -- game_mode
  ADD COLUMN answer_format VARCHAR(32),      -- ADR-012 축
  ADD COLUMN grading_method VARCHAR(32);     -- ADR-013: ast / keyword / llm / held / override
```

기존 샘플은 `mode='blank-typing'`, `answer_format='single-token'`, `grading_method='keyword'` 기본값으로 backfill.

### 2. 신규 지표 정의

#### MT6 — free-form-canonical-match rate

- **정의**: 작성형 답안 중 Layer 1(AST canonicalize)에서 PASS/FAIL 확정된 비율
- **계산**: `layer_1_resolved / total_free_form_gradings`
- **목표**: ≥ 80%
- **게이트 breach**: 60% 미만 2시간 지속 시 `ops_event_log` `kind='mt6_breach'`
- **대응**: Oracle 방언 파서 커버리지 확장 또는 Layer 2 튜닝

#### MT7 — capstone-step-consistency

- **정의**: 캡스톤 세션 step 간 DAG 위반(순환 / 미정의 의존) 발생 건수
- **계산**: `capstone_sessions.step_progress`에서 `depends_on_step_ids`가 미완료 상태로 진행된 step 수
- **목표**: 0 (무결성 지표, 하루 합산 0 유지)
- **게이트 breach**: 24시간 내 ≥ 1건 시 즉시 알람
- **대응**: capstone_templates seed 검증 강화 (CI)

#### MT8 — llm-judge-invocation-ratio

- **정의**: 전체 채점 중 Layer 3(LLM-judge) 호출 비율
- **계산**: `layer_3_calls / total_gradings`
- **목표**: ≤ 10%
- **게이트 breach**: 15% 초과 4시간 지속 시 `gate_breach`
- **대응**:
  - Layer 1/2 커버리지 개선 검토
  - M3 자기검증 편향 심화 위험 → ADR-019(채점 모델 분리) 승격 검토 트리거

### 3. Phase B 집계 cron 확장

기존 `OpsAggregationService`에 MT6/MT7/MT8 집계 로직 추가:

```typescript
const measurements = {
  MT3: scopeWhitelistViolationRate(rows),
  MT4: blankConsistencyRate(rows.filter(r => r.answer_format === 'single-token')),
  MT6: freeFormCanonicalMatchRate(rows.filter(r => r.answer_format === 'free-form')),
  MT7: capstoneStepConsistencyViolations(capstoneSessions),
  MT8: llmJudgeInvocationRatio(rows)
};
```

window-1 리포트(`docs/operations/monitoring-window-1.md`)에 MT6/MT7/MT8 섹션 추가.

### 4. ADR-011 메타 편향 주의문 갱신 (§1.6 추가 조항)

기존 4항 + 신규 5항/6항:

5. **자기검증 편향 (Self-grading Bias)**: M3는 ADR-013으로 문제 생성 및 Layer 3 LLM-judge 채점에 동시 사용된다. 동일 모델 내 일관된 해석으로 인해 다른 모델이 판단했다면 다르게 분류될 수 있는 경계 케이스가 숨을 수 있다. MT8 호출률을 10% 이하로 유지하고, 분기별 "M3 생성 + 타 모델 채점" 대조 샘플링(≥ 50건)을 수행한다.

6. **모델 목적 적합성 주의 (Training Objective Mismatch)**: Qwen3-Coder는 코드 *생성*에 튜닝되었으며 코드 *평가*에는 최적이 아닐 수 있다. MT8 breach 또는 운영 이의제기(`grading_appeals`) 집중 발생 시 ADR-019(채점 전용 모델 분리) 트리거.

### 5. `ops_event_log` 이벤트 종류 확장

| kind | 설명 | 연계 ADR |
|------|------|---------|
| `mt6_breach` | MT6 < 60% 2시간 지속 | ADR-013 |
| `mt7_breach` | MT7 ≥ 1건 / 24시간 | ADR-014 |
| `mt8_breach` | MT8 > 15% 4시간 지속 | ADR-013, ADR-019 |
| `capstone_similarity_alert` | 답안 공유 의심 (edit distance < 10%) | ADR-014, ADR-016 |
| `grading_appeal` | 사용자 이의제기 접수 | ADR-016 |
| `admin_override` | 관리자 채점 번복 | ADR-016 |

## 선택지 (Options Considered)

### 선택지 A: MT6 / MT7 / MT8 동시 도입 (채택)
- 장점: ADR-013/014/016의 핵심 게이트를 동시 확보.
- 단점: 집계 cron 구현 공수 증가.

### 선택지 B: MT8만 우선 (LLM-judge 호출률 모니터링)
- 장점: 최소 변경.
- 단점: 캡스톤 DAG 무결성 / 작성형 커버리지 미측정 → 블라인드 스팟.

### 선택지 C: 통합 지표 (단일 "contents_health_score")
- 장점: 대시보드 단순화.
- 단점: 원인 분석 불가. 개별 breach 대응 지연.

## 근거 (Rationale)

**채택: 선택지 A**

- **ADR-013/014/016의 게이트가 측정 없이 무의미** — 각 지표가 대응되는 ADR이 명확.
- **Agent B 필수안 전체 수용** — `mode` 컬럼 + 3개 신규 MT + 이벤트 종류 확장.
- **ADR-011 주의문 갱신이 ADR-013 도입과 동시 필요** — 자기검증 편향이 실질 리스크로 전환됨.
- **window-1 리포트 호환** — 기존 Phase B 리포트 구조 재사용, 섹션 추가만 필요.

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 지표 정의 + 집계 cron 확장 구체안 | OpsAggregationService 기존 구조 재사용. MT6/MT7/MT8 각각 독립 계산식 |
| Agent B (품질) | 필수 안전장치로 지정 | 신규 모드/형식/구조에 MT3/MT4 미적용 = 블라인드. 3개 신규 MT 없으면 운영 게이트 무의미 |
| Agent C (대안) | distractor 품질 assertion 제안 | MC 전용 MT 추가 검토 (후순위). 현행 3개 MT 우선 |
| **Reviewer** | **선택지 A 채택** | ADR-011/013/014/016 게이트 완결. MC 전용 assertion은 MVP-A 시 별도 검토 |

## 결과 (Consequences)

### 긍정적
- ADR-013(3단 채점) + ADR-014(캡스톤) + ADR-016(LLM-judge) 게이트 운영 가능
- `ops_event_log` 신규 kind 6종으로 관리자 가시성 확대
- ADR-011 자기검증 편향이 명시적 문서화 + 정량 게이트
- window-1 리포트 자동 확장

### 부정적
- `ops_question_measurements` 스키마 마이그레이션 + 기존 데이터 backfill 필요
- `OpsAggregationService` 테스트 케이스 추가 (신규 3 지표 × 각 3~5 cases = 9~15 cases)
- MT7 무결성 지표는 캡스톤 seed 품질에 민감 → CI 강화 필요

### 주의사항
- **MT6/MT7/MT8 집계는 Phase B 집계 cron에 통합** — 별도 cron 신설 금지.
- **MT7 breach = 즉시 알람** (다른 지표는 지속 시간 게이트). 캡스톤 seed 오류는 사용자 블로킹이므로 빠른 대응 필요.
- **ADR-019 승격 조건 명시** — MT8 breach 3회 / 월 또는 `grading_appeals` ≥ 10건 / 주 시 ADR-019 재검토 미팅 소집.
- **MC 전용 assertion(`mc-distractor-plausibility`)** — Agent C 제안. MVP-A 착수 시 promptfoo에 추가 검토 (후순위).
- **distractor 품질 모니터링** — 객관식 오답 선지가 너무 쉬운지(명백 오답) 측정. 운영 데이터 축적 후 별도 지표 추가 검토.
- **ADR-011 주의문 갱신**은 본 ADR과 동시 커밋. SDD §1.6도 동기화.

---

**관련 문서**:
- `docs/review/consensus-004-problem-format-redesign.md`
- `docs/architecture/operational-monitoring-design.md` (v1.1 개정 예정)
- `docs/architecture/oracle-dba-learning-game-design.md` §1.6 (v2.9 메타 편향 주의문 갱신)
- ADR-011 (M3 pin), ADR-013 (3단 채점), ADR-014 (캡스톤), ADR-016 (LLM-judge 안전), ADR-019 (채점 모델 분리, P2)
- `apps/api/src/modules/ops/` (OpsAggregationService)
