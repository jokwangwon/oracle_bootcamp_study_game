import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('weekly_scope')
@Index(['week', 'topic'], { unique: true })
export class WeeklyScopeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  week!: number;

  @Column({ type: 'varchar', length: 50 })
  topic!: string;

  @Column({ type: 'jsonb' })
  keywords!: string[];

  @Column({ type: 'text', nullable: true, name: 'source_url' })
  sourceUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
