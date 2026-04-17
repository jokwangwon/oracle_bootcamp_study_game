import { describe, expect, it } from 'vitest';

import {
  AST_GRADER_VERSION,
  AstCanonicalGrader,
} from './ast-canonical.grader';

/**
 * ADR-013 Layer 1 — AST Canonicalize TDD.
 *
 * 전략:
 *  - node-sql-parser 5.4.0 은 Oracle dialect 미지원 → MySQL → PostgresQL 순차 fallback
 *  - 파싱 성공 시 학생 AST 와 expected AST 들을 구조 비교 (table/column/ast)
 *  - 파싱 실패 시 verdict='UNKNOWN' + astFailureReason 분류 (기록만, 행동 분기는 Session 4)
 *
 * 본 테스트는 방언 8종 실측 매트릭스 + 정규화 5종 + 구조적 엣지케이스 + 결정성을 검증한다.
 */

const grader = new AstCanonicalGrader();

function gradeOnce(studentAnswer: string, expected: readonly string[]) {
  return grader.grade({ studentAnswer, expected });
}

describe('AstCanonicalGrader — 메타데이터', () => {
  it('graderDigest는 ast-v1 상수', () => {
    expect(AST_GRADER_VERSION).toBe('ast-v1');
    const r = gradeOnce('SELECT 1 FROM DUAL', ['SELECT 1 FROM DUAL']);
    expect(r.graderDigest).toBe(AST_GRADER_VERSION);
  });

  it('expected 비어있으면 Error', () => {
    expect(() => gradeOnce('SELECT 1 FROM DUAL', [])).toThrow();
  });
});

describe('AstCanonicalGrader — 네이티브 방언 (MySQL/PG 파싱 가능)', () => {
  it('DUAL 테이블 정답 일치 → PASS', () => {
    const r = gradeOnce('SELECT 1 FROM DUAL', ['SELECT 1 FROM DUAL']);
    expect(r.verdict).toBe('PASS');
  });

  it('ROWNUM 식별자 정답 일치 → PASS', () => {
    const sql = 'SELECT * FROM emp WHERE ROWNUM <= 5';
    const r = gradeOnce(sql, [sql]);
    expect(r.verdict).toBe('PASS');
  });

  it('NVL 함수 정답 일치 → PASS', () => {
    const sql = 'SELECT NVL(comm, 0) FROM emp';
    const r = gradeOnce(sql, [sql]);
    expect(r.verdict).toBe('PASS');
  });

  it('DECODE 함수 정답 일치 → PASS', () => {
    const sql = "SELECT DECODE(deptno, 10, 'A', 'B') FROM emp";
    const r = gradeOnce(sql, [sql]);
    expect(r.verdict).toBe('PASS');
  });
});

describe('AstCanonicalGrader — 정규화 (공백/대소문자/주석/세미콜론/절 순서)', () => {
  it('대소문자 차이만 → PASS (identifier case fold)', () => {
    const r = gradeOnce('select ename from emp', ['SELECT ENAME FROM EMP']);
    expect(r.verdict).toBe('PASS');
  });

  it('공백·탭·개행 차이만 → PASS', () => {
    const r = gradeOnce(
      'SELECT   ename\n  FROM\temp',
      ['SELECT ename FROM emp'],
    );
    expect(r.verdict).toBe('PASS');
  });

  it('주석만 다름 → PASS (주석 제거)', () => {
    const r = gradeOnce(
      'SELECT ename FROM emp /* comment */',
      ['SELECT ename FROM emp'],
    );
    expect(r.verdict).toBe('PASS');
  });

  it('세미콜론 유무만 다름 → PASS', () => {
    const r = gradeOnce('SELECT ename FROM emp;', ['SELECT ename FROM emp']);
    expect(r.verdict).toBe('PASS');
  });

  it('SELECT 프로젝션 순서 다름 → FAIL (프로젝션만 순서 민감 — ADR-013 Line 53)', () => {
    const r = gradeOnce(
      'SELECT sal, ename FROM emp',
      ['SELECT ename, sal FROM emp'],
    );
    expect(r.verdict).toBe('FAIL');
  });
});

describe('AstCanonicalGrader — 구조적 불일치 → FAIL', () => {
  it('테이블 다름 → FAIL', () => {
    const r = gradeOnce(
      'SELECT ename FROM dept',
      ['SELECT ename FROM emp'],
    );
    expect(r.verdict).toBe('FAIL');
  });

  it('컬럼 다름 → FAIL', () => {
    const r = gradeOnce(
      'SELECT sal FROM emp',
      ['SELECT ename FROM emp'],
    );
    expect(r.verdict).toBe('FAIL');
  });

  it('WHERE 술어 다름 → FAIL', () => {
    const r = gradeOnce(
      'SELECT ename FROM emp WHERE deptno = 20',
      ['SELECT ename FROM emp WHERE deptno = 10'],
    );
    expect(r.verdict).toBe('FAIL');
  });
});

