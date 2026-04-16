import { describe, it, expect, beforeEach, vi } from 'vitest';

import { OpsMeasurementService } from './ops-measurement.service';
import type { OpsQuestionMeasurementEntity } from './entities/ops-question-measurement.entity';
import type { OpsEventLogEntity } from './entities/ops-event-log.entity';
import type { QuestionEntity } from '../content/entities/question.entity';
import type { ScopeValidatorService } from '../content/services/scope-validator.service';
import type { Repository } from 'typeorm';

type MeasureRepo = Pick<Repository<OpsQuestionMeasurementEntity>, 'save' | 'count'>;
type EventRepo = Pick<Repository<OpsEventLogEntity>, 'save'>;

function makeQuestion(partial: Partial<QuestionEntity>): QuestionEntity {
  return {
    id: 'q-1',
    topic: 'sql-basics',
    week: 1,
    gameMode: 'blank-typing',
    difficulty: 'easy',
    content: {
      type: 'blank-typing',
      sql: 'SELECT ___ FROM EMP WHERE DEPTNO = ___',
      blanks: [
        { position: 0, answer: 'ENAME' },
        { position: 1, answer: '10' },
      ],
    },
    answer: ['ENAME', '10'],
    explanation: null,
    status: 'pending_review',
    source: 'ai-realtime',
    createdAt: new Date(),
    ...partial,
  } as QuestionEntity;
}

function makeScopeValidator(out: string[] = []): ScopeValidatorService {
  return {
    validateText: vi.fn().mockResolvedValue({ valid: out.length === 0, outOfScope: out }),
  } as unknown as ScopeValidatorService;
}

describe('OpsMeasurementService.measureSync', () => {
  let measureRepo: MeasureRepo & { save: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  let eventRepo: EventRepo & { save: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    measureRepo = {
      save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
      count: vi.fn().mockResolvedValue(0),
    };
    eventRepo = { save: vi.fn().mockResolvedValue({}) };
  });

  it('blank-typing + MT3 pass + MT4 pass → window_index=1 저장', async () => {
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await service.measureSync(makeQuestion({}), 12345, 'sha256:abc');

    expect(measureRepo.save).toHaveBeenCalledOnce();
    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.mt3Pass).toBe(true);
    expect(saved.mt4Pass).toBe(true);
    expect(saved.windowIndex).toBe(1);
    expect(saved.latencyMs).toBe(12345);
    expect(saved.modelDigest).toBe('sha256:abc');
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('MT3 fail: outOfScope가 저장되고 mt3_pass=false', async () => {
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(['DROP', 'TRUNCATE']),
    );
    await service.measureSync(makeQuestion({}), 100, 'sha256:abc');

    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.mt3Pass).toBe(false);
    expect(saved.mt3OutOfScope).toEqual(['DROP', 'TRUNCATE']);
  });

  it('MT4 fail: sql의 ___ 개수와 blanks 길이 불일치', async () => {
    const q = makeQuestion({
      content: {
        type: 'blank-typing',
        sql: 'SELECT ___ FROM EMP',
        blanks: [
          { position: 0, answer: 'ENAME' },
          { position: 1, answer: '10' },
        ],
      },
      answer: ['ENAME', '10'],
    });
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await service.measureSync(q, 200, 'sha256:abc');

    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.mt4Pass).toBe(false);
    expect(saved.mt4Failures).toMatchObject({ expectedBlankCount: 2, actualBlankCount: 1 });
  });

  it('MT4 fail: top-level answer 길이 ≠ blanks 길이', async () => {
    const q = makeQuestion({
      answer: ['ENAME'],
    });
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await service.measureSync(q, 200, 'sha256:abc');

    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.mt4Pass).toBe(false);
  });

  it('term-match 모드: mt4_pass=null', async () => {
    const q = makeQuestion({
      gameMode: 'term-match',
      content: { type: 'term-match', description: 'SELECT 문의 기능은?' },
      answer: ['조회'],
    });
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await service.measureSync(q, 50, 'sha256:abc');

    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.mt4Pass).toBeNull();
    expect(saved.mt3Pass).toBe(true);
  });

  it('window_index: 기존 99건 측정 → 새 row windowIndex=100', async () => {
    measureRepo.count.mockResolvedValue(99);
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await service.measureSync(makeQuestion({}), 100, 'sha256:abc');

    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.windowIndex).toBe(100);
  });

  it('window_index: 100건 초과 → null', async () => {
    measureRepo.count.mockResolvedValue(100);
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await service.measureSync(makeQuestion({}), 100, 'sha256:abc');

    const saved = measureRepo.save.mock.calls[0]![0] as OpsQuestionMeasurementEntity;
    expect(saved.windowIndex).toBeNull();
  });

  it('scopeValidator 예외 → measurement_fail 이벤트 기록 + 예외 삼킴', async () => {
    const validator = {
      validateText: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as ScopeValidatorService;
    const service = new OpsMeasurementService(measureRepo as never, eventRepo as never, validator);

    await expect(service.measureSync(makeQuestion({}), 100, 'sha256:abc')).resolves.toBeUndefined();

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const logged = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(logged.kind).toBe('measurement_fail');
    expect((logged.payload as { stage: string }).stage).toBe('mt3');
    expect(measureRepo.save).not.toHaveBeenCalled();
  });

  it('save 예외 → measurement_fail 이벤트 기록', async () => {
    measureRepo.save.mockRejectedValue(new Error('unique violation'));
    const service = new OpsMeasurementService(
      measureRepo as never,
      eventRepo as never,
      makeScopeValidator(),
    );
    await expect(service.measureSync(makeQuestion({}), 100, 'sha256:abc')).resolves.toBeUndefined();

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const logged = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(logged.kind).toBe('measurement_fail');
    expect((logged.payload as { stage: string }).stage).toBe('other');
  });
});
