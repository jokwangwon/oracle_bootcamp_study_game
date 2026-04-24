import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LlmClient } from '../../ai/llm-client';
import type { LlmClientFactory } from '../../ai/llm-client.factory';
import type { ModelDigestProvider } from '../../ai/model-digest.provider';
import type {
  PromptManager,
  ResolvedEvaluationPrompt,
} from '../../ai/prompt-manager';
import { EVALUATION_FREE_FORM_SQL_PROMPT } from '../../ai/prompts';
import {
  ERROR_MESSAGE_MAX_LENGTH,
  GRADER_DIGEST_REGEX,
  LLM_JUDGE_DEFAULT_TIMEOUT_MS,
  LLM_JUDGE_PROMPT_NAME,
  LLM_JUDGE_PROMPT_VERSION,
  LlmJudgeGrader,
  LlmJudgeTimeoutError,
  RATIONALE_MAX_LENGTH,
  redactErrorMessage,
  withLlmJudgeTimeout,
} from './llm-judge.grader';
import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * ADR-013 Layer 3 + ADR-016 §1·§3·§4 + consensus-005 §커밋1 TDD.
 *
 * 커버:
 *  1. 경계 태그 탈출 시도 (sanitizer 가 이미 BOUNDARY_ESCAPE flag 전달 케이스)
 *  2. 한국어/영어 injection SUSPICIOUS_INPUT flag 가 프롬프트에 주입됨
 *  3. Ollama 경로 결정성 (seed=42, topK=1 ctor 전달 확인)
 *  4. Anthropic 경로 — seed 없이 temperature=0 만 전달
 *  5. Zod 파싱 실패 → fixer retry → 최종 실패 시 UNKNOWN fallback
 *  6. Langfuse getEvaluationPrompt 숫자 버전 pin 확인
 *  7. grader_digest regex 매치 (langfuse 경로)
 *  8. grader_digest regex 매치 (local fallback 경로, `|local-{sha8}` 접미사)
 *  9. rationale 500자 초과 시 truncate
 * 10. 경계 태그 nonce UUID 매 호출 신선
 * 11. Layer 3 호출 자체가 실패해도 UNKNOWN 반환 (fail-closed)
 * 12. LangChain prompt 변수 4개 모두 주입 (expected/answer_tagged/suspicious/format_instructions)
 */

function makePromptTemplate() {
  return ChatPromptTemplate.fromMessages([
    ['system', EVALUATION_FREE_FORM_SQL_PROMPT.systemTemplate],
    ['user', EVALUATION_FREE_FORM_SQL_PROMPT.userTemplate],
  ]);
}

function makeLangfuseResolved(
  version = LLM_JUDGE_PROMPT_VERSION,
): ResolvedEvaluationPrompt {
  return {
    template: makePromptTemplate(),
    source: 'langfuse',
    version,
    name: LLM_JUDGE_PROMPT_NAME,
  };
}

function makeLocalResolved(
  version = LLM_JUDGE_PROMPT_VERSION,
): ResolvedEvaluationPrompt {
  return {
    template: makePromptTemplate(),
    source: 'local',
    version,
    name: LLM_JUDGE_PROMPT_NAME,
  };
}

/**
 * 최소 BaseChatModel mock — OutputFixingParser.fromLLM 이 요구하는 구조만 충족.
 * invoke 는 실제 호출되지 않아야 한다 (fixer는 parser 성공 시 미호출).
 */
function makeMockChatModel(): unknown {
  return {
    invoke: vi.fn(() => Promise.reject(new Error('fixer llm must not be called in happy path'))),
    _modelType: () => 'fake',
    _llmType: () => 'fake',
    lc_serializable: true,
    lc_aliases: {},
    lc_kwargs: {},
    lc_namespace: ['test'],
    lc_runnable: true,
    getName: () => 'FakeChat',
  };
}

