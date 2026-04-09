import { Injectable, Logger } from '@nestjs/common';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { z } from 'zod';
import type {
  BlankTypingContent,
  Difficulty,
  GameModeId,
  TermMatchContent,
  Topic,
} from '@oracle-game/shared';
import { questionContentSchema } from '@oracle-game/shared';

import { LlmClient } from './llm-client';
import { PromptManager } from './prompt-manager';
import {
  blankTypingOutputSchema,
  termMatchOutputSchema,
} from './eval/output-schemas';
import { QuestionEntity } from '../content/entities/question.entity';
import {
  QuestionPoolService,
  type SaveQuestionInput,
} from '../content/services/question-pool.service';
import { ScopeValidatorService } from '../content/services/scope-validator.service';
import { WeeklyScopeEntity } from '../content/entities/weekly-scope.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

/**
 * AI 문제 생성기 (SDD §4.3 + ADR-009).
 *
 * 전체 파이프라인:
 *  1. PromptManager에서 게임 모드별 ChatPromptTemplate 로드
 *     (Langfuse fetch 우선, 실패 시 로컬 fallback)
 *  2. weekly_scope에서 누적 키워드 화이트리스트 조회
 *  3. count 회수만큼 LLM 호출:
 *     a. LangChain StructuredOutputParser로 출력 스키마 정의
 *     b. PromptTemplate.formatMessages(...) → messages
 *     c. LlmClient.invoke(messages) (Langfuse callback 자동 부착)
 *     d. parser.parse(rawText) → 구조화된 객체
 *     e. Zod questionContentSchema로 컨텐츠 검증
 *     f. ScopeValidator로 화이트리스트 매칭
 *     g. 모두 통과 시 QuestionPoolService.save(status='pending_review')
 *  4. 단계 a~f 중 어떤 단계라도 실패하면 해당 결과는 폐기 (count 미달 가능)
 *  5. 최종적으로 저장된 Question[]를 반환
 *
 * 향후 강화:
 *  - 폐기된 결과에 대한 1회 재시도 (이번 PR에서는 단순화)
 *  - 중복 검사 (SDD §4.4 ③)
 */

export interface AiGenerationInput {
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  difficulty: Difficulty;
  count: number;
}

export interface AiGenerationResult {
  saved: QuestionEntity[];
  attempted: number;
  rejected: Array<{ reason: string; raw?: string }>;
}

@Injectable()
export class AiQuestionGenerator {
  private readonly logger = new Logger(AiQuestionGenerator.name);

  constructor(
    private readonly llm: LlmClient,
    private readonly prompts: PromptManager,
    private readonly pool: QuestionPoolService,
    private readonly scopeValidator: ScopeValidatorService,
    @InjectRepository(WeeklyScopeEntity)
    private readonly scopeRepo: Repository<WeeklyScopeEntity>,
  ) {}

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    if (input.count < 1 || input.count > 20) {
      throw new Error('count는 1~20 사이여야 합니다');
    }
    if (input.gameMode !== 'blank-typing' && input.gameMode !== 'term-match') {
      throw new Error(
        `현재 AI 생성은 blank-typing, term-match만 지원합니다 (received: ${input.gameMode})`,
      );
    }

    const allowedKeywords = await this.fetchAllowedKeywords(input.topic, input.week);
    if (allowedKeywords.length === 0) {
      throw new Error(
        `주차 ${input.week}, 주제 ${input.topic}의 weekly_scope가 비어있습니다. 시드 또는 노션 import를 먼저 실행하세요.`,
      );
    }

    const result: AiGenerationResult = { saved: [], attempted: 0, rejected: [] };

