# Consensus 007 — MVP-B Session 6 GradingModule 배선 + D3 Hybrid 실 배선

**날짜**: 2026-04-23
**의사결정자**: 3+1 에이전트 합의 (Agent A/B/C + Reviewer) + 사용자 결정 (Q1~Q5)
**주제**: MVP-B Session 6/10 — free-form 채점 경로 실 활성화. 5건 작업 계획 검증.
**관련 ADR**: ADR-016 (§6 WORM, §7 D3 Hybrid, §추가 이의제기), ADR-018 (§4 D3 Hybrid, §5 epoch 원장, §8 금지 6, §10 유보, §11 rotation 절차)
**관련 합의**: consensus-005 (LLM-judge 아키텍처), consensus-006 (salt rotation 정책)
**본 세션 범위**: 합의 산출물 + Session 6 PR #1/PR #2 실행 계획 확정. 실행은 후속 커밋.

---

## 배경

Session 5 (PR #6, `fc71a85`) 머지로 ADR-018 §10 Session 5 이관 항목 + ADR-016 §6 WORM + §추가 이의제기가 전량 완주되어 main 이 653 tests GREEN. `GradingAppealsModule` 은 AppModule 등록되었으나, **`GradingModule` (Orchestrator + AstCanonicalGrader + LlmJudgeGrader + LAYER_2 + Sanitizer) 은 Session 1 부터 격리 유지**. Session 6 은 이 격리를 해제하고 `GameSessionService.submitAnswer` 의 `answerFormat==='free-form'` 분기에서 실제로 채점 파이프라인을 호출하는 세션이다.

D3 Hybrid (ADR-018 §4) 는 Session 5 에서 masker 방어 계층(`langfuse-masker.ts`, `USER_TOKEN_HASH_PATTERNS`) 까지만 완성. Langfuse trace metadata 에 `session_id` 만 흘리고 `user_token_hash` 주입 경로가 부재함을 **E2E 로 확인**하는 실 배선은 Session 6 범위.

## Session 6 작업 5건 (분석 대상)

1. `GameSessionService.submitAnswer` 의 `answerFormat==='free-form'` 분기 → `GradingOrchestrator.grade()` 호출. 기존 MC/single-token 경로 보존.
2. `GradingModule` AppModule 등록 (격리 해제).
3. `ast_failure_reason` → `ops_question_measurements` 저장 배선.
4. Langfuse trace metadata D3 Hybrid 실 배선 — `session_id` 만 기록, `user_token_hash` 주입 경로 부재 E2E 검증.
5. `answer_history` INSERT 시 active epoch 조회 → `user_token_hash_epoch` 채움.

---

## 🔴 최상단 경보 (CRITICAL)

**Session 4 교훈 "1인 지적 CRITICAL 격상" 룰 적용 — 보안/감사 체인 무결성은 다수결 대상 아님.**

### CRITICAL-1 (B 단독) — bootstrap active epoch seed 부재

- **근거**: `apps/api/src/migrations/1714000001000-AddUserTokenHashSaltEpochs.ts` 는 `user_token_hash_salt_epochs` 테이블 DDL 만 생성, row seed 없음. `SaltRotationService.rotate()` 가 실행되지 않은 신규 DB(=개발·CI·production 최초 기동) 에서 active epoch 0건.
- **파급**: Session 6 작업 5 (`user_token_hash_epoch` 채움) 의 `epochs.findOne({ deactivatedAt: IsNull() })` 결과 null → (a) NULL 저장 = 감사 단절(ADR-018 §5 "활성 salt 항상 1건" 위반) 또는 (b) throw = 서비스 중단. 양단 모두 받아들일 수 없음.
- **조치**: PR #1 최우선 커밋 — 신규 migration `1714000004000-BootstrapActiveEpoch.ts`. `user_token_hash_salt_epochs` row 0 건 감지 시 env `USER_TOKEN_HASH_SALT` 의 `sha256(salt).slice(0,8)` fingerprint + `admin_id='00000000-0000-0000-0000-000000000000'` (system sentinel) + `reason='scheduled'` + `note='bootstrap seed'` 로 1건 INSERT. `ops_event_log(kind='salt_rotation', payload={ bootstrap: true })` 동시 기록. **fail-closed 정책 채택** — 작업 5 경로에서 active epoch 조회 결과 null 이면 throw + `ops_event_log(kind='active_epoch_missing')`.

### CRITICAL-2 (B 단독) — Langfuse callback metadata 무검사

- **근거**: `apps/api/src/modules/ai/masking-callback-handler.ts` 의 `handleChatModelStart(serialized, messages, runId, parentRunId, extraParams, tags, metadata, ...)` 에서 `metadata` 인자가 Session 5 masker 의 치환 대상이 **아님**. masker 는 message content 만 마스킹. 호출자 코드가 `LlmClient.invoke(messages, { metadata: { user_token_hash: '...' } })` 한 줄 넣으면 ADR-018 §8 금지 6 ("Langfuse 로 userId/유사 식별자 전송 금지") 를 평문으로 우회.
- **파급**: PR #7 masker 가 "최후 보루" 로 content 회귀 차단은 하지만, metadata 경로는 무방비. D3 Hybrid 본령(§4) 의 실질 보장 무효.
- **조치**: PR #1 커밋 — `MaskingLangfuseCallbackHandler` 에 **metadata 키 화이트리스트 강제**. 허용 키 **4종 (사용자 Q4 결정)**: `session_id`, `prompt_name`, `prompt_version`, `model_digest`. 위반 시 dev 에서 throw (개발 즉시 인지), production 에서 silent drop + `ops_event_log(kind='pii_masker_triggered', payload={ violation: 'metadata_key', key })` 기록. `langfuse-trace-privacy.test.ts` 에 E2E 스냅샷 추가.

### HIGH-1 (B 단독) — LlmJudgeGrader 에러 로깅에 학생 답안 평문 echo 가능

- **근거**: `apps/api/src/modules/grading/graders/llm-judge.grader.ts` 의 `logger.warn(err.message)` 가 `OutputFixingParser` 2차 실패 시 LLM raw response 를 stdout/journald 로 출력. raw response 에 prompt echo 가 포함되면 학생 답안 평문 유출.
- **조치**: PR #1 커밋 — err.message 를 `redactStudentAnswer(err.message, boundary)` 로 필터. 학생 답안 태그 구간은 `[REDACTED]` 치환. TDD.

---

## 1. 일치 항목 (Consensus) — 3개 모두 동의

| # | 항목 | 근거 |
|---|------|------|
| 1 | LLM 호출은 DB 트랜잭션 **밖** | A, B, C 암묵/명시 동의 |
| 2 | `PlayerAnswer.sessionId` 경로로 `session_id` 전파 | A 설계 / B·C 이의 없음 |
| 3 | `GradingModule` AppModule 등록 필수 (현재 격리) | 3자 전제 |
| 4 | Layer 4 masker (content 경로) 는 PR #7 에서 커버 | 3자 확인 |
| 5 | `LlmClient.invoke(messages, opts?)` 시그니처는 **optional** 인자로 확장 (회귀 0) | A 설계 / B·C 반대 없음 |
| 6 | E2E 테스트는 커밋 스택 **최후** | 3자 순서 동의 |
| 7 | Ollama 실연동은 nightly/optional gate (`OLLAMA_INTEGRATION` env) | C 명시, A·B 이의 없음 |

→ 전부 그대로 채택.

---

## 2. 부분 일치 → 결정 근거

### P1. epoch 조회 방식 (A=부팅 캐시 / B=미언급 / C=매 SELECT)

- **결정: C 안 채택 (매 SELECT 유지)**
- **근거**: 현재 트래픽 ~20명 × ~5 답안/분 ≈ 1.7 rps peak. partial unique index 를 통한 1ms PK 조회 무시 가능. 캐시는 invalidation 버그가 곧 **보안 사고** (구 epoch 로 지속 INSERT = 감사 체인 오염). A 의 "부팅 시 1회 로드 + rotate-salt CLI 가 재기동 유도" 안은 운영자 휴먼 에러 발생 시 조용히 실패. **캐시 도입 임계값 100 rps** 를 ADR-018 §10 에 "유보 항목 (2)" 로 메모.

### P2. 트랜잭션 경계 (A=answer_history+ops 단일 TX / C=분리 + held fallback)

- **결정: C 안 채택 (분리)**
- **근거**: A 안도 "LLM 호출은 TX 밖" 이므로 단일 TX 실질 범위는 `answer_history INSERT + ops INSERT` 뿐. 그러나 ops 실패가 `answer_history` INSERT 를 롤백하는 시맨틱은 감사 손실 (채점은 성공했는데 기록 없음). `answer_history` 는 WORM (ADR-016 §6), ops 는 best-effort 라는 책임 분리가 이미 확립. 따라서 **TX-A (answer_history) / TX-B (ops) 분리**, LLM timeout 시 `gradingMethod='held'` 로 TX-A 진입.

### P3. 채점 분기 위치 (A·B=GameSessionService if/else / C=if/else + 즉시 private 추출)

- **결정: C 안 채택 (`gradeFreeForm()` private 추출)**
- **근거**: A·B 안과 모순 없음 — 상위 if/else 유지. 메서드 추출은 0 비용이며 Strategy 전환 시점(MVP-C 캡스톤) 에 리팩토 표면 축소. 단위 테스트 주입점 확보.

---

## 3. 불일치 → 최선 선택

### D1. 권장 커밋 순서 (A 7단계 / B 6단계 epoch-seed 우선 / C 2 PR 분할)

- **결정: B 를 골격, C 의 PR 분할을 상위 구조로 채택**
- **근거**: B CRITICAL-1 (bootstrap epoch seed) 은 신규 DB 부팅 시 즉시 장애. 따라서 seed 가 모든 것에 선행. A 순서는 seed 부재를 전제하지 않음. C 의 "2 PR 분할 + kill-switch" 는 B 선형 순서를 감싸는 메타 구조로 양립 가능.

### D2. PR 분할 (A=단일 / B=작업 1·5 분리 / C=2 PR + env kill-switch)

- **결정: C 안 채택 + B 의 "작업 1 선행" 흡수**
- **근거**: 5건 단일 PR 은 보안 회귀 섞일 때 격리 실패. C 안은 선행 PR (보안 가드·인프라) + 후행 PR (분기 활성) 로 롤백 입도 최적. env kill-switch `ENABLE_FREE_FORM_GRADING` 은 canary 분기 불필요론과 부합. **사용자 Q2=A 로 프로덕션 기본값 `false` 확정.**

---

## 4. 누락 → 포함/제외 결정

| 항목 | 제기 | 평가 | 결정 |
|------|------|------|------|
| Bootstrap epoch seed | B | CRITICAL | **포함 (PR#1 C1-1)** |
| Langfuse metadata 화이트리스트 | B | CRITICAL | **포함 (PR#1 C1-2)** |
| LLM error log raw echo | B | HIGH | **포함 (PR#1 C1-3)** |
| `pii_masker_triggered` ops event | C | MEDIUM (관측성) | **포함 (PR#1 C1-4)** |
| session_id PK uuid 확인 | B | MEDIUM (추론 방지) | **포함 (PR#1 C1-4)** |
| Prompt template lint (`user_token_hash`/`salt` grep) | C | MEDIUM (feedforward) | **포함 (PR#1 C1-5)** |
| Epoch INSERT race 완화 | B | HIGH | **포함 (PR#1 C1-6)** |
| `LLM_JUDGE_TIMEOUT_MS` env | B | HIGH | **포함 (PR#2 C2-5)** |
| `ENABLE_FREE_FORM_GRADING` kill-switch | C | HIGH | **포함 (PR#2 C2-4)** |
| `measureGrading()` 신규 | C | MEDIUM | **포함 (PR#2 C2-2)** |
| GradingResult → EvaluationResult 7항 persist | A | HIGH (감사 정합) | **포함 (PR#2 C2-6)** |
| `LlmClient.invoke` opts 확장 | A | 필수 | **포함 (PR#2 C2-1)** |
| GradingEpochCache | A | P1 에서 기각 | **제외 (100 rps 트리거만 ADR-018 §10 메모)** |
| Held 큐 admin/CLI | C | LOW | **제외 (MVP-C 백로그)** |
| Layer 1/2 hit rate 별도 지표 | C | LOW | **제외 (백로그)** |
| Strategy 흡수 | C | — | **제외 (MVP-C 캡스톤 진입 시 자연 합류)** |

---

## 5. 최종 Session 6 실행 계획

### 트랜잭션 경계 (확정)

- **TX-A**: `answer_history` INSERT (단독, WORM, 반드시 성공)
- **TX-B**: `ops_question_measurements` INSERT + `ops_event_log` INSERT (best-effort, 실패해도 TX-A 롤백 금지)
- **LLM 호출**: 모든 TX 밖. timeout (Q1=8000ms) 시 `gradingMethod='held'` 로 TX-A 진입 후 HTTP 에러 응답 (Q3=B).

### PR #1 — 보안·인프라 가드 (`ENABLE_FREE_FORM_GRADING=false` 상태 유지)

| # | 커밋 | TDD 범위 |
|---|------|---------|
| C0 | `docs/review/consensus-007` + ADR-016/018 연쇄 수정 | docs-only |
| C1-1 | `1714000004000-BootstrapActiveEpoch` migration | migration up/down + no-op (이미 active epoch 존재 시) |
| C1-2 | `MaskingLangfuseCallbackHandler` metadata 화이트리스트 | 허용 4 키 / 위반 시 dev throw · prod drop + ops event |
| C1-3 | `LlmJudgeGrader` 에러 로깅 redaction | err.message 에 student_answer 포함 시 `[REDACTED]` |
| C1-4 | `pii_masker_triggered` ops event + session_id PK uuid 확인 | schema test + event kind 등록 |
| C1-5 | prompt template lint 룰 (pre-commit + vitest layer 4) | `user_token_hash`/`salt`/`epoch`/`userId` 감지 → 차단 |
| C1-6 | epoch SELECT race 회귀 테스트 | rotation CLI 동시 INSERT → 구 epoch_id 또는 재시도 성공 |

**차단 항목 (하나라도 GREEN 아니면 머지 금지)**: C1-1, C1-2.

### PR #2 — free-form 채점 배선 (PR #1 프로덕션 배포 **1일 관측 후** — 사용자 Q5=B)

| # | 커밋 | TDD 범위 |
|---|------|---------|
| C2-1 | `LlmClient.invoke(messages, opts?: { metadata?: WhitelistedMetadata })` + `sessionId` 전파 | 기존 호출자 회귀 0 / metadata 화이트리스트 통과 |
| C2-2 | `GradingMeasurementService.measureGrading()` 신규 | `measureSync` 와 시맨틱 분리 |
| C2-3 | `GradingModule` → AppModule 등록 | wiring smoke test |
| C2-4 | `GameSessionService.gradeFreeForm()` private 추출 + if/else 분기 + `ENABLE_FREE_FORM_GRADING` env | MC 회귀 없음 / flag=false 시 기존 경로 / flag=true 시 orchestrator 호출 |
| C2-5 | `LLM_JUDGE_TIMEOUT_MS=8000` env + held fallback + HTTP 에러 응답 | timeout → `gradingMethod='held'` persist + ops `llm_timeout` + HTTP 5xx |
| C2-6 | `GradingResult → EvaluationResult` 변환 + 7항 `answer_history` persist + `user_token_hash_epoch` 채움 | score 반올림 / 7항 누락 0 / active epoch null 시 throw (fail-closed) |
| C2-7 | E2E (`OLLAMA_INTEGRATION` gate, nightly) | Langfuse mock 송신 payload → userId 파생정보 0건 assert |

**차단 항목**: C2-5 (timeout fallback) 없이 머지 금지 — timeout = HTTP hang 직결.

---

## 6. 사용자 결정 (Q1~Q5) — 확정

| # | 질문 | 결정 | 비고 |
|---|------|------|------|
| **Q1** | `LLM_JUDGE_TIMEOUT_MS` 기본값 | **8000ms** | 사용자 체감 상한. 운영 후 p95 관측하여 ADR-018 §10 갱신 |
| **Q2** | `ENABLE_FREE_FORM_GRADING` 프로덕션 기본값 | **false** | 수동 활성 + 안정화 창 확보 |
| **Q3** | Held fallback UX | **동기 대기 후 timeout 에러** (Reviewer 권장 A 와 다른 B 채택) | 8s 초과 시 HTTP 에러 응답 + student 재시도. 감사 체인 보존 위해 `answer_history` 에 `gradingMethod='held'` persist 는 유지 |
| **Q4** | Langfuse metadata 화이트리스트 키 | **4종** (`session_id`, `prompt_name`, `prompt_version`, `model_digest`) | 최소권한. 추가는 재ADR |
| **Q5** | PR #1 → PR #2 간격 | **PR #1 프로덕션 배포 1일 관측 후** | CRITICAL 수정 회귀 관측. kill-switch 로 기능 지연 영향 0 |

---

## 7. ADR 연쇄 수정 항목 (C0 커밋 포함)

- **ADR-016 §7**: Langfuse metadata 화이트리스트 4종 명시 (`session_id`, `prompt_name`, `prompt_version`, `model_digest`). 위반 시 dev throw / prod drop + ops event.
- **ADR-016 §추가**: Layer 3 LLM timeout 정책 추가. 기본 8000ms, 초과 시 `gradingMethod='held'` persist + HTTP 에러 응답. `grading_appeals` 경로로 학생 재제출 가능.
- **ADR-018 §5**: bootstrap active epoch seed 정책 명시. 신규 DB 부팅 시 migration 자동 seed (fail-closed).
- **ADR-018 §10**: 유보 항목 (2) 신설 — "epoch 조회 캐시 (현재 매 SELECT 유지). 트리거: 100 rps 초과 또는 p95 DB CPU > 70%."

---

## 메타

- 합의율: §1 기준 7/7 (100%)
- 유효 이견 반영: 3건 (P1 C 채택 / P2 C 채택 / D1 B 채택)
- 1명 Agent 만 짚은 CRITICAL 2건 (B: bootstrap epoch seed, Langfuse metadata) — **모두 채택 (Session 4 교훈 룰 적용)**
- 사용자 결정 중 Reviewer 권장과 불일치 1건: **Q3 (held fallback UX)**. 사용자는 B(동기 대기 후 timeout 에러) 채택. 합의 문서는 사용자 결정 반영.

---

## 다음 단계

1. 본 합의 문서 커밋 (PR #1 C0, ADR-016/018 연쇄 수정 포함).
2. PR #1 C1-1 부터 순차 TDD 진행.
3. PR #1 머지 + 프로덕션 배포 + 1일 관측 후 PR #2 착수 (Q5).
