import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Repository } from 'typeorm';

import { GradingMeasurementService } from './grading-measurement.service';
import type {
  GradingMeasuredPayload,
  LlmTimeoutPayload,
  OpsEventLogEntity,
} from './entities/ops-event-log.entity';

/**
 * consensus-007 S6-C2-2 — GradingMeasurementService TDD.
 *
 * 검증 범위:
 *  1. payload 전달 완결성 — GradingMeasuredPayload 전 필드가 ops_event_log 에 그대로
 *     실려 저장되는지 (MT6/MT8 집계 입력원).
 *  2. kind='grading_measured' 고정 + questionId/userId 올바른 컬럼 매핑.
 *  3. Fail-safe — eventRepo.save 실패 시 warn 로깅만, 예외 전파 금지.
 *  4. optional astFailureReason 유무에 따른 payload 차이.
 *  5. Layer 경로별 layer1Resolved / layer3Invoked 조합.
 *  6. held 경로 payload.
 */

type EventRepo = Pick<Repository<OpsEventLogEntity>, 'save'>;

function makePayload(overrides: Partial<GradingMeasuredPayload> = {}): GradingMeasuredPayload {
  return {
    gradingMethod: 'keyword',
    gradingLayersUsed: [1, 2],
    partialScore: 1,
    graderDigest: 'keyword-v1',
    layer1Resolved: false,
    layer3Invoked: false,
    judgeInvocationCount: 0,
    heldForReview: false,
    sanitizationFlagCount: 0,
    latencyMs: 120,
    ...overrides,
  };
}

describe('GradingMeasurementService.measureGrading', () => {
  let eventRepo: EventRepo & { save: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventRepo = { save: vi.fn().mockResolvedValue({}) };
  });

  it("kind='grading_measured' + questionId/userId/payload 가 정확히 저장된다", async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    const payload = makePayload();
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload,
    });

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(saved.kind).toBe('grading_measured');
    expect(saved.questionId).toBe('q-1');
    expect(saved.userId).toBe('user-1');
    expect(saved.resolvedAt).toBeNull();
    expect(saved.payload).toEqual(payload);
  });

  it('Layer 1 PASS 경로 — layer1Resolved=true, layer3Invoked=false, gradingMethod=ast', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload({
        gradingMethod: 'ast',
        gradingLayersUsed: [1],
        layer1Resolved: true,
        layer3Invoked: false,
        graderDigest: 'ast-v1',
      }),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.gradingMethod).toBe('ast');
    expect(p.gradingLayersUsed).toEqual([1]);
    expect(p.layer1Resolved).toBe(true);
    expect(p.layer3Invoked).toBe(false);
  });

  it('Layer 3 경로 — layer3Invoked=true, judgeInvocationCount≥1, gradingMethod=llm', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload({
        gradingMethod: 'llm',
        gradingLayersUsed: [1, 2, 3],
        layer1Resolved: false,
        layer3Invoked: true,
        judgeInvocationCount: 1,
        graderDigest: 'prompt:eval:v1|model:abcd1234|parser:sov1|temp:0|seed:42|topk:1',
      }),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.layer3Invoked).toBe(true);
    expect(p.judgeInvocationCount).toBe(1);
    expect(p.gradingLayersUsed).toEqual([1, 2, 3]);
  });

  it('held 경로 — heldForReview=true, gradingMethod=held', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload({
        gradingMethod: 'held',
        gradingLayersUsed: [1, 2, 3],
        heldForReview: true,
        layer3Invoked: true,
        judgeInvocationCount: 1,
      }),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.heldForReview).toBe(true);
    expect(p.gradingMethod).toBe('held');
  });

  it('astFailureReason 이 있으면 payload 에 그대로 전달', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload({
        gradingMethod: 'keyword',
        gradingLayersUsed: [1, 2],
        astFailureReason: 'dialect_unsupported',
      }),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.astFailureReason).toBe('dialect_unsupported');
  });

  it('astFailureReason 미전달 시 payload 에 키 없음 (undefined)', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload(),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.astFailureReason).toBeUndefined();
  });

  it('sanitizationFlagCount 를 기록한다 (원문 저장 금지, 개수만)', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload({ sanitizationFlagCount: 2 }),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.sanitizationFlagCount).toBe(2);
  });

  it('Fail-safe — eventRepo.save 실패해도 예외 전파 금지 (채점 경로 보호)', async () => {
    eventRepo.save.mockRejectedValueOnce(new Error('DB unreachable'));
    const service = new GradingMeasurementService(eventRepo as never);

    await expect(
      service.measureGrading({
        questionId: 'q-1',
        userId: 'user-1',
        payload: makePayload(),
      }),
    ).resolves.toBeUndefined();
  });

  it('latencyMs 와 graderDigest 도 payload 에 전달', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.measureGrading({
      questionId: 'q-1',
      userId: 'user-1',
      payload: makePayload({ latencyMs: 8421, graderDigest: 'ast-v1' }),
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as GradingMeasuredPayload;
    expect(p.latencyMs).toBe(8421);
    expect(p.graderDigest).toBe('ast-v1');
  });
});

describe('GradingMeasurementService.recordLlmTimeout (S6-C2-5)', () => {
  let eventRepo: { save: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventRepo = { save: vi.fn().mockResolvedValue({}) };
  });

  it("kind='llm_timeout' 이벤트로 저장 + payload 4필드 전달", async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    const payload: LlmTimeoutPayload = {
      timeoutMs: 8000,
      layerAttempted: 3,
      elapsedMs: 8050,
      retriable: true,
    };
    await service.recordLlmTimeout({
      questionId: 'q-1',
      userId: 'user-1',
      payload,
    });

    expect(eventRepo.save).toHaveBeenCalledOnce();
    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    expect(saved.kind).toBe('llm_timeout');
    expect(saved.questionId).toBe('q-1');
    expect(saved.userId).toBe('user-1');
    expect(saved.payload).toEqual(payload);
  });

  it('elapsedMs 미전달 시 payload 에 키 없음 (optional)', async () => {
    const service = new GradingMeasurementService(eventRepo as never);
    await service.recordLlmTimeout({
      questionId: 'q-1',
      userId: 'user-1',
      payload: { timeoutMs: 8000, layerAttempted: 3, retriable: true },
    });

    const saved = eventRepo.save.mock.calls[0]![0] as OpsEventLogEntity;
    const p = saved.payload as unknown as LlmTimeoutPayload;
    expect(p.elapsedMs).toBeUndefined();
  });

  it('Fail-safe — eventRepo.save 실패해도 예외 전파 금지', async () => {
    eventRepo.save.mockRejectedValueOnce(new Error('DB unreachable'));
    const service = new GradingMeasurementService(eventRepo as never);
    await expect(
      service.recordLlmTimeout({
        questionId: 'q-1',
        userId: 'user-1',
        payload: { timeoutMs: 8000, layerAttempted: 3, retriable: true },
      }),
    ).resolves.toBeUndefined();
  });
});
