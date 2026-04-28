import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type DiscussionVoteTarget = 'thread' | 'post';
export type DiscussionVoteValue = -1 | 1;

/**
 * PR-10b §4.4 — thread/post 통합 vote (target_type discriminator).
 *
 * 복합 PK (user_id, target_type, target_id) — 같은 사용자가 같은 target 에 대해
 * 1건만. UPDATE 로 -1 ↔ 1 토글, DELETE 로 취소.
 *
 * 무결성:
 *  - DB CHECK target_type IN ('thread','post') / value IN (-1,1) — migration 1714000011000.
 *  - DB TRIGGER prevent_discussion_self_vote — migration 1714000012000.
 *  - service 단 ForbiddenException 사전 차단 (UX).
 */
@Entity('discussion_votes')
export class DiscussionVoteEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 10, name: 'target_type' })
  targetType!: DiscussionVoteTarget;

  @PrimaryColumn({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'smallint' })
  value!: DiscussionVoteValue;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
