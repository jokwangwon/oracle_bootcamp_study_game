import { describe, expect, it } from 'vitest';

import koreanFeaturesAssertion, {
  KOREAN_RATIO_THRESHOLD,
  EOJEOL_DIVERSITY_THRESHOLD,
} from './korean-features';
import type { AssertionContext } from './types';

/**
 * MT6 계산적 보조 — 한국어 자연스러움 (SDD v2 §3.2).
 *
 * 본 assertion은 한국어 judge의 사전 필터로 작동한다 (Tier 1 부분 편입).
 * 측정:
 *  1. 한글 비율 (가-힣 글자 / 비공백 총 글자) ≥ 30%
 *  2. 어절 다양성 (unique 어절 / 총 어절) ≥ 0.6
 *  3. 조사 존재 여부 (은/는/이/가/을/를/에/의/로 등 1개 이상)
 *
 * 모드별 검사 텍스트:
 *  - blank-typing: explanation
 *  - term-match: description + explanation
 *
 * pass 조건: 세 항목 모두 합격선 통과. 점수는 boolean 합계 / 3.
 */

function ctx(gameMode: 'blank-typing' | 'term-match' = 'term-match'): AssertionContext {
  return {
    prompt: 'test',
    vars: {
      gameMode,
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: ['SELECT'],
      seedFocusKeyword: 'SELECT',
    },
  };
}

describe('MT6 koreanFeaturesAssertion', () => {
  it('자연스러운 한국어 description은 pass', async () => {
    const raw = JSON.stringify({
      description: '테이블에서 행을 조회할 때 가장 기본적으로 사용하는 키워드입니다.',
      answer: ['SELECT'],
      explanation: 'SELECT은 SQL의 가장 기초가 되는 명령어로, 컬럼을 지정하여 조회합니다.',
    });
    const result = await koreanFeaturesAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.99);
  });

  it('영어로만 된 description은 한글 비율 fail → pass=false', async () => {
    const raw = JSON.stringify({
      description: 'A keyword used to retrieve rows from tables in SQL queries.',
      answer: ['SELECT'],
      explanation: 'Used for SELECT operations on EMP and DEPT tables.',
    });
    const result = await koreanFeaturesAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/한글/);
  });

  it('어절이 모두 동일(다양성 0)이면 fail', async () => {
    const raw = JSON.stringify({
      description: '키워드 키워드 키워드 키워드 키워드 키워드 키워드 키워드.',
      answer: ['SELECT'],
      explanation: '키워드 키워드 키워드 키워드 키워드 키워드 키워드 키워드.',
    });
    const result = await koreanFeaturesAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/어절|다양성/);
  });

  it('조사가 전혀 없으면 fail', async () => {
    const raw = JSON.stringify({
      description: '키워드 명령어 함수 절차 단계.',  // 조사 없음
      answer: ['SELECT'],
      explanation: '키워드 명령어 함수 절차 단계.',
    });
    const result = await koreanFeaturesAssertion(raw, ctx('term-match'));
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/조사/);
  });

  it('blank-typing 모드는 explanation만 검사', async () => {
    const raw = JSON.stringify({
      sql: 'SELECT ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT' }],
      answer: ['SELECT'],
      explanation: 'SELECT은 컬럼을 조회할 때 사용하는 가장 기본적인 키워드입니다.',
    });
    const result = await koreanFeaturesAssertion(raw, ctx('blank-typing'));
    expect(result.pass).toBe(true);
  });

  it('JSON 파싱 실패 시 fail', async () => {
    const result = await koreanFeaturesAssertion('not json', ctx());
    expect(result.pass).toBe(false);
  });

  it('임계치 상수가 export되어 있어 promptfoo report-generator가 참조 가능', () => {
    expect(KOREAN_RATIO_THRESHOLD).toBeGreaterThan(0);
    expect(KOREAN_RATIO_THRESHOLD).toBeLessThanOrEqual(1);
    expect(EOJEOL_DIVERSITY_THRESHOLD).toBeGreaterThan(0);
    expect(EOJEOL_DIVERSITY_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
