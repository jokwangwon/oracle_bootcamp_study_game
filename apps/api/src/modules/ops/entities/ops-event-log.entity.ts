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
  | 'measurement_fail';

export type StudentReportReason = 'incorrect_answer' | 'sql_error' | 'other';

export interface StudentReportPayload {
  reason: StudentReportReason;
}

export interface GateBreachPayload {
  metric: 'mt3_rate' | 'mt4_rate' | 'p95_latency' | 'student_report_rate';
  observed: number;
  threshold: number;
  windowSize: number;
}

export interface MeasurementFailPayload {
  error: string;
  stage: 'mt3' | 'mt4' | 'other';
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
