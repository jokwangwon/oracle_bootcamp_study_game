import { describe, expect, it } from 'vitest';

import blankConsistencyAssertion from './blank-consistency';
import type { AssertionContext } from './types';

/**
 * MT4 — 빈칸-정답 일관성 (SDD v2 §3.1).
 *
 * 정의:
 *  1. blank-typing 모드에서 sql 안의 `___` 개수 == blanks 배열 길이
 *  2. blanks[i].answer는 문자열 타입 (화이트리스트 검증은 MT3 단일 책임)
 *  3. top-level answer 길이도 blanks 길이와 일치해야 한다 (운영 시드 컨벤션)
 *  4. term-match 모드는 본 메트릭의 적용 대상이 아니므로 자동 pass
 *
 * 옵션 2(rationale/oss-eval-failure-analysis-2026-04-14.md) 반영:
 * blanks.answer에 대한 화이트리스트 검증은 제거됨. 리터럴/연산자 정답
 * ("=", ">", "10", "SAL DESC")을 허용하기 위함.
 */

const ALLOWED = ['SELECT', 'FROM', 'WHERE', 'EMP', 'BY', 'ORDER', 'AND', 'OR', 'AS'];

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

describe('MT4 blankConsistencyAssertion', () => {
  it('blank-typing: ___ 1개 + blanks 1개 + answer 1개 → pass', async () => {
    const raw = JSON.stringify({
      sql: '___ ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT'],
      explanation: '...',
    });
    expect((await blankConsistencyAssertion(raw, ctx())).pass).toBe(true);
  });

  it('blank-typing: ___ 2개 + blanks 1개 → fail', async () => {
    const raw = JSON.stringify({
      sql: '___ ENAME ___ EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT'],
      explanation: '...',
    });
    const result = await blankConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/___|blanks/);
  });

  it('blank-typing: 리터럴/연산자 정답("=", "10")도 MT4에서는 pass (화이트리스트는 MT3 책임)', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP WHERE DEPTNO ___ 10;',
      blanks: [{ position: 0, answer: '=' }],
      answer: ['='],
      explanation: '...',
    });
    expect((await blankConsistencyAssertion(raw, ctx())).pass).toBe(true);
  });

  it('blank-typing: blanks[i].answer가 문자열이 아니면 fail', async () => {
    const raw = JSON.stringify({
      sql: '___ ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 42 }],
      answer: ['SELECT'],
      explanation: '...',
    });
    const result = await blankConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/문자열/);
  });

  it('blank-typing: top-level answer 길이가 blanks 길이와 다르면 fail', async () => {
    const raw = JSON.stringify({
      sql: '___ ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT', 'FROM'],
      explanation: '...',
    });
    const result = await blankConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/answer/);
  });

  it('term-match: 본 메트릭 비대상이므로 자동 pass', async () => {
    const raw = JSON.stringify({
      description: '조회',
      answer: ['SELECT'],
      explanation: '...',
    });
    expect((await blankConsistencyAssertion(raw, ctx('term-match'))).pass).toBe(true);
  });

  it('blank-typing: ___이 0개면 fail (빈칸 문제가 아님)', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP;',
      blanks: [],
      answer: [],
      explanation: '...',
    });
    const result = await blankConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
  });

  it('JSON 파싱 실패 시 fail', async () => {
    const result = await blankConsistencyAssertion('not json', ctx());
    expect(result.pass).toBe(false);
  });
});
