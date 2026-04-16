import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { NotionController } from './notion.controller';
import type { Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';

function makeCtl(opts: {
  envDb?: string;
  add?: ReturnType<typeof vi.fn>;
}) {
  const queue = { add: opts.add ?? vi.fn().mockResolvedValue({}) } as unknown as Queue;
  const config = {
    get: vi.fn((key: string) => (key === 'NOTION_DATABASE_ID' ? opts.envDb : undefined)),
  } as unknown as ConfigService;
  return new NotionController(queue, config);
}

describe('NotionController', () => {
  it('body.databaseId 있으면 그것을 사용', async () => {
    const add = vi.fn().mockResolvedValue({});
    const ctl = makeCtl({ envDb: 'env-db', add });

    const res = await ctl.triggerSync({ databaseId: 'override-db' });

    expect(res.databaseId).toBe('override-db');
    expect(res.jobId).toMatch(/^manual:override-db:/);
    expect(add).toHaveBeenCalledWith(
      'sync-database',
      { databaseId: 'override-db' },
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it('body.databaseId 없으면 NOTION_DATABASE_ID env를 fallback', async () => {
    const ctl = makeCtl({ envDb: 'env-db' });
    const res = await ctl.triggerSync({});
    expect(res.databaseId).toBe('env-db');
  });

  it('body.databaseId 빈 문자열도 fallback (trim)', async () => {
    const ctl = makeCtl({ envDb: 'env-db' });
    const res = await ctl.triggerSync({ databaseId: '   ' });
    expect(res.databaseId).toBe('env-db');
  });

  it('body 비고 env도 비면 BadRequest', async () => {
    const ctl = makeCtl({ envDb: undefined });
    await expect(ctl.triggerSync({})).rejects.toThrow(BadRequestException);
  });
});
