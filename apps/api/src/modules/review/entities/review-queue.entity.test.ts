import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';

import { ReviewQueueEntity } from './review-queue.entity';

/**
 * ADR-019 PR-1 — ReviewQueueEntity 메타데이터 smoke.
 *
 * 실 DB 연결 없이 TypeORM 메타데이터로 스키마를 assert. 실 migration 실행 후
 * 컬럼 정합은 PR-3 통합 테스트에서 재확인.
 */

function getColumn(name: string) {
  const storage = getMetadataArgsStorage();
  return storage.columns.find(
    (c) => c.target === ReviewQueueEntity && (c.options.name === name || c.propertyName === name),
  );
}

function getPrimaries() {
  const storage = getMetadataArgsStorage();
  return storage.columns.filter(
    (c) => c.target === ReviewQueueEntity && c.mode === 'regular' && c.options.primary,
  );
}

describe('ReviewQueueEntity metadata (ADR-019 PR-1)', () => {
  it('테이블명이 review_queue 로 등록된다', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === ReviewQueueEntity);
    expect(table).toBeDefined();
    expect(table?.name).toBe('review_queue');
  });

  it('복합 PK (user_id, question_id)', () => {
    const primaries = getPrimaries();
    const names = primaries.map((p) => p.options.name);
    expect(names).toContain('user_id');
    expect(names).toContain('question_id');
    expect(primaries).toHaveLength(2);
  });

  it('SM-2 상태 컬럼 집합 + default 값', () => {
    const ease = getColumn('ease_factor');
    expect(ease).toBeDefined();
    expect(ease?.options.type).toBe('numeric');
    expect(ease?.options.precision).toBe(4);
    expect(ease?.options.scale).toBe(3);
    expect(ease?.options.default).toBe('2.500');

    const interval = getColumn('interval_days');
    expect(interval?.options.type).toBe('int');
    expect(interval?.options.default).toBe(0);

    const rep = getColumn('repetition');
    expect(rep?.options.type).toBe('int');
    expect(rep?.options.default).toBe(0);

    const lastQ = getColumn('last_quality');
    expect(lastQ?.options.type).toBe('smallint');
    expect(lastQ?.options.nullable).toBe(true);

    const dueAt = getColumn('due_at');
    expect(dueAt?.options.type).toBe('timestamptz');
    expect(dueAt?.options.nullable).toBe(true);

    const lastReviewed = getColumn('last_reviewed_at');
    expect(lastReviewed?.options.type).toBe('timestamptz');
    expect(lastReviewed?.options.nullable).toBe(true);
  });

  it('algorithm_version default sm2-v1 (ADR-019 §4.2 FSRS 교체 대비)', () => {
    const col = getColumn('algorithm_version');
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('varchar');
    expect(Number(col?.options.length)).toBe(16);
    expect(col?.options.default).toBe('sm2-v1');
  });

  it('user_token_hash + epoch (ADR-019 §4.3 D3 Hybrid 대칭)', () => {
    const hash = getColumn('user_token_hash');
    expect(hash?.options.type).toBe('varchar');
    expect(Number(hash?.options.length)).toBe(32);
    expect(hash?.options.nullable).toBe(true);

    const epoch = getColumn('user_token_hash_epoch');
    expect(epoch?.options.type).toBe('smallint');
    expect(epoch?.options.nullable).toBe(true);
  });

  it('partial index 정의: (user_id, due_at) WHERE due_at IS NOT NULL', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === ReviewQueueEntity);
    const due = indices.find((i) => i.name === 'idx_review_queue_user_due');
    expect(due).toBeDefined();
    expect(due?.columns).toEqual(['userId', 'dueAt']);
    expect(due?.where).toMatch(/due_at.*IS NOT NULL/i);
  });

  it('created_at / updated_at auto 관리 (CreateDateColumn / UpdateDateColumn)', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === ReviewQueueEntity);
    const hasCreate = cols.some((c) => c.mode === 'createDate');
    const hasUpdate = cols.some((c) => c.mode === 'updateDate');
    expect(hasCreate).toBe(true);
    expect(hasUpdate).toBe(true);
  });
});
