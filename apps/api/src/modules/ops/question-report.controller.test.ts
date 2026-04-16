import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';

import { QuestionReportController, type ReportQuestionDto } from './question-report.controller';
import type { QuestionReportService } from './question-report.service';

function makeController(reportFn: QuestionReportService['report']) {
  const service = { report: reportFn } as unknown as QuestionReportService;
  return new QuestionReportController(service);
}

const fakeReq = (userId: string): Request =>
  ({ user: { sub: userId } } as unknown as Request);

describe('QuestionReportController', () => {
  it('DTO + req.user.sub을 service.report에 매핑', async () => {
    const report = vi.fn(async () => ({ eventId: 'evt-1' }));
    const ctrl = makeController(report);
    const dto: ReportQuestionDto = { reason: 'incorrect_answer' };

    const res = await ctrl.report('q-1', dto, fakeReq('user-1'));

    expect(report).toHaveBeenCalledWith('q-1', 'user-1', 'incorrect_answer');
    expect(res).toEqual({ eventId: 'evt-1' });
  });

  it('service throw는 그대로 전파 (Nest 필터가 처리)', async () => {
    const report = vi.fn(async () => {
      throw new Error('boom');
    });
    const ctrl = makeController(report);

    await expect(ctrl.report('q-1', { reason: 'other' }, fakeReq('user-1'))).rejects.toThrow('boom');
  });
});
