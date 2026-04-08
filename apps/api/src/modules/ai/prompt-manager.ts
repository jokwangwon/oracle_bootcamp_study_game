import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Langfuse } from 'langfuse';

import { GENERATION_PROMPTS_BY_MODE, type PromptTemplate } from './prompts';

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
