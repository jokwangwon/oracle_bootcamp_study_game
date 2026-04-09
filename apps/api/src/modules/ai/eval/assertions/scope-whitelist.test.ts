import { describe, expect, it } from 'vitest';

import scopeWhitelistAssertion from './scope-whitelist';
import type { AssertionContext } from './types';

/**
 * MT3 — 화이트리스트 통과율 (SDD v2 §3.1).
 *
 * 운영의 ScopeValidatorService는 DB-backed (async)지만, promptfoo assertion은
 * pure 함수여야 하므로 본 모듈은 vars.allowedKeywords + extractOracleTokens
 * 만 사용해 동일 정책을 재현한다 (단계 0에서 추출한 oracle-tokens.ts 공유).
 */

const ALLOWED = ['SELECT', 'FROM', 'WHERE', 'EMP', 'DEPT', 'ENAME', 'SAL', 'DEPTNO', 'AS'];

function ctx(gameMode: 'blank-typing' | 'term-match' = 'blank-typing'): AssertionContext {
  return {
    prompt: 'test',
    vars: {
      gameMode,
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: ALLOWED,
      seedFocusKeyword: 'SELECT',
    },
  };
}

describe('MT3 scopeWhitelistAssertion', () => {
  it('blank-typing: 모든 토큰이 화이트리스트 안이면 pass', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP WHERE SAL > 1000;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT'],
      explanation: '...',
    });
    const result = await scopeWhitelistAssertion(raw, ctx());
    expect(result.pass).toBe(true);
  });

  it('blank-typing: 화이트리스트 밖 토큰(NVL)이 있으면 fail + reason에 토큰 노출', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT NVL(COMM, 0) FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT'],
      explanation: 'NVL 사용',
    });
    const result = await scopeWhitelistAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/NVL/);
  });

  it('term-match: description의 토큰만 검사 (sql 없음)', async () => {
    const raw = JSON.stringify({
      description: '결과의 행 수를 세는 집계 함수',
      category: '집계',
      answer: ['COUNT'],
      explanation: '...',
    });
    // COUNT는 화이트리스트 밖 → fail
    const result = await scopeWhitelistAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/COUNT/);
  });

  it('term-match: 한국어 description은 추출 대상이 아니므로 pass', async () => {
    const raw = JSON.stringify({
      description: '테이블에서 행을 선택하는 가장 기본 키워드',
      category: '키워드',
      answer: ['SELECT'],
      explanation: '...',
    });
    const result = await scopeWhitelistAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(true);
  });

  it('JSON 파싱 실패 시 fail (체이닝 불필요 — 본 assertion은 독립적)', async () => {
    const result = await scopeWhitelistAssertion('not json', ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/JSON|파싱/);
  });

  it('answer 배열의 토큰도 검증한다 (정답이 화이트리스트 밖이면 fail)', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['ROWNUM'],   // ROWNUM은 화이트리스트 밖
      explanation: '...',
    });
    const result = await scopeWhitelistAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/ROWNUM/);
  });

  it('대소문자 무시 (allowed가 소문자여도 매칭)', async () => {
    const lowerCtx = ctx();
    lowerCtx.vars.allowedKeywords = ALLOWED.map((k) => k.toLowerCase());
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT'],
      explanation: '...',
    });
    const result = await scopeWhitelistAssertion(raw, lowerCtx);
    expect(result.pass).toBe(true);
  });
});
