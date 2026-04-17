import { describe, expect, it } from 'vitest';

import {
  KEYWORD_GRADER_VERSION,
  KeywordCoverageGrader,
} from './keyword-coverage.grader';

/**
 * ADR-013 Layer 2 — Keyword/Token Coverage TDD.
 *
 * 알고리즘:
 *  T_expected = extractOracleTokens(expected[*] 합침)
 *  T_student  = extractOracleTokens(studentAnswer)
 *  coverage = |T_expected ∩ T_student| / |T_expected|
 *  extra_penalty = |T_student \ allowlist| * 0.05
 *  partial_score = max(0, coverage - extra_penalty)
 *
 * 판정:
 *  partial_score ≥ 0.95 → PASS
 *  partial_score < 0.3  → FAIL
 *  그 외                 → UNKNOWN (AMBIGUOUS → Layer 3로 올림)
 */

const ALLOWLIST = [
  'SELECT',
  'FROM',
  'WHERE',
  'EMP',
  'DEPT',
  'ENAME',
  'SAL',
  'DEPTNO',
  'AND',
  'OR',
  'IS',
  'NULL',
  'ORDER',
  'BY',
];

describe('KeywordCoverageGrader', () => {
  const grader = new KeywordCoverageGrader();

  it('학생 답안이 정답과 완전 동일 → PASS + confidence=1', () => {
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    expect(result.verdict).toBe('PASS');
    expect(result.confidence).toBe(1);
    expect(result.graderDigest).toBe(KEYWORD_GRADER_VERSION);
  });

  it('순서만 다르고 토큰은 모두 포함 → PASS (Layer 2는 구조 무관)', () => {
    const result = grader.grade({
      studentAnswer: 'FROM EMP SELECT ENAME',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    // coverage = |{SELECT,ENAME,FROM,EMP} ∩ {FROM,EMP,SELECT,ENAME}| / 4 = 1.0
    expect(result.verdict).toBe('PASS');
  });

  it('학생 답안이 정답의 핵심 토큰을 절반만 포함 → FAIL (coverage ~0.5 < 0.95)', () => {
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME',
      expected: ['SELECT ENAME FROM EMP WHERE DEPTNO = 10'],
      allowlist: ALLOWLIST,
    });
    // T_expected = {SELECT, ENAME, FROM, EMP, WHERE, DEPTNO}  (6)
    // T_student = {SELECT, ENAME} (2)
    // coverage = 2/6 ≈ 0.33 → FAIL threshold 0.3 경계 (0.33 > 0.3이라 UNKNOWN)
    expect(['FAIL', 'UNKNOWN']).toContain(result.verdict);
  });

  it('학생 답안이 관련 없는 토큰만 포함 → FAIL', () => {
    const result = grader.grade({
      studentAnswer: 'DROP TABLE USERS',
      expected: ['SELECT ENAME FROM EMP WHERE DEPTNO = 10'],
      allowlist: ALLOWLIST,
    });
    // coverage = 0 → partial_score < 0.3 → FAIL
    expect(result.verdict).toBe('FAIL');
    expect(result.confidence).toBe(0);
  });

  it('중간 수준 coverage (0.3 ≤ score < 0.95) → UNKNOWN (Layer 3 요청)', () => {
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP WHERE DEPTNO = 10 ORDER BY SAL'],
      allowlist: ALLOWLIST,
    });
    // T_expected = {SELECT, ENAME, FROM, EMP, WHERE, DEPTNO, ORDER, BY, SAL} (9)
    // T_student = {SELECT, ENAME, FROM, EMP} (4)
    // coverage = 4/9 ≈ 0.44 → UNKNOWN
    expect(result.verdict).toBe('UNKNOWN');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.confidence).toBeLessThan(0.95);
  });

  it('화이트리스트 외 토큰 다수 사용 → penalty 적용하여 점수 하락', () => {
    // T_expected = {SELECT, ENAME, FROM, EMP}
    // T_student = {SELECT, ENAME, FROM, EMP, NVL, COALESCE, TRUNC}
    // coverage = 4/4 = 1.0
    // extra = |{NVL, COALESCE, TRUNC}| = 3, penalty = 3 * 0.05 = 0.15
    // partial_score = 1.0 - 0.15 = 0.85 → UNKNOWN
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP WHERE COL = NVL(COALESCE(X, Y), TRUNC(Z))',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    expect(result.verdict).toBe('UNKNOWN');
    expect(result.confidence).toBeLessThan(0.95);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('학생 답안에 extra 토큰이 있어도 화이트리스트 안이면 penalty 없음', () => {
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP ORDER BY SAL',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    // coverage = 4/4 = 1.0, ORDER/BY/SAL는 allowlist에 있음 → penalty 0
    expect(result.verdict).toBe('PASS');
  });

  it('복수 정답 중 하나와 매치 → T_expected는 합집합 (관대)', () => {
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: [
        'SELECT ENAME FROM EMP',
        'SELECT * FROM EMP', // 별칭 정답
      ],
      allowlist: ALLOWLIST,
    });
    // T_expected = {SELECT, ENAME, FROM, EMP} (합집합, * 은 토큰 아님)
    // T_student = {SELECT, ENAME, FROM, EMP}
    // coverage = 4/4 = 1.0
    expect(result.verdict).toBe('PASS');
  });

  it('정답이 비어있으면 예외 (잘못된 호출)', () => {
    expect(() =>
      grader.grade({ studentAnswer: 'SELECT', expected: [], allowlist: ALLOWLIST }),
    ).toThrow(/expected/);
  });

  it('학생 답안이 빈 문자열 → FAIL (coverage 0)', () => {
    const result = grader.grade({
      studentAnswer: '',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    expect(result.verdict).toBe('FAIL');
  });

  it('rationale에 coverage 수치 포함 (감사용)', () => {
    const result = grader.grade({
      studentAnswer: 'SELECT ENAME FROM EMP',
      expected: ['SELECT ENAME FROM EMP'],
      allowlist: ALLOWLIST,
    });
    expect(result.rationale).toMatch(/coverage/i);
    expect(result.rationale).toMatch(/1\.0/);
  });

  it('graderDigest는 KEYWORD_GRADER_VERSION 상수 그대로', () => {
    const result = grader.grade({
      studentAnswer: 'x',
      expected: ['SELECT'],
      allowlist: ALLOWLIST,
    });
    expect(result.graderDigest).toBe(KEYWORD_GRADER_VERSION);
  });

  it('T_expected가 0개 (추출 실패) → UNKNOWN (자체 판정 불가)', () => {
    // 숫자만 있는 정답은 extractOracleTokens가 토큰 0개 반환
    const result = grader.grade({
      studentAnswer: 'SELECT 1',
      expected: ['1'],
      allowlist: ALLOWLIST,
    });
    expect(result.verdict).toBe('UNKNOWN');
    expect(result.rationale).toMatch(/토큰|token/i);
  });
});
