import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_progress')
@Index(['userId', 'topic', 'week'], { unique: true })
export class UserProgressEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  topic!: string;

  @Column({ type: 'int' })
  week!: number;

  @Column({ type: 'int', name: 'total_score', default: 0 })
  totalScore!: number;

  @Column({ type: 'int', name: 'games_played', default: 0 })
  gamesPlayed!: number;

  /**
   * 누적 라운드 수 (accuracy 가중 평균 계산용).
   * 게임당 라운드 수가 다를 수 있으므로 단순 평균이 아닌 라운드 가중 평균을
   * 정확하게 산출하기 위해 별도 컬럼으로 추적한다.
   */
  @Column({ type: 'int', name: 'total_rounds_played', default: 0 })
  totalRoundsPlayed!: number;

  @Column({ type: 'int', name: 'total_correct_answers', default: 0 })
  totalCorrectAnswers!: number;

  @Column({ type: 'real', default: 0 })
  accuracy!: number;

  @Column({ type: 'int', default: 0 })
  streak!: number;

  @UpdateDateColumn({ name: 'last_played_at' })
  lastPlayedAt!: Date;
}
