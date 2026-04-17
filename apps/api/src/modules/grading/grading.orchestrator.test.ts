import { describe, expect, it, vi } from 'vitest';

import { AnswerSanitizer } from './answer-sanitizer';
import { KeywordCoverageGrader } from './graders/keyword-coverage.grader';
import {
  GradingOrchestrator,
  ORCHESTRATOR_VERSION,
} from './grading.orchestrator';
import type { LayerVerdict } from './grading.types';

/**
 * ADR-013 — Orchestrator 통합 테스트.
 *
 * 현재 세션 범위:
 *  - Layer 1 (AST): 주입된 stub이 UNKNOWN 반환하면 Layer 2로 넘어감
 *  - Layer 2 (Keyword): 실 KeywordCoverageGrader 호출
 *  - Layer 3 (LLM): 주입된 stub이 UNKNOWN 반환하면 gradingMethod='held'로
 *    확정 (관리자 큐 이관)
 *
 * 후속 세션에서 Layer 1/3 실제 grader로 교체 — 본 orchestrator API는 안정화.
 */

const ALLOWLIST = ['SELECT', 'FROM', 'WHERE', 'EMP', 'ENAME', 'SAL', 'DEPTNO'];

function makeOrchestrator(opts: {
  layer1?: LayerVerdict;
  layer3?: LayerVerdict;
} = {}) {
  const sanitizer = new AnswerSanitizer();
  const keywordGrader = new KeywordCoverageGrader();
  // Layer 1/3 은 아직 구현되지 않아 placeholder. 기본값은 UNKNOWN → 다음 Layer로 이관
  const layer1 = {
    grade: vi.fn().mockReturnValue(
      opts.layer1 ?? {
        verdict: 'UNKNOWN',
        rationale: 'Layer 1 not implemented',
        graderDigest: 'ast-not-implemented',
      },
    ),
  };
  const layer3 = {
    grade: vi.fn().mockResolvedValue(
      opts.layer3 ?? {
        verdict: 'UNKNOWN',
        rationale: 'Layer 3 not implemented',
        graderDigest: 'llm-not-implemented',
      },
    ),
  };
  return {
    orchestrator: new GradingOrchestrator(
      sanitizer,
      keywordGrader,
      layer1 as never,
      layer3 as never,
    ),
    layer1,
    layer3,
  };
}

