import { describe, expect, it } from 'vitest';

import testCases, {
  buildPromptfooTestCases,
} from './promptfoo-testcases';
import { goldSetA } from './gold-set-a';
import { goldSetB } from './gold-set-b';

/**
 * promptfoo testCase 어댑터 단위 테스트.
 *
 * 검증:
 *  - default export가 Gold Set A + B를 모두 포함 (총 개수)
 *  - vars 필수 필드가 모두 채워져 있어 build-eval-prompt + assertion이 실패하지 않음
 *  - goldSet 분류 키가 'A' / 'B'로 정확
 *  - allowedKeywords가 mutable copy (원본 readonly 보호)
 */

describe('buildPromptfooTestCases', () => {
  it('Gold Set A + B의 합과 동일한 길이를 반환', () => {
    const cases = buildPromptfooTestCases();
    expect(cases).toHaveLength(goldSetA.length + goldSetB.length);
  });

  it('default export = build 함수 호출 결과 (모듈 로드 시 1회 계산)', () => {
    expect(testCases.length).toBe(buildPromptfooTestCases().length);
  });

  it('각 testCase에 vars 필수 필드가 모두 존재', () => {
    const cases = buildPromptfooTestCases();
    for (const tc of cases) {
      expect(typeof tc.vars.topic).toBe('string');
      expect(typeof tc.vars.week).toBe('number');
      expect(typeof tc.vars.difficulty).toBe('string');
      expect(Array.isArray(tc.vars.allowedKeywords)).toBe(true);
      expect(tc.vars.allowedKeywords.length).toBeGreaterThan(0);
      expect(typeof tc.vars.seedFocusKeyword).toBe('string');
      expect(['blank-typing', 'term-match']).toContain(tc.vars.gameMode);
      expect(['A', 'B']).toContain(tc.vars.goldSet);
      expect(tc.vars.entryId).toMatch(/^gold-[ab]-/);
    }
  });

  it('Gold Set A entry는 goldSet=A로 매핑', () => {
    const cases = buildPromptfooTestCases();
    const aCases = cases.filter((c) => c.vars.goldSet === 'A');
    expect(aCases).toHaveLength(goldSetA.length);
    expect(aCases[0].vars.entryId).toMatch(/^gold-a-/);
  });

  it('Gold Set B entry는 goldSet=B로 매핑', () => {
    const cases = buildPromptfooTestCases();
    const bCases = cases.filter((c) => c.vars.goldSet === 'B');
    expect(bCases).toHaveLength(goldSetB.length);
    expect(bCases[0].vars.entryId).toMatch(/^gold-b-/);
  });

  it('allowedKeywords는 원본의 mutable copy (push가 원본에 영향 없음)', () => {
    const cases = buildPromptfooTestCases();
    const tc = cases[0];
    const originalLen = goldSetA[0].vars.allowedKeywords.length;
    tc.vars.allowedKeywords.push('FAKE_TOKEN');
    expect(goldSetA[0].vars.allowedKeywords.length).toBe(originalLen);
  });

  it('description은 사람이 식별 가능 (gameMode + difficulty 포함)', () => {
    const cases = buildPromptfooTestCases();
    for (const tc of cases) {
      expect(tc.description).toContain(tc.vars.entryId);
      expect(tc.description).toContain(tc.vars.gameMode);
    }
  });
});
