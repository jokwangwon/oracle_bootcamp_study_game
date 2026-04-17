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

  /**
   * ADR-017 차원 컬럼 — 신규 측정은 반드시 채움. 기존 행은 NULL (backfill은
   * MT6/MT8 집계 시 COALESCE로 처리).
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  mode!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'answer_format', nullable: true })
  answerFormat!: string | null;

  /** ast | keyword | llm | held | override (ADR-013) */
  @Column({ type: 'varchar', length: 32, name: 'grading_method', nullable: true })
  gradingMethod!: string | null;

  /**
   * MT6 — free-form 답안이 Layer 1(AST) 에서 PASS/FAIL 확정되었는지.
   * true = Layer 1 에서 해소, false = Layer 2/3 으로 escalate, null = 해당 없음
   * (객관식/빈칸 등 free-form 아님).
   */
  @Column({ type: 'boolean', name: 'layer_1_resolved', nullable: true })
  layer1Resolved!: boolean | null;

  /**
   * ADR-013 Layer 1 UNKNOWN 사유 (MVP-B Session 3, 커밋 3).
   *
   * Layer 1 AST grader 가 UNKNOWN 을 반환해 Layer 2/3 로 강등된 경우 사유를 기록.
   * MT6/MT8 집계에서 **파서 한계로 인한 샘플**을 분모에서 제외하여 "진짜 모호성"
   * 지표를 왜곡 없이 추적한다.
   *
   * 값: `dialect_unsupported` | `truly_invalid_syntax` | `empty_answer` | `non_sql_block` | NULL
   * NULL = Layer 1 정상 판정 또는 free-form 이 아님.
   */
  @Column({ type: 'varchar', length: 32, name: 'ast_failure_reason', nullable: true })
  astFailureReason!: string | null;
}

export interface Mt4FailureDetail {
  expectedBlankCount: number;
  actualBlankCount: number;
  missingAnswers: string[];
}
