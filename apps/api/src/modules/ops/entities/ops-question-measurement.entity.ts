import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * 1 행 = 1 AI 문제의 운영 시점 재측정 결과.
 *
 * SDD `operational-monitoring-design.md` §3.1.
 * ADR-011 채택 조건 #3 — 초기 100건 MT3/MT4 재측정 기록.
 */
@Entity('ops_question_measurements')
@Unique(['questionId'])
@Index('idx_ops_measurements_window', ['windowIndex'])
export class OpsQuestionMeasurementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @CreateDateColumn({ name: 'measured_at' })
  measuredAt!: Date;

  @Column({ type: 'boolean', name: 'mt3_pass' })
  mt3Pass!: boolean;

  /** MT3 재측정에서 화이트리스트 미포함 토큰 목록 */
  @Column({ type: 'jsonb', name: 'mt3_out_of_scope', default: () => `'[]'::jsonb` })
  mt3OutOfScope!: string[];

  /** blank 모드 외에는 NULL */
  @Column({ type: 'boolean', name: 'mt4_pass', nullable: true })
  mt4Pass!: boolean | null;

  /** blank/answer 불일치 상세 (blank 모드에서만 채움) */
  @Column({ type: 'jsonb', name: 'mt4_failures', nullable: true })
  mt4Failures!: Mt4FailureDetail | null;

  @Column({ type: 'int', name: 'latency_ms' })
  latencyMs!: number;

  /** verifyApprovedModel().currentDigest */
  @Column({ type: 'text', name: 'model_digest' })
  modelDigest!: string;

  /** 1..100이면 초기 window, NULL이면 이후 생성분 */
  @Column({ type: 'int', name: 'window_index', nullable: true })
  windowIndex!: number | null;
}

export interface Mt4FailureDetail {
  expectedBlankCount: number;
  actualBlankCount: number;
  missingAnswers: string[];
}
