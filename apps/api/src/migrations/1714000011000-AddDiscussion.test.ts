import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddDiscussion1714000011000 } from './1714000011000-AddDiscussion';

/**
 * PR-10b Phase 1 — R4 토론 3-테이블 신설.
 *
 * ADR-020 §5.1 (entity 명세) + §4.4 (vote UNIQUE/CHECK).
 * 실 Postgres 없이 SQL 문자열만 assert.
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

describe('AddDiscussion1714000011000', () => {
  it('migration 이름이 고정된다', () => {
    const m = new AddDiscussion1714000011000();
    expect(m.name).toBe('AddDiscussion1714000011000');
  });

  it('up: 3 테이블 CREATE TABLE IF NOT EXISTS (threads / posts / votes)', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+discussion_threads/);
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+discussion_posts/);
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+discussion_votes/);
  });

  it('up: discussion_threads 컬럼 (uuid PK + score/post_count default 0 + last_activity_at + is_deleted)', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries.find((q) => /CREATE TABLE IF NOT EXISTS\s+discussion_threads/.test(q))!;
    expect(sql).toMatch(/id\s+UUID\s+NOT NULL\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/);
    expect(sql).toMatch(/question_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/author_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/title\s+VARCHAR\(200\)\s+NOT NULL/);
    expect(sql).toMatch(/body\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/score\s+INTEGER\s+NOT NULL\s+DEFAULT 0/);
    expect(sql).toMatch(/post_count\s+INTEGER\s+NOT NULL\s+DEFAULT 0/);
    expect(sql).toMatch(/last_activity_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT NOW\(\)/);
    expect(sql).toMatch(/is_deleted\s+BOOLEAN\s+NOT NULL\s+DEFAULT FALSE/);
    expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT NOW\(\)/);
    expect(sql).toMatch(/updated_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT NOW\(\)/);
  });

  it('up: discussion_posts 컬럼 (parent_id nullable / is_accepted / related_question_id nullable)', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries.find((q) => /CREATE TABLE IF NOT EXISTS\s+discussion_posts/.test(q))!;
    expect(sql).toMatch(/thread_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/author_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/parent_id\s+UUID/); // nullable (no NOT NULL)
    expect(sql).toMatch(/body\s+TEXT\s+NOT NULL/);
    expect(sql).toMatch(/is_accepted\s+BOOLEAN\s+NOT NULL\s+DEFAULT FALSE/);
    expect(sql).toMatch(/related_question_id\s+UUID/); // nullable
  });

  it('up: discussion_votes 복합 PK + target_type CHECK + value CHECK (-1, 1)', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const sql = queries.find((q) => /CREATE TABLE IF NOT EXISTS\s+discussion_votes/.test(q))!;
    expect(sql).toMatch(/user_id\s+UUID\s+NOT NULL/);
    expect(sql).toMatch(/target_type\s+VARCHAR\(10\)\s+NOT NULL/);
    expect(sql).toMatch(/CHECK\s*\(\s*target_type\s+IN\s*\(\s*'thread'\s*,\s*'post'\s*\)\s*\)/);
    expect(sql).toMatch(/value\s+SMALLINT\s+NOT NULL/);
    expect(sql).toMatch(/CHECK\s*\(\s*value\s+IN\s*\(\s*-1\s*,\s*1\s*\)\s*\)/);
    expect(sql).toMatch(/PRIMARY KEY\s*\(\s*user_id\s*,\s*target_type\s*,\s*target_id\s*\)/);
  });

  it('up: FK CASCADE — threads.author_id, posts.thread_id, posts.author_id', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(/REFERENCES\s+users\s*\(\s*id\s*\)\s+ON DELETE CASCADE/);
    expect(allSql).toMatch(/REFERENCES\s+discussion_threads\s*\(\s*id\s*\)\s+ON DELETE CASCADE/);
  });

  it('up: 인덱스 (threads question_activity / posts thread_created)', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_discussion_threads_question_activity[\s\S]*ON discussion_threads/,
    );
    expect(allSql).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_discussion_posts_thread_created[\s\S]*ON discussion_posts/,
    );
  });

  it('down: 인덱스 + 3 테이블 DROP IF EXISTS (역순)', async () => {
    const m = new AddDiscussion1714000011000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(/DROP INDEX IF EXISTS\s+idx_discussion_posts_thread_created/);
    expect(allSql).toMatch(/DROP INDEX IF EXISTS\s+idx_discussion_threads_question_activity/);
    expect(allSql).toMatch(/DROP TABLE IF EXISTS\s+discussion_votes/);
    expect(allSql).toMatch(/DROP TABLE IF EXISTS\s+discussion_posts/);
    expect(allSql).toMatch(/DROP TABLE IF EXISTS\s+discussion_threads/);
  });
});
