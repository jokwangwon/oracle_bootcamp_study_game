import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Langfuse } from 'langfuse';

import {
  EVALUATION_PROMPTS_BY_NAME,
  GENERATION_PROMPTS_BY_MODE,
  type PromptTemplate,
} from './prompts';

/**
 * 평가 프롬프트 조회 결과.
 *
 * - `source='langfuse'` — Langfuse 에서 fetch 성공. 해당 version 으로 pin 된 상태.
 * - `source='local'` — Langfuse fetch 실패 또는 키 미설정. 로컬 fallback 사용.
 *   LlmJudgeGrader 는 이 경우 `grader_digest` 에 `local-{sha256_8}` 접미사를
 *   추가해야 한다 (consensus-005 §커밋1-4).
 */
export interface ResolvedEvaluationPrompt {
  template: ChatPromptTemplate;
  source: 'langfuse' | 'local';
  /** 요청된 version (pin). Langfuse 미설정/fetch 실패여도 동일 version 반환. */
  version: number;
  name: string;
}

/**
 * 프롬프트 관리자 (ADR-009 §강제 사항 2번).
 *
 * 책임:
 *  - 프롬프트를 코드 외부에서 가져온다 (Langfuse Prompt Management 우선)
 *  - Langfuse fetch 실패 시 로컬 정의로 fallback (warning log)
 *  - LangChain ChatPromptTemplate 형식으로 반환하여 generator가 그대로 사용
 *
 * 운영 정책:
 *  - 첫 부팅 시 Langfuse에 prompt가 없으면 로컬 fallback이 동작 (개발 친화)
 *  - 운영자는 Langfuse Cloud에서 동일 이름의 prompt를 등록하면 즉시 적용
 *  - 프롬프트 변경은 코드 배포 없이 Langfuse에서 가능
 */
@Injectable()
export class PromptManager {
  private readonly logger = new Logger(PromptManager.name);
  private readonly langfuse: Langfuse | null;

  constructor(private readonly config: ConfigService) {
    const publicKey = this.config.get<string>('LANGFUSE_PUBLIC_KEY');
    const secretKey = this.config.get<string>('LANGFUSE_SECRET_KEY');
    const baseUrl =
      this.config.get<string>('LANGFUSE_HOST') ?? 'https://cloud.langfuse.com';

    if (publicKey && secretKey) {
      this.langfuse = new Langfuse({ publicKey, secretKey, baseUrl });
    } else {
      this.langfuse = null;
      this.logger.warn(
        'Langfuse 키 미설정 — 모든 prompt가 로컬 fallback으로 동작합니다',
      );
    }
  }

  /**
   * 게임 모드에 해당하는 생성 프롬프트를 ChatPromptTemplate으로 반환.
   *
   * 흐름:
   *  1. Langfuse에서 동일 이름의 prompt fetch 시도
   *  2. fetch 성공 시: Langfuse prompt를 사용 (코드 변경 없이 갱신 가능)
   *  3. fetch 실패 시: 로컬 fallback 사용 + warning 로그 (개발 환경 호환)
   */
  async getGenerationPrompt(
    promptKey: keyof typeof GENERATION_PROMPTS_BY_MODE,
  ): Promise<ChatPromptTemplate> {
    const localTemplate = GENERATION_PROMPTS_BY_MODE[promptKey];
    if (!localTemplate) {
      throw new NotFoundException(
        `'${promptKey}'에 해당하는 prompt 정의가 없습니다`,
      );
    }

    const langfuseTemplate = await this.tryFetchFromLangfuse(localTemplate.name);

    if (langfuseTemplate) {
      this.logger.log(`prompt '${localTemplate.name}' loaded from Langfuse`);
      return ChatPromptTemplate.fromMessages([
        ['system', langfuseTemplate.system],
        ['user', langfuseTemplate.user],
      ]);
    }

    this.logger.log(
      `prompt '${localTemplate.name}' loaded from local fallback (Langfuse miss)`,
    );
    return ChatPromptTemplate.fromMessages([
      ['system', localTemplate.systemTemplate],
      ['user', localTemplate.userTemplate],
    ]);
  }

