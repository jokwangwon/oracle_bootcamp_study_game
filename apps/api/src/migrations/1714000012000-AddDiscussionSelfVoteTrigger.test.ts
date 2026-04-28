import { describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from 'typeorm';

import { AddDiscussionSelfVoteTrigger1714000012000 } from './1714000012000-AddDiscussionSelfVoteTrigger';

/**
 * PR-10b §4.4 — self-vote 차단 plpgsql 트리거.
 *
 * CHECK 제약은 JOIN 불가 — JOIN 으로 author_id 비교하려면 트리거 필요.
 * 서버 측 ForbiddenException 이 1차 방어 (UX 메시지), DB 트리거가 최후 방어.
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

describe('AddDiscussionSelfVoteTrigger1714000012000', () => {
  it('migration 이름이 고정된다', () => {
    const m = new AddDiscussionSelfVoteTrigger1714000012000();
    expect(m.name).toBe('AddDiscussionSelfVoteTrigger1714000012000');
  });

  it('up: prevent_self_vote FUNCTION + tr_prevent_self_vote TRIGGER 생성', async () => {
    const m = new AddDiscussionSelfVoteTrigger1714000012000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(/CREATE OR REPLACE FUNCTION prevent_discussion_self_vote/);
    expect(allSql).toMatch(/RAISE EXCEPTION/);
    expect(allSql).toMatch(/discussion_posts/);
    expect(allSql).toMatch(/discussion_threads/);
    expect(allSql).toMatch(
      /CREATE TRIGGER tr_prevent_discussion_self_vote[\s\S]*BEFORE INSERT OR UPDATE ON discussion_votes/,
    );
  });

  it('up: 함수가 target_type 분기 (post / thread)', async () => {
    const m = new AddDiscussionSelfVoteTrigger1714000012000();
    const { queryRunner, queries } = makeRunner();
    await m.up(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(/IF NEW\.target_type = 'post' THEN/);
    expect(allSql).toMatch(/IF NEW\.target_type = 'thread' THEN/);
  });

  it('down: 트리거 먼저 drop → function drop (역순)', async () => {
    const m = new AddDiscussionSelfVoteTrigger1714000012000();
    const { queryRunner, queries } = makeRunner();
    await m.down(queryRunner);

    const allSql = queries.join('\n');
    expect(allSql).toMatch(/DROP TRIGGER IF EXISTS tr_prevent_discussion_self_vote/);
    expect(allSql).toMatch(/DROP FUNCTION IF EXISTS prevent_discussion_self_vote/);

    // 순서 검증 — TRIGGER 가 FUNCTION 보다 먼저
    const triggerIdx = allSql.indexOf('DROP TRIGGER');
    const functionIdx = allSql.indexOf('DROP FUNCTION');
    expect(triggerIdx).toBeLessThan(functionIdx);
  });
});
