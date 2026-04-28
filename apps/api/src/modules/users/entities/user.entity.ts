import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { UserRole } from '@oracle-game/shared';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'player' })
  role!: UserRole;

  /**
   * PR-10a §4.2.1 B 절. logout/revoke 즉시 무효화 카운터.
   * JWT payload epoch claim 과 비교 — 불일치 시 401.
   * migration 1714000009000 에서 컬럼 신설.
   */
  @Column({ type: 'integer', name: 'token_epoch', default: 0 })
  tokenEpoch = 0;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
