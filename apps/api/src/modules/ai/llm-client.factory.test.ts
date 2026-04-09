import { describe, expect, it } from 'vitest';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';

import { LlmClient } from './llm-client';
import { LlmClientFactory } from './llm-client.factory';

/**
 * LlmClientFactory 단위 테스트 (SDD v2 §7.1 + C-04).
 *
 * 책임:
 *  - createDefault() — 환경변수 기반 단일 인스턴스 (운영 호환)
 *  - createFor({provider, model, baseUrl}) — 호출 시점 평가 인스턴스
 *
 * 평가 시 judge=Claude + eval target=Ollama 동시 운영을 가능하게 하는 계층.
 */

class FakeConfig {
  constructor(private readonly map: Record<string, string | undefined>) {}

  get<T = string>(key: string): T {
    return this.map[key] as unknown as T;
  }
}

function makeFactory(env: Record<string, string | undefined>): LlmClientFactory {
  const config = new FakeConfig(env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new LlmClientFactory(config as any);
}

describe('LlmClientFactory', () => {
  describe('createDefault()', () => {
    it('환경변수 LLM_PROVIDER=anthropic 기반 LlmClient를 반환한다 (운영 호환)', () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });

      const client = factory.createDefault();
      expect(client).toBeInstanceOf(LlmClient);
      expect(client.getModel()).toBeInstanceOf(ChatAnthropic);
    });

    it('환경변수 LLM_PROVIDER=ollama 기반 LlmClient를 반환한다', () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'exaone3.5:32b',
        OLLAMA_BASE_URL: 'http://ollama:11434',
      });

      const client = factory.createDefault();
      expect(client).toBeInstanceOf(LlmClient);
      expect(client.getModel()).toBeInstanceOf(ChatOllama);
    });
  });

  describe('createFor()', () => {
    it("provider='ollama'를 호출 시점에 지정하면 ChatOllama 인스턴스가 만들어진다", () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
        OLLAMA_BASE_URL: 'http://ollama:11434',
      });

      const client = factory.createFor({
        provider: 'ollama',
        model: 'exaone3.5:32b',
      });
      expect(client.getModel()).toBeInstanceOf(ChatOllama);
    });

    it('opts.baseUrl이 OLLAMA_BASE_URL 환경변수보다 우선한다', () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'anthropic',
        OLLAMA_BASE_URL: 'http://env-default:11434',
      });

      const client = factory.createFor({
        provider: 'ollama',
        model: 'exaone4:32b',
        baseUrl: 'http://opts-override:11434',
      });

      const model = client.getModel() as ChatOllama;
      expect(model.baseUrl).toBe('http://opts-override:11434');
    });

    it("provider='anthropic'을 호출 시점에 지정 + apiKey override 가능하다", () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'exaone3.5:32b',
      });

      const client = factory.createFor({
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        apiKey: 'sk-override',
      });
      expect(client.getModel()).toBeInstanceOf(ChatAnthropic);
    });

    it('createDefault()와 createFor()는 서로 독립된 LlmClient 인스턴스를 반환한다', () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
      });

      const a = factory.createDefault();
      const b = factory.createFor({ provider: 'ollama', model: 'exaone3.5:32b' });
      expect(a).not.toBe(b);
      expect(a.getModel()).toBeInstanceOf(ChatAnthropic);
      expect(b.getModel()).toBeInstanceOf(ChatOllama);
    });

    it('Langfuse callback 분기는 환경변수 기반으로 모든 인스턴스에 동일하게 적용된다', () => {
      const factory = makeFactory({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'sk-test',
        LLM_MODEL: 'claude-opus-4-6',
        LANGFUSE_PUBLIC_KEY: 'pk-test',
        LANGFUSE_SECRET_KEY: 'sk-langfuse-test',
      });

      const client1 = factory.createDefault();
      const client2 = factory.createFor({
        provider: 'ollama',
        model: 'exaone3.5:32b',
      });

      expect(client1.isLangfuseEnabled()).toBe(true);
      expect(client2.isLangfuseEnabled()).toBe(true);
    });
  });
});