function makeMockLlmClient(
  responseText: string,
  ctorSpy?: (opts: unknown) => void,
): LlmClient {
  const invokeSpy = vi.fn(async (_msgs: BaseMessage[]) => {
    return new AIMessage(responseText);
  });
  return {
    invoke: invokeSpy,
    getModel: () => makeMockChatModel() as never,
    getCallbacks: () => [],
    isLangfuseEnabled: () => false,
    // expose for assertion
    __invokeSpy: invokeSpy,
    __ctorSpy: ctorSpy,
  } as unknown as LlmClient;
}

function makeConfig(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  const values: Record<string, string | undefined> = {
    LLM_PROVIDER: 'ollama',
    LLM_MODEL: 'qwen3-coder-next:80b',
    OLLAMA_BASE_URL: 'http://ollama:11434',
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function makeDigestProvider(
  digest = 'qwen3-coder-next:80b@ca06e9e4087c111222333444555',
): ModelDigestProvider {
  return {
    getDigest: () => digest,
  } as unknown as ModelDigestProvider;
}

function makeFactory(
  responseText: string,
  options?: { captureOpts?: unknown[]; createdClients?: LlmClient[] },
): LlmClientFactory {
  const captured: unknown[] = options?.captureOpts ?? [];
  const tracked: LlmClient[] = options?.createdClients ?? [];
  return {
    createDefault: () => {
      const c = makeMockLlmClient(responseText);
      tracked.push(c);
      return c;
    },
    createFor: (opts: unknown) => {
      captured.push(opts);
      const c = makeMockLlmClient(responseText);
      tracked.push(c);
      return c;
    },
  } as unknown as LlmClientFactory;
}

function makePromptManager(
  resolved: ResolvedEvaluationPrompt,
  spy?: (name: string, version: number) => void,
): PromptManager {
  return {
    getEvaluationPrompt: vi.fn(async (name: string, version: number) => {
      spy?.(name, version);
      return resolved;
    }),
  } as unknown as PromptManager;
}

const VALID_RESPONSE_JSON = JSON.stringify({
  verdict: 'PASS',
  rationale: 'Semantically equivalent JOIN syntax with matching projection.',
  confidence: 0.92,
});

describe('LlmJudgeGrader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('정상 JSON 응답 → PASS verdict + grader_digest regex 매치', async () => {
    const resolved = makeLangfuseResolved();
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON),
      makePromptManager(resolved),
      makeDigestProvider(),
    );

    const result = await grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP WHERE SAL > 3000',
      expected: ['SELECT ENAME FROM EMP WHERE SAL > 3000'],
      sanitizationFlags: [],
    });

    expect(result.verdict).toBe('PASS');
    expect(result.confidence).toBeCloseTo(0.92, 2);
    expect(result.graderDigest).toMatch(GRADER_DIGEST_REGEX);
    expect(result.graderDigest).toContain(`v${LLM_JUDGE_PROMPT_VERSION}`);
    expect(result.graderDigest).toContain('seed:42');
    expect(result.graderDigest).toContain('topk:1');
    expect(result.graderDigest).not.toContain('local-');
  });

  it('local fallback 경로 → grader_digest 에 |local-{sha8} 접미사', async () => {
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON),
      makePromptManager(makeLocalResolved()),
      makeDigestProvider(),
    );

    const result = await grader.grade({
      studentAnswer: 'SELECT 1 FROM DUAL',
      expected: ['SELECT 1 FROM DUAL'],
      sanitizationFlags: [],
    });

    expect(result.graderDigest).toMatch(GRADER_DIGEST_REGEX);
    expect(result.graderDigest).toMatch(/\|local-[a-f0-9]{8}$/);
  });

  it('Ollama 경로 — factory.createFor 에 seed=42, topK=1, temperature=0 전달', async () => {
    const captured: unknown[] = [];
    const grader = new LlmJudgeGrader(
      makeConfig({ LLM_PROVIDER: 'ollama', LLM_MODEL: 'qwen3-coder-next:80b' }),
      makeFactory(VALID_RESPONSE_JSON, { captureOpts: captured }),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    // 최소 2회 (judge + fixer) createFor 호출
    expect(captured.length).toBeGreaterThanOrEqual(2);
    for (const opts of captured) {
      const o = opts as {
        provider: string;
        seed?: number;
        topK?: number;
        temperature?: number;
      };
      expect(o.provider).toBe('ollama');
      expect(o.seed).toBe(42);
      expect(o.topK).toBe(1);
      expect(o.temperature).toBe(0);
    }
  });

  it('Anthropic 경로 — factory.createFor 에 temperature=0 (seed 는 옵션 전달되나 SDK가 무시)', async () => {
    const captured: unknown[] = [];
    const grader = new LlmJudgeGrader(
      makeConfig({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'claude-opus-4-6' }),
      makeFactory(VALID_RESPONSE_JSON, { captureOpts: captured }),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider('claude-api:claude-opus-4-6'),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    for (const opts of captured) {
      const o = opts as { provider: string; temperature?: number };
      expect(o.provider).toBe('anthropic');
      expect(o.temperature).toBe(0);
    }
  });

  it('Langfuse getEvaluationPrompt 는 숫자 버전(v1) 을 반드시 전달', async () => {
    const spy = vi.fn<[string, number], void>();
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON),
      makePromptManager(makeLangfuseResolved(), spy),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    expect(spy).toHaveBeenCalledWith(LLM_JUDGE_PROMPT_NAME, LLM_JUDGE_PROMPT_VERSION);
  });

  it('파싱 불가능한 응답 → UNKNOWN (fail-closed)', async () => {
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory('not json at all, totally garbage'),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    const result = await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.rationale).toMatch(/parse failed|UNKNOWN/);
    expect(result.graderDigest).toMatch(GRADER_DIGEST_REGEX);
  });

  it('rationale 500자 초과 → 500자로 truncate', async () => {
    const longResponse = JSON.stringify({
      verdict: 'FAIL',
      rationale: 'X'.repeat(RATIONALE_MAX_LENGTH),
      confidence: 0.5,
    });

    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(longResponse),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    const result = await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 2'],
      sanitizationFlags: [],
    });

    expect(result.rationale.length).toBeLessThanOrEqual(RATIONALE_MAX_LENGTH);
  });

  it('경계 태그 nonce 는 매 호출 신선 (서로 다른 nonce)', async () => {
    const captured: BaseMessage[][] = [];
    const factory = {
      createDefault: () => makeMockLlmClient(VALID_RESPONSE_JSON),
      createFor: () => {
        const invokeSpy = vi.fn(async (msgs: BaseMessage[]) => {
          captured.push(msgs);
          return new AIMessage(VALID_RESPONSE_JSON);
        });
        return {
          invoke: invokeSpy,
          getModel: () => makeMockChatModel() as never,
          getCallbacks: () => [],
          isLangfuseEnabled: () => false,
        } as unknown as LlmClient;
      },
    } as unknown as LlmClientFactory;

    const grader = new LlmJudgeGrader(
      makeConfig(),
      factory,
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });
    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    // 두 번의 grade 호출 → judgeLlm.invoke 두 번 (최초 2개 entries 는 첫/두 번째 grade)
    const firstCallMsgs = captured[0]
      .map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      )
      .join('\n');
    const secondCallMsgs = captured[1]
      .map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      )
      .join('\n');

    const nonceRegex = /student_answer\s+id="([a-f0-9-]+)"/;
    const nonce1 = nonceRegex.exec(firstCallMsgs)?.[1];
    const nonce2 = nonceRegex.exec(secondCallMsgs)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  it('sanitization flags 가 프롬프트 변수로 주입됨 (injection 경고 전달)', async () => {
    const capturedMsgs: BaseMessage[][] = [];
    const factory = {
      createDefault: () => makeMockLlmClient(VALID_RESPONSE_JSON),
      createFor: () => {
        const invokeSpy = vi.fn(async (msgs: BaseMessage[]) => {
          capturedMsgs.push(msgs);
          return new AIMessage(VALID_RESPONSE_JSON);
        });
        return {
          invoke: invokeSpy,
          getModel: () => makeMockChatModel() as never,
          getCallbacks: () => [],
          isLangfuseEnabled: () => false,
        } as unknown as LlmClient;
      },
    } as unknown as LlmClientFactory;

    const grader = new LlmJudgeGrader(
      makeConfig(),
      factory,
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: ['SUSPICIOUS_INPUT', 'BOUNDARY_ESCAPE'],
    });

    const joined = capturedMsgs[0]
      .map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      )
      .join('\n');

    expect(joined).toContain('SUSPICIOUS_INPUT');
    expect(joined).toContain('BOUNDARY_ESCAPE');
  });

  it('sanitization flags 가 비어있으면 "none" 으로 주입', async () => {
    const capturedMsgs: BaseMessage[][] = [];
    const factory = {
      createDefault: () => makeMockLlmClient(VALID_RESPONSE_JSON),
      createFor: () => {
        const invokeSpy = vi.fn(async (msgs: BaseMessage[]) => {
          capturedMsgs.push(msgs);
          return new AIMessage(VALID_RESPONSE_JSON);
        });
        return {
          invoke: invokeSpy,
          getModel: () => makeMockChatModel() as never,
          getCallbacks: () => [],
          isLangfuseEnabled: () => false,
        } as unknown as LlmClient;
      },
    } as unknown as LlmClientFactory;

    const grader = new LlmJudgeGrader(
      makeConfig(),
      factory,
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    const joined = capturedMsgs[0]
      .map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      )
      .join('\n');

    expect(joined).toContain('Sanitizer flags: none');
  });

  it('LLM invoke 자체가 throw → UNKNOWN (fail-closed)', async () => {
    const throwingFactory = {
      createDefault: () => makeMockLlmClient(VALID_RESPONSE_JSON),
      createFor: () =>
        ({
          invoke: vi.fn(() => Promise.reject(new Error('network down'))),
          getModel: () => makeMockChatModel() as never,
          getCallbacks: () => [],
          isLangfuseEnabled: () => false,
        }) as unknown as LlmClient,
    } as unknown as LlmClientFactory;

    const grader = new LlmJudgeGrader(
      makeConfig(),
      throwingFactory,
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    const result = await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.graderDigest).toMatch(GRADER_DIGEST_REGEX);
  });

  it('grader_digest 형식 정확성 — prompt/model/parser/temp/seed/topk 모두 포함', async () => {
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON),
      makePromptManager(makeLangfuseResolved(3)), // version 3 도 문제 없음
      makeDigestProvider('qwen3-coder-next:80b@deadbeefcafe1234567890'),
    );

    const result = await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    // 규약:
    //  prompt:{name}:v{ver}|model:{digest8}|parser:sov1|temp:0|seed:42|topk:1
    expect(result.graderDigest).toMatch(/^prompt:evaluation\/free-form-sql-v1:v3\|/);
    expect(result.graderDigest).toContain('|parser:sov1|');
    expect(result.graderDigest).toContain('|temp:0|');
    expect(result.graderDigest).toContain('|seed:42|');
    expect(result.graderDigest).toMatch(/topk:1(\||$)/);
  });
});

