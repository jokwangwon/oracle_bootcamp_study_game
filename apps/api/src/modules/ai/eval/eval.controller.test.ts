import { describe, expect, it, vi } from 'vitest';

import { EvalController } from './eval.controller';
import type { EvalRunnerService, RunRoundResult } from './eval-runner.service';
import { RunEvalDto } from './eval.controller';

/**
 * EvalController 단위 테스트.
 *
 * 본 테스트는 라우팅/가드 통합이 아닌 컨트롤러 메서드의 입출력만 검증한다.
 * (가드는 eval-admin.guard.test.ts에서 별도 검증)
 *
 * 검증:
 *  - DTO를 EvalRunnerService.runRound 입력 형태로 매핑
 *  - service의 RunRoundResult를 그대로 응답으로 반환
 *  - service가 throw하면 그대로 전파 (Nest 예외 필터가 처리)
 */

const FAKE_RESULT: RunRoundResult = {
  roundId: 'R-2026-04-10T01-23-45Z',
  reportPath: '/eval-results/R-2026-04-10T01-23-45Z/report.md',
  resultJsonPath: '/eval-results/R-2026-04-10T01-23-45Z/result.json',
  summary: {
    totalCalls: 60,
    passRatePerMetric: {
      MT1: { passes: 60, total: 60, rate: 1 },
      MT2: { passes: 58, total: 60, rate: 58 / 60 },
    },
    errorCount: 0,
  },
};

function makeController(runRound: EvalRunnerService['runRound']) {
  const service = { runRound } as unknown as EvalRunnerService;
  return new EvalController(service);
}

const VALID_DTO: RunEvalDto = {
  roundLabel: 'R1 — Tier 1 Gold A',
  providerFilter: 'M2 — EXAONE 3.5 32B',
  environment: {
    cudaVersion: '13.0',
    nvidiaDriverVersion: '580.126.09',
    ollamaVersion: '0.20.4',
    ollamaImageDigest: 'sha256:abc',
    promptVersion: 'local-fallback-v1',
    seed: 42,
    temperature: 0.2,
  },
  provider: {
    id: 'M2 — EXAONE 3.5 32B',
    provider: 'ollama',
    model: 'exaone3.5:32b',
    baseUrl: 'http://ollama:11434',
  },
};

describe('EvalController', () => {
  it('POST /api/eval/run: DTO를 service.runRound에 그대로 매핑', async () => {
    const runRound = vi.fn(async () => FAKE_RESULT);
    const controller = makeController(runRound);

    const res = await controller.runRound(VALID_DTO);

    expect(runRound).toHaveBeenCalledTimes(1);
    expect(runRound).toHaveBeenCalledWith({
      roundLabel: VALID_DTO.roundLabel,
      providerFilter: VALID_DTO.providerFilter,
      environment: VALID_DTO.environment,
      provider: VALID_DTO.provider,
    });
    expect(res).toBe(FAKE_RESULT);
  });

  it('service throw → controller도 그대로 throw', async () => {
    const runRound = vi.fn(async () => {
      throw new Error('boom');
    });
    const controller = makeController(runRound);

    await expect(controller.runRound(VALID_DTO)).rejects.toThrow('boom');
  });

  it('응답에 roundId/reportPath/resultJsonPath/summary가 포함된다', async () => {
    const runRound = vi.fn(async () => FAKE_RESULT);
    const controller = makeController(runRound);

    const res = await controller.runRound(VALID_DTO);

    expect(res.roundId).toMatch(/^R-/);
    expect(res.reportPath).toContain('report.md');
    expect(res.resultJsonPath).toContain('result.json');
    expect(res.summary.totalCalls).toBe(60);
  });
});
