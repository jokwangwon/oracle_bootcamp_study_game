import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * ADR-016 §추가 이의제기 파이프라인 + ADR-018 §4 반영.
 *
 * 목적:
 *  - `answer_history` 는 WORM (REVOKE UPDATE + trigger) — 채점 결과 수정 불가.
 *  - 학생·관리자가 "이 채점 결과가 틀렸다" 라고 주장할 때 사용하는 **별도 저장소**.
 *  - 관리자 override 는 `answer_history` 수정이 아닌 `grading_appeals` 레코드를
 *    resolved 로 표기 + 별도 조정 (Session 6+ 배선 시 확정).
 *
 * 소유자 식별:
 *  - ADR-018 §8 금지 2: `user_token_hash` 를 식별자로 사용 금지. **평문 userId** 만 사용.
 *  - 소유자 확인: appeal 의 `user_id` === answer_history 의 `user_id` (Service 레이어 검증).
 *
 * Rate limit:
 *  - Redis 기반 (분당 10 / 일당 5) — ADR-016 §레이트리밋 재사용.
 *  - 구현은 `AppealRateLimiter` 서비스 (S5-C3 본 커밋).
 */

export type AppealReason =
  | 'incorrect_grading'
  | 'scope_dispute'
  | 'technical_error'
  | 'other';

export const APPEAL_REASONS: readonly AppealReason[] = [
  'incorrect_grading',
  'scope_dispute',
  'technical_error',
  'other',
] as const;

export type AppealStatus = 'pending' | 'resolved' | 'rejected';

@Entity('grading_appeals')
@Index('idx_grading_appeals_user_created', ['userId', 'createdAt'])
@Index('idx_grading_appeals_answer_status', ['answerHistoryId', 'status'])
@Index('uq_grading_appeals_pending_unique', ['answerHistoryId', 'userId'], {
  unique: true,
  where: "status = 'pending'",
})
export class GradingAppealEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'answer_history_id' })
  answerHistoryId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  reason!: AppealReason;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: AppealStatus;

  @Column({ type: 'uuid', name: 'admin_reviewer', nullable: true })
  adminReviewer!: string | null;

  @Column({ type: 'text', nullable: true })
  resolution!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;
}
