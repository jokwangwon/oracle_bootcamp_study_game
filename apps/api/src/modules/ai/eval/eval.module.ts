import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../../auth/auth.module';
import { EvalAdminGuard } from './eval-admin.guard';
import { EvalController } from './eval.controller';
import {
  EvalRunnerService,
  type EvalFileSystem,
  type PromptfooExecutor,
} from './eval-runner.service';

/**
 * EvalModule — OSS 모델 평가 트리거 모듈 (단계 7).
 *
 * 본 모듈은 운영 AI 파이프라인(AiModule)과 분리된다:
 *  - 운영 파이프라인: 학생용 문제 자동 생성 (BullMQ 비동기)
 *  - 평가 파이프라인: 라운드 단위 promptfoo 실행 + 감사 로그 (운영자 트리거)
 *
 * 이 분리는 SDD §5.1 (eval은 별도 디렉토리/책임)과 정합한다.
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §5.1)
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [EvalController],
  providers: [
    {
      provide: 'EVAL_ADMIN_USERNAMES',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('EVAL_ADMIN_USERNAMES'),
    },
    EvalAdminGuard,
    {
      provide: 'EVAL_PROMPTFOO_EXECUTOR',
      useFactory: (): PromptfooExecutor => createDefaultPromptfooExecutor(),
    },
    {
      provide: 'EVAL_FILE_SYSTEM',
      useFactory: (): EvalFileSystem => createDefaultFileSystem(),
    },
    {
      provide: EvalRunnerService,
      inject: [
        'EVAL_PROMPTFOO_EXECUTOR',
        'EVAL_FILE_SYSTEM',
        ConfigService,
      ],
      useFactory: (
        executor: PromptfooExecutor,
        fileSystem: EvalFileSystem,
        config: ConfigService,
      ) => {
        const repoRoot = process.cwd();
        const resultsDir =
          config.get<string>('EVAL_RESULTS_DIR') ??
          path.resolve(repoRoot, 'apps/api/eval-results');
        const configPath =
          config.get<string>('EVAL_PROMPTFOO_CONFIG') ??
          path.resolve(
            repoRoot,
            'apps/api/src/modules/ai/eval/promptfoo.config.yaml',
          );
        return new EvalRunnerService(executor, fileSystem, {
          resultsDir,
          configPath,
          now: () => new Date(),
        });
      },
    },
  ],
})
export class EvalModule {}

// ============================================================================
// 기본 PromptfooExecutor (실 구현 — 단계 8 첫 실행 시 promptfoo JSON shape 검증)
// ============================================================================

/**
 * 실제 promptfoo CLI를 spawn하여 실행하고 outputPath의 JSON을 읽어 반환한다.
 *
 * 주의:
 *  - promptfoo는 단계 8 직전 npm install로 설치된다 (현 시점 미설치).
 *    따라서 본 executor는 단계 8 전까지 실행되지 않으며 단계 8에서 첫 검증.
 *  - ENOENT는 EvalRunnerService가 503으로 변환한다.
 *  - --filter-providers, --output, --config 옵션은 promptfoo 0.x 표준.
 *    단계 8 첫 실행 시 옵션명/형식 변경이 있으면 이 함수만 patch.
 */
function createDefaultPromptfooExecutor(): PromptfooExecutor {
  return async ({ configPath, providerFilter, outputPath }) => {
    return new Promise((resolve, reject) => {
      const args = [
        'eval',
        '--config',
        configPath,
        '--filter-providers',
        providerFilter,
        '--output',
        outputPath,
      ];

      const child = spawn('promptfoo', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      child.on('error', (err) => reject(err));

      child.on('close', async (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `promptfoo CLI 종료 코드 ${code}\nstderr:\n${stderr}\nstdout:\n${stdout}`,
            ),
          );
          return;
        }
        try {
          const raw = await fs.readFile(outputPath, 'utf-8');
          resolve({ stdout, rawJson: JSON.parse(raw) });
        } catch (readErr) {
          reject(readErr);
        }
      });
    });
  };
}

function createDefaultFileSystem(): EvalFileSystem {
  return {
    async mkdir(dirPath: string): Promise<void> {
      await fs.mkdir(dirPath, { recursive: true });
    },
    async writeFile(filePath: string, content: string): Promise<void> {
      await fs.writeFile(filePath, content, 'utf-8');
    },
    async exists(targetPath: string): Promise<boolean> {
      try {
        await fs.access(targetPath);
        return true;
      } catch {
        return false;
      }
    },
  };
}
