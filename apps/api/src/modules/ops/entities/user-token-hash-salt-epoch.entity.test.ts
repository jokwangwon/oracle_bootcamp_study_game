import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';

import { UserTokenHashSaltEpochEntity } from './user-token-hash-salt-epoch.entity';

/**
 * ADR-018 §5 — UserTokenHashSaltEpochEntity TypeORM 메타데이터 검증.
 *
 * 목적: entity 선언이 ADR-018 §5 스키마와 1:1 대응하는지 계산적 검증.
 * DB 실 연결 없이 decorator 메타데이터만으로 구조 확인.
 */

describe('UserTokenHashSaltEpochEntity (ADR-018 §5)', () => {
  const tableMeta = getMetadataArgsStorage().tables.find(
    (t) => t.target === UserTokenHashSaltEpochEntity,
  );
  const columnMetas = getMetadataArgsStorage().columns.filter(
    (c) => c.target === UserTokenHashSaltEpochEntity,
  );
  const generatedMetas = getMetadataArgsStorage().generations.filter(
    (g) => g.target === UserTokenHashSaltEpochEntity,
  );
  const indexMetas = getMetadataArgsStorage().indices.filter(
    (i) => i.target === UserTokenHashSaltEpochEntity,
  );

  it('테이블명은 user_token_hash_salt_epochs', () => {
    expect(tableMeta?.name).toBe('user_token_hash_salt_epochs');
  });

  it('epoch_id 는 smallint PK (SMALLSERIAL 지원)', () => {
    const epoch = columnMetas.find((c) => c.propertyName === 'epochId');
    expect(epoch?.options.name).toBe('epoch_id');
    expect(epoch?.options.type).toBe('smallint');
    expect(epoch?.options.primary).toBe(true);
    const gen = generatedMetas.find((g) => g.propertyName === 'epochId');
    expect(gen).toBeDefined();
    expect(gen?.strategy).toBe('increment');
  });

  it('salt_fingerprint 는 char(8) NOT NULL — salt 평문 금지 (§8 금지 4)', () => {
    const col = columnMetas.find((c) => c.propertyName === 'saltFingerprint');
    expect(col?.options.name).toBe('salt_fingerprint');
    expect(col?.options.type).toBe('char');
    expect(col?.options.length).toBe(8);
    expect(col?.options.nullable).toBeFalsy();
  });

  it('activated_at 는 timestamptz NOT NULL', () => {
    const col = columnMetas.find((c) => c.propertyName === 'activatedAt');
    expect(col?.options.name).toBe('activated_at');
    expect(col?.options.type).toBe('timestamptz');
    expect(col?.options.nullable).toBeFalsy();
  });

  it('deactivated_at 는 timestamptz nullable (활성 중이면 null)', () => {
    const col = columnMetas.find((c) => c.propertyName === 'deactivatedAt');
    expect(col?.options.name).toBe('deactivated_at');
    expect(col?.options.type).toBe('timestamptz');
    expect(col?.options.nullable).toBe(true);
  });

  it('admin_id 는 uuid NOT NULL', () => {
    const col = columnMetas.find((c) => c.propertyName === 'adminId');
    expect(col?.options.name).toBe('admin_id');
    expect(col?.options.type).toBe('uuid');
    expect(col?.options.nullable).toBeFalsy();
  });

  it('reason 은 varchar(32) — scheduled|incident (CHECK 은 migration 에서)', () => {
    const col = columnMetas.find((c) => c.propertyName === 'reason');
    expect(col?.options.type).toBe('varchar');
    expect(col?.options.length).toBe(32);
  });

  it('note 는 text nullable', () => {
    const col = columnMetas.find((c) => c.propertyName === 'note');
    expect(col?.options.type).toBe('text');
    expect(col?.options.nullable).toBe(true);
  });

  it('활성 salt 1건 partial unique index — activated_at on WHERE deactivated_at IS NULL', () => {
    const idx = indexMetas.find(
      (i) => i.name === 'ux_user_token_hash_salt_epochs_active',
    );
    expect(idx).toBeDefined();
    expect(idx?.unique).toBe(true);
    expect(idx?.where).toMatch(/deactivated_at.*IS\s+NULL/i);
    const cols = typeof idx?.columns === 'function' ? [] : idx?.columns;
    expect(cols).toContain('activatedAt');
  });
});
