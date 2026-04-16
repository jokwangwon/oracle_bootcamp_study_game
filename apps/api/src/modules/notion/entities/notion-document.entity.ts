import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NotionDocumentStatus = 'active' | 'deleted';

/**
 * 노션 페이지의 마크다운 캐시 + Stage 2 LLM 정리 결과 (선택).
 *
 * SDD §4.2.1 + §4.2.2.
 * 1 행 = 1 Notion 페이지. notion_page_id로 멱등.
 * raw_markdown은 불변 (감사 추적). structured_content는 Stage 2 결과 (현재 NULL).
 * week/topic은 Stage 3 결과 (현재 NULL — 수동 입력 fallback).
 */
@Entity('notion_documents')
@Index('idx_notion_doc_week_topic', ['week', 'topic'])
export class NotionDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, name: 'notion_page_id', unique: true })
  notionPageId!: string;

  @Column({ type: 'text' })
  title!: string;

  /** 원본 마크다운 — 절대 덮어쓰지 않는다 (감사) */
  @Column({ type: 'text', name: 'raw_markdown' })
  rawMarkdown!: string;

  /** Stage 2 LLM 정리 결과 (현재 NULL) */
  @Column({ type: 'text', name: 'structured_content', nullable: true })
  structuredContent!: string | null;

  @Column({ type: 'int', nullable: true })
  week!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  topic!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: NotionDocumentStatus;

  /** Notion 측 last_edited_time */
  @Column({ type: 'timestamptz', name: 'last_edited_at', nullable: true })
  lastEditedAt!: Date | null;

  @CreateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