describe('AstCanonicalGrader — Oracle 방언 미지원 → UNKNOWN + dialect_unsupported', () => {
  it('CONNECT BY → UNKNOWN + dialect_unsupported', () => {
    const r = gradeOnce(
      'SELECT empno, mgr FROM emp START WITH mgr IS NULL CONNECT BY PRIOR empno = mgr',
      ['SELECT empno, mgr FROM emp START WITH mgr IS NULL CONNECT BY PRIOR empno = mgr'],
    );
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('dialect_unsupported');
  });

  it('(+) outer join → UNKNOWN + dialect_unsupported', () => {
    const r = gradeOnce(
      'SELECT * FROM emp e, dept d WHERE e.deptno = d.deptno(+)',
      ['SELECT * FROM emp e JOIN dept d ON e.deptno = d.deptno'],
    );
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('dialect_unsupported');
  });

  it('LISTAGG WITHIN GROUP → UNKNOWN + dialect_unsupported', () => {
    const sql = "SELECT LISTAGG(ename, ',') WITHIN GROUP (ORDER BY ename) FROM emp";
    const r = gradeOnce(sql, [sql]);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('dialect_unsupported');
  });

  it('MERGE → UNKNOWN + dialect_unsupported', () => {
    const sql =
      'MERGE INTO t1 USING t2 ON (t1.id = t2.id) WHEN MATCHED THEN UPDATE SET t1.v = t2.v';
    const r = gradeOnce(sql, [sql]);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('dialect_unsupported');
  });
});

describe('AstCanonicalGrader — 비-SQL 입력 분류', () => {
  it('빈 문자열 → UNKNOWN + empty_answer', () => {
    const r = gradeOnce('', ['SELECT 1 FROM DUAL']);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('empty_answer');
  });

  it('공백만 → UNKNOWN + empty_answer', () => {
    const r = gradeOnce('   \n\t ', ['SELECT 1 FROM DUAL']);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('empty_answer');
  });

  it('주석 전용 → UNKNOWN + empty_answer', () => {
    const r = gradeOnce('-- todo\n/* nothing */', ['SELECT 1 FROM DUAL']);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('empty_answer');
  });

  it('PL/SQL 블록 (BEGIN...END) → UNKNOWN + non_sql_block', () => {
    const r = gradeOnce('BEGIN NULL; END;', ['SELECT 1 FROM DUAL']);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('non_sql_block');
  });

  it('진짜 문법 오류 (방언 키워드 없음) → UNKNOWN + truly_invalid_syntax', () => {
    const r = gradeOnce('SELEC FROM WHERE', ['SELECT ename FROM emp']);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('truly_invalid_syntax');
  });
});

describe('AstCanonicalGrader — 방어적 동작', () => {
  it('parser throw 시 상위로 전파하지 않음 (반드시 LayerVerdict 반환)', () => {
    const r = gradeOnce('COMPLETELY GARBLED ;;;!!! NONSENSE', [
      'SELECT 1 FROM DUAL',
    ]);
    expect(r.verdict).toBe('UNKNOWN');
    // 반환만 되면 통과 (astFailureReason은 분류 로직에 따라)
  });

  it('모든 expected 파싱 실패 → UNKNOWN + dialect_unsupported (seed CI는 별도 레이어에서 방어)', () => {
    const r = gradeOnce('SELECT ename FROM emp', [
      'SELECT LISTAGG(x) WITHIN GROUP (ORDER BY y) FROM t',
    ]);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.astFailureReason).toBe('dialect_unsupported');
  });

  it('rationale는 사람이 읽을 수 있는 문자열', () => {
    const r = gradeOnce('SELECT 1 FROM DUAL', ['SELECT 1 FROM DUAL']);
    expect(typeof r.rationale).toBe('string');
    expect(r.rationale.length).toBeGreaterThan(0);
  });
});

describe('AstCanonicalGrader — 결정성 (동일 입력 5회 반복 시 동일 판정)', () => {
  const cases: Array<[string, readonly string[]]> = [
    ['SELECT 1 FROM DUAL', ['SELECT 1 FROM DUAL']],
    ['CONNECT BY PRIOR a = b', ['CONNECT BY PRIOR a = b']],
    ['', ['SELECT 1']],
    ['BEGIN NULL; END;', ['SELECT 1']],
    ['SELECT ename FROM emp', ['SELECT sal FROM emp']],
  ];

  it.each(cases)('%s — 5회 반복 시 verdict/astFailureReason 동일', (s, e) => {
    const results = Array.from({ length: 5 }, () => gradeOnce(s, e));
    const first = results[0];
    for (const r of results) {
      expect(r.verdict).toBe(first.verdict);
      expect(r.astFailureReason).toBe(first.astFailureReason);
    }
  });
});

describe('AstCanonicalGrader — 다중 expected (정답 여러 개 중 하나라도 일치하면 PASS)', () => {
  it('두 번째 expected와 일치 → PASS', () => {
    const r = gradeOnce(
      'SELECT ename FROM emp',
      ['SELECT sal FROM emp', 'SELECT ename FROM emp'],
    );
    expect(r.verdict).toBe('PASS');
  });

  it('모든 expected와 불일치 → FAIL', () => {
    const r = gradeOnce(
      'SELECT deptno FROM emp',
      ['SELECT sal FROM emp', 'SELECT ename FROM emp'],
    );
    expect(r.verdict).toBe('FAIL');
  });
});
