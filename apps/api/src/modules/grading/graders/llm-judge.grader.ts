import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseOutputParser } from '@langchain/core/output_parsers';
import { OutputFixingParser, StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

import { LlmClient, type LlmProvider } from '../../ai/llm-client';
import { LlmClientFactory } from '../../ai/llm-client.factory';
import { maskStudentAnswerInText } from '../../ai/langfuse-masker';
import { ModelDigestProvider } from '../../ai/model-digest.provider';
import {
  PromptManager,
  type ResolvedEvaluationPrompt,
} from '../../ai/prompt-manager';
import { EVALUATION_FREE_FORM_SQL_PROMPT } from '../../ai/prompts';
import type { Layer3Grader } from '../grading.orchestrator';
import type { GradingVerdict, LayerVerdict } from '../grading.types';

/**
 * ADR-013 Layer 3 + ADR-016 §1·§3·§4 + consensus-005 §커밋1.
 *
 * Layer 1 (AST) / Layer 2 (Keyword) 가 UNKNOWN 을 반환했을 때 호출되는
 * 마지막 판정기. LangChain + Langfuse 경유 LLM 호출로 의미적 동치성을 판단.
 *
 * 안전장치:
 *  1. **입력 경계 분리** — 학생 답안은
 *     `<student_answer id="{nonce}">...</student_answer id="{nonce}">`
 *     (이중 센티넬 + nonce UUID) 로 감싸 system 프롬프트와 분리.
 *  2. **구조화 출력** — Zod schema + StructuredOutputParser + OutputFixingParser.
 *     파싱 최종 실패 → UNKNOWN (fail-closed).
 *  3. **결정성** — Ollama: temp=0, seed=42, top_k=1 / Anthropic: temp=0 (seed 미지원).
 *  4. **Langfuse prompt 숫자 버전 pin** — `getEvaluationPrompt(name, version)` 필수.
 *  5. **rationale 500 자 제한** — response 측에서 추가 truncate (LLM 준수 실패 보강).
 *  6. **grader_digest 규약**:
 *     `prompt:{name}:v{ver}|model:{digest8}|parser:sov1|temp:0|seed:42|topk:1`
 *     로컬 fallback 시 `|local-{sha8(system+user)}` 접미사.
 *
 * LLM-judge 호출률은 MT8 게이트로 별도 감시 (ops-aggregation.service).
 */

export const LLM_JUDGE_PROMPT_NAME = EVALUATION_FREE_FORM_SQL_PROMPT.name;
export const LLM_JUDGE_PROMPT_VERSION = 1;
export const LLM_JUDGE_PARSER_VERSION = 'sov1';
export const LLM_JUDGE_SEED = 42;
export const LLM_JUDGE_TOP_K = 1;
export const LLM_JUDGE_TEMPERATURE = 0;
export const RATIONALE_MAX_LENGTH = 500;

/**
 * ADR-016 §추가 + consensus-007 Q1/S6-C2-5 — Layer 3 호출 기본 timeout.
 * env LLM_JUDGE_TIMEOUT_MS 로 override. 초과 시 LlmJudgeTimeoutError throw.
 */
export const LLM_JUDGE_DEFAULT_TIMEOUT_MS = 8000;

export class LlmJudgeTimeoutError extends Error {
  /**
   * PR #15 (consensus-007 사후 검증 CRITICAL-1) — 상위 GameSessionService 가
   * held answer_history row 를 채울 때 sanitizer 플래그를 재현할 수 없으므로
   * Orchestrator 가 catch 시점에 첨부한다.
   */
  sanitizationFlags?: readonly string[];

  constructor(
    public readonly timeoutMs: number,
    public readonly elapsedMs?: number,
  ) {
    super(`LLM judge timeout after ${timeoutMs}ms`);
    this.name = 'LlmJudgeTimeoutError';
  }
}

/** Layer 3 invoke 를 timeout Promise.race 로 감싼다. */
export async function withLlmJudgeTimeout<T>(
  p: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const start = Date.now();
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new LlmJudgeTimeoutError(timeoutMs, Date.now() - start)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const JUDGE_OUTPUT_SCHEMA = z.object({
  verdict: z.enum(['PASS', 'FAIL', 'UNKNOWN']),
  rationale: z.string().max(RATIONALE_MAX_LENGTH),
  confidence: z.number().min(0).max(1),
});
export type JudgeOutput = z.infer<typeof JUDGE_OUTPUT_SCHEMA>;

/**
 * consensus-005 §커밋1-4 — grader_digest 검증 정규식.
 * prompt name 은 `a-z`, `0-9`, `-`, `/` 만 허용.
 * local fallback 접미사 `|local-{8 hex}` 는 선택.
 */
export const GRADER_DIGEST_REGEX =
  /^prompt:[a-z0-9\-/]+:v\d+\|model:[a-f0-9]{8}\|parser:sov1\|temp:0\|seed:42\|topk:1(\|local-[a-f0-9]{8})?$/;

/**
 * consensus-007 Session 6 PR#1 C1-3 — 에러 로깅 redaction.
 *
 * LangChain `OutputFixingParser` 가 2차 파싱 실패 시 raw LLM response 를 error
 * message 에 그대로 포함하는 경우가 있다. raw response 에는 prompt echo + 학생
 * 답안 경계 태그가 섞여 있을 수 있어, stdout/journald 로 출력되면 학생 답안 평문
 * 유출 위험. `maskStudentAnswerInText` 를 재사용해 태그 구간 치환 + 최대 길이 제한.
 */
export const ERROR_MESSAGE_MAX_LENGTH = 500;
export const ERROR_MESSAGE_TRUNCATE_MARK = '…';

export function redactErrorMessage(err: unknown, maxLen = ERROR_MESSAGE_MAX_LENGTH): string {
  const raw = err instanceof Error ? err.message : String(err);
  const masked = maskStudentAnswerInText(raw);
  return masked.length > maxLen
    ? masked.slice(0, maxLen) + ERROR_MESSAGE_TRUNCATE_MARK
    : masked;
}

export interface Layer3GradeInput {
  studentAnswer: string;
  expected: readonly string[];
  sanitizationFlags: readonly string[];
  /**
   * consensus-007 C2-1 — Langfuse trace metadata.session_id 로 전파.
   * ADR-018 §8 금지 6 에 따라 userId 파생정보는 절대 전송되지 않는다.
   */
  sessionId?: string;
}

@Injectable()
export class LlmJudgeGrader implements Layer3Grader {
  private readonly logger = new Logger(LlmJudgeGrader.name);
  private readonly judgeLlm: LlmClient;
  // langchain 의 InteropZodType(bundled zod) 와 앱 zod 버전 스큐 때문에
  // StructuredOutputParser 제네릭은 never 로 두고 parse 결과만 JudgeOutput 로 시그니처화.
  private readonly parser: BaseOutputParser<JudgeOutput>;
  private readonly fixingParser: OutputFixingParser<JudgeOutput>;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    factory: LlmClientFactory,
    private readonly promptManager: PromptManager,
    private readonly digestProvider: ModelDigestProvider,
  ) {
    const provider = (config.get<string>('LLM_PROVIDER') ?? 'anthropic') as LlmProvider;
    const model = config.get<string>('LLM_MODEL') ?? '';
    const baseUrl = config.get<string>('OLLAMA_BASE_URL');
    const apiKey = config.get<string>('LLM_API_KEY');
    // consensus-007 Q1/S6-C2-5 — env 우선, 미설정 시 기본 8000ms.
    // env.validation 이 transform 후 number 를 반환하지만 외부 설정/테스트 mock 이
    // string 으로 전달할 가능성 방어 (parseInt 한 번 더).
    const rawTimeout = config.get<number | string>('LLM_JUDGE_TIMEOUT_MS');
    const normalizedTimeout =
      typeof rawTimeout === 'string' ? Number.parseInt(rawTimeout, 10) : rawTimeout;
    this.timeoutMs =
      typeof normalizedTimeout === 'number' &&
      Number.isFinite(normalizedTimeout) &&
      normalizedTimeout > 0
        ? normalizedTimeout
        : LLM_JUDGE_DEFAULT_TIMEOUT_MS;

    // Judge LLM — 결정성 옵션 고정.
    this.judgeLlm = factory.createFor({
      provider,
      model,
      apiKey,
      baseUrl,
      temperature: LLM_JUDGE_TEMPERATURE,
      seed: LLM_JUDGE_SEED,
      topK: LLM_JUDGE_TOP_K,
    });

    // Fixer LLM — consensus-005 §커밋1-3 (A 지적): fixer 도 동일 결정성 옵션 주입.
    // 별도 인스턴스지만 옵션 동일.
    const fixerLlm = factory.createFor({
      provider,
      model,
      apiKey,
      baseUrl,
      temperature: LLM_JUDGE_TEMPERATURE,
      seed: LLM_JUDGE_SEED,
      topK: LLM_JUDGE_TOP_K,
    });

    // StructuredOutputParser.fromZodSchema 의 InteropZodType 제약은 bundled zod 타입
    // 기준. 런타임 동작은 동일하므로 로컬 zod schema 를 unknown 경유로 투영.
    this.parser = StructuredOutputParser.fromZodSchema(
      JUDGE_OUTPUT_SCHEMA as unknown as never,
    ) as unknown as BaseOutputParser<JudgeOutput>;
    this.fixingParser = OutputFixingParser.fromLLM<JudgeOutput>(
      fixerLlm.getModel() as never,
      this.parser,
    );
  }

  async grade(input: Layer3GradeInput): Promise<LayerVerdict> {
    // 1. 경계 태그 — nonce 매 호출 신선.
    const nonce = randomUUID();
    const openTag = `<student_answer id="${nonce}">`;
    const closeTag = `</student_answer id="${nonce}">`;
    const studentAnswerTagged = `${openTag}\n${input.studentAnswer}\n${closeTag}`;

    // 2. Prompt resolve (Langfuse 우선, 실패 시 local fallback).
    let resolved: ResolvedEvaluationPrompt;
    try {
      resolved = await this.promptManager.getEvaluationPrompt(
        LLM_JUDGE_PROMPT_NAME,
        LLM_JUDGE_PROMPT_VERSION,
      );
    } catch (err) {
      this.logger.warn(
        `Layer 3 prompt resolution failed: ${redactErrorMessage(err)}`,
      );
      return this.unknownFallback(
        'Layer 3 prompt resolution failed',
        { source: 'local', version: LLM_JUDGE_PROMPT_VERSION, name: LLM_JUDGE_PROMPT_NAME } as ResolvedEvaluationPrompt,
      );
    }

    // 3. Prompt 변수 주입.
    const formatInstructions = this.parser.getFormatInstructions();
    const suspiciousFlags =
      input.sanitizationFlags.length > 0
        ? input.sanitizationFlags.join(',')
        : 'none';
    let messages: BaseMessage[];
    try {
      messages = (await resolved.template.formatMessages({
        expected: input.expected.join('\n'),
        student_answer_tagged: studentAnswerTagged,
        suspicious_flags: suspiciousFlags,
        format_instructions: formatInstructions,
      })) as BaseMessage[];
    } catch (err) {
      this.logger.warn(
        `Layer 3 prompt format failed: ${redactErrorMessage(err)}`,
      );
      return this.unknownFallback('Layer 3 prompt format failed', resolved);
    }

    // 4. LLM 호출.
    // consensus-007 C2-1: sessionId 가 주어지면 Langfuse trace metadata 로 전파.
    // ADR-016 §7 화이트리스트 4종 중 session_id 만 사용 — userId 파생정보 불가.
    // consensus-007 C2-5: LLM_JUDGE_TIMEOUT_MS (기본 8000ms) 초과 시 LlmJudgeTimeoutError.
    // timeout 에러는 surface (unknownFallback 안 함) — 상위 GameSessionService 가
    // gradingMethod='held' persist + ops_event_log(llm_timeout) + HTTP 503 처리.
    const invokeOpts = input.sessionId
      ? { metadata: { session_id: input.sessionId } }
      : undefined;
    let responseText: string;
    try {
      const response = await withLlmJudgeTimeout(
        this.judgeLlm.invoke(messages, invokeOpts),
        this.timeoutMs,
      );
      responseText =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
    } catch (err) {
      if (err instanceof LlmJudgeTimeoutError) {
        // 상위 경로가 감사 체인·HTTP 응답 책임. 여기선 로깅만.
        this.logger.warn(
          `Layer 3 LLM timeout after ${err.timeoutMs}ms (elapsed=${err.elapsedMs ?? '?'}ms)`,
        );
        throw err;
      }
      this.logger.warn(
        `Layer 3 LLM invocation failed: ${redactErrorMessage(err)}`,
      );
      return this.unknownFallback('Layer 3 LLM invocation failed', resolved);
    }

    // 5. 구조화 파싱 (+ fixer retry).
    let parsed: JudgeOutput;
    try {
      parsed = await this.fixingParser.parse(responseText);
    } catch (err) {
      this.logger.warn(
        `Layer 3 structured output parse failed: ${redactErrorMessage(err)}`,
      );
      return this.unknownFallback(
        'Layer 3 structured output parse failed after fixer retry',
        resolved,
      );
    }

    // 6. rationale 최종 truncate (LLM이 500자 규칙을 준수하지 않은 경우 보강).
    const rationale =
      parsed.rationale.length > RATIONALE_MAX_LENGTH
        ? parsed.rationale.slice(0, RATIONALE_MAX_LENGTH)
        : parsed.rationale;

    return {
      verdict: parsed.verdict as GradingVerdict,
      confidence: parsed.confidence,
      rationale,
      graderDigest: this.buildDigest(resolved),
    };
  }

  private unknownFallback(
    reason: string,
    resolved: ResolvedEvaluationPrompt,
  ): LayerVerdict {
    return {
      verdict: 'UNKNOWN',
      rationale: reason,
      graderDigest: this.buildDigest(resolved),
    };
  }

  private buildDigest(resolved: ResolvedEvaluationPrompt): string {
    const modelDigestFull = this.safeGetModelDigest();
    const modelShort = sha8(modelDigestFull);
    const base = `prompt:${resolved.name}:v${resolved.version}|model:${modelShort}|parser:${LLM_JUDGE_PARSER_VERSION}|temp:0|seed:${LLM_JUDGE_SEED}|topk:${LLM_JUDGE_TOP_K}`;
    if (resolved.source === 'local') {
      const tpl = EVALUATION_FREE_FORM_SQL_PROMPT;
      const localHash = sha8(tpl.systemTemplate + '\n' + tpl.userTemplate);
      return `${base}|local-${localHash}`;
    }
    return base;
  }

  private safeGetModelDigest(): string {
    try {
      return this.digestProvider.getDigest();
    } catch {
      return 'unverified';
    }
  }
}

function sha8(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 8);
}
