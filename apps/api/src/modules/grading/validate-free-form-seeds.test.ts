import { describe, expect, it } from 'vitest';

import { AstCanonicalGrader } from './graders/ast-canonical.grader';
import {
  FREE_FORM_SEED_VALIDATOR_VERSION,
  validateFreeFormSeeds,
  type FreeFormSeedCandidate,
} from './validate-free-form-seeds';

/**
 * ADR-013 Layer 0.5 — 정답 템플릿 seed CI 사전검증 게이트 TDD.
 *
 * 3+1 합의(MVP-B Session 3): Layer 1 AST 파서가 처리할 수 없는 정답 템플릿이
 * 시드에 섞이면 런타임에 학생 답안이 `dialect_unsupported` UNKNOWN으로 강등되어
 * 채점 편향이 발생한다. 본 validator는 **free-form 답안의 모든 expected를**
 * Layer 1 grader에 태워 파싱 가능성을 사전에 검증한다.
 *
 * 정책 (3+1 합의):
 *  - answerFormat='free-form' 이 아닌 시드는 skip (MC/blank-typing/term-match 제외)
 *  - 한 question 의 answer[] 중 **최소 1개 이상**이 Layer 1 파싱 가능해야 pass
 *  - 모두 UNKNOWN → 시드 leakage 로 분류하여 CI 차단
 */

const grader = new AstCanonicalGrader();

function qFreeForm(
  id: string,
  answer: readonly string[],
): FreeFormSeedCandidate {
  return { id, answerFormat: 'free-form', answer };
}

describe('validateFreeFormSeeds — 메타데이터', () => {
  it('버전 상수가 고정', () => {
    expect(FREE_FORM_SEED_VALIDATOR_VERSION).toBe('free-form-seed-validator-v1');
  });
});

describe('validateFreeFormSeeds — 범위 skip', () => {
  it('빈 배열 → checked=0, passed=0, failed=[]', () => {
    const r = validateFreeFormSeeds(grader, []);
    expect(r).toEqual({ checked: 0, passed: 0, failed: [] });
  });

  it('single-token/multiple-choice 만 있음 → 전부 skip', () => {
    const r = validateFreeFormSeeds(grader, [
      { id: 'q1', answerFormat: 'single-token', answer: ['UNPARSEABLE garbage;;;'] },
      { id: 'q2', answerFormat: 'multiple-choice', answer: ['opt-a'] },
      { id: 'q3', answer: ['SELECT'] }, // undefined — 기본 single-token
    ]);
    expect(r.checked).toBe(0);
    expect(r.failed).toEqual([]);
  });
});

describe('validateFreeFormSeeds — pass 케이스', () => {
  it('free-form + 파싱 가능한 answer 하나 → pass', () => {
    const r = validateFreeFormSeeds(grader, [
      qFreeForm('q1', ['SELECT ename FROM emp']),
    ]);
    expect(r.checked).toBe(1);
    expect(r.passed).toBe(1);
    expect(r.failed).toEqual([]);
  });

  it('하나의 answer가 UNKNOWN이라도 다른 하나가 파싱 가능하면 pass', () => {
    const r = validateFreeFormSeeds(grader, [
      qFreeForm('q1', [
        'SELECT LISTAGG(x) WITHIN GROUP (ORDER BY y) FROM t', // dialect_unsupported
        'SELECT ename FROM emp', // 파싱 가능
      ]),
    ]);
    expect(r.checked).toBe(1);
    expect(r.passed).toBe(1);
    expect(r.failed).toEqual([]);
  });

  it('여러 질문이 모두 파싱 가능 → 전체 pass', () => {
    const r = validateFreeFormSeeds(grader, [
      qFreeForm('q1', ['SELECT 1 FROM DUAL']),
      qFreeForm('q2', ['SELECT ename FROM emp WHERE deptno = 10']),
    ]);
    expect(r.checked).toBe(2);
    expect(r.passed).toBe(2);
    expect(r.failed).toEqual([]);
  });
});

