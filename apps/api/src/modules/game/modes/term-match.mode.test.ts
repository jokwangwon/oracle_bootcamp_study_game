import { describe, expect, it } from 'vitest';
import type { Question, RoundConfig, PlayerAnswer } from '@oracle-game/shared';

import { TermMatchMode } from './term-match.mode';

const baseConfig: RoundConfig = {
  topic: 'sql-functions',
  week: 2,
  difficulty: 'EASY',
  timeLimit: 10,
};

function buildQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    topic: 'sql-functions',
    week: 2,
    gameMode: 'term-match',
    difficulty: 'EASY',
    content: {
      type: 'term-match',
      description: 'NULL 값을 다른 값으로 대체하는 Oracle 전용 함수',
      category: 'NULL 처리 함수',
    },
    answer: ['NVL'],
    status: 'active',
    source: 'pre-generated',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildAnswer(overrides: Partial<PlayerAnswer> = {}): PlayerAnswer {
  return {
    roundId: 'r1',
    playerId: 'p1',
    answer: 'NVL',
    submittedAt: 3_000,
    hintsUsed: 0,
    ...overrides,
  };
}

describe('TermMatchMode', () => {
  const mode = new TermMatchMode();

  describe('id and metadata', () => {
    it('식별자가 term-match이다', () => {
      expect(mode.id).toBe('term-match');
    });
  });

  describe('generateRound', () => {
    it('Question을 받아 라운드를 생성하고 정답을 보존한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);

      expect(round.question.id).toBe('q1');
      expect(round.correctAnswers).toEqual(['NVL']);
    });

    it('단계적 힌트를 생성한다 (첫 글자 → 글자수 → 카테고리)', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);

      expect(round.hints.length).toBeGreaterThanOrEqual(2);
      expect(round.hints[0]).toContain('N'); // 첫 글자 힌트
      expect(round.hints.some((h) => h.includes('3'))).toBe(true); // 글자 수 힌트
    });

    it('카테고리가 있으면 마지막 힌트로 카테고리를 노출한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const lastHint = round.hints[round.hints.length - 1];
      expect(lastHint).toContain('NULL 처리 함수');
    });
  });

  describe('evaluateAnswer', () => {
    it('정답이면 정답 처리한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(round, buildAnswer());

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('대소문자/공백을 무시한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      expect(
        mode.evaluateAnswer(round, buildAnswer({ answer: '  nvl  ' })).isCorrect,
      ).toBe(true);
    });

    it('복수 정답을 모두 인정한다 (예: NVL 또는 COALESCE)', () => {
      const question = buildQuestion({ answer: ['NVL', 'COALESCE'] });
      const round = mode.generateRound(question, baseConfig);

      expect(
        mode.evaluateAnswer(round, buildAnswer({ answer: 'NVL' })).isCorrect,
      ).toBe(true);
      expect(
        mode.evaluateAnswer(round, buildAnswer({ answer: 'COALESCE' })).isCorrect,
      ).toBe(true);
    });

    it('힌트 없이 정답 시 보너스 점수가 적용된다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const noHint = mode.evaluateAnswer(round, buildAnswer({ hintsUsed: 0 }));
      const withHint = mode.evaluateAnswer(round, buildAnswer({ hintsUsed: 2 }));

      expect(noHint.score).toBeGreaterThan(withHint.score);
    });

    it('오답이면 점수는 0이다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'DECODE' }),
      );
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('content type 검증', () => {
    it('blank-typing 컨텐츠에는 거부한다', () => {
      const question = buildQuestion({
        content: {
          type: 'blank-typing',
          sql: 'SELECT * ___ employees',
          blanks: [{ position: 0, answer: 'FROM' }],
        },
      });
      expect(() => mode.generateRound(question, baseConfig)).toThrow();
    });
  });
});
