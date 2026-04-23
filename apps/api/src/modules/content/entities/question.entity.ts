import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  AnswerFormat,
  Difficulty,
  GameModeId,
  QuestionContent,
  QuestionSource,
  QuestionStatus,
  Topic,
} from '@oracle-game/shared';

@Entity('questions')
@Index(['week', 'topic', 'gameMode', 'status'])
export class QuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  topic!: Topic;

  @Column({ type: 'int' })
  week!: number;

  @Column({ type: 'varchar', length: 30, name: 'game_mode' })
  gameMode!: GameModeId;

  /**
   * 답안 형식 (ADR-012). 기존 행은 synchronize로 'single-token' backfill.
   */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'answer_format',
    default: 'single-token',
  })
  answerFormat!: AnswerFormat;

  @Column({ type: 'varchar', length: 10 })
  difficulty!: Difficulty;

  @Column({ type: 'jsonb' })
  content!: QuestionContent;

  @Column({ type: 'jsonb' })
  answer!: string[];

  @Column({ type: 'text', nullable: true })
  explanation!: string | null;

  /**
   * UX #2 (ux-redesign-brief-v1.md §2.2) — 문맥 결여 해소.
   * `scenario`: 이 쿼리가 해결하는 상황. `rationale`: 왜 이 문법을 쓰는가.
   * 기존 seed 호환 위해 nullable. synchronize=true 환경에서는 자동 ALTER.
   */
  @Column({ type: 'text', nullable: true })
  scenario!: string | null;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending_review' })
  status!: QuestionStatus;

  @Column({ type: 'varchar', length: 20 })
  source!: QuestionSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
