import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallbackHandler } from 'langfuse-langchain';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { LlmClient } from './llm-client';
import { MaskingLangfuseCallbackHandler } from './masking-callback-handler';

/**
 * Layer 4 CI 스냅샷 — consensus-005 최상단 경보 1 회귀 방지.
 *
 * 목적: 향후 누군가 `llm-client.ts` 의 `createLangfuseHandler()` 를 되돌려
 * 원본 `CallbackHandler` 를 쓰도록 변경하거나, 우회 경로가 생겨 학생 답안 평문이
 * Langfuse cloud 로 전송되는 회귀를 CI 에서 바로 차단한다.
 *
 * 본 테스트가 실패하면 **Langfuse 에 학생 답안 평문이 유출될 가능성** 을 의미하므로
 * 원인 분석 전까지 병합 차단.
 */

class FakeConfig {
  constructor(private readonly map: Record<string, string | undefined>) {}

  get<T = string>(key: string): T {
    return this.map[key] as unknown as T;
  }
}

const LANGFUSE_ENABLED_ENV = {
  LLM_PROVIDER: 'ollama',
  LLM_MODEL: 'exaone3.5:32b',
  OLLAMA_BASE_URL: 'http://ollama:11434',
  LANGFUSE_PUBLIC_KEY: 'pk-trace-privacy',
  LANGFUSE_SECRET_KEY: 'sk-trace-privacy',
  LANGFUSE_HOST: 'http://localhost:3000',
};

describe('Langfuse trace privacy (Layer 4 회귀 방지)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('LANGFUSE key 가 있으면 callbacks[0] 은 MaskingLangfuseCallbackHandler', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new LlmClient(new FakeConfig(LANGFUSE_ENABLED_ENV) as any);
    const cbs = client.getCallbacks() as unknown[];

    expect(cbs).toHaveLength(1);
    expect(cbs[0]).toBeInstanceOf(MaskingLangfuseCallbackHandler);
    // Regression guard: 원본 CallbackHandler 직접 사용 금지.
    expect(Object.getPrototypeOf(cbs[0]).constructor.name).toBe(
      'MaskingLangfuseCallbackHandler',
    );
  });

  it('학생 답안 태그 포함 HumanMessage 가 Langfuse super 로 갈 때 평문이 제거된다', async () => {
    const superSpy = vi
      .spyOn(CallbackHandler.prototype, 'handleChatModelStart')
      .mockImplementation(async () => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new LlmClient(new FakeConfig(LANGFUSE_ENABLED_ENV) as any);
    const handler = client.getCallbacks()[0] as MaskingLangfuseCallbackHandler;

    const sys = new SystemMessage('당신은 SQL 채점자입니다');
    const human = new HumanMessage(
      'Evaluate: <student_answer id="nonce-a">DROP TABLE students; SELECT name FROM staff</student_answer id="nonce-a">',
    );

    await handler.handleChatModelStart(
      {
        lc: 1,
        type: 'constructor',
        id: ['langchain', 'chat_models', 'ChatOllama'],
        kwargs: {},
      },
      [[sys, human]],
      'run-privacy',
    );

    expect(superSpy).toHaveBeenCalledOnce();
    const [, forwardedMessages] = superSpy.mock.calls[0];
    const flatTexts = forwardedMessages
      .flat()
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join(' || ');

    // Regression guard: 평문 포함되면 즉시 실패
    expect(flatTexts).not.toContain('DROP TABLE students');
    expect(flatTexts).not.toContain('SELECT name FROM staff');
    // 마스킹 포맷 존재 확인
    expect(flatTexts).toMatch(/\[HASH=[a-f0-9]{16}\|LEN=\d+\|KW=/);
    // System 메시지는 보존
    expect(flatTexts).toContain('당신은 SQL 채점자입니다');
  });
});
