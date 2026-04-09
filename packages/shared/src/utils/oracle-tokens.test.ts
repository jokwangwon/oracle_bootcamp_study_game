import { describe, it, expect } from 'vitest';

import { ORACLE_TOKEN_REGEX, extractOracleTokens } from './oracle-tokens';

/**
 * Oracle 토큰 추출 유틸 — 단위 테스트.
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §3.1 MT4 + 단계 0)
 *
 * 이 함수는 다음 3곳에서 재사용된다:
 *  1. ScopeValidator (런타임 화이트리스트 검증)
 *  2. seed.data.test.ts (시드 빌드 전 검증)
 *  3. eval/assertions/blank-consistency.ts (평가 메트릭 MT4)
 *
 * 따라서 동작이 변하면 세 사용처의 의미가 동시에 변한다.
 */
describe('extractOracleTokens', () => {
  it('빈 문자열은 빈 배열을 반환한다', () => {
    expect(extractOracleTokens('')).toEqual([]);
  });

  it('단일 Oracle 키워드를 추출한다', () => {
    expect(extractOracleTokens('SELECT')).toEqual(['SELECT']);
  });

  it('여러 키워드가 섞인 SQL에서 대문자 토큰만 추출한다', () => {
    expect(extractOracleTokens('SELECT name FROM users WHERE id = 1')).toEqual([
      'SELECT',
      'FROM',
      'WHERE',
    ]);
  });

  it('1글자 대문자는 추출하지 않는다 (2글자 이상 정책)', () => {
    expect(extractOracleTokens('A B C')).toEqual([]);
  });

  it('언더스코어를 포함한 식별자를 추출한다', () => {
    expect(extractOracleTokens('ROW_NUMBER() OVER (ORDER BY id)')).toEqual([
      'ROW_NUMBER',
      'OVER',
      'ORDER',
      'BY',
    ]);
  });

  it('숫자를 포함한 식별자를 추출한다 (VARCHAR2)', () => {
    expect(extractOracleTokens('column1 VARCHAR2(100) NOT NULL')).toEqual([
      'VARCHAR2',
      'NOT',
      'NULL',
    ]);
  });

  it('소문자만 있는 텍스트는 빈 배열을 반환한다', () => {
    expect(extractOracleTokens('select * from users')).toEqual([]);
  });

  it('한글과 영어가 섞인 텍스트에서 영어 대문자 토큰만 추출한다', () => {
    expect(extractOracleTokens('데이터를 SELECT하고 FROM 절에 명시한다')).toEqual([
      'SELECT',
      'FROM',
    ]);
  });

  it('중복된 토큰은 등장한 만큼 모두 반환한다 (중복 제거는 호출 측 책임)', () => {
    expect(extractOracleTokens('SELECT a, SELECT b')).toEqual(['SELECT', 'SELECT']);
  });

  it('소문자가 섞인 식별자(camelCase)는 추출하지 않는다', () => {
    expect(extractOracleTokens('SelectStatement myTable')).toEqual([]);
  });

  it('대문자 + 숫자만으로 구성된 식별자는 추출한다 (예: T1)', () => {
    // 정책: 첫 글자 대문자 + 그 다음 [A-Z_0-9] 1자 이상
    expect(extractOracleTokens('FROM T1, T2')).toEqual(['FROM', 'T1', 'T2']);
  });
});

describe('ORACLE_TOKEN_REGEX', () => {
  it('global 플래그를 가진다 (match() 호출 시 모든 토큰 반환)', () => {
    expect(ORACLE_TOKEN_REGEX.flags).toContain('g');
  });

  it('기존 ScopeValidator/seed.data.test.ts 와 동일한 패턴이다', () => {
    // 기존 두 사용처에 박혀있던 정규식의 source
    expect(ORACLE_TOKEN_REGEX.source).toBe('\\b[A-Z][A-Z_0-9]{1,}\\b');
  });
});
