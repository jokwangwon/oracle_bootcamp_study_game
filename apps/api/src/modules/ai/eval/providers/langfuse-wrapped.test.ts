import { describe, expect, it } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import LangfuseWrappedProvider, {
  parsePromptToMessages,
  runLlmInvoke,
  type LlmInvokeable,
} from './langfuse-wrapped';

/**
 * langfuse-wrapped provider 단위 테스트.
 *
 * 목표:
 *  - runLlmInvoke pure function의 동작 (output, error, metadata)
 *  - LangfuseWrappedProvider의 id() 형식
 *  - 클래스가 promptfoo의 ApiProvider 계약(callApi(prompt) → { output | error })을 만족
 *
 * promptfoo 런타임을 import하지 않고도 검증 가능하도록 fake LlmClient를 주입한다.
 */

class FakeLlmClient implements LlmInvokeable {
  callCount = 0;
  lastMessages: BaseMessage[] | null = null;

  constructor(
    private readonly response: string | Error,
    private readonly langfuseEnabled = false,
  ) {}

  async invoke(messages: BaseMessage[]): Promise<BaseMessage> {
    this.callCount += 1;
    this.lastMessages = messages;
    if (this.response instanceof Error) {
      throw this.response;
    }
    return new AIMessage(this.response);
  }

  isLangfuseEnabled(): boolean {
    return this.langfuseEnabled;
  }
}

describe('runLlmInvoke', () => {
  it('성공 시 output에 raw text 반환 + metadata 부착', async () => {
    const fake = new FakeLlmClient('{"sql":"SELECT * FROM EMP"}', true);
    const result = await runLlmInvoke(fake, 'generate question', {
      provider: 'ollama',
      model: 'exaone3.5:32b',
    });
    expect(result.output).toBe('{"sql":"SELECT * FROM EMP"}');
    expect(result.error).toBeUndefined();
    expect(result.metadata).toMatchObject({
      provider: 'ollama',
      model: 'exaone3.5:32b',
      langfuseEnabled: true,
    });
    expect(fake.callCount).toBe(1);
  });

  it('LlmClient.invoke 예외 시 error 필드로 격리', async () => {
    const fake = new FakeLlmClient(new Error('connection refused'));
    const result = await runLlmInvoke(fake, 'generate', { provider: 'ollama', model: 'qwen2.5-coder:32b' });
    expect(result.output).toBeUndefined();
    expect(result.error).toMatch(/connection refused/);
  });

  it('prompt가 HumanMessage 한 개로 변환되어 invoke에 전달', async () => {
    const fake = new FakeLlmClient('{}');
    await runLlmInvoke(fake, '문제를 만들어주세요', { provider: 'anthropic', model: 'claude-opus-4-6' });
    expect(fake.lastMessages).not.toBeNull();
    expect(fake.lastMessages).toHaveLength(1);
    expect(String(fake.lastMessages?.[0].content)).toBe('문제를 만들어주세요');
  });

  it('langfuseEnabled=false면 metadata에 false 그대로 노출', async () => {
    const fake = new FakeLlmClient('ok', false);
    const result = await runLlmInvoke(fake, 'p', { provider: 'ollama', model: 'llama3.3:70b' });
    expect(result.metadata).toMatchObject({ langfuseEnabled: false });
  });

  it('AIMessage.content가 객체여도 JSON 직렬화로 안전 추출', async () => {
    // ChatOllama가 가끔 array content를 돌려주는 케이스 방어
    const fake: LlmInvokeable = {
      isLangfuseEnabled: () => false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: async (_msgs: BaseMessage[]) => ({ content: { type: 'text', text: 'hello' } }) as any,
    };
    const result = await runLlmInvoke(fake, 'p', { provider: 'ollama', model: 'x' });
    expect(result.output).toBe(JSON.stringify({ type: 'text', text: 'hello' }));
  });
});

describe('parsePromptToMessages', () => {
  it('일반 문자열은 단일 HumanMessage로 wrap', () => {
    const messages = parsePromptToMessages('plain text prompt');
    expect(messages).toHaveLength(1);
    expect(messages[0].getType()).toBe('human');
    expect(String(messages[0].content)).toBe('plain text prompt');
  });

  it('JSON-encoded message array는 SystemMessage + HumanMessage로 분리', () => {
    const json = JSON.stringify([
      { role: 'system', content: 'You are a strict Oracle SQL teacher.' },
      { role: 'user', content: '1주차 SELECT 문제를 만들어주세요' },
    ]);
    const messages = parsePromptToMessages(json);
    expect(messages).toHaveLength(2);
    expect(messages[0].getType()).toBe('system');
    expect(messages[1].getType()).toBe('human');
  });

  it('assistant role도 인식', () => {
    const json = JSON.stringify([
      { role: 'system', content: 's' },
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
    const messages = parsePromptToMessages(json);
    expect(messages).toHaveLength(3);
    expect(messages[2].getType()).toBe('ai');
  });

  it('JSON 형식이지만 role/content 누락이면 자유 문자열로 fallback', () => {
    const json = JSON.stringify([{ foo: 'bar' }]);
    const messages = parsePromptToMessages(json);
    expect(messages).toHaveLength(1);
    expect(messages[0].getType()).toBe('human');
  });

  it('대괄호로 시작하지만 JSON 파싱 실패면 자유 문자열로 fallback', () => {
    const messages = parsePromptToMessages('[not json');
    expect(messages).toHaveLength(1);
    expect(messages[0].getType()).toBe('human');
    expect(String(messages[0].content)).toBe('[not json');
  });
});

describe('LangfuseWrappedProvider', () => {
  it('id() 기본 포맷은 langfuse-wrapped:{provider}:{model}', () => {
    const provider = new LangfuseWrappedProvider({
      config: { provider: 'ollama', model: 'exaone3.5:32b' },
    });
    expect(provider.id()).toBe('langfuse-wrapped:ollama:exaone3.5:32b');
  });

  it('options.id가 있으면 그 값을 우선 사용', () => {
    const provider = new LangfuseWrappedProvider({
      id: 'M2 — EXAONE 3.5 32B',
      config: { provider: 'ollama', model: 'exaone3.5:32b' },
    });
    expect(provider.id()).toBe('M2 — EXAONE 3.5 32B');
  });

  it('promptfoo가 두 번째 인자(providerId)만 줘도 fallback 채택', () => {
    const provider = new LangfuseWrappedProvider(
      { config: { provider: 'anthropic', model: 'claude-opus-4-6' } },
      'fallback-id',
    );
    // options.id가 없고 providerId만 있을 때 그것을 사용
    expect(provider.id()).toBe('fallback-id');
  });
});
