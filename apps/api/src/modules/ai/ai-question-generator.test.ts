import { describe, expect, it } from 'vitest';
import { AIMessage } from '@langchain/core/messages';

import { AiQuestionGenerator } from './ai-question-generator';
import { PromptManager } from './prompt-manager';
import { ScopeValidatorService } from '../content/services/scope-validator.service';
import type { QuestionEntity } from '../content/entities/question.entity';
import type { WeeklyScopeEntity } from '../content/entities/weekly-scope.entity';

/**
 * AiQuestionGenerator 단위 테스트.
 *
 * Mock 전략:
 *  - LlmClient: invoke()를 사전 응답 배열로 stub (FakeLlmClient)
 *  - PromptManager: 실제 인스턴스 사용. LANGFUSE_* 키 없이 생성하면
 *    Langfuse 인스턴스를 만들지 않으므로 vi.mock 불필요.
 *    (vi.mock('langfuse')를 hoist하면 langchain core import에 부작용이 생겨
 *    SystemMessage/HumanMessage가 'not a constructor'로 깨지는 현상이 있다.)
 *  - ScopeValidatorService: 실제 인스턴스 + FakeScopeRepo
 *  - QuestionPoolService: FakePool (save만 구현, in-memory)
 *  - WeeklyScopeRepo: 동일 FakeScopeRepo 재사용
 *
 * 검증 대상 파이프라인:
 *   LLM 응답 → parser → Zod → ScopeValidator → save
 * 어떤 단계라도 실패하면 결과는 rejected에, 통과하면 saved에 들어간다.
 */

class FakeLlmClient {
  callIndex = 0;
  constructor(private readonly responses: string[]) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async invoke(_messages: any[]) {
    const text = this.responses[this.callIndex] ?? '';
    this.callIndex += 1;
    return new AIMessage(text);
  }

  // 다른 메서드는 generator에서 호출되지 않음
}

class FakeScopeRepo {
  scopes: WeeklyScopeEntity[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async find({ where }: any) {
    const maxWeek = where.week?._value ?? where.week;
    return this.scopes.filter((s) => s.week <= maxWeek && s.topic === where.topic);
  }
}

class FakePool {
  saved: QuestionEntity[] = [];

  async save(input: Partial<QuestionEntity>): Promise<QuestionEntity> {
    const entity = {
      id: `q-${this.saved.length + 1}`,
      createdAt: new Date(),
      ...input,
    } as QuestionEntity;
    this.saved.push(entity);
    return entity;
  }
}

class FakeConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = string>(_key: string): T {
    return undefined as unknown as T;
  }
}

