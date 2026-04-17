import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';

import { defaultTagsFetcher, loadPins, verifyApprovedModel, type TagsFetcher } from './eval/pins/verify';
import type { ModelPin } from './eval/pins/types';

const PINS_PATH = path.resolve(__dirname, 'eval', 'pins', 'approved-models.json');

/**
 * 운영 LLM 모델의 digest를 부팅 시 1회 검증하고 in-memory 캐시한다.
 *
 * ADR-011 채택 조건 #2 — primary OSS의 digest drift 차단을 평가뿐 아니라
 * 운영 부팅 경로에서도 강제. 평가의 `verifyApprovedModel`을 동일하게 재사용.
 *
 * 동작:
 *  - LLM_PROVIDER=anthropic: verify 건너뛰고 'claude-api:<model>' 형식 사용
 *    (Anthropic API에는 모델 digest 개념 없음 — 모델명으로 식별)
 *  - LLM_PROVIDER=ollama: approved-models.json과 Ollama /api/tags 비교.
 *    pin 누락/불일치/Ollama 미기동 모두 fail-closed (throw → Nest boot 실패).
 *  - DIGEST_PIN_SKIP=true: dev/test 우회. digest는 'unverified-skip'.
 */
@Injectable()
export class ModelDigestProvider implements OnModuleInit {
  private readonly logger = new Logger(ModelDigestProvider.name);
  private digest: string | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly tagsFetcher: TagsFetcher = defaultTagsFetcher(),
    @Optional() private readonly pins: readonly ModelPin[] = loadPinsSafe(PINS_PATH),
  ) {}

  async onModuleInit(): Promise<void> {
    const provider = this.config.get<string>('LLM_PROVIDER') ?? 'anthropic';
    const model = this.config.get<string>('LLM_MODEL') ?? '';
    const skip = this.config.get<string>('DIGEST_PIN_SKIP') === 'true';

    if (provider === 'anthropic') {
      this.digest = `claude-api:${model}`;
      this.logger.log(`Digest cache: ${this.digest} (anthropic — pin verify skipped)`);
      return;
    }

    if (skip) {
      this.digest = `${model}@unverified-skip`;
      this.logger.warn(`Digest cache: ${this.digest} (DIGEST_PIN_SKIP=true)`);
      return;
    }

    const result = await verifyApprovedModel(model, this.pins, this.tagsFetcher);
    if (!result.ok) {
      throw new Error(
        `LLM 부팅 차단: ${result.reason} — ${result.message} ` +
          `(ADR-011 #2). pin-model CLI로 등록하거나 DIGEST_PIN_SKIP=true로 우회 가능.`,
      );
    }

    this.digest = `${model}@${result.currentDigest}`;
    this.logger.log(`Digest cache verified: ${this.digest} (round=${result.pin.evalRound ?? 'n/a'})`);
  }

  getDigest(): string {
    if (this.digest === null) {
      throw new Error('ModelDigestProvider not initialized — onModuleInit must run first');
    }
    return this.digest;
  }
}

function loadPinsSafe(filePath: string): ModelPin[] {
  try {
    return loadPins(filePath);
  } catch {
    return [];
  }
}
