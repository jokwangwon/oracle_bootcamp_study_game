import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PR-10b §5.1 — R4 토론 post (답변 또는 1-level nested 댓글).
 *
 *  - parentId NULL    → thread 직속 답변
 *  - parentId NOT NULL → 답변에 대한 1-level 댓글
 *  - 2 단 이상 nested 차단은 service 단에서 (DB 제약 없음).
 *
 * relatedQuestionId — HIGH-3 중재 (적절성). 다른 question 으로 분기 추천.
 */
@Entity('discussion_posts')
@Index('idx_discussion_posts_thread_created', ['threadId', 'createdAt'])
export class DiscussionPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  /** sanitize-html 화이트리스트 통과한 본문. */
  @Column({ type: 'text' })
  body!: string;

  /** sum(votes.value) 캐시. */
  @Column({ type: 'integer', default: 0 })
  score = 0;

  /** Best answer 표시 — thread 의 author 가 1건 마킹 가능. */
  @Column({ type: 'boolean', name: 'is_accepted', default: false })
  isAccepted = false;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted = false;

  @Column({ type: 'uuid', name: 'related_question_id', nullable: true })
  relatedQuestionId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
