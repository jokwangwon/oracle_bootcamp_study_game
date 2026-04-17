import { describe, expect, it } from 'vitest';

import mcOptionConsistencyAssertion from './mc-option-consistency';
import type { AssertionContext } from './types';

/**
 * MT_MC — 객관식 옵션 일관성 (ADR-012 §구현 범위 7 + ADR-017).
 *
 * 정의:
 *  1. multiple-choice 모드에서 options.length >= 2
 *  2. options[].id 고유
 *  3. correctOptionIds가 모두 options[].id에 존재
 *  4. allowMultiple=false(또는 미지정)면 correctOptionIds.length === 1
 *  5. 그 외 모드는 자동 pass (본 메트릭 비대상)
 */

const ALLOWED = ['SELECT', 'FROM', 'WHERE', 'IS', 'NULL', 'DEPTNO'];

function ctx(
  gameMode: 'blank-typing' | 'term-match' | 'multiple-choice' = 'multiple-choice',
): AssertionContext {
  return {
    prompt: 'test',
    vars: {
      gameMode,
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: ALLOWED,
      seedFocusKeyword: 'IS NULL',
    },
  };
}

describe('MT_MC mcOptionConsistencyAssertion', () => {
  it('정상 MC 응답(4지선다, 단일 정답) → pass', async () => {
    const raw = JSON.stringify({
      stem: 'NULL 비교 연산자는?',
      options: [
        { id: 'A', text: 'IS NULL' },
        { id: 'B', text: '= NULL' },
        { id: 'C', text: 'WHERE NULL' },
        { id: 'D', text: 'SELECT NULL' },
      ],
      correctOptionIds: ['A'],
      explanation: '...',
    });
    const result = await mcOptionConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('allowMultiple=true + 정답 2개 → pass', async () => {
    const raw = JSON.stringify({
      stem: 'DML 명령어 모두 고르시오',
      options: [
        { id: 'A', text: 'SELECT' },
        { id: 'B', text: 'INSERT' },
        { id: 'C', text: 'CREATE' },
      ],
      correctOptionIds: ['A', 'B'],
      allowMultiple: true,
      explanation: '...',
    });
    expect((await mcOptionConsistencyAssertion(raw, ctx())).pass).toBe(true);
  });

  it('options 1개 → fail (최소 2개 필요)', async () => {
    const raw = JSON.stringify({
      stem: 'x',
      options: [{ id: 'A', text: 'X' }],
      correctOptionIds: ['A'],
      explanation: '...',
    });
    const result = await mcOptionConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/options/);
  });

  it('options id 중복 → fail', async () => {
    const raw = JSON.stringify({
      stem: 'x',
      options: [
        { id: 'A', text: 'X' },
        { id: 'A', text: 'Y' },
      ],
      correctOptionIds: ['A'],
      explanation: '...',
    });
    const result = await mcOptionConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/중복|unique/i);
  });

  it('correctOptionIds가 존재하지 않는 id 참조 → fail', async () => {
    const raw = JSON.stringify({
      stem: 'x',
      options: [
        { id: 'A', text: 'X' },
        { id: 'B', text: 'Y' },
      ],
      correctOptionIds: ['Z'],
      explanation: '...',
    });
    const result = await mcOptionConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/correctOptionIds/);
  });

  it('correctOptionIds 빈 배열 → fail', async () => {
    const raw = JSON.stringify({
      stem: 'x',
      options: [
        { id: 'A', text: 'X' },
        { id: 'B', text: 'Y' },
      ],
      correctOptionIds: [],
      explanation: '...',
    });
    const result = await mcOptionConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/correctOptionIds/);
  });

  it('allowMultiple=false(미지정)인데 정답이 2개 → fail', async () => {
    const raw = JSON.stringify({
      stem: 'x',
      options: [
        { id: 'A', text: 'X' },
        { id: 'B', text: 'Y' },
      ],
      correctOptionIds: ['A', 'B'],
      explanation: '...',
    });
    const result = await mcOptionConsistencyAssertion(raw, ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/allowMultiple|단일/);
  });

  it('blank-typing 모드는 자동 pass (MT_MC 비대상)', async () => {
    const raw = JSON.stringify({ sql: '___', blanks: [{ position: 0, answer: 'X' }] });
    const result = await mcOptionConsistencyAssertion(raw, ctx('blank-typing'));
    expect(result.pass).toBe(true);
    expect(result.reason).toMatch(/skip|비대상/);
  });

  it('term-match 모드는 자동 pass', async () => {
    const raw = JSON.stringify({ description: '...', answer: ['X'] });
    expect(
      (await mcOptionConsistencyAssertion(raw, ctx('term-match'))).pass,
    ).toBe(true);
  });

  it('JSON 파싱 실패 → fail', async () => {
    const result = await mcOptionConsistencyAssertion('not json', ctx());
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/JSON/i);
  });
});
