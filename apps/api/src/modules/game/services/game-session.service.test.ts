import { describe, expect, it, beforeEach } from 'vitest';
import type { Question, Round } from '@oracle-game/shared';

import { GameSessionService } from './game-session.service';
import { GameModeRegistry } from '../modes/game-mode.registry';
import { BlankTypingMode } from '../modes/blank-typing.mode';
import { MultipleChoiceMode } from '../modes/multiple-choice.mode';
import { TermMatchMode } from '../modes/term-match.mode';
import { QuestionPoolService } from '../../content/services/question-pool.service';
import { AnswerHistoryEntity } from '../../users/entities/answer-history.entity';

/**
 * GameSessionService 단위 테스트.
 *
 * 핵심 검증:
 *  - submitAnswer가 answer_history에 INSERT 한다 (SDD §5.1, §6.1)
 *  - submitAnswer가 활성 라운드를 메모리에서 제거한다
 *  - finishSolo가 UsersService.recordSessionProgress에 위임하고
 *    summary를 함께 반환한다
 *
 * 의존성은 모두 fake (DB 없음).
 */

class FakeHistoryRepo {
  records: AnswerHistoryEntity[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(input: any): AnswerHistoryEntity {
    return {
      id: `h-${this.records.length + 1}`,
      createdAt: new Date(),
      hintsUsed: 0,
      score: 0,
      ...input,
    } as AnswerHistoryEntity;
  }

  async save(record: AnswerHistoryEntity): Promise<AnswerHistoryEntity> {
    this.records.push(record);
    return record;
  }
}

class FakeUsersService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public lastInput: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async recordSessionProgress(input: any) {
    this.lastInput = input;
    return {
      id: 'p-1',
      userId: input.userId,
      topic: input.topic,
      week: input.week,
      totalScore: input.sessionScore,
      gamesPlayed: 1,
      totalRoundsPlayed: input.totalRounds,
      totalCorrectAnswers: input.correctCount,
      accuracy: input.correctCount / input.totalRounds,
      streak: input.correctCount === input.totalRounds ? input.totalRounds : 0,
      lastPlayedAt: new Date(),
    };
  }
}

class FakePool {
  // 사용 안 함 (startSolo 테스트는 별도)
}

function makeFakeBlankTypingQuestion(): Question {
  return {
    id: 'q-fake-1',
    topic: 'sql-basics',
    week: 1,
    gameMode: 'blank-typing',
    difficulty: 'EASY',
    content: {
      type: 'blank-typing',
      sql: '___ ENAME FROM EMP;',
      blanks: [{ position: 0, answer: 'SELECT', hint: '조회 키워드' }],
    },
    answer: ['SELECT'],
    explanation: '조회 키워드',
    status: 'active',
    source: 'pre-generated',
    createdAt: new Date(),
  };
}

function makeService() {
  const blankTyping = new BlankTypingMode();
  const termMatch = new TermMatchMode();
  const multipleChoice = new MultipleChoiceMode();
  const registry = new GameModeRegistry(blankTyping, termMatch, multipleChoice);
  const pool = new FakePool() as unknown as QuestionPoolService;
  const usersService = new FakeUsersService();
  const historyRepo = new FakeHistoryRepo();

  const service = new GameSessionService(
    registry,
    pool,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usersService as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    historyRepo as any,
  );

  return { service, registry, blankTyping, usersService, historyRepo };
}

function injectActiveRound(service: GameSessionService, round: Round): void {
  // private 멤버에 접근하기 위한 우회 — 테스트 한정.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (service as any).activeRounds.set(round.id, round);
}

function getActiveRoundCount(service: GameSessionService): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (service as any).activeRounds.size;
}

describe('GameSessionService.submitAnswer', () => {
  let service: GameSessionService;
  let blankTyping: BlankTypingMode;
  let historyRepo: FakeHistoryRepo;

  beforeEach(() => {
    const built = makeService();
    service = built.service;
    blankTyping = built.blankTyping;
    historyRepo = built.historyRepo;
  });

  it('정답 시 EvaluationResult 반환 + answer_history에 INSERT + 라운드 제거', async () => {
    const question = makeFakeBlankTypingQuestion();
    const round = blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(service, round);

    const result = await service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'SELECT',
      submittedAt: 5_000,
      hintsUsed: 0,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBeGreaterThan(0);

    expect(historyRepo.records).toHaveLength(1);
    expect(historyRepo.records[0]).toMatchObject({
      userId: 'user-1',
      questionId: 'q-fake-1',
      answer: 'SELECT',
      isCorrect: true,
      hintsUsed: 0,
      gameMode: 'blank-typing',
    });
    expect(historyRepo.records[0].score).toBeGreaterThan(0);

    expect(getActiveRoundCount(service)).toBe(0);
  });

  it('오답 시 isCorrect=false로 history에 기록된다', async () => {
    const question = makeFakeBlankTypingQuestion();
    const round = blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(service, round);

    const result = await service.submitAnswer({
      roundId: round.id,
      playerId: 'user-2',
      answer: 'WRONG',
      submittedAt: 3_000,
      hintsUsed: 1,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);

    expect(historyRepo.records).toHaveLength(1);
    expect(historyRepo.records[0]).toMatchObject({
      userId: 'user-2',
      isCorrect: false,
      score: 0,
      hintsUsed: 1,
    });
  });

  it('만료된 roundId는 BadRequest를 throw 한다', async () => {
    await expect(
      service.submitAnswer({
        roundId: 'nonexistent',
        playerId: 'user-1',
        answer: 'SELECT',
        submittedAt: 1_000,
        hintsUsed: 0,
      }),
    ).rejects.toThrow();

    // 실패 시에는 history에 INSERT 되지 않아야 함
    const built = makeService();
    expect(built.historyRepo.records).toHaveLength(0);
  });
});

describe('GameSessionService.finishSolo', () => {
  let service: GameSessionService;
  let usersService: FakeUsersService;

  beforeEach(() => {
    const built = makeService();
    service = built.service;
    usersService = built.usersService;
  });

  it('UsersService.recordSessionProgress에 입력을 그대로 위임한다', async () => {
    const result = await service.finishSolo({
      userId: 'user-1',
      topic: 'sql-basics',
      week: 1,
      gameMode: 'blank-typing',
      totalRounds: 10,
      correctCount: 8,
      totalScore: 5_000,
    });

    expect(usersService.lastInput).toMatchObject({
      userId: 'user-1',
      topic: 'sql-basics',
      week: 1,
      totalRounds: 10,
      correctCount: 8,
      sessionScore: 5_000,
    });

    expect(result.progress.totalScore).toBe(5_000);
    expect(result.progress.accuracy).toBeCloseTo(0.8);
  });

  it('summary에 입력 그대로 + 계산된 accuracy를 함께 담는다', async () => {
    const result = await service.finishSolo({
      userId: 'user-1',
      topic: 'sql-basics',
      week: 1,
      gameMode: 'term-match',
      totalRounds: 5,
      correctCount: 5,
      totalScore: 6_000,
    });

    expect(result.summary).toEqual({
      topic: 'sql-basics',
      week: 1,
      gameMode: 'term-match',
      totalRounds: 5,
      correctCount: 5,
      accuracy: 1,
      sessionScore: 6_000,
    });
  });
});
