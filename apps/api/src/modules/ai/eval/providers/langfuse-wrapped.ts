import { ConfigService } from '@nestjs/config';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import { LlmClient, type LlmProvider } from '../../llm-client';

/**
 * promptfoo provider — LlmClient를 wrap하여 모든 평가 호출을 LangChain +
 * Langfuse(self-host) trace로 흐르게 한다 (SDD v2 §5.3).
 *
 * 핵심 책임:
 *  1. promptfoo의 provider 계약(`callApi(prompt) → { output | error }`)을 만족
 *  2. 모든 LLM 호출을 LlmClient + Langfuse callback으로 라우팅 (ADR-009 ③ 정합)
 *  3. promptfoo testCase 1건 = LlmClient.invoke 1번 = Langfuse trace 1건
 *
 * 본 클래스는 NestJS DI 컨테이너 밖에서 동작한다 — promptfoo 런타임이 직접
 * import/instantiate하므로 ConfigService를 process.env로부터 단독 구성한다.
 *
 * 테스트 격리를 위해 핵심 invoke 로직은 `runLlmInvoke` pure function으로
 * 분리되어 있어 vitest에서 fake LlmInvokeable로 단위 검증 가능하다.
 */

export interface LangfuseWrappedConfig {
  provider: LlmProvider;
  model: string;
  /** ollama 전용 — 미지정 시 OLLAMA_BASE_URL 환경변수 사용 */
  baseUrl?: string;
  /** 평가 결정론 (SDD v2 §10.2). 기본 0.2(ollama) / 0.7(anthropic) */
  temperature?: number;
  /** anthropic 전용 — 미지정 시 LLM_API_KEY 환경변수 사용 */
  apiKey?: string;
}

export interface PromptfooProviderOptions {
  /** promptfoo YAML에서 지정한 provider id (예: "M2 — EXAONE 3.5 32B") */
  id?: string;
  config: LangfuseWrappedConfig;
}

export interface PromptfooProviderResponse {
  output?: string;
  error?: string;
  metadata?: {
    provider: LlmProvider;
    model: string;
    langfuseEnabled: boolean;
  };
}

/**
 * runLlmInvoke가 의존하는 최소 LlmClient 인터페이스.
 * 본 인터페이스만 만족하면 fake로 대체 가능 — 테스트 격리.
 */
export interface LlmInvokeable {
  invoke(messages: BaseMessage[]): Promise<BaseMessage>;
  isLangfuseEnabled(): boolean;
}

/**
 * promptfoo 호출 1건의 prompt 문자열을 BaseMessage[]로 변환.
 *
 * 두 가지 입력 형식을 자동 감지:
 *  1. JSON-encoded multi-message: `[{"role":"system","content":"..."}, ...]`
 *     → 운영 AQG와 동일한 system/user 분리 구조 (단계 5-4 build-eval-prompt.ts)
 *  2. 일반 문자열 → 단일 HumanMessage로 wrap (자유 prompt)
 *
 * 운영 일관성: 평가에서 system/user를 분리해야 운영 동작을 동일하게 예측.
 * production AQG가 SystemMessage + HumanMessage 두 개를 보내므로 평가도 동일.
 */
export function parsePromptToMessages(prompt: string): BaseMessage[] {
  const trimmed = prompt.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const messages: BaseMessage[] = [];
        for (const item of parsed) {
          if (
            typeof item !== 'object' ||
            item === null ||
            typeof (item as { role?: unknown }).role !== 'string' ||
            typeof (item as { content?: unknown }).content !== 'string'
          ) {
            // 형식 미달 — 전체를 자유 문자열로 fallback
            return [new HumanMessage(prompt)];
          }
          const { role, content } = item as { role: string; content: string };
          if (role === 'system') messages.push(new SystemMessage(content));
          else if (role === 'assistant') messages.push(new AIMessage(content));
          else messages.push(new HumanMessage(content));
        }
        return messages;
      }
    } catch {
      // JSON 아니면 자유 문자열로 처리
    }
  }
  return [new HumanMessage(prompt)];
}

/**
 * pure function — promptfoo 호출 1건을 LlmInvokeable로 흘려보낸다.
 *
 * - 성공: AIMessage.content를 string으로 안전 추출 (객체면 JSON.stringify)
 * - 실패: 예외를 error 필드로 격리 (promptfoo가 단일 testCase fail로 처리하고
 *   배치 전체를 죽이지 않도록)
 * - metadata에 provider/model/langfuseEnabled 노출 (감사용)
 */
export async function runLlmInvoke(
  client: LlmInvokeable,
  prompt: string,
  label: { provider: LlmProvider; model: string },
): Promise<PromptfooProviderResponse> {
  try {
    const messages = parsePromptToMessages(prompt);
    const response = await client.invoke(messages);
    const text =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    return {
      output: text,
      metadata: {
        provider: label.provider,
        model: label.model,
        langfuseEnabled: client.isLangfuseEnabled(),
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * promptfoo가 직접 instantiate하는 provider 클래스.
 *
 * promptfoo YAML 사용 예 (단계 5-4 promptfoo.config.yaml에서 작성):
 *   providers:
 *     - id: 'M2 — EXAONE 3.5 32B'
 *       file: 'file://providers/langfuse-wrapped.ts'
 *       config:
 *         provider: ollama
 *         model: exaone3.5:32b
 *         baseUrl: http://ollama:11434
 *         temperature: 0.2
 */
export default class LangfuseWrappedProvider {
  private readonly providerConfig: LangfuseWrappedConfig;
  private readonly _id: string;
  private readonly configService: ConfigService;
  /**
   * 인스턴스 캐시 — 동일 (provider, model, baseUrl)에 대해 1회만 생성.
   * ChatOllama keep-alive(`OLLAMA_KEEP_ALIVE=-1`)와 LlmClient 내부 callback
   * 인스턴스 재사용을 동시에 노린다.
   */
  private cachedClient: LlmClient | null = null;

  constructor(options: PromptfooProviderOptions, providerId?: string) {
    this.providerConfig = options.config;
    this._id =
      options.id ??
      providerId ??
      `langfuse-wrapped:${this.providerConfig.provider}:${this.providerConfig.model}`;
    // process.env 기반 단독 ConfigService — NestJS module init 없이 동작
    this.configService = new ConfigService(process.env);
  }

  id(): string {
    return this._id;
  }

  async callApi(prompt: string): Promise<PromptfooProviderResponse> {
    return runLlmInvoke(this.getClient(), prompt, {
      provider: this.providerConfig.provider,
      model: this.providerConfig.model,
    });
  }

  private getClient(): LlmClient {
    if (this.cachedClient === null) {
      this.cachedClient = new LlmClient(this.configService, {
        provider: this.providerConfig.provider,
        model: this.providerConfig.model,
        baseUrl: this.providerConfig.baseUrl,
        temperature: this.providerConfig.temperature,
        apiKey: this.providerConfig.apiKey,
      });
    }
    return this.cachedClient;
  }
}
