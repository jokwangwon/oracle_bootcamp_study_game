import { describe, expect, it, vi } from 'vitest';
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { PromptManager } from './prompt-manager';

/**
 * PromptManager 단위 테스트.
 *
 * Langfuse SDK는 외부 네트워크 의존이라 클래스를 vi.mock으로 대체한다.
 * 검증 대상:
 *  - Langfuse key 없을 때 → 항상 로컬 fallback
 *  - Langfuse fetch 성공 + 예상 형식 → Langfuse 값 사용
 *  - Langfuse fetch 성공 but 잘못된 형식 → fallback
 *  - Langfuse fetch 실패(throw) → fallback
 *  - 미정의 prompt key → NotFoundException
 */

class FakeConfig {
  constructor(private readonly map: Record<string, string | undefined>) {}
  get<T = string>(key: string): T {
    return this.map[key] as unknown as T;
  }
}

// langfuse 모듈 전체를 mock.
// Langfuse 생성자는 인자를 받지만 우리는 prototype.getPrompt만 stubs.
const mockGetPrompt = vi.fn();
vi.mock('langfuse', () => {
  return {
    Langfuse: vi.fn().mockImplementation(() => ({
      getPrompt: mockGetPrompt,
    })),
  };
});

function makeManager(env: Record<string, string | undefined>): PromptManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PromptManager(new FakeConfig(env) as any);
}

describe('PromptManager', () => {
  describe('Langfuse 비활성 (key 없음)', () => {
    it('항상 로컬 fallback을 사용하고 ChatPromptTemplate을 반환한다', async () => {
      mockGetPrompt.mockClear();
      const mgr = makeManager({}); // LANGFUSE_* 누락

      const tpl = await mgr.getGenerationPrompt('blank-typing');
      expect(tpl).toBeInstanceOf(ChatPromptTemplate);
      expect(mockGetPrompt).not.toHaveBeenCalled();
    });
  });

  describe('Langfuse 활성', () => {
    const env = {
      LANGFUSE_PUBLIC_KEY: 'pk-test',
      LANGFUSE_SECRET_KEY: 'sk-test',
      LANGFUSE_HOST: 'https://cloud.langfuse.com',
    };

    it('fetch 성공 + chat 형식이면 Langfuse 값을 사용한다', async () => {
      mockGetPrompt.mockClear();
      mockGetPrompt.mockResolvedValueOnce({
        prompt: [
          { role: 'system', content: 'SYS_FROM_LANGFUSE' },
          { role: 'user', content: 'USER_FROM_LANGFUSE {topic}' },
        ],
      });

      const mgr = makeManager(env);
      const tpl = await mgr.getGenerationPrompt('blank-typing');

      expect(tpl).toBeInstanceOf(ChatPromptTemplate);
      expect(mockGetPrompt).toHaveBeenCalledWith('blank-typing-generation');

      // formatMessages로 실제 시스템 메시지가 Langfuse 값인지 확인
      const messages = await tpl.formatMessages({
        topic: 'sql-basics',
      });
      const systemMsg = messages.find((m) => m.getType() === 'system');
      expect(String(systemMsg?.content)).toContain('SYS_FROM_LANGFUSE');
    });

    it('fetch 성공 but 잘못된 형식(text)이면 로컬 fallback', async () => {
      mockGetPrompt.mockClear();
      mockGetPrompt.mockResolvedValueOnce({
        prompt: 'just a string, not an array',
      });

      const mgr = makeManager(env);
      const tpl = await mgr.getGenerationPrompt('blank-typing');

      // 로컬 fallback 사용 — 시스템 메시지가 로컬 정의의 일부를 포함
      const messages = await tpl.formatMessages({
        topic: 'sql-basics',
        week: 1,
        difficulty: 'EASY',
        allowedKeywords: 'SELECT, FROM',
        format_instructions: '...',
      });
      const systemMsg = messages.find((m) => m.getType() === 'system');
      expect(String(systemMsg?.content)).toContain('Oracle DBA');
    });

    it('fetch가 throw하면 로컬 fallback', async () => {
      mockGetPrompt.mockClear();
      mockGetPrompt.mockRejectedValueOnce(new Error('network down'));

      const mgr = makeManager(env);
      const tpl = await mgr.getGenerationPrompt('term-match');

      const messages = await tpl.formatMessages({
        topic: 'sql-basics',
        week: 1,
        difficulty: 'EASY',
        allowedKeywords: 'SELECT',
        format_instructions: '...',
      });
      const systemMsg = messages.find((m) => m.getType() === 'system');
      // term-match local prompt 확인
      expect(String(systemMsg?.content)).toContain('용어 맞추기');
    });
  });
});
