import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { QuestionReportService } from './question-report.service';
import type { OpsEventLogEntity } from './entities/ops-event-log.entity';
import type { QuestionEntity } from '../content/entities/question.entity';
import type { Repository } from 'typeorm';

type EventRepo = Pick<Repository<OpsEventLogEntity>, 'save' | 'findOne'>;
type QRepo = Pick<Repository<QuestionEntity>, 'findOne'>;

describe('QuestionReportService.report', () => {
  let eventRepo: EventRepo & { save: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let questionRepo: QRepo & { findOne: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventRepo = {
      save: vi.fn().mockImplementation((e) => Promise.resolve({ ...e, id: 'evt-1' })),
      findOne: vi.fn().mockResolvedValue(null),
    };
    questionRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'q-1', status: 'pending_review' } as QuestionEntity),
    };
  });

  it('정상 신고 → ops_event_log 저장 + id 반환', async () => {
    const service = new QuestionReportService(eventRepo as never, questionRepo as never);

    const result = await service.report('q-1', 'user-1', 'incorrect_answer');

    expect(result).toEqual({ eventId: 'evt-1' });
    expect(eventRepo.save).toHaveBeenCalledOnce();
    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(saved.kind).toBe('student_report_incorrect');
    expect(saved.questionId).toBe('q-1');
    expect(saved.userId).toBe('user-1');
    expect((saved.payload as { reason: string }).reason).toBe('incorrect_answer');
  });

  it('존재하지 않는 question → NotFoundException', async () => {
    questionRepo.findOne.mockResolvedValue(null);
    const service = new QuestionReportService(eventRepo as never, questionRepo as never);

    await expect(service.report('missing', 'user-1', 'sql_error')).rejects.toThrow(NotFoundException);
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('동일 (user, question) 중복 신고 → ConflictException (findOne 선행 체크)', async () => {
    eventRepo.findOne.mockResolvedValue({ id: 'prev' } as OpsEventLogEntity);
    const service = new QuestionReportService(eventRepo as never, questionRepo as never);

    await expect(service.report('q-1', 'user-1', 'other')).rejects.toThrow(ConflictException);
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('동일 (user, question) 중복 신고 → DB unique violation도 ConflictException으로 변환', async () => {
    eventRepo.save.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    const service = new QuestionReportService(eventRepo as never, questionRepo as never);

    await expect(service.report('q-1', 'user-1', 'other')).rejects.toThrow(ConflictException);
  });

  it('다른 사용자의 신고는 독립적으로 허용', async () => {
    const service = new QuestionReportService(eventRepo as never, questionRepo as never);
    eventRepo.findOne.mockImplementation(async (opts: { where?: { userId?: string } }) =>
      opts.where?.userId === 'user-1' ? ({ id: 'prev' } as OpsEventLogEntity) : null,
    );

    await expect(service.report('q-1', 'user-2', 'sql_error')).resolves.toEqual({ eventId: 'evt-1' });
  });
});
