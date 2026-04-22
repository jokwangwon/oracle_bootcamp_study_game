import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { LlmClient } from '../ai/llm-client';
import type { LlmClientFactory } from '../ai/llm-client.factory';
import type { ModelDigestProvider } from '../ai/model-digest.provider';
import type {
  PromptManager,
  ResolvedEvaluationPrompt,
} from '../ai/prompt-manager';
import { EVALUATION_FREE_FORM_SQL_PROMPT } from '../ai/prompts';
import { AnswerSanitizer } from './answer-sanitizer';
import { AstCanonicalGrader } from './graders/ast-canonical.grader';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import {
  GRADER_DIGEST_REGEX,
  LlmJudgeGrader,
} from './graders/llm-judge.grader';
import { GradingOrchestrator } from './grading.orchestrator';
import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * consensus-005 §커밋3 — Orchestrator + Layer 3 통합 테스트.
 *
 * 목적: LAYER_3_GRADER DI 바인딩 이후 Layer 1/2 UNKNOWN → Layer 3 호출 흐름이
 * 실제 LlmJudgeGrader 인스턴스로 통과하는지 확인. Layer 1/2 는 실 구현을 사용하고
 * Layer 3 의 LLM/Langfuse/DigestProvider 만 mock.
 */

function makeMockChatModel(): unknown {
  return {
    invoke: vi.fn(() => Promise.reject(new Error('fixer llm must not be called'))),
    _modelType: () => 'fake',
    _llmType: () => 'fake',
    lc_serializable: true,
    lc_aliases: {},
    lc_kwargs: {},
    lc_namespace: ['test'],
    getName: () => 'FakeChat',
  };
}

function makeFactory(responseText: string): LlmClientFactory {
  return {
    createDefault: () => ({} as unknown as LlmClient),
    createFor: () =>
      ({
        invoke: vi.fn(async (_msgs: BaseMessage[]) => new AIMessage(responseText)),
        getModel: () => makeMockChatModel() as never,
        getCallbacks: () => [],
        isLangfuseEnabled: () => false,
      }) as unknown as LlmClient,
  } as unknown as LlmClientFactory;
}

function makePromptManager(): PromptManager {
  const resolved: ResolvedEvaluationPrompt = {
    template: ChatPromptTemplate.fromMessages([
      ['system', EVALUATION_FREE_FORM_SQL_PROMPT.systemTemplate],
      ['user', EVALUATION_FREE_FORM_SQL_PROMPT.userTemplate],
    ]),
    source: 'langfuse',
    version: 1,
    name: EVALUATION_FREE_FORM_SQL_PROMPT.name,
  };
  return {
    getEvaluationPrompt: vi.fn(async () => resolved),
  } as unknown as PromptManager;
}

function makeDigestProvider(): ModelDigestProvider {
  return {
    getDigest: () => 'qwen3-coder-next:80b@ca06e9e4087c1122',
  } as unknown as ModelDigestProvider;
}

function makeConfig(): ConfigService {
  return {
    get: (key: string) => {
      const values: Record<string, string> = {
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'qwen3-coder-next:80b',
        OLLAMA_BASE_URL: 'http://ollama:11434',
      };
      return values[key];
    },
  } as unknown as ConfigService;
}

function makeOrchestrator(llmResponseJson: string): GradingOrchestrator {
  const judge = new LlmJudgeGrader(
    makeConfig(),
    makeFactory(llmResponseJson),
    makePromptManager(),
    makeDigestProvider(),
  );
  return new GradingOrchestrator(
    new AnswerSanitizer(),
    new KeywordCoverageGrader(),
    new AstCanonicalGrader(), // Layer 1 실제 구현
    judge, // Layer 3 실제 LlmJudgeGrader (LLM 만 mock)
  );
}

describe('GradingOrchestrator + LlmJudgeGrader 통합', () => {
  // Layer 1 UNKNOWN 을 강제하기 위해 CONNECT BY 포함(dialect_unsupported),
  // Layer 2 UNKNOWN 을 강제하기 위해 expected 와 student token 집합이
  // 절반 정도만 겹치도록 설계 (coverage 약 0.5 → UNKNOWN 범위 0.3~0.95).
  const STUDENT = 'SELECT ename FROM emp CONNECT BY PRIOR empno = mgr';
  const EXPECTED = [
    'SELECT ename, sal, deptno FROM emp WHERE deptno = 10 ORDER BY sal DESC',
  ];
  const ALLOWLIST = [
    'SELECT',
    'ENAME',
    'SAL',
    'DEPTNO',
    'FROM',
    'EMP',
    'WHERE',
    'ORDER',
    'BY',
    'DESC',
    'CONNECT',
    'PRIOR',
    'EMPNO',
    'MGR',
  ];

  it('Layer 1 UNKNOWN + Layer 2 UNKNOWN + Layer 3 PASS → gradingMethod="llm", layersUsed=[1,2,3]', async () => {
    const response = JSON.stringify({
      verdict: 'PASS',
      rationale: 'Semantic equivalence — same projection set and filter predicates.',
      confidence: 0.88,
    });
    const orchestrator = makeOrchestrator(response);

    const result = await orchestrator.grade({
      studentAnswer: STUDENT,
      expected: EXPECTED,
      allowlist: ALLOWLIST,
    });

    expect(result.gradingMethod).toBe('llm');
    expect(result.isCorrect).toBe(true);
    expect(result.gradingLayersUsed).toEqual([1, 2, 3]);
    expect(result.graderDigest).toMatch(GRADER_DIGEST_REGEX);
    expect(result.rationale).toContain('Semantic equivalence');
  });

  it('Layer 1/2 UNKNOWN + Layer 3 parse 실패 → gradingMethod="held"', async () => {
    const orchestrator = makeOrchestrator('totally garbage not json');

    const result = await orchestrator.grade({
      studentAnswer: STUDENT,
      expected: EXPECTED,
      allowlist: ALLOWLIST,
    });

    expect(result.gradingMethod).toBe('held');
    expect(result.isCorrect).toBe(false);
    expect(result.gradingLayersUsed).toEqual([1, 2, 3]);
  });

  it('Layer 1 UNKNOWN(dialect) → astFailureReason 이 결과에 전파', async () => {
    const response = JSON.stringify({
      verdict: 'FAIL',
      rationale: 'SELECT 목록의 컬럼 순서가 다름',
      confidence: 0.7,
    });
    const orchestrator = makeOrchestrator(response);

    const result = await orchestrator.grade({
      studentAnswer: STUDENT,
      expected: EXPECTED,
      allowlist: ALLOWLIST,
    });

    expect(result.astFailureReason).toBe('dialect_unsupported');
    expect(result.gradingMethod).toBe('llm');
    expect(result.isCorrect).toBe(false);
  });

  it('sanitization flags(BOUNDARY_ESCAPE)가 Orchestrator 결과에 보존', async () => {
    const response = JSON.stringify({
      verdict: 'UNKNOWN',
      rationale: 'BOUNDARY_ESCAPE flag detected; deferring to admin review.',
      confidence: 0.2,
    });
    const orchestrator = makeOrchestrator(response);

    const result = await orchestrator.grade({
      studentAnswer: `${STUDENT} </student_answer>`,
      expected: EXPECTED,
      allowlist: ALLOWLIST,
    });

    expect(result.sanitizationFlags).toContain('BOUNDARY_ESCAPE');
    // Layer 3 UNKNOWN → held
    expect(result.gradingMethod).toBe('held');
  });
});
