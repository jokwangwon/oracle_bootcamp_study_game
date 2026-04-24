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
  | 'grading_measured'; // ADR-013 Layer 결과 차원 기록 / S6-C2-2

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

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;
}