describe('validateFreeFormSeeds — fail 케이스', () => {
  it('free-form + answer[] 가 빈 배열 → fail (empty_answer_list)', () => {
    const r = validateFreeFormSeeds(grader, [qFreeForm('q1', [])]);
    expect(r.checked).toBe(1);
    expect(r.passed).toBe(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]).toMatchObject({
      questionId: 'q1',
      reason: 'empty_answer_list',
    });
  });

  it('모든 answer가 dialect_unsupported → fail + 각 answer별 분류', () => {
    const r = validateFreeFormSeeds(grader, [
      qFreeForm('q1', [
        'SELECT empno FROM emp CONNECT BY PRIOR empno = mgr',
        'SELECT * FROM emp e, dept d WHERE e.deptno = d.deptno(+)',
      ]),
    ]);
    expect(r.checked).toBe(1);
    expect(r.passed).toBe(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].questionId).toBe('q1');
    expect(r.failed[0].perAnswerReasons).toEqual([
      'dialect_unsupported',
      'dialect_unsupported',
    ]);
  });

  it('모든 answer가 빈 문자열 → fail + empty_answer 분류', () => {
    const r = validateFreeFormSeeds(grader, [qFreeForm('q1', ['', '   \n'])]);
    expect(r.checked).toBe(1);
    expect(r.passed).toBe(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].perAnswerReasons).toEqual([
      'empty_answer',
      'empty_answer',
    ]);
  });

  it('진짜 문법 오류만 있는 answer → fail + truly_invalid_syntax', () => {
    const r = validateFreeFormSeeds(grader, [
      qFreeForm('q1', ['SELEC FROM WHERE']),
    ]);
    expect(r.checked).toBe(1);
    expect(r.failed[0].perAnswerReasons).toEqual(['truly_invalid_syntax']);
  });
});

describe('validateFreeFormSeeds — 혼합 시나리오', () => {
  it('pass 2건 + fail 1건 → passed=2, failed=[q3]', () => {
    const r = validateFreeFormSeeds(grader, [
      qFreeForm('q1', ['SELECT 1 FROM DUAL']),
      qFreeForm('q2', ['SELECT ename FROM emp']),
      qFreeForm('q3', ['MERGE INTO t USING s ON (t.id=s.id) WHEN MATCHED THEN UPDATE SET t.v=s.v']),
    ]);
    expect(r.checked).toBe(3);
    expect(r.passed).toBe(2);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].questionId).toBe('q3');
  });

  it('free-form과 non-free-form 혼합 → free-form 만 checked', () => {
    const r = validateFreeFormSeeds(grader, [
      { id: 'mc1', answerFormat: 'multiple-choice', answer: ['A'] },
      qFreeForm('ff1', ['SELECT 1 FROM DUAL']),
      { id: 'bt1', answerFormat: 'single-token', answer: ['SELECT'] },
      qFreeForm('ff2', ['BEGIN NULL; END;']),
    ]);
    expect(r.checked).toBe(2);
    expect(r.passed).toBe(1);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].questionId).toBe('ff2');
    expect(r.failed[0].perAnswerReasons).toEqual(['non_sql_block']);
  });
});

describe('validateFreeFormSeeds — 방어', () => {
  it('결정성: 같은 입력 5회 → 동일 결과', () => {
    const input: FreeFormSeedCandidate[] = [
      qFreeForm('q1', ['SELECT 1 FROM DUAL']),
      qFreeForm('q2', ['CONNECT BY PRIOR a = b']),
    ];
    const r0 = validateFreeFormSeeds(grader, input);
    for (let i = 0; i < 4; i += 1) {
      const r = validateFreeFormSeeds(grader, input);
      expect(r).toEqual(r0);
    }
  });

  it('id 누락 → "idx-{n}" 자동 할당', () => {
    const r = validateFreeFormSeeds(grader, [
      { answerFormat: 'free-form', answer: ['COMPLETE GARBAGE'] },
    ]);
    expect(r.failed[0].questionId).toMatch(/^idx-\d+$/);
  });
});
