import { z } from 'zod';

/**
 * AI 문제 생성 출력 스키마 (단일 진실 소스).
 *
 * 본 모듈은 두 곳에서 import된다:
 *   1. apps/api/src/modules/ai/ai-question-generator.ts (운영 — StructuredOutputParser)
 *   2. apps/api/src/modules/ai/eval/assertions/zod-schema.ts (평가 — MT2)
 *
 * **운영 일관성 원칙** (SDD v2 §7.2 v2.3 patch):
 *   평가 경로가 운영 경로와 동일해야 평가 결과가 운영 동작을 그대로 예측 가능.
 *   AQG가 사용하는 schema와 promptfoo MT2 assertion이 사용하는 schema가
 *   동일해야 하므로 본 모듈로 단일화한다. 한쪽만 갱신되면 평가가 운영을
 *   거짓 예측하게 되어 합격선의 신뢰성이 무너진다.
 *
 * 두 스키마는 `questionContentSchema`(packages/shared)와는 다른 점:
 *   - LLM 출력은 `type` 필드 없이 평탄화된 구조 (운영 코드가 모드별로 type을 부여)
 *   - 평가 보조용 `answer`(정답 토큰 배열) + `explanation` 필드를 함께 요구
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §3.1 MT2)
 */

export const blankTypingOutputSchema = z.object({
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
  answer: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
});

export const termMatchOutputSchema = z.object({
  description: z.string().min(1),
  category: z.string().optional(),
  answer: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
});

/**
 * 객관식 LLM 출력 스키마 (ADR-012 Mode 6).
 *
 * 운영 매핑: correctOptionIds → Question.answer (option id 배열 그대로).
 * Question.content 는 { type: 'multiple-choice', stem, options, allowMultiple? }
 * 로 조립된다 (type 필드는 AQG가 부여).
 *
 * 검증 순서 (계산적 → 추론적, 헌법 §3):
 *   1. 본 Zod 스키마로 구조 검증
 *   2. AQG 가 correctOptionIds ⊆ options[].id 확인
 *   3. options[].id 고유성 확인
 *   4. allowMultiple=false 또는 unset일 때 correctOptionIds.length === 1
 *   5. ScopeValidator 로 stem + options[].text + explanation 검증
 */
export const multipleChoiceOutputSchema = z.object({
  stem: z.string().min(1),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
      }),
    )
    .min(2),
  correctOptionIds: z.array(z.string().min(1)).min(1),
  allowMultiple: z.boolean().optional(),
  explanation: z.string().min(1),
});

export type BlankTypingOutput = z.infer<typeof blankTypingOutputSchema>;
export type TermMatchOutput = z.infer<typeof termMatchOutputSchema>;
export type MultipleChoiceOutput = z.infer<typeof multipleChoiceOutputSchema>;
