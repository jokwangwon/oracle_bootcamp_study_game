import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Question, Round } from '@oracle-game/shared';

import { GameSessionService } from './game-session.service';
import { GameModeRegistry } from '../modes/game-mode.registry';
import { BlankTypingMode } from '../modes/blank-typing.mode';
import { MultipleChoiceMode } from '../modes/multiple-choice.mode';
import { TermMatchMode } from '../modes/term-match.mode';
import { QuestionPoolService } from '../../content/services/question-pool.service';
import type { ScopeValidatorService } from '../../content/services/scope-validator.service';
import type { GradingOrchestrator } from '../../grading/grading.orchestrator';
import { LlmJudgeTimeoutError } from '../../grading/graders/llm-judge.grader';
import type { GradingResult } from '../../grading/grading.types';
import type { GradingMeasurementService } from '../../ops/grading-measurement.service';
import { AnswerHistoryEntity } from '../../users/entities/answer-history.entity';
import type { ConfigService } from '@nestjs/config';

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

interface ServiceDeps {
  config?: ConfigService;
  orchestrator?: GradingOrchestrator;
  scopeValidator?: ScopeValidatorService;
  gradingMeasurement?: GradingMeasurementService;
}

function makeService(deps: ServiceDeps = {}) {
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
    deps.config,
    deps.orchestrator,
    deps.scopeValidator,
    deps.gradingMeasurement,
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

/**
 * consensus-007 S6-C2-4 — free-form 3단 채점 분기 TDD.
 *
 * kill-switch ENABLE_FREE_FORM_GRADING=false 기본 → 기존 mode.evaluateAnswer 경로.
 * flag=true + answerFormat='free-form' 에서만 GradingOrchestrator 호출.
 */
describe('GameSessionService.submitAnswer — free-form 분기 (S6-C2-4)', () => {
  function makeFreeFormQuestion(): Question {
    return {
      id: 'q-ff-1',
      topic: 'sql-basics',
      week: 1,
      gameMode: 'blank-typing', // mode 는 임의 (evaluateAnswer 는 호출되지만 덮어씌움)
      answerFormat: 'free-form',
      difficulty: 'EASY',
      content: {
        type: 'blank-typing',
        sql: '___ ENAME FROM EMP;',
        blanks: [{ position: 0, answer: 'SELECT', hint: '조회 키워드' }],
      },
      answer: ['SELECT ENAME FROM EMP'],
      explanation: '조회 키워드',
      status: 'active',
      source: 'pre-generated',
      createdAt: new Date(),
    } as Question;
  }

  function makeConfig(flag: boolean): ConfigService {
    return {
      get: (key: string) => (key === 'ENABLE_FREE_FORM_GRADING' ? flag : undefined),
    } as unknown as ConfigService;
  }

  function makeOrchestrator(
    result: GradingResult,
    captureArgs?: (args: unknown) => void,
  ): GradingOrchestrator {
    return {
      grade: vi.fn(async (args: unknown) => {
        captureArgs?.(args);
        return result;
      }),
    } as unknown as GradingOrchestrator;
  }

  function makeScopeValidator(allowlist: string[] = ['SELECT', 'FROM', 'EMP', 'ENAME']): ScopeValidatorService {
    return {
      getAllowlist: vi.fn().mockResolvedValue(allowlist),
    } as unknown as ScopeValidatorService;
  }

  function injectActiveRound(service: GameSessionService, round: Round): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).activeRounds.set(round.id, round);
  }

  it('flag=false 이면 answerFormat=free-form 이어도 orchestrator 미호출 (기존 경로)', async () => {
    const orchestrator = makeOrchestrator({
      isCorrect: true,
      partialScore: 1,
      gradingMethod: 'ast',
      graderDigest: 'ast-v1',
      gradingLayersUsed: [1],
      rationale: 'ok',
    });
    const built = makeService({
      config: makeConfig(false),
      orchestrator,
      scopeValidator: makeScopeValidator(),
    });
    const question = makeFreeFormQuestion();
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'SELECT ENAME FROM EMP',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    expect(orchestrator.grade).not.toHaveBeenCalled();
    // 기존 경로 호출 → answer_history 에 기록됨
    expect(built.historyRepo.records).toHaveLength(1);
  });

  it('flag=true + answerFormat=free-form → orchestrator.grade 호출, 결과가 EvaluationResult 에 반영', async () => {
    const gradingResult: GradingResult = {
      isCorrect: true,
      partialScore: 0.8,
      gradingMethod: 'keyword',
      graderDigest: 'keyword-v1',
      gradingLayersUsed: [1, 2],
      rationale: 'keyword coverage',
    };
    const captured: unknown[] = [];
    const orchestrator = makeOrchestrator(gradingResult, (a) => captured.push(a));
    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(['SELECT', 'FROM', 'EMP', 'ENAME']),
    });
    const question = makeFreeFormQuestion();
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    const result = await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'SELECT ENAME FROM EMP',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    expect(orchestrator.grade).toHaveBeenCalledOnce();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      studentAnswer: 'SELECT ENAME FROM EMP',
      sessionId: round.id,
    });
    // allowlist 는 scopeValidator 반환값
    expect((captured[0] as { allowlist: string[] }).allowlist).toContain('SELECT');
    // expected 는 round.correctAnswers
    expect((captured[0] as { expected: readonly string[] }).expected).toEqual(round.correctAnswers);

    expect(result.isCorrect).toBe(true);
    // EASY 기본 max 100 × 0.8 = 80
    expect(result.score).toBe(80);
  });

  it('flag=true + free-form + orchestrator=FAIL → score=0 / isCorrect=false', async () => {
    const orchestrator = makeOrchestrator({
      isCorrect: false,
      partialScore: 0.3,
      gradingMethod: 'keyword',
      graderDigest: 'keyword-v1',
      gradingLayersUsed: [1, 2],
      rationale: 'below threshold',
    });
    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
    });
    const question = makeFreeFormQuestion();
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    const result = await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'DROP TABLE USERS',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
    // answer_history 에 기록됨 (WORM 감사)
    expect(built.historyRepo.records[0]).toMatchObject({
      userId: 'user-1',
      isCorrect: false,
      score: 0,
    });
  });

  it('answerFormat=single-token (기본) 은 flag=true 여도 orchestrator 미호출 (분기 없음)', async () => {
    const orchestrator = makeOrchestrator({
      isCorrect: true,
      partialScore: 1,
      gradingMethod: 'ast',
      graderDigest: 'ast-v1',
      gradingLayersUsed: [1],
      rationale: 'x',
    });
    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
    });
    const question = {
      ...makeFreeFormQuestion(),
      answerFormat: 'single-token',
    } as Question;
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'SELECT',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    expect(orchestrator.grade).not.toHaveBeenCalled();
  });

  it('GradingOrchestrator 미주입 (DI 부재) 이면 free-form 답안이어도 기존 경로 (회귀 안전망)', async () => {
    const built = makeService({
      config: makeConfig(true),
      // orchestrator 생략
      scopeValidator: makeScopeValidator(),
    });
    const question = makeFreeFormQuestion();
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    await expect(
      built.service.submitAnswer({
        roundId: round.id,
        playerId: 'user-1',
        answer: 'SELECT ENAME FROM EMP',
        submittedAt: 1_000,
        hintsUsed: 0,
      }),
    ).resolves.toBeDefined();
    expect(built.historyRepo.records).toHaveLength(1);
  });

  it('Layer 3 timeout → ServiceUnavailableException + held 감사 row + llm_timeout 이벤트', async () => {
    const orchestrator = {
      grade: vi.fn().mockRejectedValue(new LlmJudgeTimeoutError(8000, 8050)),
    } as unknown as GradingOrchestrator;
    const recordSpy = vi.fn().mockResolvedValue(undefined);
    const gradingMeasurement = {
      measureGrading: vi.fn(),
      recordLlmTimeout: recordSpy,
    } as unknown as GradingMeasurementService;

    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
      gradingMeasurement,
    });
    const question = makeFreeFormQuestion();
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    // HTTP 503 (Q3=B)
    await expect(
      built.service.submitAnswer({
        roundId: round.id,
        playerId: 'user-1',
        answer: 'SELECT',
        submittedAt: 1_000,
        hintsUsed: 0,
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    // held 감사 row (gradingMethod='held', isCorrect=false, score=0)
    expect(built.historyRepo.records).toHaveLength(1);
    expect(built.historyRepo.records[0]).toMatchObject({
      userId: 'user-1',
      isCorrect: false,
      score: 0,
      gradingMethod: 'held',
    });

    // ops_event_log(llm_timeout) 호출
    expect(recordSpy).toHaveBeenCalledOnce();
    const call = recordSpy.mock.calls[0]![0] as {
      questionId: string;
      userId: string;
      payload: { timeoutMs: number; layerAttempted: 3; elapsedMs?: number; retriable: boolean };
    };
    expect(call.questionId).toBe(round.question.id);
    expect(call.userId).toBe('user-1');
    expect(call.payload.timeoutMs).toBe(8000);
    expect(call.payload.layerAttempted).toBe(3);
    expect(call.payload.elapsedMs).toBe(8050);
    expect(call.payload.retriable).toBe(true);
  });

  it('timeout 후 active round 는 제거된다 (재사용 방지)', async () => {
    const orchestrator = {
      grade: vi.fn().mockRejectedValue(new LlmJudgeTimeoutError(8000)),
    } as unknown as GradingOrchestrator;

    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
    });
    const question = makeFreeFormQuestion();
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    await built.service
      .submitAnswer({
        roundId: round.id,
        playerId: 'user-1',
        answer: 'SELECT',
        submittedAt: 1_000,
        hintsUsed: 0,
      })
      .catch(() => undefined);

    // 두 번째 submit → Round not found (이미 제거)
    await expect(
      built.service.submitAnswer({
        roundId: round.id,
        playerId: 'user-1',
        answer: 'SELECT',
        submittedAt: 2_000,
        hintsUsed: 0,
      }),
    ).rejects.toThrow();
  });

  it('MEDIUM 난이도 max score 150 × partialScore 반영', async () => {
    const orchestrator = makeOrchestrator({
      isCorrect: true,
      partialScore: 0.6,
      gradingMethod: 'keyword',
      graderDigest: 'keyword-v1',
      gradingLayersUsed: [1, 2],
      rationale: 'x',
    });
    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
    });
    const question = {
      ...makeFreeFormQuestion(),
      difficulty: 'MEDIUM',
    } as Question;
    const round = built.blankTyping.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      timeLimit: 15,
    });
    injectActiveRound(built.service, round);

    const result = await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'SELECT ENAME FROM EMP',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    // 150 × 0.6 = 90
    expect(result.score).toBe(90);
  });
});
