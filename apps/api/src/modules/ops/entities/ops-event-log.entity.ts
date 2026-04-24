import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OpsEventKind =
  | 'student_report_incorrect'
  | 'admin_reject'
  | 'gate_breach'
  | 'measurement_fail'
  | 'mt6_breach'
  | 'mt7_breach'
  | 'mt8_breach'
  | 'grading_appeal' // ADR-016 §추가 이의제기 / S5-C3
  | 'salt_rotation' // ADR-018 §6 salt rotation / S5-C4
  | 'pii_masker_triggered' // ADR-016 §7 metadata 화이트리스트 위반 / S6-C1-4
  | 'grading_measured' // ADR-013 Layer 결과 차원 기록 / S6-C2-2
  | 'llm_timeout' // ADR-016 §추가 Layer 3 timeout / S6-C2-5
  | 'sr_queue_overflow' // ADR-019 §5.3 일일 신규 편입 상한 초과 drop / PR-3
  | 'sr_upsert_failed'; // ADR-019 §5.1 review_queue UPSERT 실패 (Tx2 fail-open)

export type StudentReportReason = 'incorrect_answer' | 'sql_error' | 'other';

export interface StudentReportPayload {
  reason: StudentReportReason;
}

export type GateBreachMetric =
  | 'mt3_rate'
  | 'mt4_rate'
  | 'p95_latency'
  | 'student_report_rate'
  | 'mt6_canonical_match_rate'
  | 'mt7_capstone_violations'
  | 'mt8_llm_judge_ratio';

export interface GateBreachPayload {
  metric: GateBreachMetric;
  observed: number;
  threshold: number;
  windowSize: number;
}

export interface MeasurementFailPayload {
  error: string;
  stage: 'mt3' | 'mt4' | 'other';
  /**
   * PR #15 (consensus-007 사후 검증 Agent B CRITICAL-1 보강) — held persist 실패
   * 등 세부 원인 분류. 기존 호출자 영향 없음 (optional).
   *   - 'held_persist_fail': Layer 3 timeout 후 held row 저장이 실패한 경우
   */
  cause?: string;
}

/** ADR-016 §추가 + S5-C3 — grading_appeals 제출 이벤트 payload */
export interface GradingAppealPayload {
  appealId: string;
  answerHistoryId: string;
  reason: 'incorrect_grading' | 'scope_dispute' | 'technical_error' | 'other';
}

/** ADR-018 §6 + S5-C4 — salt rotation 이벤트 payload. salt 평문 저장 금지. */
export interface SaltRotationPayload {
  prevFingerprint: string | null; // 최초 rotation 시 null. sha256(salt).slice(0,8)
  newFingerprint: string; // sha256(salt).slice(0,8)
  rotatedBy: string; // admin user uuid
  reason: 'scheduled' | 'incident';
}

/**
 * ADR-016 §7 + consensus-007 S6-C1-4 — Langfuse metadata 화이트리스트 위반 감지.
 * production 에서 silent drop 된 key 를 관측성 확보용으로 기록.
 * payload 에 **값은 저장 금지** (PII 유출 방지) — key 이름과 발생 위치만.
 */
export interface PiiMaskerTriggeredPayload {
  violation: 'metadata_key';
  key: string; // drop 된 메타데이터 key 이름 (값은 저장 금지)
  handler: string; // handleChatModelStart / handleLLMStart / handleChainStart
  runId?: string; // LangChain run id (trace 연동)
}

/**
 * ADR-013 3단 채점 결과 차원 이벤트 (consensus-007 S6-C2-2).
 *
 * `ops_question_measurements` 는 UNIQUE(question_id) 제약으로 1 문제 1 행이라
 * 학생별 채점 이벤트는 여기에 로그된다. MT6/MT8 집계는 payload 필드에서 파생.
 *
 * payload 에 **학생 답안 원문 저장 금지** — 태그/해시된 식별자만.
 * `userTokenHash` 는 answer_history 와 동일 salt 로 계산된 식별자 (D3 Hybrid).
 * Langfuse 로는 전송되지 않는다 (ADR-018 §8 금지 6).
 */
/**
 * ADR-016 §추가 + consensus-007 S6-C2-5 — Layer 3 LLM-judge timeout 관측.
 *
 * 발생 경로: LlmJudgeGrader.grade 내부 `Promise.race(invoke, timer)` 에서 timer 가
 * 먼저 resolve → LlmJudgeTimeoutError throw → GameSessionService 가 catch 하여
 * answer_history(gradingMethod='held') persist + 본 이벤트 기록 + HTTP 503.
 *
 * 학생 답안 원문 저장 금지. 시간/layer/재시도 가능 여부만.
 */
