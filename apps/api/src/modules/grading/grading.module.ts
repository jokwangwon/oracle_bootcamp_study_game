import { Module } from '@nestjs/common';

import { AnswerSanitizer } from './answer-sanitizer';
import { AstCanonicalGrader } from './graders/ast-canonical.grader';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import { GradingOrchestrator, LAYER_1_GRADER } from './grading.orchestrator';

/**
 * GradingModule — 작성형 답안 채점 파이프라인 (ADR-013 + ADR-016).
 *
 * 현재 상태 (MVP-B Session 3, 커밋 1):
 *  - AnswerSanitizer 제공 (ADR-016 §2)
 *  - AstCanonicalGrader (Layer 1) → LAYER_1_GRADER 토큰 바인딩
 *  - KeywordCoverageGrader (Layer 2) 제공
 *  - GradingOrchestrator 제공 — Layer 3(LLM)은 default UNKNOWN stub 유지
 *  - AppModule에 등록되지 않음 → 아직 게임 흐름에 영향 없음
 *
 * 후속 세션:
 *  - Session 4: Layer 3 LlmJudgeGrader → LAYER_3_GRADER 토큰 provider 추가
 *  - Session 6: GameSessionService 배선 + AppModule 등록
 */
@Module({
  providers: [
    AnswerSanitizer,
    AstCanonicalGrader,
    { provide: LAYER_1_GRADER, useExisting: AstCanonicalGrader },
    KeywordCoverageGrader,
    GradingOrchestrator,
  ],
  exports: [
    AnswerSanitizer,
    AstCanonicalGrader,
    KeywordCoverageGrader,
    GradingOrchestrator,
  ],
})
export class GradingModule {}
