import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PiiMaskerEventRecorder } from '../ops/pii-masker-event.recorder';
import { LlmClient, type LlmClientOptions } from './llm-client';

/**
 * LLM 클라이언트 팩토리 (SDD v2 §7.1 + C-04).
 *
 * v1의 단일 provider 하드와이어를 해소하고, 평가 라운드에서
 * **judge=Claude + eval target=Ollama** 동시 운영을 가능하게 한다.
 *
 * - `createDefault()` — 환경변수 기반 단일 인스턴스. NestJS 운영 호환.
 *   기존 코드에서 `LlmClient`를 직접 inject하던 자리는 그대로 둘 수 있고,
 *   factory가 필요한 곳에서만 본 클래스를 inject한다.
 *
 * - `createFor(opts)` — 호출 시점에 provider/model/baseUrl 지정.
 *   평가용. Langfuse callback 분기는 항상 환경변수 기반이라 보고서/trace 일관성
 *   유지된다 (LANGFUSE_PUBLIC_KEY/SECRET_KEY가 있으면 모든 인스턴스에 부착).
 *
 * 본 팩토리는 의도적으로 인스턴스 캐시를 두지 않는다. 평가 도중 동일한
 * provider/model 조합을 여러 번 createFor 호출하면 그만큼 새 인스턴스가
 * 만들어진다. 캐싱은 ChatOllama 자체의 keep-alive(`OLLAMA_KEEP_ALIVE=-1`,
 * docker-compose.yml)에서 처리되므로 여기서 중복 캐싱은 불필요.
 */
@Injectable()
export class LlmClientFactory {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly piiRecorder?: PiiMaskerEventRecorder,
  ) {}

  /** 운영용 — 환경변수 기반 단일 인스턴스 (기존 NestJS DI 동작 호환) */
  createDefault(): LlmClient {
    return new LlmClient(this.config, undefined, this.piiRecorder);
  }

  /** 평가용 — provider/model을 호출 시점에 지정 */
  createFor(opts: LlmClientOptions): LlmClient {
    return new LlmClient(this.config, opts, this.piiRecorder);
  }
}
