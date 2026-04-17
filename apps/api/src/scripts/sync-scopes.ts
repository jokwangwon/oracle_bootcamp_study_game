#!/usr/bin/env tsx
/**
 * weekly_scope 테이블 동기화 스크립트 (ADR-010)
 *
 * scope.ts 파일을 단일 source of truth로 weekly_scope 테이블과 동기화.
 * R2 재평가 전 필수 선행 작업. SeedService.syncScopes()의 이식 버전으로
 * Nest/TypeORM 부트스트랩 없이 pg 라이브러리 직접 사용 (CLI 간결성).
 *
 * 사용법 (apps/api 디렉토리에서):
 *   DATABASE_URL="postgresql://oracle_game:changeme@localhost:5434/oracle_game" \
 *     npx tsx src/scripts/sync-scopes.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { Client } from 'pg';

// apps/api/src/scripts/ → project root 4단계 상위
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

import { WEEK1_SQL_BASICS_SCOPE } from '../modules/content/seed/data/week1-sql-basics.scope';
import { WEEK2_TRANSACTIONS_SCOPE } from '../modules/content/seed/data/week2-transactions.scope';
import type { WeeklyScopeSeed } from '../modules/content/seed/data/week1-sql-basics.scope';

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.POSTGRES_USER ?? 'oracle_game';
  const pw = process.env.POSTGRES_PASSWORD ?? 'changeme';
  const db = process.env.POSTGRES_DB ?? 'oracle_game';
  const port = process.env.POSTGRES_PORT ?? '5432';
  return `postgresql://${user}:${pw}@localhost:${port}/${db}`;
}

async function upsertScope(
  client: Client,
  seed: WeeklyScopeSeed,
): Promise<{ week: number; topic: string; changed: boolean; reason: string }> {
  const existing = await client.query<{
    id: string;
    keywords: string[];
    source_url: string | null;
  }>(
    `SELECT id, keywords, source_url FROM weekly_scope WHERE week = $1 AND topic = $2`,
    [seed.week, seed.topic],
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO weekly_scope (week, topic, keywords, source_url)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [seed.week, seed.topic, JSON.stringify(seed.keywords), seed.sourceUrl],
    );
    return { week: seed.week, topic: seed.topic, changed: true, reason: 'inserted' };
  }

  const row = existing.rows[0]!;
  const existingKeywords: string[] = row.keywords ?? [];
  const same =
    existingKeywords.length === seed.keywords.length &&
    existingKeywords.every((k, i) => k === seed.keywords[i]);

  if (same && row.source_url === seed.sourceUrl) {
    return { week: seed.week, topic: seed.topic, changed: false, reason: 'unchanged' };
  }

  await client.query(
    `UPDATE weekly_scope
       SET keywords = $1::jsonb, source_url = $2
       WHERE id = $3`,
    [JSON.stringify(seed.keywords), seed.sourceUrl, row.id],
  );
  return {
    week: seed.week,
    topic: seed.topic,
    changed: true,
    reason: `updated (keywords: ${existingKeywords.length} → ${seed.keywords.length})`,
  };
}

async function main(): Promise<void> {
  const connectionString = buildDatabaseUrl();
  console.log(`[sync-scopes] DB: ${connectionString.replace(/:[^:@/]+@/, ':***@')}`);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const seeds: WeeklyScopeSeed[] = [WEEK1_SQL_BASICS_SCOPE, WEEK2_TRANSACTIONS_SCOPE];
    const report = [];
    for (const seed of seeds) {
      report.push(await upsertScope(client, seed));
    }

    console.log('\n=== syncScopes report ===');
    for (const r of report) {
      const mark = r.changed ? '[CHANGED]' : '[unchanged]';
      console.log(`${mark} week=${r.week} topic=${r.topic} (${r.reason})`);
    }
    const changedCount = report.filter((r) => r.changed).length;
    console.log(`\n총 ${report.length}개 scope 중 ${changedCount}개 갱신됨.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[sync-scopes] 실패:', err);
  process.exit(1);
});