    for (let i = 0; i < input.count; i += 1) {
      result.attempted += 1;
      try {
        const saved = await this.generateOne(input, allowedKeywords);
        result.saved.push(saved);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`generation #${i + 1} 폐기: ${reason}`);
        result.rejected.push({ reason });
      }
    }

    this.logger.log(
      `AI 생성 완료: saved=${result.saved.length}/${result.attempted}, rejected=${result.rejected.length}`,
    );
    return result;
  }

  private async generateOne(
    input: AiGenerationInput,
    allowedKeywords: string[],
  ): Promise<QuestionEntity> {
    const promptTemplate = await this.prompts.getGenerationPrompt(input.gameMode);

    const parser = this.makeParser(input.gameMode);
    const formatInstructions = parser.getFormatInstructions();

    const messages = await promptTemplate.formatMessages({
      topic: input.topic,
      week: input.week,
      difficulty: input.difficulty,
      allowedKeywords: allowedKeywords.join(', '),
      format_instructions: formatInstructions,
    });

    const response = await this.llm.invoke(
      messages.map((m) =>
        m.getType() === 'system'
          ? new SystemMessage(String(m.content))
          : new HumanMessage(String(m.content)),
      ),
    );

    const rawText =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    let parsed: unknown;
    try {
      parsed = await parser.parse(rawText);
    } catch (err) {
      throw new Error(
        `output parser 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 모드별로 직접 조립 (Pick<QuestionEntity, ...>를 거치면 DeepPartial과
    // 결합되어 TS2589 발생, 따라서 인라인 + content 변수에 명시 타입).
    let content: BlankTypingContent | TermMatchContent;
    let answer: string[];
    let explanation: string;

    if (input.gameMode === 'blank-typing') {
      const p = parsed as z.infer<typeof blankTypingOutputSchema>;
      content = { type: 'blank-typing', sql: p.sql, blanks: p.blanks };
      answer = p.answer;
      explanation = p.explanation;
    } else {
      const p = parsed as z.infer<typeof termMatchOutputSchema>;
      content = {
        type: 'term-match',
        description: p.description,
        category: p.category,
      };
      answer = p.answer;
      explanation = p.explanation;
    }

    // Zod content 검증 (계산적 검증 — 헌법 §3)
    const contentResult = questionContentSchema.safeParse(content);
    if (!contentResult.success) {
      throw new Error(
        `Zod content 검증 실패: ${JSON.stringify(contentResult.error.issues)}`,
      );
    }

    // ScopeValidator (계산적 키워드 매칭)
    const textsToValidate: string[] = [];
    if (content.type === 'blank-typing') {
      textsToValidate.push(content.sql);
    } else {
      textsToValidate.push(content.description);
    }
    textsToValidate.push(answer.join(' '));

    for (const text of textsToValidate) {
      const v = await this.scopeValidator.validateText(text, input.week, input.topic);
      if (!v.valid) {
        throw new Error(
          `화이트리스트 위반: out-of-scope=${v.outOfScope.join(', ')}`,
        );
      }
    }

    // pending_review 상태로 저장. SaveQuestionInput을 명시 변수에 담아
    // object literal 추론을 끊는다 (직접 인자로 넘기면 TS2589 재발).
    const saveInput: SaveQuestionInput = {
      topic: input.topic,
      week: input.week,
      gameMode: input.gameMode,
      difficulty: input.difficulty,
      content,
      answer,
      explanation: explanation ?? null,
      status: 'pending_review',
      source: 'ai-realtime',
    };
    return this.pool.save(saveInput);
  }

  /**
   * StructuredOutputParser는 generic이 깊어 fromZodSchema에 정확한 ZodObject
   * 타입을 그대로 넘기면 TS2589 발생. schema를 `any`로 캐스팅해 generic만
   * 우회하고, fromZodSchema 자체는 정적 메서드 호출을 유지한다 (함수 참조를
   * 떼어내면 내부 `new this(...)`의 this 컨텍스트가 손실되어 런타임에 깨짐).
   *
   * 호출 site에서는 getFormatInstructions / parse 두 개만 사용하므로
   * 결과를 narrow 인터페이스로 좁힌다.
   */
  private makeParser(gameMode: GameModeId): {
    getFormatInstructions(): string;
    parse(text: string): Promise<unknown>;
  } {
    const schema =
      gameMode === 'blank-typing'
        ? blankTypingOutputSchema
        : termMatchOutputSchema;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return StructuredOutputParser.fromZodSchema(schema as any) as {
      getFormatInstructions(): string;
      parse(text: string): Promise<unknown>;
    };
  }

  private async fetchAllowedKeywords(topic: Topic, week: number): Promise<string[]> {
    const scopes = await this.scopeRepo.find({
      where: { topic, week: LessThanOrEqual(week) },
    });
    const set = new Set<string>();
    for (const scope of scopes) {
      for (const kw of scope.keywords) {
        set.add(kw.toUpperCase());
      }
    }
    return [...set];
  }
}
