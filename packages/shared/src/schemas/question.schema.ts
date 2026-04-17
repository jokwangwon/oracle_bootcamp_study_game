import { z } from 'zod';

/**
 * Zod 스키마: AI가 생성한 문제의 런타임 검증에 사용
 *
 * 헌법 제3조: AI 출력은 반드시 계산적(스키마) 검증을 통과해야 한다.
 */

export const blankTypingContentSchema = z.object({
  type: z.literal('blank-typing'),
  sql: z.string().min(1),
  blanks: z
    .array(
      z.object({
        position: z.number().int().nonnegative(),
        answer: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .min(1),
});

export const termMatchContentSchema = z.object({
  type: z.literal('term-match'),
  description: z.string().min(1),
  category: z.string().optional(),
});

export const resultPredictContentSchema = z.object({
  type: z.literal('result-predict'),
  sql: z.string().min(1),
  options: z.array(z.string()).optional(),
  expectedResult: z.string().min(1),
});

export const categorySortContentSchema = z.object({
  type: z.literal('category-sort'),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        correctCategory: z.string().min(1),
      }),
    )
    .min(2),
  categories: z.array(z.string().min(1)).min(2),
});

export const scenarioContentSchema = z.object({
  type: z.literal('scenario'),
  scenario: z.string().min(1),
  oraError: z.string().optional(),
  steps: z
    .array(
      z.object({
        description: z.string().min(1),
        expectedSql: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .min(1),
});

/**
 * 객관식 콘텐츠 (ADR-012 Mode 6).
 * options[i].id 가 안정 식별자(A/B/C/D), Question.answer는 정답 option id 배열.
 * allowMultiple=false(기본) 시 정답 1개, true 시 2개 이상 허용.
 *
 * 고유 id 제약은 AiQuestionGenerator 에서 별도 검증 (z.discriminatedUnion은
 * ZodObject 원형 멤버만 허용하므로 refine 을 스키마에 붙이지 않는다).
 */
export const multipleChoiceContentSchema = z.object({
  type: z.literal('multiple-choice'),
  stem: z.string().min(1),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
      }),
    )
    .min(2),
  allowMultiple: z.boolean().optional(),
});

export const questionContentSchema = z.discriminatedUnion('type', [
  blankTypingContentSchema,
  termMatchContentSchema,
  resultPredictContentSchema,
  categorySortContentSchema,
  scenarioContentSchema,
  multipleChoiceContentSchema,
]);

export const questionSchema = z.object({
  id: z.string().uuid(),
  topic: z.string(),
  week: z.number().int().positive(),
  gameMode: z.enum([
    'blank-typing',
    'term-match',
    'result-predict',
    'category-sort',
    'scenario',
    'multiple-choice',
  ]),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  content: questionContentSchema,
  answer: z.array(z.string()).min(1),
  explanation: z.string().optional(),
  status: z.enum(['pending_review', 'active', 'rejected', 'archived']),
  source: z.enum(['pre-generated', 'ai-realtime', 'manual']),
  createdAt: z.date(),
});
