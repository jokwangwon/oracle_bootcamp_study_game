import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AnswerSanitizer } from './answer-sanitizer';
import { AstCanonicalGrader } from './graders/ast-canonical.grader';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import { LlmJudgeGrader } from './graders/llm-judge.grader';
import { GradingModule } from './grading.module';
import {
  GradingOrchestrator,
  LAYER_1_GRADER,
  LAYER_3_GRADER,
} from './grading.orchestrator';

/**
 * consensus-007 S6-C2-3 — GradingModule AppModule 등록 wiring smoke test.
 *
 * Session 1 부터 격리되어 있던 GradingModule 을 AppModule imports 로 복귀.
 * AppModule 을 직접 import 하면 ConfigModule 이 즉시 env 검증을 실행해 unhandled
 * error 가 발생하므로, **소스 파일 grep 방식의 정적 가드**로 등록 여부를 확인.
 * 실 부팅 smoke 는 staging 실측으로 대체 (consensus-007 Q5 관측 gate).
 */

function getMetadata<T>(key: string, target: object): T | undefined {
  return Reflect.getMetadata(key, target) as T | undefined;
}

describe('GradingModule wiring (consensus-007 S6-C2-3)', () => {
  it('AppModule 소스가 GradingModule 을 import + 등록한다 (정적 가드)', () => {
    const src = readFileSync(
      resolve(__dirname, '../../app.module.ts'),
      'utf8',
    );
    expect(src).toMatch(/import\s+\{\s*GradingModule\s*\}\s+from\s+['"]\.\/modules\/grading\/grading\.module['"]/);
    expect(src).toMatch(/(^|\s)GradingModule,/m);
  });

  it('GradingModule providers 에 4 Grader + Orchestrator + 토큰이 모두 포함', () => {
    const providers = getMetadata<unknown[]>('providers', GradingModule);
    expect(providers).toBeDefined();

    const classProviders = (providers ?? []).filter(
      (p): p is new (...args: unknown[]) => unknown => typeof p === 'function',
    );
    expect(classProviders).toContain(AnswerSanitizer);
    expect(classProviders).toContain(AstCanonicalGrader);
    expect(classProviders).toContain(KeywordCoverageGrader);
    expect(classProviders).toContain(LlmJudgeGrader);
    expect(classProviders).toContain(GradingOrchestrator);

    // Layer 1/3 토큰 바인딩 (useExisting) 존재 확인
    const tokenBindings = (providers ?? []).filter(
      (p): p is { provide: unknown } =>
        typeof p === 'object' && p !== null && 'provide' in (p as object),
    );
    const provideSymbols = tokenBindings.map((p) => p.provide);
    expect(provideSymbols).toContain(LAYER_1_GRADER);
    expect(provideSymbols).toContain(LAYER_3_GRADER);
  });

  it('GradingModule exports 에 Orchestrator + 4 Grader 포함 (소비자 노출)', () => {
    const exportsList = getMetadata<unknown[]>('exports', GradingModule);
    expect(exportsList).toBeDefined();
    expect(exportsList).toContain(AnswerSanitizer);
    expect(exportsList).toContain(AstCanonicalGrader);
    expect(exportsList).toContain(KeywordCoverageGrader);
    expect(exportsList).toContain(LlmJudgeGrader);
    expect(exportsList).toContain(GradingOrchestrator);
  });

  it('GradingModule imports 에 AiModule 이 포함 (LlmJudgeGrader 의존)', async () => {
    const imports = getMetadata<unknown[]>('imports', GradingModule);
    expect(imports).toBeDefined();
    // AiModule class reference 비교 — dynamic import 로 순환 참조 회피
    const { AiModule } = await import('../ai/ai.module');
    expect(imports).toContain(AiModule);
  });
});
