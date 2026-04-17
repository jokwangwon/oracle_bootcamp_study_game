import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AdminReviewService } from './admin-review.service';
import type { QuestionEntity } from '../content/entities/question.entity';
import type { OpsEventLogEntity } from './entities/ops-event-log.entity';
import type { Repository } from 'typeorm';

type QRepo = { findOne: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
type ERepo = { save: ReturnType<typeof vi.fn> };

function makeQ(status: 'pending_review' | 'active' | 'rejected' | 'archived'): QuestionEntity {
  return {
    id: 'q-1',
    topic: 'sql-basics',
    week: 1,
    gameMode: 'blank-typing',
    difficulty: 'easy',
    content: { type: 'blank-typing', sql: 'X', blanks: [] },
    answer: ['X'],
    explanation: null,
    status,
    source: 'ai-realtime',
    createdAt: new Date(),
  } as QuestionEntity;
}

describe('AdminReviewService.review', () => {
  let qRepo: QRepo;
  let eRepo: ERepo;

  beforeEach(() => {
    eRepo = { save: vi.fn().mockResolvedValue({}) };
  });

  it('approve: pending_review → active 저장', async () => {
    qRepo = {
      findOne: vi.fn().mockResolvedValue(makeQ('pending_review')),
      save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = new AdminReviewService(qRepo as never, eRepo as never);

    const res = await service.review({
      questionId: 'q-1',
      adminUserId: 'admin-1',
      action: 'approve',
    });

    expect(res.status).toBe('active');
    expect(eRepo.save).not.toHaveBeenCalled();
  });

  it('reject: pending_review → rejected + ops_event_log(admin_reject) INSERT', async () => {
    qRepo = {
      findOne: vi.fn().mockResolvedValue(makeQ('pending_review')),
      save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = new AdminReviewService(qRepo as never, eRepo as never);

    const res = await service.review({
      questionId: 'q-1',
      adminUserId: 'admin-1',
      action: 'reject',
      reason: 'SQL syntax error',
    });

    expect(res.status).toBe('rejected');
    expect(eRepo.save).toHaveBeenCalledOnce();
    const evt = eRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(evt.kind).toBe('admin_reject');
    expect(evt.questionId).toBe('q-1');
    expect(evt.userId).toBe('admin-1');
    expect((evt.payload as { reason: string }).reason).toBe('SQL syntax error');
  });

  it('reject without reason → ops_event_log payload.reason=null', async () => {
    qRepo = {
      findOne: vi.fn().mockResolvedValue(makeQ('pending_review')),
      save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = new AdminReviewService(qRepo as never, eRepo as never);

    await service.review({ questionId: 'q-1', adminUserId: 'admin-1', action: 'reject' });
    const evt = eRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect((evt.payload as { reason: string | null }).reason).toBeNull();
  });

  it('not found → NotFoundException', async () => {
    qRepo = { findOne: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const service = new AdminReviewService(qRepo as never, eRepo as never);

    await expect(
      service.review({ questionId: 'missing', adminUserId: 'admin-1', action: 'approve' }),
    ).rejects.toThrow(NotFoundException);
    expect(qRepo.save).not.toHaveBeenCalled();
  });

  it('이미 active인 문제 → BadRequest (review는 pending_review 상태만)', async () => {
    qRepo = {
      findOne: vi.fn().mockResolvedValue(makeQ('active')),
      save: vi.fn(),
    };
    const service = new AdminReviewService(qRepo as never, eRepo as never);

    await expect(
      service.review({ questionId: 'q-1', adminUserId: 'admin-1', action: 'approve' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('이미 rejected인 문제 → BadRequest', async () => {
    qRepo = {
      findOne: vi.fn().mockResolvedValue(makeQ('rejected')),
      save: vi.fn(),
    };
    const service = new AdminReviewService(qRepo as never, eRepo as never);

    await expect(
      service.review({ questionId: 'q-1', adminUserId: 'admin-1', action: 'reject' }),
    ).rejects.toThrow(BadRequestException);
  });
});
