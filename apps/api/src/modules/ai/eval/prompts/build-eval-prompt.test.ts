import { describe, expect, it } from 'vitest';

import buildEvalPromptForPromptfoo, {
  renderEvalMessages,
} from './build-eval-prompt';

/**
 * build-eval-prompt 단위 테스트.
 *
 * 검증 목표:
 *  - 운영 prompt template과 동일한 system 메시지를 사용한다 (단일 진실 소스)
 *  - vars의 모든 필수 필드가 substitute에 흘러간다
 *  - format_instructions가 user 메시지에 포함된다
 *  - 평가 전용 "중심 토큰 강제" 한 줄이 추가된다 (모드별로 다르게)
 *  - 잘못된 vars는 명확한 에러 메시지로 throw
 */

const BASE_VARS = {
  topic: 'sql-basics',
  week: 1,
  difficulty: 'EASY',
  allowedKeywords: ['SELECT', 'FROM', 'WHERE', 'EMP'],
  seedFocusKeyword: 'SELECT',
};

describe('renderEvalMessages', () => {
  it('blank-typing: system + user 두 메시지 반환', () => {
    const { system, user } = renderEvalMessages({ ...BASE_VARS, gameMode: 'blank-typing' });
    expect(system).toContain('Oracle DBA 부트캠프 강사');   // 운영 BLANK_TYPING_GENERATION_PROMPT system 일부
    expect(user).toContain('주제: sql-basics');
    expect(user).toContain('주차: 1');
    expect(user).toContain('난이도: EASY');
    expect(user).toContain('SELECT, FROM, WHERE, EMP');
  });

  it('blank-typing: user에 format_instructions이 포함된다 (StructuredOutputParser 결과)', () => {
    const { user } = renderEvalMessages({ ...BASE_VARS, gameMode: 'blank-typing' });
    // format_instructions의 핵심 키워드가 들어있는지만 확인 (LangChain 출력은 길이가 가변)
    expect(user.toLowerCase()).toContain('json');
  });

  it('blank-typing: 평가 전용 중심 토큰 지시가 마지막에 추가', () => {
    const { user } = renderEvalMessages({ ...BASE_VARS, gameMode: 'blank-typing' });
    expect(user).toContain('평가 지시');
    expect(user).toContain('SELECT');
    // blank-typing 분기는 "정답에는 반드시 ... 포함"
    expect(user).toMatch(/정답에는 반드시.*SELECT.*포함/);
  });

  it('term-match: 평가 지시 문구는 "정답은 반드시 ... 이어야"', () => {
    const { user } = renderEvalMessages({
      ...BASE_VARS,
      seedFocusKeyword: 'DISTINCT',
      gameMode: 'term-match',
    });
    expect(user).toMatch(/정답은 반드시.*DISTINCT/);
  });
});

describe('buildEvalPromptForPromptfoo (default export)', () => {
  it('vars 객체를 받아 JSON-encoded messages 반환', () => {
    const result = buildEvalPromptForPromptfoo({
      vars: { ...BASE_VARS, gameMode: 'blank-typing' },
    });
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].role).toBe('system');
    expect(parsed[1].role).toBe('user');
    expect(parsed[1].content).toContain('SELECT');
  });

  it('필수 vars 필드 누락 시 명확한 에러', () => {
    expect(() =>
      buildEvalPromptForPromptfoo({
        vars: { topic: 'sql-basics' },
      }),
    ).toThrow(/필수 필드/);
  });

  it('지원하지 않는 gameMode는 throw', () => {
    expect(() =>
      buildEvalPromptForPromptfoo({
        vars: { ...BASE_VARS, gameMode: 'scenario' },
      }),
    ).toThrow();
  });
});
