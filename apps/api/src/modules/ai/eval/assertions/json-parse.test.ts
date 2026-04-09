import { describe, expect, it } from 'vitest';

import jsonParseAssertion from './json-parse';
import type { AssertionContext } from './types';

/**
 * MT1 — JSON 파싱 성공률 (SDD v2 §3.1).
 *
 * promptfoo가 LLM 출력 raw 문자열을 넘기면 본 assertion이 마크다운 fenced
 * 블록 우선 → 전체 raw 순으로 JSON.parse를 시도한다. 합격선 C1 ≥ 95%는
 * promptfoo 측에서 집계하므로 본 함수는 단일 호출에 대한 boolean만 보고한다.
 */

function ctx(overrides: Partial<AssertionContext> = {}): AssertionContext {
  return {
    prompt: 'test',
    vars: {
      gameMode: 'blank-typing',
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: ['SELECT', 'FROM'],
      seedFocusKeyword: 'SELECT',
    },
    ...overrides,
  };
}

describe('MT1 jsonParseAssertion', () => {
  it('raw JSON 객체는 pass=true', async () => {
    const result = await jsonParseAssertion('{"sql":"SELECT * FROM EMP"}', ctx());
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fenced ```json 블록도 pass=true', async () => {
    const raw = '```json\n{"description":"가장 기본적인 조회 키워드"}\n```';
    const result = await jsonParseAssertion(raw, ctx({ vars: { ...ctx().vars, gameMode: 'term-match' } }));
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('JSON 파싱 실패면 pass=false + reason에 사유 포함', async () => {
    const result = await jsonParseAssertion('SELECT FROM EMP', ctx());
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toMatch(/JSON\.parse|빈 출력/);
  });

  it('JSON 배열만 와도 파싱 자체는 성공한 것으로 본다 (구조 검증은 MT2 책임)', async () => {
    // MT1은 "JSON parsable" 여부만 검사. 배열/문자열/숫자도 valid JSON.
    const result = await jsonParseAssertion('[1, 2, 3]', ctx());
    expect(result.pass).toBe(true);
  });

  it('빈 문자열은 pass=false', async () => {
    const result = await jsonParseAssertion('', ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/빈 출력/);
  });
});
