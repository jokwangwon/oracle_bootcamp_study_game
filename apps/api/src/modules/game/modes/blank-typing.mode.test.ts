import { describe, expect, it } from 'vitest';
import type { Question, RoundConfig, PlayerAnswer } from '@oracle-game/shared';

import { BlankTypingMode } from './blank-typing.mode';

const baseConfig: RoundConfig = {
  topic: 'sql-basics',
  week: 1,
  difficulty: 'EASY',
  timeLimit: 20,
};

function buildQuestion(): Question {
  return {
    id: 'q1',
    topic: 'sql-basics',
    week: 1,
    gameMode: 'blank-typing',
    difficulty: 'EASY',
    content: {
      type: 'blank-typing',
      sql: 'SELECT * ___ employees WHERE salary > 3000',
      blanks: [{ position: 0, answer: 'FROM', hint: 'F로 시작' }],
    },
    answer: ['FROM'],
    status: 'active',
    source: 'pre-generated',
    createdAt: new Date(),
  };
}

function buildAnswer(overrides: Partial<PlayerAnswer> = {}): PlayerAnswer {
  return {
    roundId: 'r1',
    playerId: 'p1',
    answer: 'FROM',
    submittedAt: 5_000,
    hintsUsed: 0,
    ...overrides,
  };
}

describe('BlankTypingMode', () => {
  const mode = new BlankTypingMode();

  describe('id and metadata', () => {
    it('식별자가 blank-typing이다', () => {
      expect(mode.id).toBe('blank-typing');
    });

    it('지원하는 모든 학습 주제가 정의되어 있다', () => {
      expect(mode.supportedTopics.length).toBeGreaterThan(0);
    });
  });

  describe('generateRound', () => {
    it('Question을 받아 라운드를 생성한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);

      expect(round.id).toBeDefined();
      expect(round.question.id).toBe('q1');
      expect(round.correctAnswers).toEqual(['FROM']);
      expect(round.timeLimit).toBe(20);
    });

    it('빈칸의 hint를 라운드 hint로 노출한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      expect(round.hints).toEqual(['F로 시작']);
    });
  });

  describe('evaluateAnswer', () => {
    it('정답을 정확히 입력하면 정답 처리한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(round, buildAnswer({ submittedAt: 3_000 }));

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('대소문자를 무시한다 (Oracle은 대소문자 구분 없음)', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'from' }),
      );

      expect(result.isCorrect).toBe(true);
    });

    it('앞뒤 공백을 무시한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: '  FROM  ' }),
      );

      expect(result.isCorrect).toBe(true);
    });

    it('오답이면 isCorrect=false이고 점수는 0이다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'WHERE' }),
      );

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });

    it('힌트를 사용하면 점수가 감소한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const noHint = mode.evaluateAnswer(round, buildAnswer({ hintsUsed: 0 }));
      const withHint = mode.evaluateAnswer(round, buildAnswer({ hintsUsed: 1 }));

      expect(withHint.score).toBeLessThan(noHint.score);
    });

    it('빠르게 답할수록 점수가 높다 (시간 보너스)', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const fast = mode.evaluateAnswer(
        round,
        buildAnswer({ submittedAt: 2_000 }),
      );
      const slow = mode.evaluateAnswer(
        round,
        buildAnswer({ submittedAt: 18_000 }),
      );

      expect(fast.score).toBeGreaterThan(slow.score);
    });

    it('timeTakenMs를 정확히 기록한다', () => {
      const round = mode.generateRound(buildQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ submittedAt: 7_500 }),
      );
      expect(result.timeTakenMs).toBe(7_500);
    });
  });
});
