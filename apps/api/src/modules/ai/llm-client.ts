import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import { CallbackHandler } from 'langfuse-langchain';

import { PiiMaskerEventRecorder } from '../ops/pii-masker-event.recorder';
import { MaskingLangfuseCallbackHandler } from './masking-callback-handler';

/**
 * LLM 클라이언트 (ADR-009 + SDD v2 §7).
 *
 * 모든 LLM 호출은 이 클라이언트를 통해서만 이루어진다. Anthropic SDK 등
 * 공급자 SDK를 직접 호출하는 코드는 ADR-009 §강제 사항 1번에 의해 거부된다.
 *
 * 책임:
 *  - LangChain Chat Model 인스턴스 보관 (provider별 어댑터)
 *  - Langfuse Callback Handler 관리 (key가 있으면 부착, 없으면 NoOp)
 *  - invoke()를 단일 진입점으로 제공
 *
 * 두 가지 구성 방식:
 *  1. **운영 (NestJS @Injectable 단일 인스턴스)** — 환경변수 기반.
 *     `new LlmClient(config)` — 두 번째 인자 생략 시 LLM_PROVIDER/LLM_API_KEY/
 *     LLM_MODEL/OLLAMA_BASE_URL을 그대로 사용.
 *  2. **평가 (LlmClientFactory.createFor)** — 호출 시점 provider/model 지정.
 *     `new LlmClient(config, { provider: 'ollama', model: 'exaone3.5:32b', baseUrl })`.
 *     opts 필드는 환경변수보다 우선한다. Langfuse callback은 항상 환경변수 기반
 *     (key가 있으면 부착, 없으면 NoOp).
 *
 * 환경변수:
 *  - LLM_PROVIDER: 'anthropic' | 'ollama'
 *  - LLM_API_KEY (anthropic 한정)
 *  - LLM_MODEL
 *  - OLLAMA_BASE_URL (ollama 한정)
 *  - LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST (옵셔널)
 */

export type LlmProvider = 'anthropic' | 'ollama';

export interface LlmClientOptions {
  provider: LlmProvider;
  model: string;
  /** anthropic 전용 */
  apiKey?: string;
  /** ollama 전용 */
  baseUrl?: string;
  /** 기본 0.7(anthropic) / 0.2(ollama, SDD v2 §10.2). 명시 시 override */
  temperature?: number;
  /**
   * consensus-005 §커밋1-4 — 결정성 확보 (Layer 3 LLM-judge 전용).
   * Ollama seed 는 chat_models.d.ts:382 에 실재. Anthropic 은 미지원(무시됨).
   */
  seed?: number;
  /** Ollama top_k — consensus-005 Agent C Ollama issue #586/#1749/#5321 근거. */
  topK?: number;
}

