import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PR-10b §5.1 — R4 토론 thread.
 *
 * 마이그레이션: 1714000011000-AddDiscussion.
 *
 * partial index `idx_discussion_threads_question_activity` 가 (question_id,
 * last_activity_at DESC) WHERE is_deleted=FALSE — 활성 thread 의 최신순 쿼리.
 */
@Entity('discussion_threads')
@Index('idx_discussion_threads_question_activity', ['questionId', 'lastActivityAt'])
export class DiscussionThreadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** sanitize-html 화이트리스트 통과한 본문. PR-10b §4.2.1 C 절. */
  @Column({ type: 'text' })
  body!: string;

  /** sum(votes.value) 캐시 — DiscussionService 가 vote 시 동기 갱신 (트랜잭션). */
  @Column({ type: 'integer', default: 0 })
  score = 0;

  @Column({ type: 'integer', name: 'post_count', default: 0 })
  postCount = 0;

  @Column({ type: 'timestamptz', name: 'last_activity_at' })
  lastActivityAt!: Date;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted = false;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
