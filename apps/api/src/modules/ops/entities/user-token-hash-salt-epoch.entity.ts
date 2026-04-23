import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * ADR-018 §5 — `user_token_hash_salt_epochs` 감사 원장.
 *
 * 목적:
 *  - DB 내부 "rotation 이전 구간 / 이후 구간" 식별.
 *  - Langfuse 측 rotation 영향은 ADR-018 §4 D3 Hybrid 로 소멸 (Langfuse 는 session_id 만).
 *    본 원장은 **DB 감사·분석 전용**.
 *
 * 기록 규정 (ADR-018 §8 금지 4):
 *  - salt 평문 저장 절대 금지.
 *  - `salt_fingerprint` 는 `sha256(salt).slice(0, 8)` — 8 hex chars 고정.
 *  - 활성 salt 는 항상 1건 (unique partial index 로 강제).
 *  - `reason` 은 'scheduled' | 'incident' enum (CHECK 제약).
 *
 * 연계:
 *  - `scripts/rotate-salt.ts` CLI (Session 5 커밋 4) 가 본 테이블에 INSERT + 기존 active epoch 의
 *    `deactivated_at` 을 UPDATE.
 *  - `ops_event_log` `kind='salt_rotation'` 이벤트와 동시 기록 (ADR-018 §6).
 */

export type SaltRotationReason = 'scheduled' | 'incident';

@Entity('user_token_hash_salt_epochs')
@Index('ux_user_token_hash_salt_epochs_active', ['activatedAt'], {
  unique: true,
  where: '"deactivated_at" IS NULL',
})
export class UserTokenHashSaltEpochEntity {
  @PrimaryGeneratedColumn({ type: 'smallint', name: 'epoch_id' })
  epochId!: number;

  /** sha256(salt).slice(0, 8). salt 평문 저장 절대 금지. */
  @Column({ type: 'char', length: 8, name: 'salt_fingerprint' })
  saltFingerprint!: string;

  @Column({ type: 'timestamptz', name: 'activated_at' })
  activatedAt!: Date;

  @Column({ type: 'timestamptz', name: 'deactivated_at', nullable: true })
  deactivatedAt!: Date | null;

  @Column({ type: 'uuid', name: 'admin_id' })
  adminId!: string;

  @Column({ type: 'varchar', length: 32 })
  reason!: SaltRotationReason;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