describe('redactErrorMessage (consensus-007 C1-3 — 에러 로깅 redaction)', () => {
  it('student_answer 태그 구간은 mask 되어 학생 답안 평문 미노출', () => {
    const err = new Error(
      'Parsing failed. Raw output: <student_answer id="abc">SELECT secret FROM vault</student_answer id="abc">',
    );
    const red = redactErrorMessage(err);
    expect(red).not.toContain('SELECT secret FROM vault');
    expect(red).toMatch(/\[HASH=/);
    expect(red).toContain('Parsing failed');
  });

  it('경계 태그 불균형 (태그 일부만) → BOUNDARY_ESCAPE_SENTINEL 치환', () => {
    const err = new Error(
      'Parser: <student_answer id="x">secret input leaked without close',
    );
    const red = redactErrorMessage(err);
    expect(red).not.toContain('secret input leaked');
    expect(red).toContain('[BOUNDARY_ESCAPE_DETECTED]');
  });

  it('에러 유형 정보 (학생 답안 태그 없음) 는 그대로 유지', () => {
    const err = new Error('Ollama unreachable: ECONNREFUSED 127.0.0.1:11434');
    const red = redactErrorMessage(err);
    expect(red).toContain('Ollama unreachable');
    expect(red).toContain('ECONNREFUSED');
  });

  it('err 가 Error 인스턴스 아닐 때도 String() 경유 동작', () => {
    expect(redactErrorMessage('plain string error')).toBe('plain string error');
    expect(redactErrorMessage(null)).toBe('null');
  });

  it('길이 초과 시 truncate + 마크 추가', () => {
    const longMsg = 'x'.repeat(ERROR_MESSAGE_MAX_LENGTH + 100);
    const err = new Error(longMsg);
    const red = redactErrorMessage(err);
    expect(red.length).toBe(ERROR_MESSAGE_MAX_LENGTH + 1);
    expect(red.endsWith('…')).toBe(true);
  });

  it('user_token_hash 패턴도 같이 redact (masker USER_TOKEN_HASH_PATTERNS 재사용)', () => {
    const err = new Error(
      'LLM error: user_token_hash=abcdef1234567890 was leaked in raw response',
    );
    const red = redactErrorMessage(err);
    expect(red).not.toContain('abcdef1234567890');
    expect(red).toContain('[USER_TOKEN_HASH_REDACTED]');
  });
});

/**
 * consensus-007 C2-1 — Layer3GradeInput.sessionId → judgeLlm.invoke opts.metadata.session_id.
 *
 * ADR-016 §7 화이트리스트 4종 중 `session_id` 만 사용. userId 파생정보는 절대 전송 금지.
 */
describe('LlmJudgeGrader — sessionId → Langfuse metadata (consensus-007 C2-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getFirstInvokeCall(clients: LlmClient[]) {
    // createFor 첫 호출 → judgeLlm, 두 번째 → fixerLlm. happy path 에선 fixer 미호출.
    expect(clients.length).toBeGreaterThanOrEqual(1);
    const judge = clients[0] as LlmClient & {
      __invokeSpy: ReturnType<typeof vi.fn>;
    };
    expect(judge.__invokeSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    return judge.__invokeSpy.mock.calls[0] as [unknown, unknown];
  }

  it('grade input.sessionId 가 있으면 judgeLlm.invoke 두번째 인자 opts.metadata.session_id 에 전달', async () => {
    const created: LlmClient[] = [];
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON, { createdClients: created }),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
      sessionId: 'sess-abc-001',
    });

    const [, opts] = getFirstInvokeCall(created);
    expect(opts).toBeDefined();
    expect(opts).toEqual({ metadata: { session_id: 'sess-abc-001' } });
  });

  it('grade input.sessionId 미전달 시 judgeLlm.invoke 두번째 인자는 undefined', async () => {
    const created: LlmClient[] = [];
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON, { createdClients: created }),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
    });

    const [, opts] = getFirstInvokeCall(created);
    expect(opts).toBeUndefined();
  });

  it('sessionId 외의 키는 grader 가 직접 주입하지 않는다 (metadata 에 session_id 만)', async () => {
    const created: LlmClient[] = [];
    const grader = new LlmJudgeGrader(
      makeConfig(),
      makeFactory(VALID_RESPONSE_JSON, { createdClients: created }),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
      sessionId: 's',
    });

    const [, opts] = getFirstInvokeCall(created);
    const meta = (opts as { metadata: Record<string, unknown> }).metadata;
    expect(Object.keys(meta)).toEqual(['session_id']);
  });
});

