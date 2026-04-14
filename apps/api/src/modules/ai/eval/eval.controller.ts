import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EvalAdminGuard } from './eval-admin.guard';
import {
  EvalRunnerService,
  type RunRoundInput,
  type RunRoundResult,
} from './eval-runner.service';

/**
 * EvalController — POST /api/eval/run (단계 7).
 *
 * 가드 체인:
 *  1. JwtAuthGuard — 인증 (req.user 채움)
 *  2. EvalAdminGuard — 화이트리스트 인가
 *
 * 본 컨트롤러는 동기적으로 promptfoo CLI를 spawn하므로 단계 9 라운드 실행
 * 시 응답 시간이 수십 분에 달할 수 있다. 운영 단계에서 BullMQ 비동기로 옮길지는
 * 단계 8 첫 실행 후 결정. 현 단계는 단발성 운영자 트리거이므로 동기로 충분.
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §5.2 + §7.4)
 */

class RunEvalEnvironmentDto {
  @IsString()
  @MinLength(1)
  cudaVersion!: string;

  @IsString()
  @MinLength(1)
  nvidiaDriverVersion!: string;

  @IsString()
  @MinLength(1)
  ollamaVersion!: string;

  @IsString()
  @MinLength(1)
  ollamaImageDigest!: string;

  @IsString()
  @MinLength(1)
  promptVersion!: string;

  @IsInt()
  seed!: number;

  @IsNumber()
  @Min(0)
  @Max(2)
  temperature!: number;
}

class RunEvalProviderDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsIn(['anthropic', 'ollama'])
  provider!: 'anthropic' | 'ollama';

  @IsString()
  @MinLength(1)
  model!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  ggufSha256?: string;
}

export class RunEvalDto {
  @IsString()
  @MinLength(1)
  roundLabel!: string;

  @IsString()
  @MinLength(1)
  providerFilter!: string;

  @ValidateNested()
  @Type(() => RunEvalEnvironmentDto)
  environment!: RunEvalEnvironmentDto;

  @ValidateNested()
  @Type(() => RunEvalProviderDto)
  provider!: RunEvalProviderDto;
}

@Controller('eval')
@UseGuards(JwtAuthGuard, EvalAdminGuard)
export class EvalController {
  constructor(private readonly runner: EvalRunnerService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runRound(@Body() dto: RunEvalDto): Promise<RunRoundResult> {
    const input: RunRoundInput = {
      roundLabel: dto.roundLabel,
      providerFilter: dto.providerFilter,
      environment: dto.environment,
      provider: dto.provider,
    };
    return this.runner.runRound(input);
  }
}
