import { describe, expect, it, vi } from 'vitest';

import { EvalRunnerService } from './eval-runner.service';
import type {
  PromptfooExecutor,
  EvalFileSystem,
  RunRoundInput,
} from './eval-runner.service';

/**
 * EvalRunnerService 단위 테스트 (단계 7).
 *
 * 본 서비스는 다음 책임을 가진다:
 *  1. promptfoo CLI를 격리된 executor로 spawn (단계 8 이후 실제 호출)
 *  2. raw JSON 출력을 parsePromptfooRawJson + buildRoundFromRecords로 schema.v1
 *     EvalRoundResultV1로 정규화
 *  3. generateRoundReport markdown 생성
 *  4. result.json + report.md 두 파일을 eval-results/{roundId}/ 에 저장
 *  5. controller에 요약(roundId, 경로, summary) 반환
 *
 * Mock 전략:
 *  - PromptfooExecutor: vi.fn으로 stub (실제 child_process spawn 불필요)
 *  - EvalFileSystem: in-memory FakeFs (mkdir/write recording)
 *
 * 검증 목표:
 *  - executor.run이 올바른 인자(configPath, providerFilter, outputPath)로 호출되는지
 *  - executor가 promptfoo 출력 JSON을 반환했을 때 schema.v1으로 정규화되어 저장되는지
 *  - 빈 results 또는 잘못된 shape는 BadRequestException으로 fail-fast
 *  - executor가 ENOENT(미설치)를 던지면 ServiceUnavailableException
 *  - 동일 roundId가 두 번 실행되면 두 번째는 ConflictException
 */