describe('GradingOrchestrator', () => {
  it('Layer 1이 PASS 반환 시 Layer 2/3 호출 안 함 + ast 경로', async () => {
    const { orchestrator, layer1 } = makeOrchestrator({
      layer1: {
        verdict: 'PASS',
        confidence: 1,
        rationale: 'AST 구조 동일',
        graderDigest: 'ast-v1',
      },
    });
    const result = await orchestrator.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.partialScore).toBe(1);
    expect(result.gradingMethod).toBe('ast');
    expect(result.gradingLayersUsed).toEqual([1]);
    expect(result.graderDigest).toBe('ast-v1');
    expect(layer1.grade).toHaveBeenCalledOnce();
  });

  it('Layer 1이 FAIL 반환 시 즉시 FAIL + Layer 2/3 호출 안 함', async () => {
    const { orchestrator, layer3 } = makeOrchestrator({
      layer1: {
        verdict: 'FAIL',
        confidence: 0,
        rationale: 'AST 구조 불일치',
        graderDigest: 'ast-v1',
      },
    });
    const result = await orchestrator.grade({
      studentAnswer: 'DROP TABLE EMP',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.partialScore).toBe(0);
    expect(result.gradingMethod).toBe('ast');
    expect(result.gradingLayersUsed).toEqual([1]);
    expect(layer3.grade).not.toHaveBeenCalled();
  });

  it('Layer 1=UNKNOWN, Layer 2=PASS → keyword 경로 [1,2]', async () => {
    const { orchestrator, layer3 } = makeOrchestrator({
      // layer1 default UNKNOWN
    });
    const result = await orchestrator.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.gradingMethod).toBe('keyword');
    expect(result.gradingLayersUsed).toEqual([1, 2]);
    expect(layer3.grade).not.toHaveBeenCalled();
  });

  it('Layer 1=UNKNOWN, Layer 2=FAIL → keyword 경로 [1,2]', async () => {
    const { orchestrator, layer3 } = makeOrchestrator({});
    const result = await orchestrator.grade({
      studentAnswer: 'DROP TABLE USERS',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.gradingMethod).toBe('keyword');
    expect(result.gradingLayersUsed).toEqual([1, 2]);
    expect(layer3.grade).not.toHaveBeenCalled();
  });

  it('Layer 1/2=UNKNOWN, Layer 3=PASS → llm 경로 [1,2,3]', async () => {
    const { orchestrator } = makeOrchestrator({
      layer3: {
        verdict: 'PASS',
        confidence: 0.9,
        rationale: 'LLM: 의미 동치 확인',
        graderDigest: 'llm-qwen3:ca06e9e4',
      },
    });
    // Layer 2가 UNKNOWN이 되도록 중간 coverage 입력
    const result = await orchestrator.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP WHERE DEPTNO = 10 ORDER BY SAL'],
      allowlist: ALLOWLIST,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.gradingMethod).toBe('llm');
    expect(result.gradingLayersUsed).toEqual([1, 2, 3]);
    expect(result.graderDigest).toBe('llm-qwen3:ca06e9e4');
  });

  it('Layer 1/2/3 모두 UNKNOWN → held (관리자 큐)', async () => {
    const { orchestrator } = makeOrchestrator({});
    const result = await orchestrator.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP WHERE DEPTNO = 10 ORDER BY SAL'],
      allowlist: ALLOWLIST,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.gradingMethod).toBe('held');
    expect(result.gradingLayersUsed).toEqual([1, 2, 3]);
  });

  it('sanitizationFlags가 있으면 결과에 전달', async () => {
    const { orchestrator } = makeOrchestrator({
      layer1: {
        verdict: 'PASS',
        confidence: 1,
        rationale: 'x',
        graderDigest: 'ast-v1',
      },
    });
    const result = await orchestrator.grade({
      studentAnswer:
        '<script>alert(1)</script>SELECT ENAME FROM EMP -- ignore previous',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    expect(result.sanitizationFlags).toContain('SUSPICIOUS_INPUT');
  });

  it('Layer들이 받는 studentAnswer는 sanitize된 값', async () => {
    const { orchestrator, layer1 } = makeOrchestrator({
      layer1: {
        verdict: 'PASS',
        confidence: 1,
        rationale: 'x',
        graderDigest: 'ast-v1',
      },
    });
    await orchestrator.grade({
      studentAnswer: '<script>bad</script>SELECT 1',
      expected: ['SELECT 1'],
      allowlist: ['SELECT'],
    });
    const call = layer1.grade.mock.calls[0]![0] as { studentAnswer: string };
    expect(call.studentAnswer).not.toContain('<script>');
    expect(call.studentAnswer).toContain('SELECT 1');
  });

  it('rationale에 사용된 모든 Layer의 근거가 연결되어 있다', async () => {
    const { orchestrator } = makeOrchestrator({});
    const result = await orchestrator.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP WHERE DEPTNO = 10 ORDER BY SAL'],
      allowlist: ALLOWLIST,
    });
    // Layer 1 UNKNOWN → Layer 2 UNKNOWN → Layer 3 UNKNOWN → held
    expect(result.rationale).toMatch(/Layer 1/);
    expect(result.rationale).toMatch(/Layer 2/i);
    expect(result.rationale).toMatch(/Layer 3|held/);
  });

  it('ORCHESTRATOR_VERSION 상수 노출 (감사용)', () => {
    expect(ORCHESTRATOR_VERSION).toMatch(/^orchestrator-v/);
  });
});