interface ResolvedOptions {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string | undefined;
  temperature: number;
  seed: number | undefined;
  topK: number | undefined;
}

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly model: BaseChatModel;
  private readonly callbacks: Callbacks;
  private readonly langfuseEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @Optional() opts?: LlmClientOptions,
    @Optional() private readonly piiRecorder?: PiiMaskerEventRecorder,
  ) {
    const resolved = this.resolveOptions(opts);
    this.model = this.createModel(resolved);

    const langfuseHandler = this.createLangfuseHandler();
    this.callbacks = langfuseHandler ? [langfuseHandler] : [];
    this.langfuseEnabled = langfuseHandler !== null;

    this.logger.log(
      `LlmClient ready: provider=${resolved.provider}, model=${resolved.model}, langfuse=${this.langfuseEnabled ? 'enabled' : 'disabled'}`,
    );
  }

  /**
   * 단일 진입점. 모든 LLM 호출은 이 메서드를 통해 이루어지며 자동으로
   * Langfuse callback이 부착된다 (활성화된 경우).
   */
  async invoke(messages: BaseMessage[]): Promise<BaseMessage> {
    return this.model.invoke(messages, { callbacks: this.callbacks });
  }

  /**
   * 테스트 / 진단용. 외부에서 직접 호출하지 말고 invoke()를 사용한다.
   */
  getModel(): BaseChatModel {
    return this.model;
  }

  getCallbacks(): Callbacks {
    return this.callbacks;
  }

  isLangfuseEnabled(): boolean {
    return this.langfuseEnabled;
  }

  /**
   * opts가 있으면 opts를 우선하고, 미설정 필드(특히 baseUrl/apiKey)만 환경변수에서
   * 보충한다. opts가 없으면 환경변수만으로 구성한다 (기존 단일 인스턴스 동작).
   */
  private resolveOptions(opts?: LlmClientOptions): ResolvedOptions {
    if (opts) {
      const isOllama = opts.provider === 'ollama';
      return {
        provider: opts.provider,
        model: opts.model,
        apiKey: opts.apiKey ?? this.config.get<string>('LLM_API_KEY') ?? '',
        baseUrl: isOllama
          ? (opts.baseUrl ?? this.config.get<string>('OLLAMA_BASE_URL'))
          : undefined,
        temperature: opts.temperature ?? (isOllama ? 0.2 : 0.7),
        seed: opts.seed,
        topK: opts.topK,
      };
    }

    const provider = (this.config.get<string>('LLM_PROVIDER') ??
      'anthropic') as LlmProvider;
    const isOllama = provider === 'ollama';
    return {
      provider,
      model: this.config.get<string>('LLM_MODEL') ?? 'claude-opus-4-6',
      apiKey: this.config.get<string>('LLM_API_KEY') ?? '',
      baseUrl: isOllama ? this.config.get<string>('OLLAMA_BASE_URL') : undefined,
      temperature: isOllama ? 0.2 : 0.7,
      seed: undefined,
      topK: undefined,
    };
  }

  private createModel(opts: ResolvedOptions): BaseChatModel {
    if (opts.provider === 'anthropic') {
      if (!opts.apiKey) {
        throw new Error(
          "LLM_PROVIDER='anthropic' 설정에서 LLM_API_KEY가 비어있습니다. " +
            'ADR-011 P1 운영 교체 후에는 LLM_PROVIDER=ollama로 전환 권장.',
        );
      }
      return new ChatAnthropic({
        model: opts.model,
        apiKey: opts.apiKey,
        temperature: opts.temperature,
        maxTokens: 4096,
        // Anthropic SDK 는 seed 를 노출하지 않음 (consensus-005 Agent A 실측).
        // Layer 3 재현성 기대치는 "verdict 필드만 동일" 수준.
        ...(opts.topK !== undefined ? { topK: opts.topK } : {}),
      });
    }
    if (opts.provider === 'ollama') {
      // SDD v2 §7.2 + §10.2: temperature 0.2 결정론, num_ctx는 Modelfile 기본값(8192)
      // §14 미해결 #8 해소 — ChatOllama는 seed 옵션을 노출 (chat_models.d.ts:382).
      //   평가 라운드에서 seed=42 지정은 LlmClientFactory.createFor() 또는
      //   호출 시점 invoke options로 주입한다. 본 생성자에서는 기본값(미지정).
      // §14 미해결 #9 해소 — format vs StructuredOutputParser 실증 결과는
      //   eval/scripts/format-vs-parser-experiment.ts + SDD §7.2 v2.3 patch 참조.
      //   기본 인스턴스는 format 미지정 (StructuredOutputParser 사용 가정).
      return new ChatOllama({
        baseUrl: opts.baseUrl,
        model: opts.model,
        temperature: opts.temperature,
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts.topK !== undefined ? { topK: opts.topK } : {}),
      });
    }
    // 미지원 provider는 명확한 오류
    throw new Error(
      `LLM_PROVIDER='${opts.provider}'는 아직 지원되지 않습니다. 현재는 'anthropic' 또는 'ollama'만 가능 (ADR-009 + SDD v2 §7.2).`,
    );
  }

  private createLangfuseHandler(): CallbackHandler | null {
    const publicKey = this.config.get<string>('LANGFUSE_PUBLIC_KEY');
    const secretKey = this.config.get<string>('LANGFUSE_SECRET_KEY');
    const baseUrl =
      this.config.get<string>('LANGFUSE_HOST') ?? 'https://cloud.langfuse.com';

    if (!publicKey || !secretKey) {
      return null;
    }

    // consensus-005 선행 PR: CallbackHandler 를 마스킹 래퍼로 교체.
    // Langfuse cloud 에 전송되는 payload 에서 `<student_answer>` 태그 내부
    // 평문을 해시 메타로 치환. Session 4 LLM-judge 배포 전 필수.
    //
    // consensus-007 S6-C1-4: metadata 화이트리스트 위반 시 production 에서
    // silent drop 된 key 를 `ops_event_log(pii_masker_triggered)` 로 기록.
    // dev 모드는 throw 동작 유지. piiRecorder 미주입 환경(unit test)은 noop.
    const recorder = this.piiRecorder;
    return new MaskingLangfuseCallbackHandler(
      { publicKey, secretKey, baseUrl },
      recorder
        ? {
            violationReporter: (violation) => {
              // fire-and-forget. recorder 내부에서 이미 fail-safe 로깅.
              void recorder.record(violation);
            },
          }
        : undefined,
    );
  }
}