export interface LlmTimeoutPayload {
  timeoutMs: number; // 적용된 타임아웃 값 (LLM_JUDGE_TIMEOUT_MS)
  layerAttempted: 3;
  elapsedMs?: number; // 실제 경과 (timer 기준). 계측 실패 시 미포함.
  retriable: boolean; // 학생이 재제출 가능한지 (MVP: true)
}

/**
 * ADR-019 §5.3 — 일일 신규 편입 상한 (SR_DAILY_NEW_CAP, 기본 100) 초과로
 * `review_queue` 신규 행이 drop 된 관측. 학생은 영향 없음 (다음 날 재진입).
 *
 * payload 에 학생 답안·quality·이전 SR 상태 저장 금지 — 관측 축만.
 */
export interface SrQueueOverflowPayload {
  cap: number; // 적용된 SR_DAILY_NEW_CAP
  observed: number; // 오늘 기존 신규 insert 수 (drop 직전)
}

/**
 * ADR-019 §5.1 — Tx2 (review_queue UPSERT 보조 경로) 실패 관측. fail-open 이므로
 * 학생은 정상 응답 수신. 본 이벤트는 사후 복구용.
 *
 * payload 에 **학생 답안 원문 저장 금지**. error message 만 잘라 기록.
 */
export interface SrUpsertFailedPayload {
  error: string;
  /**
   * 'upsert' — 정상 답변 경로 (upsertAfterAnswer)
   * 'overwrite' — admin-override 경로 (overwriteAfterOverride)
   */
  stage: 'upsert' | 'overwrite';
}

export interface GradingMeasuredPayload {
  gradingMethod: 'ast' | 'keyword' | 'llm' | 'held' | 'admin-override';
  gradingLayersUsed: number[]; // [1] | [1,2] | [1,2,3]
  astFailureReason?:
    | 'dialect_unsupported'
    | 'truly_invalid_syntax'
    | 'empty_answer'
    | 'non_sql_block';
  partialScore: number; // 0.0 ~ 1.0
  graderDigest: string;
  layer1Resolved: boolean; // MT6 — Layer 1 에서 PASS/FAIL 확정
  layer3Invoked: boolean; // MT8 — Layer 3 호출 여부
  judgeInvocationCount: number; // 정상 1, fixer retry 발생 시 2
  heldForReview: boolean; // Layer 1~3 모두 UNKNOWN → 관리자 큐
  sanitizationFlagCount: number;
  latencyMs: number;
}

/**
 * 수강생 신고 / 관리자 reject / 시스템 알림의 통합 구조화 로그.
 *
 * SDD `operational-monitoring-design.md` §3.2.
 */
@Entity('ops_event_log')
@Index('idx_ops_event_log_kind_time', ['kind', 'createdAt'])
@Index('uq_ops_event_student_report', ['userId', 'questionId'], {
  unique: true,
  where: "kind = 'student_report_incorrect'",
})
export class OpsEventLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 32 })
  kind!: OpsEventKind;

  @Column({ type: 'uuid', name: 'question_id', nullable: true })
  questionId!: string | null;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  /**
   * PR #16 (consensus-007 사후 검증 Agent B HIGH / Q2=b 이행) —
   * answer_history.user_token_hash 와 대칭. ADR-018 §4 D3 Hybrid 정신에 따라
   * **분석 집계 쿼리는 본 컬럼을 사용**하고 `userId` 컬럼은 관리자 직접 조회용
   * FK 로만 유지 (remove 하지 않음 — 호환성).
   *
   * 계산: `hashUserToken(userId, env.USER_TOKEN_HASH_SALT)` (16 hex chars).
   * `userTokenHashEpoch` 는 해당 시점 활성 epoch_id.
   *
   * nullable 인 이유: salt/epoch 미주입 환경 (단위 테스트, 일부 legacy 경로)
   * 에서 저장 실패가 이벤트 기록 자체를 막지 않아야 함 (fail-safe).
   */
  @Column({ type: 'varchar', length: 32, name: 'user_token_hash', nullable: true })
  userTokenHash!: string | null;

  @Column({ type: 'smallint', name: 'user_token_hash_epoch', nullable: true })
  userTokenHashEpoch!: number | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;
}
