import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type NotionSyncStatus = 'idle' | 'syncing' | 'error';

/**
 * 노션 DB 단위 동기화 상태.
 *
 * SDD `oracle-dba-learning-game-design.md` §4.2.1.
 * 1 행 = 1 Notion DB. database_id로 멱등 (동일 DB에 대한 중복 row 금지).
 *
 * last_synced_at: 다음 sync 시 `filter.last_edited_time.after`로 사용.
 * last_cursor: 페이지네이션 도중 실패 시 이어서 재개 (현재는 보존만).
 */
@Entity('notion_sync_state')
export class NotionSyncStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, name: 'database_id', unique: true })
  databaseId!: string;

  @Column({ type: 'timestamptz', name: 'last_synced_at', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'text', name: 'last_cursor', nullable: true })
  lastCursor!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'idle' })
  status!: NotionSyncStatus;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
