import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { SeedService } from './seed.service';
import { WEEK1_SQL_BASICS_SCOPE } from './data/week1-sql-basics.scope';
import { WEEK2_TRANSACTIONS_SCOPE } from './data/week2-transactions.scope';

/**
 * ADR-010: SeedService.syncScopes — scope.ts를 단일 source of truth로 DB 동기화.
 * 멱등성 + 변경 감지가 핵심이므로 이 두 축만 검증한다.
 */
describe('SeedService.syncScopes', () => {
  function makeService(scopeRows: Array<{ week: number; topic: string; keywords: string[]; sourceUrl: string | null }>) {
    const saved: Array<Record<string, unknown>> = [];
    const scopeRepo = {
      findOne: vi.fn(async ({ where }: { where: { week: number; topic: string } }) =>
        scopeRows.find((r) => r.week === where.week && r.topic === where.topic) ?? null,
      ),
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (entity: Record<string, unknown>) => {
        saved.push(entity);
        return entity;
      }),
      count: vi.fn(),
    } as unknown as ConstructorParameters<typeof SeedService>[3];

    const service = new SeedService(
      { get: vi.fn() } as unknown as ConfigService,
      { validateText: vi.fn() } as never,
      { count: vi.fn() } as never,
      scopeRepo,
    );
    return { service, saved, scopeRepo };
  }

  it('기존 row 없으면 insert', async () => {
    const { service, saved } = makeService([]);
    const report = await service.syncScopes();
    expect(report).toEqual([
      { week: 1, topic: 'sql-basics', changed: true },
      { week: 2, topic: 'transactions', changed: true },
    ]);
    expect(saved).toHaveLength(2);
  });

  it('keywords 동일하면 changed=false + save 미호출', async () => {
    const { service, saved } = makeService([
      { week: 1, topic: 'sql-basics', keywords: [...WEEK1_SQL_BASICS_SCOPE.keywords], sourceUrl: null },
      { week: 2, topic: 'transactions', keywords: [...WEEK2_TRANSACTIONS_SCOPE.keywords], sourceUrl: null },
    ]);
    const report = await service.syncScopes();
    expect(report.every((r) => !r.changed)).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('keywords 차이 있으면 UPDATE', async () => {
    const { service, saved } = makeService([
      { week: 1, topic: 'sql-basics', keywords: ['OLD_ONLY'], sourceUrl: null },
      { week: 2, topic: 'transactions', keywords: [...WEEK2_TRANSACTIONS_SCOPE.keywords], sourceUrl: null },
    ]);
    const report = await service.syncScopes();
    expect(report[0]).toEqual({ week: 1, topic: 'sql-basics', changed: true });
    expect(report[1]).toEqual({ week: 2, topic: 'transactions', changed: false });
    expect(saved).toHaveLength(1);
    expect((saved[0] as { keywords: string[] }).keywords).toEqual(WEEK1_SQL_BASICS_SCOPE.keywords);
  });
});
