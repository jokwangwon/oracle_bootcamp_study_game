import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * PR-10a §4.2.1 A 절 — refresh token rotation chain 저장소.
 *
 * 마이그레이션: `1714000010000-AddRefreshTokens.ts`
 *
 *  - jti           : JWT JTI claim 과 1:1 매핑 (PK)
 *  - userId        : users.id FK CASCADE
 *  - familyId      : login 시 신규 family 생성, refresh 시 상속.
 *                    reuse detection 시 family 전체 revoke (유출 시 chain 폐기)
 *  - generation    : login=0, 첫 refresh=1, ... (chain 안 회전 카운터)
 *  - expiresAt     : refresh 만료 (Q-R3 결정 14d)
 *  - revokedAt     : rotation/logout 시 채움 (NULL = 활성)
 *  - replacedBy    : 회전 후 새 jti 추적 (reuse detection 보조)
 */
@Entity('refresh_tokens')
@Index('idx_refresh_tokens_user_family', ['userId', 'familyId'])
export class RefreshTokenEntity {
  @PrimaryColumn({ type: 'uuid' })
  jti!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'integer', default: 0 })
  generation!: number;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid', name: 'replaced_by', nullable: true })
  replacedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
