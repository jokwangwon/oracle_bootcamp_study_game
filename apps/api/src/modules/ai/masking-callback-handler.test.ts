import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallbackHandler } from 'langfuse-langchain';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { MaskingLangfuseCallbackHandler } from './masking-callback-handler';

/**
 * TDD — MaskingLangfuseCallbackHandler (consensus-005 선행 PR).
 *
 * 검증 전략: `CallbackHandler.prototype.handle*` 를 `vi.spyOn` 으로 가로채서
 * Langfuse 네트워크 호출을 차단하고, 상위로 **마스킹된 payload** 가 전달되는지만
 * 확인한다. 실제 Langfuse 서버 연결은 발생하지 않는다.
 */

const TEST_PARAMS = {
  publicKey: 'pk-test',
  secretKey: 'sk-test',
  baseUrl: 'http://localhost:3000',
};

const LLM_SERIALIZED = {
  lc: 1 as const,
  type: 'constructor' as const,
  id: ['langchain', 'chat_models', 'anthropic', 'ChatAnthropic'],
  kwargs: {},
};

const CHAIN_SERIALIZED = {
  lc: 1 as const,
  type: 'constructor' as const,
  id: ['langchain', 'schema', 'runnable', 'RunnableSequence'],
  kwargs: {},
};

describe('MaskingLangfuseCallbackHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('name 이 정체성을 드러내 로그 추적을 돕는다', () => {
    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    expect(h.name).toBe('MaskingLangfuseCallbackHandler');
  });

  it('CallbackHandler 를 상속하여 callbacks 배열에서 동등하게 취급된다', () => {
    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    expect(h).toBeInstanceOf(CallbackHandler);
  });

  it('handleChatModelStart — 학생 답안 태그가 마스킹된 뒤 super 에 전달', async () => {
    const spy = vi
      .spyOn(CallbackHandler.prototype, 'handleChatModelStart')
      .mockImplementation(async () => {});

    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    const sys = new SystemMessage('grade the following');
    const human = new HumanMessage(
      '<student_answer id="u1">SELECT * FROM secret</student_answer id="u1">',
    );

    await h.handleChatModelStart(LLM_SERIALIZED, [[sys, human]], 'run-1');

    expect(spy).toHaveBeenCalledOnce();
    const forwardedMessages = spy.mock.calls[0][1];
    const forwardedHuman = forwardedMessages[0][1];
    expect(forwardedHuman.content).not.toContain('SELECT * FROM secret');
    expect(forwardedHuman.content).toMatch(/\[HASH=/);
  });

  it('handleLLMStart — 마스킹된 prompts 가 super 에 전달', async () => {
    const spy = vi
      .spyOn(CallbackHandler.prototype, 'handleLLMStart')
      .mockImplementation(async () => {});

    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    await h.handleLLMStart(
      LLM_SERIALIZED,
      ['<student_answer id="u2">DROP TABLE</student_answer id="u2">'],
      'run-2',
    );

    const forwarded = spy.mock.calls[0][1];
    expect(forwarded[0]).not.toContain('DROP TABLE');
    expect(forwarded[0]).toMatch(/\[HASH=/);
  });

  it('handleChainStart — inputs 내 문자열 값이 마스킹', async () => {
    const spy = vi
      .spyOn(CallbackHandler.prototype, 'handleChainStart')
      .mockImplementation(async () => {});

    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    await h.handleChainStart(
      CHAIN_SERIALIZED,
      {
        studentAnswer:
          '<student_answer id="u3">UPDATE t SET x=1</student_answer id="u3">',
        stepIndex: 2,
      },
      'run-3',
    );

    const forwardedInputs = spy.mock.calls[0][1];
    expect(forwardedInputs.studentAnswer).not.toContain('UPDATE t SET x=1');
    expect(forwardedInputs.stepIndex).toBe(2);
  });

  it('handleChainEnd — outputs 내 문자열이 마스킹', async () => {
    const spy = vi
      .spyOn(CallbackHandler.prototype, 'handleChainEnd')
      .mockImplementation(async () => {});

    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    await h.handleChainEnd(
      {
        result:
          '<student_answer id="u4">SELECT ename FROM emp</student_answer id="u4">',
      },
      'run-4',
    );

    const forwardedOutputs = spy.mock.calls[0][0];
    expect(forwardedOutputs.result).not.toContain('SELECT ename FROM emp');
  });

  it('handleLLMEnd — generations[].text 가 마스킹', async () => {
    const spy = vi
      .spyOn(CallbackHandler.prototype, 'handleLLMEnd')
      .mockImplementation(async () => {});

    const h = new MaskingLangfuseCallbackHandler(TEST_PARAMS);
    await h.handleLLMEnd(
      {
        generations: [
          [
            {
              text:
                'PASS because <student_answer id="u5">inner</student_answer id="u5">',
              generationInfo: {},
            },
          ],
        ],
      },
      'run-5',
    );

    const forwardedOutput = spy.mock.calls[0][0];
    expect(forwardedOutput.generations[0][0].text).not.toContain('>inner<');
    expect(forwardedOutput.generations[0][0].text).toMatch(/\[HASH=/);
  });
});