  /**
   * 평가(Layer 3 LLM-judge) 프롬프트 조회.
   *
   * consensus-005 §커밋1-4 — Langfuse `getPrompt(name, version)` **숫자 버전 pin 필수**.
   * 재현성 확보를 위해 version 은 호출자가 명시 지정해야 한다.
   *
   * 반환은 `{ template, source, version, name }` — source 가 'local' 이면
   * Langfuse 미설정/fetch 실패. LlmJudgeGrader 에서 digest 접미사 분기에 사용.
   *
   * fetch 실패는 throw 하지 않고 로컬 fallback 으로 복귀 (개발 환경 호환).
   */
  async getEvaluationPrompt(
    name: string,
    version: number,
  ): Promise<ResolvedEvaluationPrompt> {
    const localTemplate = EVALUATION_PROMPTS_BY_NAME[name];
    if (!localTemplate) {
      throw new NotFoundException(
        `'${name}'에 해당하는 평가 프롬프트 정의가 없습니다 (local fallback 부재)`,
      );
    }

    const langfuseTemplate = await this.tryFetchEvaluationFromLangfuse(
      name,
      version,
    );

    if (langfuseTemplate) {
      this.logger.log(
        `evaluation prompt '${name}' v${version} loaded from Langfuse`,
      );
      return {
        template: ChatPromptTemplate.fromMessages([
          ['system', langfuseTemplate.system],
          ['user', langfuseTemplate.user],
        ]),
        source: 'langfuse',
        version,
        name,
      };
    }

    this.logger.log(
      `evaluation prompt '${name}' v${version} loaded from local fallback (Langfuse miss)`,
    );
    return {
      template: ChatPromptTemplate.fromMessages([
        ['system', localTemplate.systemTemplate],
        ['user', localTemplate.userTemplate],
      ]),
      source: 'local',
      version,
      name,
    };
  }

  private async tryFetchEvaluationFromLangfuse(
    name: string,
    version: number,
  ): Promise<{ system: string; user: string } | null> {
    if (!this.langfuse) {
      return null;
    }

    try {
      const prompt = await this.langfuse.getPrompt(name, version);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (prompt as any).prompt;
      if (Array.isArray(raw)) {
        const systemMsg = raw.find((m: { role: string }) => m.role === 'system');
        const userMsg = raw.find((m: { role: string }) => m.role === 'user');
        if (systemMsg?.content && userMsg?.content) {
          return { system: systemMsg.content, user: userMsg.content };
        }
      }
      this.logger.warn(
        `Langfuse evaluation prompt '${name}' v${version}가 예상 형식(chat: system+user)이 아닙니다 — 로컬 fallback 사용`,
      );
      return null;
    } catch (err) {
      this.logger.warn(
        `Langfuse evaluation prompt '${name}' v${version} fetch 실패 (${err instanceof Error ? err.message : String(err)}) — 로컬 fallback 사용`,
      );
      return null;
    }
  }

  /**
   * Langfuse에서 동일 이름의 prompt를 조회한다.
   *
   * Langfuse prompt format은 "text" 또는 "chat" 두 가지가 있는데, 여기서는
   * 우리가 직접 등록하는 chat prompt만 처리한다. chat prompt가 system/user
   * 두 개의 메시지를 가진다고 가정한다 (단순한 규약 — 운영 시 일관 유지).
   *
   * fetch 실패는 throw하지 않고 null을 반환하여 fallback이 동작하도록 한다.
   */
  private async tryFetchFromLangfuse(
    name: string,
  ): Promise<{ system: string; user: string } | null> {
    if (!this.langfuse) {
      return null;
    }

    try {
      const prompt = await this.langfuse.getPrompt(name);
      // Langfuse는 ChatPrompt와 TextPrompt 두 종류를 반환할 수 있다.
      // 우리 규약: chat 형식, [{role:'system', content}, {role:'user', content}]
      // 예외 상황(text prompt 등)은 fallback으로 처리.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (prompt as any).prompt;
      if (Array.isArray(raw)) {
        const systemMsg = raw.find((m: { role: string }) => m.role === 'system');
        const userMsg = raw.find((m: { role: string }) => m.role === 'user');
        if (systemMsg?.content && userMsg?.content) {
          return { system: systemMsg.content, user: userMsg.content };
        }
      }
      this.logger.warn(
        `Langfuse prompt '${name}'가 예상 형식(chat: system+user)이 아닙니다 — 로컬 fallback 사용`,
      );
      return null;
    } catch (err) {
      this.logger.warn(
        `Langfuse prompt '${name}' fetch 실패 (${err instanceof Error ? err.message : String(err)}) — 로컬 fallback 사용`,
      );
      return null;
    }
  }
}
