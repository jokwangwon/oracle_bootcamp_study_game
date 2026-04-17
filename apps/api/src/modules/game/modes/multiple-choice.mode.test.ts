import { describe, expect, it } from 'vitest';
import type { PlayerAnswer, Question, RoundConfig } from '@oracle-game/shared';

import { MultipleChoiceMode } from './multiple-choice.mode';

const baseConfig: RoundConfig = {
  topic: 'sql-basics',
  week: 1,
  difficulty: 'EASY',
  timeLimit: 20,
};

function buildSingleAnswerQuestion(): Question {
  return {
    id: 'mc-1',
    topic: 'sql-basics',
    week: 1,
    gameMode: 'multiple-choice',
    answerFormat: 'multiple-choice',
    difficulty: 'EASY',
    content: {
      type: 'multiple-choice',
      stem: '다음 중 SELECT 문의 WHERE 절에서 NULL 값을 비교할 때 사용하는 연산자는?',
      options: [
        { id: 'A', text: '= NULL' },
        { id: 'B', text: 'IS NULL' },
        { id: 'C', text: '== NULL' },
        { id: 'D', text: 'EQUAL NULL' },
      ],
    },
    answer: ['B'],
    status: 'active',
    source: 'pre-generated',
    createdAt: new Date(),
  };
}

function buildMultiAnswerQuestion(): Question {
  return {
    id: 'mc-2',
    topic: 'sql-basics',
    week: 1,
    gameMode: 'multiple-choice',
    answerFormat: 'multiple-choice',
    difficulty: 'MEDIUM',
    content: {
      type: 'multiple-choice',
      stem: '다음 중 DML 명령어를 모두 고르시오.',
      options: [
        { id: 'A', text: 'SELECT' },
        { id: 'B', text: 'INSERT' },
        { id: 'C', text: 'CREATE' },
        { id: 'D', text: 'UPDATE' },
      ],
      allowMultiple: true,
    },
    answer: ['A', 'B', 'D'],
    status: 'active',
    source: 'pre-generated',
    createdAt: new Date(),
  };
}

function buildAnswer(overrides: Partial<PlayerAnswer> = {}): PlayerAnswer {
  return {
    roundId: 'r1',
    playerId: 'p1',
    answer: 'B',
    submittedAt: 5_000,
    hintsUsed: 0,
    ...overrides,
  };
}

describe('MultipleChoiceMode', () => {
  const mode = new MultipleChoiceMode();

  describe('id and metadata', () => {
    it('식별자가 multiple-choice이다', () => {
      expect(mode.id).toBe('multiple-choice');
    });

    it('모든 학습 주제를 지원한다', () => {
      expect(mode.supportedTopics.length).toBeGreaterThan(0);
    });
  });

  describe('generateRound', () => {
    it('Question을 받아 라운드를 생성한다', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);

      expect(round.id).toBeDefined();
      expect(round.question.id).toBe('mc-1');
      expect(round.correctAnswers).toEqual(['B']);
      expect(round.timeLimit).toBe(20);
    });

    it('보기 개수를 힌트로 노출한다', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      expect(round.hints).toEqual(['보기 4개 중 선택']);
    });

    it('다중정답 문제는 정답 개수도 힌트로 노출한다', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      expect(round.hints).toContain('보기 4개 중 선택');
      expect(round.hints).toContain('정답 3개');
    });

    it('multiple-choice가 아닌 content는 거부한다', () => {
      const wrong = {
        ...buildSingleAnswerQuestion(),
        content: {
          type: 'blank-typing' as const,
          sql: 'SELECT ___',
          blanks: [{ position: 0, answer: 'FROM' }],
        },
      };
      expect(() => mode.generateRound(wrong, baseConfig)).toThrow(
        /multiple-choice/,
      );
    });
  });

  describe('evaluateAnswer — 단일 정답', () => {
    it('정답을 정확히 선택하면 정답 처리한다', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'B', submittedAt: 3_000 }),
      );

      expect(result.isCorrect).toBe(true);
      expect(result.matchedAnswer).toBe('B');
      expect(result.score).toBeGreaterThan(0);
    });

    it('대소문자를 무시한다 (옵션 id는 대문자 권장이지만 관대)', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(round, buildAnswer({ answer: 'b' }));

      expect(result.isCorrect).toBe(true);
    });

    it('앞뒤 공백을 무시한다', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(round, buildAnswer({ answer: '  B  ' }));

      expect(result.isCorrect).toBe(true);
    });

    it('오답이면 isCorrect=false이고 점수는 0이다', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(round, buildAnswer({ answer: 'A' }));

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });

    it('단일정답 문제에 복수 선택을 제출하면 오답 (allowMultiple=false 보호)', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'B,C' }),
      );

      expect(result.isCorrect).toBe(false);
    });
  });

  describe('evaluateAnswer — 복수 정답 (all-or-nothing)', () => {
    it('모든 정답 옵션을 정확히 선택하면 정답', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'A,B,D' }),
      );

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('선택 순서는 무관하다 (집합 비교)', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'D,A,B' }),
      );

      expect(result.isCorrect).toBe(true);
    });

    it('구분자 주변 공백을 허용한다', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'A, B, D' }),
      );

      expect(result.isCorrect).toBe(true);
    });

    it('일부만 맞아도 all-or-nothing이므로 오답 (MVP-A 정책)', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'A,B' }),
      );

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });

    it('정답에 오답 옵션이 섞이면 오답', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'A,B,C,D' }),
      );

      expect(result.isCorrect).toBe(false);
    });

    it('중복 선택은 한 번으로 정규화 (A,A,B,D = A,B,D)', () => {
      const round = mode.generateRound(buildMultiAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ answer: 'A,A,B,D' }),
      );

      expect(result.isCorrect).toBe(true);
    });
  });

  describe('evaluateAnswer — 점수 계산', () => {
    it('힌트를 사용하면 점수가 감소한다', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const noHint = mode.evaluateAnswer(round, buildAnswer({ hintsUsed: 0 }));
      const withHint = mode.evaluateAnswer(round, buildAnswer({ hintsUsed: 1 }));

      expect(withHint.score).toBeLessThan(noHint.score);
    });

    it('빠르게 답할수록 점수가 높다 (시간 보너스)', () => {
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
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
      const round = mode.generateRound(buildSingleAnswerQuestion(), baseConfig);
      const result = mode.evaluateAnswer(
        round,
        buildAnswer({ submittedAt: 7_500 }),
      );
      expect(result.timeTakenMs).toBe(7_500);
    });
  });
});