function makeGenerator(opts: { llmResponses: string[]; keywords: string[] }) {
  const llm = new FakeLlmClient(opts.llmResponses);
  // PromptManager는 키 없는 config로 → 로컬 fallback 사용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompts = new PromptManager(new FakeConfig() as any);

  const scopeRepo = new FakeScopeRepo();
  scopeRepo.scopes.push({
    id: '1',
    week: 1,
    topic: 'sql-basics',
    keywords: opts.keywords,
    sourceUrl: null,
    createdAt: new Date(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scopeValidator = new ScopeValidatorService(scopeRepo as any);
  const pool = new FakePool();

  const generator = new AiQuestionGenerator(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    llm as any,
    prompts,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pool as any,
    scopeValidator,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scopeRepo as any,
  );

  return { generator, llm, pool, scopeRepo };
}

const VALID_BLANK_TYPING_RESPONSE = JSON.stringify({
  sql: '___ ENAME FROM EMP;',
  blanks: [{ position: 0, answer: 'SELECT', hint: '조회 키워드' }],
  answer: ['SELECT'],
  explanation: 'SELECT은 조회 키워드입니다',
});

const OUT_OF_SCOPE_BLANK_TYPING_RESPONSE = JSON.stringify({
  sql: '___ ENAME FROM EMP WHERE NVL(COMM, 0) > 0;', // NVL은 화이트리스트 밖
  blanks: [{ position: 0, answer: 'SELECT', hint: '조회 키워드' }],
  answer: ['SELECT'],
  explanation: 'NVL을 사용한 잘못된 예시',
});

const INVALID_JSON_RESPONSE = 'this is not a valid json at all';

const VALID_MC_RESPONSE = JSON.stringify({
  stem: 'DEPTNO 컬럼의 NULL 값을 필터링하려면 어떻게 작성합니까?',
  options: [
    { id: 'A', text: 'WHERE DEPTNO IS NULL' },
    { id: 'B', text: 'WHERE DEPTNO NULL' },
    { id: 'C', text: 'SELECT DEPTNO' },
    { id: 'D', text: 'FROM DEPTNO' },
  ],
  correctOptionIds: ['A'],
  explanation: 'IS NULL 연산자만 NULL 비교에 사용합니다',
});

const MC_MULTI_ANSWER_RESPONSE = JSON.stringify({
  stem: '데이터 조작 명령어를 모두 고르시오.',
  options: [
    { id: 'A', text: 'SELECT' },
    { id: 'B', text: 'INSERT' },
    { id: 'C', text: 'CREATE' },
    { id: 'D', text: 'UPDATE' },
  ],
  correctOptionIds: ['A', 'B', 'D'],
  allowMultiple: true,
  explanation: 'SELECT INSERT UPDATE DELETE 는 데이터 조작 명령어입니다',
});

const MC_DUPLICATE_ID_RESPONSE = JSON.stringify({
  stem: 'SELECT 문의 절 순서는?',
  options: [
    { id: 'A', text: 'SELECT FROM WHERE' },
    { id: 'A', text: 'SELECT WHERE FROM' },
  ],
  correctOptionIds: ['A'],
  explanation: '...',
});

const MC_INVALID_CORRECT_ID_RESPONSE = JSON.stringify({
  stem: 'SELECT 문의 절 순서는?',
  options: [
    { id: 'A', text: 'SELECT FROM' },
    { id: 'B', text: 'FROM SELECT' },
  ],
  correctOptionIds: ['X'],
  explanation: '...',
});

const MC_SINGLE_BUT_MULTI_CORRECT_RESPONSE = JSON.stringify({
  stem: '어느 것이 DML입니까?',
  options: [
    { id: 'A', text: 'SELECT' },
    { id: 'B', text: 'INSERT' },
  ],
  correctOptionIds: ['A', 'B'],
  explanation: '...',
});

const MC_OUT_OF_SCOPE_RESPONSE = JSON.stringify({
  stem: 'NULL을 다른 값으로 치환하려면?',
  options: [
    { id: 'A', text: 'NVL(COMM, 0)' }, // NVL not in whitelist
    { id: 'B', text: 'SELECT COMM' },
    { id: 'C', text: 'FROM COMM' },
    { id: 'D', text: 'WHERE COMM' },
  ],
  correctOptionIds: ['A'],
  explanation: 'NVL은 null을 대체합니다',
});

describe('AiQuestionGenerator.generate', () => {
  describe('입력 검증', () => {
    it('count < 1 이면 throw', async () => {
      const { generator } = makeGenerator({ llmResponses: [], keywords: ['SELECT'] });
      await expect(
        generator.generate({
          topic: 'sql-basics',
          week: 1,
          gameMode: 'blank-typing',
          difficulty: 'EASY',
          count: 0,
        }),
      ).rejects.toThrow(/count/);
    });

    it('count > 20 이면 throw', async () => {
      const { generator } = makeGenerator({ llmResponses: [], keywords: ['SELECT'] });
      await expect(
        generator.generate({
          topic: 'sql-basics',
          week: 1,
          gameMode: 'blank-typing',
          difficulty: 'EASY',
          count: 21,
        }),
      ).rejects.toThrow(/count/);
    });

    it('지원하지 않는 게임 모드는 throw', async () => {
      const { generator } = makeGenerator({ llmResponses: [], keywords: ['SELECT'] });
      await expect(
        generator.generate({
          topic: 'sql-basics',
          week: 1,
          gameMode: 'scenario',
          difficulty: 'EASY',
          count: 1,
        }),
      ).rejects.toThrow(/scenario/);
    });

    it('weekly_scope가 비어있으면 throw', async () => {
      const { generator } = makeGenerator({ llmResponses: [], keywords: [] });
      await expect(
        generator.generate({
          topic: 'sql-basics',
          week: 1,
          gameMode: 'blank-typing',
          difficulty: 'EASY',
          count: 1,
        }),
      ).rejects.toThrow(/weekly_scope/);
    });
  });

  describe('생성 파이프라인', () => {
    it('정상 응답 1개면 saved=1, rejected=0', async () => {
      const { generator, pool } = makeGenerator({
        llmResponses: [VALID_BLANK_TYPING_RESPONSE],
        keywords: ['SELECT', 'FROM', 'EMP', 'ENAME'],
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.attempted).toBe(1);
      expect(result.saved).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);

      const saved = pool.saved[0];
      expect(saved.gameMode).toBe('blank-typing');
      expect(saved.status).toBe('pending_review'); // SDD §4.4 ④
      expect(saved.source).toBe('ai-realtime');
      expect(saved.answer).toEqual(['SELECT']);
    });

    it('parser 실패(잘못된 JSON) 응답은 폐기되고 rejected에 들어간다', async () => {
      const { generator } = makeGenerator({
        llmResponses: [INVALID_JSON_RESPONSE],
        keywords: ['SELECT', 'FROM', 'EMP', 'ENAME'],
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.attempted).toBe(1);
      expect(result.saved).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toMatch(/parser/);
    });

    it('화이트리스트 위반 응답은 폐기된다 (NVL 미허용)', async () => {
      const { generator, pool } = makeGenerator({
        llmResponses: [OUT_OF_SCOPE_BLANK_TYPING_RESPONSE],
        keywords: ['SELECT', 'FROM', 'EMP', 'ENAME', 'WHERE', 'COMM'],
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.attempted).toBe(1);
      expect(result.saved).toHaveLength(0);
      expect(pool.saved).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toMatch(/화이트리스트/);
      expect(result.rejected[0].reason).toMatch(/NVL/);
    });

    it('count=3 입력 시 일부 통과/일부 폐기 시나리오', async () => {
      const { generator, pool } = makeGenerator({
        llmResponses: [
          VALID_BLANK_TYPING_RESPONSE,
          INVALID_JSON_RESPONSE,
          VALID_BLANK_TYPING_RESPONSE,
        ],
        keywords: ['SELECT', 'FROM', 'EMP', 'ENAME'],
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'blank-typing',
        difficulty: 'EASY',
        count: 3,
      });

      expect(result.attempted).toBe(3);
      expect(result.saved).toHaveLength(2);
      expect(result.rejected).toHaveLength(1);
      expect(pool.saved).toHaveLength(2);
    });
  });

  describe('multiple-choice 분기 (ADR-012)', () => {
    const MC_KEYWORDS = [
      'SELECT',
      'FROM',
      'WHERE',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DEPTNO',
      'COMM',
      'IS',
      'NULL',
    ];

    it('정상 MC 응답은 saved=1이며 answerFormat=multiple-choice, content.type=multiple-choice', async () => {
      const { generator, pool } = makeGenerator({
        llmResponses: [VALID_MC_RESPONSE],
        keywords: MC_KEYWORDS,
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'multiple-choice',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.saved).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);
      const saved = pool.saved[0]!;
      expect(saved.gameMode).toBe('multiple-choice');
      expect(saved.answerFormat).toBe('multiple-choice');
      expect(saved.answer).toEqual(['A']);
      expect((saved.content as { type: string }).type).toBe('multiple-choice');
    });

    it('allowMultiple=true + 복수 정답도 정상 저장', async () => {
      const { generator, pool } = makeGenerator({
        llmResponses: [MC_MULTI_ANSWER_RESPONSE],
        keywords: MC_KEYWORDS,
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'multiple-choice',
        difficulty: 'MEDIUM',
        count: 1,
      });

      expect(result.saved).toHaveLength(1);
      const saved = pool.saved[0]!;
      expect(saved.answer).toEqual(['A', 'B', 'D']);
      const content = saved.content as { allowMultiple?: boolean };
      expect(content.allowMultiple).toBe(true);
    });

    it('options[].id 중복은 폐기된다', async () => {
      const { generator } = makeGenerator({
        llmResponses: [MC_DUPLICATE_ID_RESPONSE],
        keywords: MC_KEYWORDS,
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'multiple-choice',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.saved).toHaveLength(0);
      expect(result.rejected[0]!.reason).toMatch(/options\[\]\.id 중복/);
    });

    it('correctOptionIds가 options에 없는 id를 참조하면 폐기', async () => {
      const { generator } = makeGenerator({
        llmResponses: [MC_INVALID_CORRECT_ID_RESPONSE],
        keywords: MC_KEYWORDS,
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'multiple-choice',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.saved).toHaveLength(0);
      expect(result.rejected[0]!.reason).toMatch(/correctOptionIds/);
    });

    it('allowMultiple=false(미지정)인데 정답이 2개 이상이면 폐기', async () => {
      const { generator } = makeGenerator({
        llmResponses: [MC_SINGLE_BUT_MULTI_CORRECT_RESPONSE],
        keywords: MC_KEYWORDS,
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'multiple-choice',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.saved).toHaveLength(0);
      expect(result.rejected[0]!.reason).toMatch(/allowMultiple/);
    });

    it('option text가 화이트리스트 외 키워드(NVL)를 사용하면 scope 위반으로 폐기', async () => {
      const { generator, pool } = makeGenerator({
        llmResponses: [MC_OUT_OF_SCOPE_RESPONSE],
        keywords: MC_KEYWORDS, // NVL 없음
      });

      const result = await generator.generate({
        topic: 'sql-basics',
        week: 1,
        gameMode: 'multiple-choice',
        difficulty: 'EASY',
        count: 1,
      });

      expect(result.saved).toHaveLength(0);
      expect(pool.saved).toHaveLength(0);
      expect(result.rejected[0]!.reason).toMatch(/화이트리스트/);
      expect(result.rejected[0]!.reason).toMatch(/NVL/);
    });
  });
});