const META_INPUT: RunRoundInput = {
  roundLabel: 'R1 — Tier 1 Gold A (test)',
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

/**
 * 단일 testCase × 1 run × 7 assertion (모두 pass)을 가진
 * promptfoo CLI 출력 형태의 객체를 반환한다.
 */
function makePromptfooJson(): unknown {
  return {
    results: {
      results: [
        {
          vars: {
            entryId: 'gold-a-blank-typing-01',
            goldSet: 'A',
            gameMode: 'blank-typing',
            topic: 'sql-basics',
            week: 1,
            difficulty: 'EASY',
          },
          response: {
            output:
              '{"sql":"SELECT * FROM EMP","blanks":[{"position":0,"answer":"SELECT"}],"answer":["SELECT"],"explanation":"..."}',
            latencyMs: 12_500,
          },
          gradingResult: {
            componentResults: [
              {
                pass: true,
                score: 1,
                reason: 'MT1 ok',
                assertion: { value: 'file://assertions/json-parse.ts' },
              },
              {
                pass: true,
                score: 1,
                reason: 'MT2 ok',
                assertion: { value: 'file://assertions/zod-schema.ts' },
              },
              {
                pass: true,
                score: 1,
                reason: 'MT3 ok',
                assertion: { value: 'file://assertions/scope-whitelist.ts' },
              },
              {
                pass: true,
                score: 1,
                reason: 'MT4 ok',
                assertion: { value: 'file://assertions/blank-consistency.ts' },
              },
              {
                pass: true,
                score: 1,
                reason: 'MT5 ok',
                assertion: { value: 'file://assertions/latency.ts' },
              },
              {
                pass: true,
                score: 1,
                reason: 'MT8 ok',
                assertion: { value: 'file://assertions/sanitization.ts' },
              },
              {
                pass: true,
                score: 1,
                reason: 'MT6-aux ok',
                assertion: { value: 'file://assertions/korean-features.ts' },
              },
            ],
          },
        },
      ],
    },
  };
}

class FakeFs implements EvalFileSystem {
  // path → 내용
  written = new Map<string, string>();
  // 존재한다고 거짓말할 path 모음
  existingDirs = new Set<string>();

  async mkdir(path: string): Promise<void> {
    this.existingDirs.add(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.written.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    if (this.existingDirs.has(path)) return true;
    return Array.from(this.written.keys()).some((p) => p === path);
  }
}

function makeService(opts: {
  executor: PromptfooExecutor;
  fs?: FakeFs;
  resultsDir?: string;
  configPath?: string;
  now?: () => Date;
}) {
  const fs = opts.fs ?? new FakeFs();
  const service = new EvalRunnerService(opts.executor, fs, {
    resultsDir: opts.resultsDir ?? '/eval-results',
    configPath:
      opts.configPath ?? '/repo/apps/api/src/modules/ai/eval/promptfoo.config.yaml',
    now: opts.now ?? (() => new Date('2026-04-10T01:23:45Z')),
  });
  return { service, fs };
}

describe('EvalRunnerService', () => {
  it('executor.run을 configPath/providerFilter/outputPath와 함께 호출한다', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service } = makeService({ executor });

    const result = await service.runRound(META_INPUT);

    expect(executor).toHaveBeenCalledTimes(1);
    const call = executor.mock.calls[0]![0];
    expect(call.configPath).toBe(
      '/repo/apps/api/src/modules/ai/eval/promptfoo.config.yaml',
    );
    expect(call.providerFilter).toBe('M2 — EXAONE 3.5 32B');
    expect(call.outputPath).toContain(result.roundId);
    expect(call.outputPath.endsWith('.json')).toBe(true);
  });

  it('roundId는 R{타임스탬프} 형식으로 자동 생성된다', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service } = makeService({
      executor,
      now: () => new Date('2026-04-10T01:23:45.000Z'),
    });

    const result = await service.runRound(META_INPUT);

    expect(result.roundId).toMatch(/^R-2026-04-10T01-23-45Z$/);
  });

  it('result.json과 report.md 두 파일을 roundId 디렉토리에 쓴다', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service, fs } = makeService({ executor });

    const result = await service.runRound(META_INPUT);

    const dir = `/eval-results/${result.roundId}`;
    expect(fs.existingDirs.has(dir)).toBe(true);

    const jsonPath = `${dir}/result.json`;
    const reportPath = `${dir}/report.md`;
    expect(fs.written.has(jsonPath)).toBe(true);
    expect(fs.written.has(reportPath)).toBe(true);

    expect(result.resultJsonPath).toBe(jsonPath);
    expect(result.reportPath).toBe(reportPath);

    // result.json은 schema.v1을 통과한 EvalRoundResultV1 형태여야 한다
    const parsed = JSON.parse(fs.written.get(jsonPath)!);
    expect(parsed.meta.roundId).toBe(result.roundId);
    expect(parsed.meta.schemaVersion).toBe(1);
    expect(parsed.provider.id).toBe('M2 — EXAONE 3.5 32B');
    expect(parsed.calls).toHaveLength(1);
    expect(parsed.aggregate).not.toBeNull();
  });

  it('summary에 totalCalls/passRatePerMetric/errorCount를 포함해 반환', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service } = makeService({ executor });

    const result = await service.runRound(META_INPUT);

    expect(result.summary.totalCalls).toBe(1);
    expect(result.summary.errorCount).toBe(0);
    expect(result.summary.passRatePerMetric.MT1?.rate).toBe(1);
    expect(result.summary.passRatePerMetric.MT2?.rate).toBe(1);
  });

  it('report.md는 generateRoundReport의 헤더와 합격선 섹션을 포함', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service, fs } = makeService({ executor });

    const result = await service.runRound(META_INPUT);
    const md = fs.written.get(result.reportPath)!;

    expect(md).toContain('# 평가 라운드 보고서');
    expect(md).toContain('합격선');
    expect(md).toContain('M2 — EXAONE 3.5 32B');
  });

  it('promptfoo가 results 비어있는 출력 → BadRequestException', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: { results: { results: [] } },
    }));
    const { service } = makeService({ executor });

    await expect(service.runRound(META_INPUT)).rejects.toThrow(
      /promptfoo.*결과가 비어있음|empty/i,
    );
  });

  it('promptfoo CLI 미설치(ENOENT) → ServiceUnavailableException', async () => {
    const executor = vi.fn(async () => {
      const err = new Error('spawn promptfoo ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });
    const { service } = makeService({ executor });

    await expect(service.runRound(META_INPUT)).rejects.toThrow(
      /promptfoo.*설치|installed/i,
    );
  });

  it('동일 roundId 디렉토리가 이미 존재 → ConflictException', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const fs = new FakeFs();
    fs.existingDirs.add('/eval-results/R-2026-04-10T01-23-45Z');
    const { service } = makeService({ executor, fs });

    await expect(service.runRound(META_INPUT)).rejects.toThrow(
      /이미 존재|already exists|conflict/i,
    );
  });

  it('잘못된 shape (results가 객체가 아님) → BadRequestException', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: { results: 'invalid' },
    }));
    const { service } = makeService({ executor });

    await expect(service.runRound(META_INPUT)).rejects.toThrow();
  });

  it('환경 메타와 provider 메타는 입력에서 그대로 전달되어 result.json에 보존', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service, fs } = makeService({ executor });

    const result = await service.runRound(META_INPUT);
    const parsed = JSON.parse(fs.written.get(result.resultJsonPath)!);

    expect(parsed.meta.environment.cudaVersion).toBe('13.0');
    expect(parsed.meta.environment.seed).toBe(42);
    expect(parsed.provider.model).toBe('exaone3.5:32b');
    expect(parsed.provider.baseUrl).toBe('http://ollama:11434');
  });

  it('roundLabel은 입력값이 그대로 result.json.meta에 들어간다', async () => {
    const executor = vi.fn(async () => ({
      stdout: '',
      rawJson: makePromptfooJson(),
    }));
    const { service, fs } = makeService({ executor });

    const result = await service.runRound(META_INPUT);
    const parsed = JSON.parse(fs.written.get(result.resultJsonPath)!);

    expect(parsed.meta.roundLabel).toBe('R1 — Tier 1 Gold A (test)');
  });
});
