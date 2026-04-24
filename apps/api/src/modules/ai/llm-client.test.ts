import { describe, expect, it, vi } from 'vitest';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

import { LlmClient } from './llm-client';

/**
 * LlmClient 단위 테스트.
 *
 * 외부 LLM/Langfuse 서버는 호출하지 않는다. 검증 대상은:
 *  - provider/api key/model 조립이 의도대로 이루어지는가
 *  - Langfuse key 부재 시 callback이 빈 배열이고 isLangfuseEnabled()=false
 *  - Langfuse key가 있으면 callback이 1개 부착되고 isLangfuseEnabled()=true
 *  - 미지원 provider는 명확한 오류를 던지는가 (ADR-009 §강제 사항 1번)
 */

class FakeConfig {
  constructor(private readonly map: Record<string, string | undefined>) {}

  get<T = string>(key: string): T {
    return this.map[key] as unknown as T;
  }
}

function makeClient(env: Record<string, string | undefined>): LlmClient {
  const config = new FakeConfig(env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new LlmClient(config as any);
}

describe('LlmClient', () => {
  describe('provider 분기', () => {
    it("LLM_PROVIDER='anthropic'이면 ChatAnthropic 인스턴스를 사용한다", () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });

      expect(client.getModel()).toBeInstanceOf(ChatAnthropic);
    });

    it('미지원 provider는 명확한 에러를 throw 한다', () => {
      expect(() =>
        makeClient({
          LLM_PROVIDER: 'cohere',
          LLM_API_KEY: 'sk-test',
          LLM_MODEL: 'whatever',
        }),
      ).toThrow(/cohere/);
    });

    it('LLM_PROVIDER 미설정 시 anthropic으로 기본값 처리한다', () => {
      const client = makeClient({
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });

      expect(client.getModel()).toBeInstanceOf(ChatAnthropic);
    });

    it("LLM_PROVIDER='ollama'면 ChatOllama 인스턴스를 사용한다 (SDD v2 §7.2)", () => {
      const client = makeClient({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'exaone3.5:32b',
        OLLAMA_BASE_URL: 'http://ollama:11434',
        // Ollama는 API key 불필요
      });

      expect(client.getModel()).toBeInstanceOf(ChatOllama);
    });

    it("ollama provider는 OLLAMA_BASE_URL을 ChatOllama의 baseUrl로 전달한다", () => {
      const client = makeClient({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'exaone3.5:32b',
        OLLAMA_BASE_URL: 'http://test-host:11434',
      });

      const model = client.getModel() as ChatOllama;
      expect(model.baseUrl).toBe('http://test-host:11434');
    });

    it('OLLAMA_BASE_URL 미설정 시 ollama provider도 동작한다 (ChatOllama 기본값)', () => {
      const client = makeClient({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'exaone3.5:32b',
      });

      expect(client.getModel()).toBeInstanceOf(ChatOllama);
    });
  });

  describe('opts override (SDD v2 §7.1 — factory 지원)', () => {
    it('두 번째 인자로 provider override 시 환경변수보다 우선한다', () => {
      const config = new FakeConfig({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });

      const client = new LlmClient(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config as any,
        { provider: 'ollama', model: 'qwen2.5-coder:32b' },
      );

      expect(client.getModel()).toBeInstanceOf(ChatOllama);
    });

    it('opts.baseUrl이 OLLAMA_BASE_URL 환경변수보다 우선한다', () => {
      const config = new FakeConfig({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'exaone3.5:32b',
        OLLAMA_BASE_URL: 'http://env-default:11434',
      });

      const client = new LlmClient(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config as any,
        {
          provider: 'ollama',
          model: 'exaone4:32b',
          baseUrl: 'http://opts-override:11434',
        },
      );

      const model = client.getModel() as ChatOllama;
      expect(model.baseUrl).toBe('http://opts-override:11434');
    });

    it('opts override 시에도 Langfuse callback 분기는 환경변수 기반으로 동작한다', () => {
      const config = new FakeConfig({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
        LANGFUSE_PUBLIC_KEY: 'pk-test',
        LANGFUSE_SECRET_KEY: 'sk-langfuse-test',
      });

      const client = new LlmClient(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config as any,
        { provider: 'ollama', model: 'exaone3.5:32b' },
      );

      expect(client.isLangfuseEnabled()).toBe(true);
      expect((client.getCallbacks() as unknown[]).length).toBe(1);
    });
  });

  describe('Langfuse callback', () => {
    it('LANGFUSE_PUBLIC_KEY/SECRET_KEY가 모두 비어있으면 callbacks가 빈 배열이다 (NoOp)', () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
        // LANGFUSE_* 의도적 누락
      });

      expect(client.isLangfuseEnabled()).toBe(false);
      expect(Array.isArray(client.getCallbacks())).toBe(true);
      expect((client.getCallbacks() as unknown[]).length).toBe(0);
    });

    it('두 키 중 하나만 있으면 NoOp으로 동작한다 (부분 설정 거부)', () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
        LANGFUSE_PUBLIC_KEY: 'pk-test',
        // SECRET 누락
      });

      expect(client.isLangfuseEnabled()).toBe(false);
      expect((client.getCallbacks() as unknown[]).length).toBe(0);
    });

    it('두 키가 모두 있으면 CallbackHandler 1개를 callbacks에 부착한다', () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
        LANGFUSE_PUBLIC_KEY: 'pk-test',
        LANGFUSE_SECRET_KEY: 'sk-langfuse-test',
        LANGFUSE_HOST: 'https://cloud.langfuse.com',
      });

      expect(client.isLangfuseEnabled()).toBe(true);
      const cbs = client.getCallbacks() as unknown[];
      expect(cbs).toHaveLength(1);
      // CallbackHandler는 BaseCallbackHandler를 상속하므로 객체 + name 속성을 가짐
      expect(typeof cbs[0]).toBe('object');
    });
  });

  /**
   * consensus-007 C2-1 — invoke opts.metadata 전파.
   *
   * 기존 호출자 회귀 0 (opts 미전달 시 callbacks 만 넘어감) +
   * metadata 전달 시 LangChain RunnableConfig.metadata 로 투영.
   */
  describe('invoke opts.metadata (consensus-007 C2-1)', () => {
    function spyModel(client: LlmClient) {
      const model = client.getModel();
      return vi.spyOn(model, 'invoke').mockResolvedValue(
        new AIMessage('ok') as never,
      );
    }

    it('opts 미전달 시 model.invoke 는 callbacks 만 포함한 config 로 호출 (회귀 0)', async () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });
      const spy = spyModel(client);

      await client.invoke([new HumanMessage('hi')]);

      expect(spy).toHaveBeenCalledTimes(1);
      const [, config] = spy.mock.calls[0]!;
      expect(config).toBeDefined();
      expect((config as { callbacks: unknown }).callbacks).toBeDefined();
      expect((config as { metadata?: unknown }).metadata).toBeUndefined();
    });

    it('opts.metadata.session_id 를 LangChain RunnableConfig.metadata 로 전달', async () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });
      const spy = spyModel(client);

      await client.invoke([new HumanMessage('hi')], {
        metadata: { session_id: 'sess-abc-123' },
      });

      const [, config] = spy.mock.calls[0]!;
      expect((config as { metadata: Record<string, unknown> }).metadata).toEqual({
        session_id: 'sess-abc-123',
      });
    });

    it('opts 가 빈 object 면 metadata 를 포함하지 않는다', async () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });
      const spy = spyModel(client);

      await client.invoke([new HumanMessage('hi')], {});

      const [, config] = spy.mock.calls[0]!;
      expect((config as { metadata?: unknown }).metadata).toBeUndefined();
    });

    it('opts.metadata 허용 4종 키 전달 (prompt_name/prompt_version/model_digest 포함)', async () => {
      const client = makeClient({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });
      const spy = spyModel(client);

      await client.invoke([new HumanMessage('hi')], {
        metadata: {
          session_id: 's',
          prompt_name: 'evaluation/free-form-sql',
          prompt_version: 1,
          model_digest: 'abcd1234',
        },
      });

      const [, config] = spy.mock.calls[0]!;
      const meta = (config as { metadata: Record<string, unknown> }).metadata;
      expect(meta).toEqual({
        session_id: 's',
        prompt_name: 'evaluation/free-form-sql',
        prompt_version: 1,
        model_digest: 'abcd1234',
      });
    });
  });
});
