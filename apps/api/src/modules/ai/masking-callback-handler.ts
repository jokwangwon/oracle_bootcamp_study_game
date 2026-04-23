import { CallbackHandler } from 'langfuse-langchain';
import type { BaseMessage } from '@langchain/core/messages';
import type { Serialized } from '@langchain/core/load/serializable';
import type { ChainValues } from '@langchain/core/utils/types';
import type { LLMResult } from '@langchain/core/outputs';

import {
  ALLOWED_METADATA_KEYS,
  filterLangfuseMetadata,
  maskChatMessages,
  maskPromptStrings,
  maskChainValues,
  maskLlmOutput,
} from './langfuse-masker';

/**
 * consensus-007 Session 6 PR#1 C1-2 — metadata 화이트리스트 위반 reporter.
 * production 에서 silent drop 된 key 를 ops_event_log 로 흘려보내는 경로.
 * 배선은 C1-4 에서 AiModule provider 로 제공.
 */
export type MetadataViolationReporter = (violation: {
  key: string;
  handler: string;
  runId?: string;
}) => void;

export interface MaskingLangfuseCallbackOptions {
  violationReporter?: MetadataViolationReporter;
  /** dev/prod 분기 명시 override. 미지정 시 `process.env.NODE_ENV` 판정. */
  envMode?: 'development' | 'production';
}

/**
 * Langfuse `CallbackHandler` 를 상속하여 Langfuse cloud 로 전송되는 payload 에서
 * 학생 답안 평문을 제거하는 decorator. 실제 네트워크 전송은 상위 `CallbackHandler`
 * 에 위임하고, 본 클래스는 **입력/출력 페이로드의 치환 단계만** 담당한다.
 *
 * 추가 (consensus-007 C1-2): metadata 화이트리스트 강제 (`session_id`, `prompt_name`,
 * `prompt_version`, `model_digest`). 위반 시 dev 는 throw, prod 는 silent drop
 * + reporter 호출 (ops_event_log 배선은 C1-4).
 *
 * 관련 문서:
 *  - `docs/review/consensus-005-llm-judge-safety-architecture.md` (최상단 경보 1)
 *  - `docs/review/consensus-007-session-6-grading-wiring.md` (CRITICAL-2)
 */
export class MaskingLangfuseCallbackHandler extends CallbackHandler {
  override name = 'MaskingLangfuseCallbackHandler';

  private readonly violationReporter?: MetadataViolationReporter;
  private readonly envMode: 'development' | 'production';

  constructor(
    params: ConstructorParameters<typeof CallbackHandler>[0],
    options?: MaskingLangfuseCallbackOptions,
  ) {
    super(params);
    this.violationReporter = options?.violationReporter;
    this.envMode =
      options?.envMode ??
      (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  }

  private guardMetadata(
    metadata: Record<string, unknown> | undefined,
    handlerName: string,
    runId?: string,
  ): Record<string, unknown> | undefined {
    if (!metadata) return metadata;
    const { allowed, violations } = filterLangfuseMetadata(metadata);
    if (violations.length === 0) return metadata;
    if (this.envMode === 'development') {
      throw new Error(
        `Langfuse metadata 화이트리스트 위반 (ADR-016 §7 / ADR-018 §8 금지 6): ` +
          `${violations.join(', ')}. 허용 키: ${[...ALLOWED_METADATA_KEYS].join(', ')}.`,
      );
    }
    for (const key of violations) {
      this.violationReporter?.({ key, handler: handlerName, runId });
    }
    return allowed;
  }

  override async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    return super.handleChatModelStart(
      llm,
      maskChatMessages(messages),
      runId,
      parentRunId,
      extraParams,
      tags,
      this.guardMetadata(metadata, 'handleChatModelStart', runId),
      name,
    );
  }

  override async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    return super.handleLLMStart(
      llm,
      maskPromptStrings(prompts),
      runId,
      parentRunId,
      extraParams,
      tags,
      this.guardMetadata(metadata, 'handleLLMStart', runId),
      name,
    );
  }

  override async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runType?: string,
    name?: string,
  ): Promise<void> {
    return super.handleChainStart(
      chain,
      maskChainValues(inputs),
      runId,
      parentRunId,
      tags,
      this.guardMetadata(metadata, 'handleChainStart', runId),
      runType,
      name,
    );
  }

  override async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    return super.handleChainEnd(maskChainValues(outputs), runId, parentRunId);
  }

  override async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    return super.handleLLMEnd(maskLlmOutput(output), runId, parentRunId);
  }
}
