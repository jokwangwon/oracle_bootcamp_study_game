import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AnswerSanitizer } from './answer-sanitizer';
import { AstCanonicalGrader } from './graders/ast-canonical.grader';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import { LlmJudgeGrader } from './graders/llm-judge.grader';
import {
  GradingOrchestrator,
  LAYER_1_GRADER,
  LAYER_3_GRADER,
} from './grading.orchestrator';

/**
 * GradingModule — 작성형 답안 채점 파이프라인 (ADR-013 + ADR-016).
 *
 * 현재 상태 (MVP-B Session 4, 커밋 3):
 *  - AnswerSanitizer 제공 (ADR-016 §2)
 *  - AstCanonicalGrader (Layer 1) → LAYER_1_GRADER 토큰 바인딩
 *  - KeywordCoverageGrader (Layer 2) 제공
 *  - **LlmJudgeGrader (Layer 3) → LAYER_3_GRADER 토큰 바인딩** (Session 4 커밋 3)
 *  - GradingOrchestrator 제공
 *  - **AppModule에 아직 등록되지 않음** → 게임 흐름 회귀 0 유지.
 *    Session 6 에서 GameSessionService answerFormat='free-form' 분기와 함께 배선.
 *
 * AiModule import 이유:
 *  - LlmJudgeGrader 가 LlmClientFactory / PromptManager / ModelDigestProvider 의존
 */
@Module({
  imports: [AiModule],
  providers: [
    AnswerSanitizer,
    AstCanonicalGrader,
    { provide: LAYER_1_GRADER, useExisting: AstCanonicalGrader },
    KeywordCoverageGrader,
    LlmJudgeGrader,
    { provide: LAYER_3_GRADER, useExisting: LlmJudgeGrader },
    GradingOrchestrator,
  ],
  exports: [
    AnswerSanitizer,
    AstCanonicalGrader,
    KeywordCoverageGrader,
    LlmJudgeGrader,
    GradingOrchestrator,
  ],
})
export class GradingModule {}
