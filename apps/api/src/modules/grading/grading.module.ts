import { Module } from '@nestjs/common';

import { AnswerSanitizer } from './answer-sanitizer';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import { GradingOrchestrator } from './grading.orchestrator';

/**
 * GradingModule — 작성형 답안 채점 파이프라인 (ADR-013 + ADR-016).
 *
 * 현재 상태 (MVP-B Session 2):
 *  - AnswerSanitizer 제공 (ADR-016 §2)
 *  - KeywordCoverageGrader (Layer 2) 제공
 *  - GradingOrchestrator 제공 — Layer 1(AST)/Layer 3(LLM)은 default UNKNOWN stub
 *    주입 상태이므로 실제 호출 시 Layer 2만 기능
 *  - AppModule에 등록되지 않음 → 아직 게임 흐름에 영향 없음
 *
 * 후속 세션:
 *  - Session 3: Layer 1 AstCanonicalGrader → LAYER_1_GRADER 토큰 provider 추가
 *  - Session 4: Layer 3 LlmJudgeGrader → LAYER_3_GRADER 토큰 provider 추가
 *  - Session 6: GameSessionService 배선 + AppModule 등록
 */
@Module({
  providers: [AnswerSanitizer, KeywordCoverageGrader, GradingOrchestrator],
  exports: [AnswerSanitizer, KeywordCoverageGrader, GradingOrchestrator],
})
export class GradingModule {}
