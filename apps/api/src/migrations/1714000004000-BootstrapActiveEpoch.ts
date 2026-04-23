import { createHash } from 'node:crypto';

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * consensus-007 CRITICAL-1 / ADR-018 §5 — bootstrap active epoch seed.
 *
 * `user_token_hash_salt_epochs` 에 active row 0건 감지 시 env `USER_TOKEN_HASH_SALT`
 * 의 fingerprint 로 1건 INSERT + `ops_event_log(kind='salt_rotation', payload={bootstrap:true})`
 * 동시 기록. 이미 active row 있으면 no-op. env salt 부재 시 fail-closed (throw).
 *
 * Session 6 PR #1 C1-1. 본 migration 머지 후 신규 DB 부팅 시 active epoch 1건 보장.
 */

const SYSTEM_SENTINEL_UUID = '00000000-0000-0000-0000-000000000000';

function saltFingerprint(salt: string): string {
  return createHash('sha256').update(salt).digest('hex').slice(0, 8);
}

export class BootstrapActiveEpoch1714000004000 implements MigrationInterface {
  name = 'BootstrapActiveEpoch1714000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const countResult = (await queryRunner.query(
      `SELECT COUNT(*) AS "count" FROM "user_token_hash_salt_epochs" WHERE "deactivated_at" IS NULL`,
    )) as Array<{ count: number | string }>;
    const activeCount = Number(countResult?.[0]?.count ?? 0);
    if (activeCount > 0) {
      return;
    }

    const salt = process.env.USER_TOKEN_HASH_SALT;
    if (!salt) {
      throw new Error(
        'BootstrapActiveEpoch: USER_TOKEN_HASH_SALT env 부재 (ADR-018 §5 fail-closed).',
      );
    }

    const fp = saltFingerprint(salt);

    await queryRunner.query(
      `INSERT INTO "user_token_hash_salt_epochs"
         ("salt_fingerprint", "activated_at", "admin_id", "reason", "note")
       VALUES ($1, NOW(), $2, $3, $4)`,
      [fp, SYSTEM_SENTINEL_UUID, 'scheduled', 'bootstrap seed'],
    );

    const payload = {
      bootstrap: true,
      salt_fingerprint: fp,
      admin_id: SYSTEM_SENTINEL_UUID,
      reason: 'scheduled',
      note: 'bootstrap seed',
    };

    await queryRunner.query(
      `INSERT INTO "ops_event_log" ("kind", "payload", "created_at")
       VALUES ($1, $2::jsonb, NOW())`,
      ['salt_rotation', JSON.stringify(payload)],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "user_token_hash_salt_epochs"
       WHERE "admin_id" = $1 AND "note" = $2`,
      [SYSTEM_SENTINEL_UUID, 'bootstrap seed'],
    );
  }
}
