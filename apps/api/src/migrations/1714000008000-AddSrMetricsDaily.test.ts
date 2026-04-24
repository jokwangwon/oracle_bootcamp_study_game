import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddSrMetricsDaily1714000008000 } from './1714000008000-AddSrMetricsDaily';

/**
 * ADR-019 PR-6 — migration up/down SQL smoke.
 *
 * 실 Postgres 없이 쿼리 문자열만 assert.
 */

function makeRunner() {
  const queries: string[] = [];
  const queryRunner: Partial<QueryRunner> = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return undefined as unknown;
    }),
  };
  return { queryRunner: queryRunner as QueryRunner, queries };
}

describe('AddSrMetricsDaily1714000008000', () => {
  it('migration 이름이 고정된다', () => {
    const m = new AddSrMetricsDaily1714000008000();
    expect(m.name).toBe('AddSrMetricsDaily1714000008000');
  });

  it('up: sr_metrics_daily CREATE TABLE IF NOT EXISTS + metric_date PK', async () => {
    const m = new AddSrMetricsDaily1714000008000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+sr_metrics_daily/);
    expect(sql).toMatch(/metric_date\s+DATE\s+NOT NULL PRIMARY KEY/);
  });

  it('up: 3대 지표 컬럼 + sample_size', async () => {
    const m = new AddSrMetricsDaily1714000008000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries[0]!;
    expect(sql).toMatch(/retention_avg_quality\s+NUMERIC\(4,3\)/);
    expect(sql).toMatch(/retention_sample_size\s+INT\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/completion_rate\s+NUMERIC\(4,3\)/);
    expect(sql).toMatch(/completion_completed\s+INT\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/completion_scheduled\s+INT\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/guard_low_rate\s+NUMERIC\(4,3\)/);
    expect(sql).toMatch(/guard_low_count\s+INT\s+NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/guard_total\s+INT\s+NOT NULL DEFAULT 0/);
  });

  it('up: created_at DEFAULT NOW()', async () => {
    const m = new AddSrMetricsDaily1714000008000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);
    expect(queries[0]).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL DEFAULT NOW\(\)/);
  });

  it('down: DROP TABLE IF EXISTS 단일 statement', async () => {
    const m = new AddSrMetricsDaily1714000008000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/DROP TABLE IF EXISTS sr_metrics_daily/);
  });
});
