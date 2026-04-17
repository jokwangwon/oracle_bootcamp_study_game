import { Module } from '@nestjs/common';

import { AnswerSanitizer } from './answer-sanitizer';

/**
 * GradingModule — 작성형 답안 채점 파이프라인 (ADR-013 + ADR-016).
 *
 * 현재 상태 (MVP-B Session 1):
 *  - AnswerSanitizer 제공 (ADR-016 §2)
 *  - Layer 1 (AST) / Layer 2 (Keyword) / Layer 3 (LLM-judge) 및 Orchestrator는
 *    후속 세션에서 도입
 *  - AppModule에 등록되지 않음 → 아직 게임 흐름에 영향 없음. 작성형 분기가
 *    활성화되는 MVP-B 마지막 단계(GameSessionService 배선)에서 등록 예정
 *
 * exports를 통해 외부에서 AnswerSanitizer를 단독으로 소비할 수 있음
 * (향후 Notion Stage 2 LLM 정리 단계에서도 재사용 예정 — ADR-016 정합).
 */
@Module({
  providers: [AnswerSanitizer],
  exports: [AnswerSanitizer],
})
export class GradingModule {}
