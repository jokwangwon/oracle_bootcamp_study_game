import { describe, expect, it } from 'vitest';

import zodSchemaAssertion from './zod-schema';
import type { AssertionContext } from './types';

/**
 * MT2 — Zod 스키마 통과율 (SDD v2 §3.1).
 *
 * 본 assertion은 LLM 출력이 운영 코드(`AiQuestionGenerator`)가 사용하는
 * 동일 schema(`eval/output-schemas.ts`)를 통과하는지 확인한다.
 * 운영 일관성 원칙 (SDD v2 §7.2 v2.3 patch).
 */

function ctx(gameMode: 'blank-typing' | 'term-match'): AssertionContext {
  return {
    prompt: 'test',
    vars: {
      gameMode,
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: ['SELECT', 'FROM', 'WHERE'],
      seedFocusKeyword: 'SELECT',
    },
  };
}

const VALID_BLANK = JSON.stringify({
  sql: '___ ENAME FROM EMP;',
  blanks: [{ position: 0, answer: 'SELECT', hint: '조회 키워드' }],
  answer: ['SELECT'],
  explanation: 'SELECT은 컬럼을 조회하는 가장 기본적인 키워드입니다.',
});

const VALID_TERM = JSON.stringify({
  description: '조회된 결과에서 중복된 행을 제거하는 키워드',
  category: '키워드',
  answer: ['DISTINCT'],
  explanation: 'DISTINCT는 SELECT 결과의 중복을 제거합니다.',
});

describe('MT2 zodSchemaAssertion', () => {
  it('blank-typing: 유효한 출력은 pass', async () => {
    const result = await zodSchemaAssertion(VALID_BLANK, ctx('blank-typing'));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('term-match: 유효한 출력은 pass', async () => {
    const result = await zodSchemaAssertion(VALID_TERM, ctx('term-match'));
    expect(result.pass).toBe(true);
  });

  it('blank-typing: blanks가 빈 배열이면 fail', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP;',
      blanks: [],
      answer: ['SELECT'],
      explanation: '...',
    });
    const result = await zodSchemaAssertion(raw, ctx('blank-typing'));
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/MT2/);
  });

  it('term-match: description 없으면 fail', async () => {
    const raw = JSON.stringify({
      answer: ['DISTINCT'],
      explanation: '...',
    });
    const result = await zodSchemaAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(false);
  });

  it('JSON 파싱 자체가 안 되면 fail (MT1과 중복이지만 독립 검증)', async () => {
    const result = await zodSchemaAssertion('not json', ctx('blank-typing'));
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/JSON/);
  });

  it('지원하지 않는 게임 모드는 fail (방어적)', async () => {
    const result = await zodSchemaAssertion(
      VALID_BLANK,
      // @ts-expect-error — 의도적으로 지원하지 않는 모드 주입
      { ...ctx('blank-typing'), vars: { ...ctx('blank-typing').vars, gameMode: 'scenario' } },
    );
    expect(result.pass).toBe(false);
  });
});