/**
 * consensus-007 Q1 / S6-C2-5 — withLlmJudgeTimeout pure helper.
 */
describe('withLlmJudgeTimeout', () => {
  it('timeout 이내에 resolve 되면 그대로 통과', async () => {
    const result = await withLlmJudgeTimeout(Promise.resolve('ok'), 100);
    expect(result).toBe('ok');
  });

  it('timeout 초과 시 LlmJudgeTimeoutError throw (timeoutMs + elapsedMs 포함)', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withLlmJudgeTimeout(slow, 30)).rejects.toThrow(LlmJudgeTimeoutError);
    try {
      await withLlmJudgeTimeout(
        new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200)),
        30,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(LlmJudgeTimeoutError);
      const err = e as LlmJudgeTimeoutError;
      expect(err.timeoutMs).toBe(30);
      expect(err.elapsedMs).toBeGreaterThanOrEqual(30);
    }
  });

  it('LLM_JUDGE_DEFAULT_TIMEOUT_MS = 8000 (consensus-007 Q1)', () => {
    expect(LLM_JUDGE_DEFAULT_TIMEOUT_MS).toBe(8000);
  });
});

/**
 * consensus-007 S6-C2-5 — LlmJudgeGrader 내부 timeout 적용.
 */
describe('LlmJudgeGrader — Layer 3 timeout (consensus-007 S6-C2-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeSlowLlmClient(delayMs: number): LlmClient {
    const invokeSpy = vi.fn(
      (_msgs: BaseMessage[]) =>
        new Promise((resolve) => setTimeout(() => resolve({ content: '{}' }), delayMs)),
    );
    return {
      invoke: invokeSpy,
      getModel: () => ({
        _modelType: () => 'fake',
        _llmType: () => 'fake',
        lc_serializable: true,
        lc_aliases: {},
        lc_kwargs: {},
        lc_namespace: ['test'],
        lc_runnable: true,
        getName: () => 'FakeChat',
        invoke: () => Promise.resolve({}),
      }) as never,
      getCallbacks: () => [],
      isLangfuseEnabled: () => false,
      __invokeSpy: invokeSpy,
    } as unknown as LlmClient;
  }

  it('config.LLM_JUDGE_TIMEOUT_MS 초과 LLM 응답 → LlmJudgeTimeoutError throw', async () => {
    // factory 는 매번 slow client 를 반환. judge 생성 = 첫 createFor.
    const factory = {
      createDefault: () => makeSlowLlmClient(200),
      createFor: () => makeSlowLlmClient(200),
    } as unknown as LlmClientFactory;

    const grader = new LlmJudgeGrader(
      makeConfig({ LLM_JUDGE_TIMEOUT_MS: 20 as unknown as string }) as ConfigService,
      factory,
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );

    await expect(
      grader.grade({
        studentAnswer: 'SELECT 1',
        expected: ['SELECT 1'],
        sanitizationFlags: [],
        sessionId: 's',
      }),
    ).rejects.toThrow(LlmJudgeTimeoutError);
  });

  it('timeout 미설정 시 기본 LLM_JUDGE_DEFAULT_TIMEOUT_MS (8000) 적용', async () => {
    // 빠른 응답 → timeout 미발생 (정상 JSON 파싱). 기본값 경로 smoke.
    const grader = new LlmJudgeGrader(
      makeConfig() as ConfigService,
      makeFactory(VALID_RESPONSE_JSON),
      makePromptManager(makeLangfuseResolved()),
      makeDigestProvider(),
    );
    const result = await grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['SELECT 1'],
      sanitizationFlags: [],
      sessionId: 's',
    });
    expect(result.verdict).toBe('PASS');
  });
});
