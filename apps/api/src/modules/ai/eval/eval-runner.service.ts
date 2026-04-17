import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  buildRoundFromRecords,
  parsePromptfooRawJson,
} from './reports/promptfoo-adapter';
import { generateRoundReport } from './reports/report-generator';
import {
  EVAL_RESULT_SCHEMA_VERSION,
  type EvalAggregate,
  type EvalEnvironment,
  type EvalProvider,
  type EvalRoundMeta,
} from './reports/schema.v1';

/**
 * EvalRunnerService — promptfoo CLI 실행 + 결과 정규화 + 보고서 저장 (단계 7).
 *
 * 책임:
 *  1. PromptfooExecutor를 호출해 promptfoo CLI 실행
 *  2. raw JSON 출력을 RawCallRecord[] → EvalRoundResultV1로 정규화
 *  3. generateRoundReport markdown 생성
 *  4. eval-results/{roundId}/{result.json,report.md} 두 파일 저장
 *  5. controller에 요약 반환
 *
 * 격리 의존성:
 *  - PromptfooExecutor: child_process spawn을 인터페이스로 격리 (단위 테스트 mock)
 *  - EvalFileSystem: fs/promises를 인터페이스로 격리 (FakeFs로 in-memory 검증)
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §5.2 + §10.3)
 */

// ============================================================================
// 의존성 인터페이스 (테스트용 격리)
// ============================================================================

export interface PromptfooExecutorInput {
  configPath: string;
  providerFilter: string;
  outputPath: string;
}

export interface PromptfooExecutorResult {
  /** promptfoo CLI stdout (디버깅용 보존, 본 서비스는 사용하지 않음) */
  stdout: string;
  /** promptfoo가 outputPath에 쓴 JSON. 실 구현체는 파일을 읽어 parse한 결과를 넣는다 */
  rawJson: unknown;
}

/**
 * promptfoo CLI 실행 인터페이스. ENOENT(미설치)는 NodeJS.ErrnoException(code='ENOENT')으로
 * throw하는 것을 본 서비스가 503으로 변환한다.
 */
export type PromptfooExecutor = (
  input: PromptfooExecutorInput,
) => Promise<PromptfooExecutorResult>;

export interface EvalFileSystem {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface EvalRunnerOptions {
  /** result.json + report.md를 저장할 베이스 디렉토리 */
  resultsDir: string;
  /** promptfoo.config.yaml 절대 경로 */
  configPath: string;
  /** 시각 주입 (테스트용 결정론) */
  now: () => Date;
}

// ============================================================================
// 입출력 타입 (controller ↔ service)
// ============================================================================

export interface RunRoundInput {
  /** 사람이 읽을 수 있는 라운드 라벨 */
  roundLabel: string;
  /** promptfoo --filter-providers 값 — provider id 정확 일치 */
  providerFilter: string;
  /** 라운드 환경 메타 (M-04 재현성) */
  environment: EvalEnvironment;
  /** 평가 대상 provider 메타 */
  provider: EvalProvider;
}

export interface RunRoundResult {
  roundId: string;
  reportPath: string;
  resultJsonPath: string;
  summary: {
    totalCalls: number;
    passRatePerMetric: EvalAggregate['passRatePerMetric'];
    errorCount: number;
  };
}

// ============================================================================
// 서비스 구현
// ============================================================================

@Injectable()
export class EvalRunnerService {
  constructor(
    private readonly executor: PromptfooExecutor,
    private readonly fs: EvalFileSystem,
    private readonly options: EvalRunnerOptions,
  ) {}

  async runRound(input: RunRoundInput): Promise<RunRoundResult> {
    const startedAt = this.options.now();
    const roundId = formatRoundId(startedAt);
    const dir = `${this.options.resultsDir}/${roundId}`;
    const resultJsonPath = `${dir}/result.json`;
    const reportPath = `${dir}/report.md`;

    // 동일 roundId 중복 실행 방지 (드물지만 동일 ms에 두 요청이 오는 케이스)
    if (await this.fs.exists(dir)) {
      throw new ConflictException(
        `평가 라운드 디렉토리가 이미 존재합니다: ${dir}`,
      );
    }

    // 1) promptfoo CLI 실행 → raw JSON
    let executorResult: PromptfooExecutorResult;
    try {
      executorResult = await this.executor({
        configPath: this.options.configPath,
        providerFilter: input.providerFilter,
        outputPath: resultJsonPath,
      });
    } catch (err) {
      if (isEnoent(err)) {
        throw new ServiceUnavailableException(
          'promptfoo CLI가 설치되지 않았습니다. ' +
            'npm install --save-dev --workspace=@oracle-game/api promptfoo 후 재시도하세요. (단계 8 직전 install 필요)',
        );
      }
      throw err;
    }

    // 2) raw JSON → RawCallRecord[]
    const records = parsePromptfooRawJson(executorResult.rawJson);
    if (records.length === 0) {
      throw new BadRequestException(
        'promptfoo 결과가 비어있음 (results=[]). ' +
          'config의 providers/tests/filter-providers 설정을 확인하세요.',
      );
    }

    // 3) RawCallRecord[] + meta + provider → EvalRoundResultV1 (schema 검증 자동)
    const finishedAt = this.options.now();
    const meta: EvalRoundMeta = {
      schemaVersion: EVAL_RESULT_SCHEMA_VERSION,
      roundId,
      roundLabel: input.roundLabel,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      environment: input.environment,
    };

    const round = buildRoundFromRecords(meta, input.provider, records);

    // 4) markdown 보고서
    const report = generateRoundReport(round);

    // 5) 두 파일 저장
    await this.fs.mkdir(dir);
    await this.fs.writeFile(resultJsonPath, JSON.stringify(round, null, 2));
    await this.fs.writeFile(reportPath, report);

    // 6) 요약 반환 — aggregate은 buildRoundFromRecords가 항상 계산
    const aggregate = round.aggregate;
    if (aggregate === null) {
      // buildRoundFromRecords는 항상 aggregate을 계산하므로 도달 불가지만
      // 타입 가드 차원에서 명시.
      throw new Error('내부 오류: aggregate이 비어있음');
    }

    return {
      roundId,
      reportPath,
      resultJsonPath,
      summary: {
        totalCalls: aggregate.totalCalls,
        passRatePerMetric: aggregate.passRatePerMetric,
        errorCount: aggregate.errorCount,
      },
    };
  }
}

// ============================================================================
// 헬퍼
// ============================================================================

/**
 * Date → 'R-2026-04-10T01-23-45Z' 형식 roundId.
 *
 * ISO 8601의 ':'와 '.'는 일부 파일 시스템에서 문제를 일으키므로 '-'로 치환.
 * 밀리초는 잘라낸다 (분~초까지면 라운드 식별로 충분).
 */
function formatRoundId(date: Date): string {
  const iso = date.toISOString(); // '2026-04-10T01:23:45.000Z'
  const noMs = iso.replace(/\.\d{3}Z$/, 'Z'); // '2026-04-10T01:23:45Z'
  const safe = noMs.replace(/:/g, '-'); // '2026-04-10T01-23-45Z'
  return `R-${safe}`;
}

function isEnoent(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return code === 'ENOENT';
}
