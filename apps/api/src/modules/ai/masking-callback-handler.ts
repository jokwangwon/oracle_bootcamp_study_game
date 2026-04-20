import { CallbackHandler } from 'langfuse-langchain';
import type { BaseMessage } from '@langchain/core/messages';
import type { Serialized } from '@langchain/core/load/serializable';
import type { ChainValues } from '@langchain/core/utils/types';
import type { LLMResult } from '@langchain/core/outputs';

import {
  maskChatMessages,
  maskPromptStrings,
  maskChainValues,
  maskLlmOutput,
} from './langfuse-masker';

/**
 * Langfuse `CallbackHandler` 를 상속하여 Langfuse cloud 로 전송되는 payload 에서
 * 학생 답안 평문을 제거하는 decorator. 실제 네트워크 전송은 상위 `CallbackHandler`
 * 에 위임하고, 본 클래스는 **입력/출력 페이로드의 치환 단계만** 담당한다.
 *
 * 관련 문서: `docs/review/consensus-005-llm-judge-safety-architecture.md` (최상단 경보 1).
 */
export class MaskingLangfuseCallbackHandler extends CallbackHandler {
  override name = 'MaskingLangfuseCallbackHandler';

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
      metadata,
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
      metadata,
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
      metadata,
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
