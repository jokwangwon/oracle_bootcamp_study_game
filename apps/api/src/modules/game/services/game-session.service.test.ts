import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import type { EvaluationResult, Question, Round } from '@oracle-game/shared';

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
import type { ActiveEpochLookup } from '../../ops/active-epoch.lookup';
import type { ReviewQueueService } from '../../review/review-queue.service';
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
  activeEpoch?: ActiveEpochLookup;
  reviewQueueService?: ReviewQueueService;
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
    deps.activeEpoch,
    deps.reviewQueueService,
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

  function makeConfig(flag: boolean, salt = 'test-salt-at-least-16-chars'): ConfigService {
    return {
      get: (key: string) => {
        if (key === 'ENABLE_FREE_FORM_GRADING') return flag;
        if (key === 'USER_TOKEN_HASH_SALT') return salt;
        return undefined;
      },
    } as unknown as ConfigService;
  }

  function makeActiveEpoch(epochId = 1): ActiveEpochLookup {
    return {
      getActiveEpochId: vi.fn().mockResolvedValue(epochId),
    } as unknown as ActiveEpochLookup;
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
      activeEpoch: makeActiveEpoch(),
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
      activeEpoch: makeActiveEpoch(),
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
    // PR #15 CRITICAL-1: orchestrator 는 timeout 전에 sanitize 플래그를 첨부하여 re-throw
    const timeoutErr = new LlmJudgeTimeoutError(8000, 8050);
    timeoutErr.sanitizationFlags = ['SUSPICIOUS_INPUT'];
    const orchestrator = {
      grade: vi.fn().mockRejectedValue(timeoutErr),
    } as unknown as GradingOrchestrator;
    const recordSpy = vi.fn().mockResolvedValue(undefined);
    const heldFailSpy = vi.fn().mockResolvedValue(undefined);
    const gradingMeasurement = {
      measureGrading: vi.fn(),
      recordLlmTimeout: recordSpy,
      recordHeldPersistFail: heldFailSpy,
    } as unknown as GradingMeasurementService;

    const built = makeService({
      config: makeConfig(true, 'salt-of-at-least-sixteen-chars!!'),
      orchestrator,
      scopeValidator: makeScopeValidator(),
      gradingMeasurement,
      activeEpoch: makeActiveEpoch(5),
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
        hintsUsed: 2,
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    // PR #15 CRITICAL-1: held row 는 7항 + user_token_hash + epoch 완전 포함
    expect(built.historyRepo.records).toHaveLength(1);
    const heldRow = built.historyRepo.records[0] as unknown as {
      userId: string;
      isCorrect: boolean;
      score: number;
      hintsUsed: number;
      gradingMethod: string;
      graderDigest: string;
      gradingLayersUsed: number[];
      partialScore: string;
      rationale: string;
      sanitizationFlags: string[] | null | undefined;
      astFailureReason: string | null | undefined;
      userTokenHash: string;
      userTokenHashEpoch: number;
    };
    expect(heldRow.userId).toBe('user-1');
    expect(heldRow.isCorrect).toBe(false);
    expect(heldRow.score).toBe(0);
    expect(heldRow.gradingMethod).toBe('held');
    expect(heldRow.graderDigest).toBe('timeout@layer3');
    expect(heldRow.gradingLayersUsed).toEqual([1, 2, 3]);
    expect(heldRow.partialScore).toBe('0.000');
    expect(heldRow.rationale).toMatch(/LLM timeout after 8000ms/);
    // sanitizationFlags 는 orchestrator 가 timeout 에러에 첨부한 값
    expect(heldRow.sanitizationFlags).toEqual(['SUSPICIOUS_INPUT']);
    // Layer 3 timeout 이므로 Layer 1 astFailureReason 은 없음
    expect(heldRow.astFailureReason).toBeNull();
    // user_token_hash = 16 hex + epoch = 5
    expect(heldRow.userTokenHash).toMatch(/^[a-f0-9]{16}$/);
    expect(heldRow.userTokenHashEpoch).toBe(5);
    // hintsUsed: answer.hintsUsed=2 가 result 에도 전파되어야 (출처 통일)
    expect(heldRow.hintsUsed).toBe(2);

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
    // held persist 는 성공했으므로 recordHeldPersistFail 는 호출되지 않음
    expect(heldFailSpy).not.toHaveBeenCalled();
  });

  it('PR #15 CRITICAL-1: held persist 실패 시 recordHeldPersistFail 강제 기록 (최후 방어선)', async () => {
    const timeoutErr = new LlmJudgeTimeoutError(8000, 8050);
    const orchestrator = {
      grade: vi.fn().mockRejectedValue(timeoutErr),
    } as unknown as GradingOrchestrator;
    const heldFailSpy = vi.fn().mockResolvedValue(undefined);
    const gradingMeasurement = {
      measureGrading: vi.fn(),
      recordLlmTimeout: vi.fn().mockResolvedValue(undefined),
      recordHeldPersistFail: heldFailSpy,
    } as unknown as GradingMeasurementService;

    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
      gradingMeasurement,
      activeEpoch: makeActiveEpoch(1),
    });
    // historyRepo.save 를 강제 실패시킨다
    built.historyRepo.save = vi
      .fn()
      .mockRejectedValue(new Error('DB unreachable during held persist'));

    const round = built.blankTyping.generateRound(makeFreeFormQuestion(), {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    // 학생은 여전히 HTTP 503 을 받아야 함
    await expect(
      built.service.submitAnswer({
        roundId: round.id,
        playerId: 'user-1',
        answer: 'SELECT',
        submittedAt: 1_000,
        hintsUsed: 0,
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    // held persist 가 실패했으므로 recordHeldPersistFail 로 최후 기록
    expect(heldFailSpy).toHaveBeenCalledOnce();
    const call = heldFailSpy.mock.calls[0]![0] as {
      questionId: string;
      userId: string;
      error: unknown;
    };
    expect(call.questionId).toBe(round.question.id);
    expect(call.userId).toBe('user-1');
    expect(call.error).toBeInstanceOf(Error);
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

  it('C2-6: free-form 성공 시 7항 메타 + user_token_hash + epoch persist', async () => {
    const gradingResult: GradingResult = {
      isCorrect: true,
      partialScore: 0.75,
      gradingMethod: 'llm',
      graderDigest: 'prompt:eval:v1|model:abcd1234|parser:sov1|temp:0|seed:42|topk:1',
      gradingLayersUsed: [1, 2, 3],
      rationale: 'Layer 1 UNKNOWN | keyword UNKNOWN | LLM PASS: 의미 동치',
      sanitizationFlags: ['SUSPICIOUS_INPUT'],
      astFailureReason: 'dialect_unsupported',
    };
    const measureSpy = vi.fn().mockResolvedValue(undefined);
    const gradingMeasurement = {
      measureGrading: measureSpy,
      recordLlmTimeout: vi.fn(),
    } as unknown as GradingMeasurementService;
    const built = makeService({
      config: makeConfig(true, 'salt-of-at-least-sixteen-chars!!'),
      orchestrator: makeOrchestrator(gradingResult),
      scopeValidator: makeScopeValidator(),
      activeEpoch: makeActiveEpoch(7),
      gradingMeasurement,
    });
    const round = built.blankTyping.generateRound(makeFreeFormQuestion(), {
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

    expect(built.historyRepo.records).toHaveLength(1);
    const saved = built.historyRepo.records[0] as unknown as {
      gradingMethod: string;
      graderDigest: string;
      gradingLayersUsed: number[];
      partialScore: string;
      rationale: string;
      sanitizationFlags: string[] | null;
      astFailureReason: string | null;
      userTokenHash: string | null;
      userTokenHashEpoch: number | null;
    };
    expect(saved.gradingMethod).toBe('llm');
    expect(saved.graderDigest).toContain('model:abcd1234');
    expect(saved.gradingLayersUsed).toEqual([1, 2, 3]);
    expect(saved.partialScore).toBe('0.750');
    expect(saved.rationale).toContain('LLM PASS');
    expect(saved.sanitizationFlags).toEqual(['SUSPICIOUS_INPUT']);
    expect(saved.astFailureReason).toBe('dialect_unsupported');
    // user_token_hash = 16 hex chars
    expect(saved.userTokenHash).toMatch(/^[a-f0-9]{16}$/);
    expect(saved.userTokenHashEpoch).toBe(7);

    // grading_measured 이벤트
    expect(measureSpy).toHaveBeenCalledOnce();
    const call = measureSpy.mock.calls[0]![0] as {
      questionId: string;
      userId: string;
      payload: {
        gradingMethod: string;
        gradingLayersUsed: number[];
        astFailureReason?: string;
        layer1Resolved: boolean;
        layer3Invoked: boolean;
        judgeInvocationCount: number;
        heldForReview: boolean;
        sanitizationFlagCount: number;
      };
    };
    expect(call.questionId).toBe(round.question.id);
    expect(call.userId).toBe('user-1');
    expect(call.payload.gradingMethod).toBe('llm');
    expect(call.payload.layer1Resolved).toBe(false); // Layer 1 UNKNOWN → escalate
    expect(call.payload.layer3Invoked).toBe(true);
    expect(call.payload.judgeInvocationCount).toBe(1);
    expect(call.payload.heldForReview).toBe(false);
    expect(call.payload.sanitizationFlagCount).toBe(1);
    expect(call.payload.astFailureReason).toBe('dialect_unsupported');
  });

  it('C2-6: Layer 1 PASS → layer1Resolved=true / layer3Invoked=false / judgeInvocationCount=0', async () => {
    const gradingResult: GradingResult = {
      isCorrect: true,
      partialScore: 1,
      gradingMethod: 'ast',
      graderDigest: 'ast-v1',
      gradingLayersUsed: [1],
      rationale: 'AST 구조 동일',
    };
    const measureSpy = vi.fn().mockResolvedValue(undefined);
    const built = makeService({
      config: makeConfig(true),
      orchestrator: makeOrchestrator(gradingResult),
      scopeValidator: makeScopeValidator(),
      activeEpoch: makeActiveEpoch(1),
      gradingMeasurement: {
        measureGrading: measureSpy,
        recordLlmTimeout: vi.fn(),
      } as unknown as GradingMeasurementService,
    });
    const round = built.blankTyping.generateRound(makeFreeFormQuestion(), {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);
    await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'SELECT 1',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    const payload = (measureSpy.mock.calls[0]![0] as {
      payload: { layer1Resolved: boolean; layer3Invoked: boolean; judgeInvocationCount: number; heldForReview: boolean };
    }).payload;
    expect(payload.layer1Resolved).toBe(true);
    expect(payload.layer3Invoked).toBe(false);
    expect(payload.judgeInvocationCount).toBe(0);
    expect(payload.heldForReview).toBe(false);
  });

  it('C2-6: held 경로 → heldForReview=true + gradingMethod=held persist', async () => {
    const gradingResult: GradingResult = {
      isCorrect: false,
      partialScore: 0,
      gradingMethod: 'held',
      graderDigest: 'orchestrator-v1',
      gradingLayersUsed: [1, 2, 3],
      rationale: 'all UNKNOWN | held for admin review',
    };
    const measureSpy = vi.fn().mockResolvedValue(undefined);
    const built = makeService({
      config: makeConfig(true),
      orchestrator: makeOrchestrator(gradingResult),
      scopeValidator: makeScopeValidator(),
      activeEpoch: makeActiveEpoch(3),
      gradingMeasurement: {
        measureGrading: measureSpy,
        recordLlmTimeout: vi.fn(),
      } as unknown as GradingMeasurementService,
    });
    const round = built.blankTyping.generateRound(makeFreeFormQuestion(), {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);
    await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'weird answer',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    const saved = built.historyRepo.records[0] as unknown as {
      gradingMethod: string;
      userTokenHashEpoch: number;
    };
    expect(saved.gradingMethod).toBe('held');
    expect(saved.userTokenHashEpoch).toBe(3);
    expect((measureSpy.mock.calls[0]![0] as { payload: { heldForReview: boolean } }).payload.heldForReview).toBe(true);
  });

  it('C2-6: 비-free-form 경로 (MC/BlankTyping) 는 user_token_hash / epoch / 7항 미저장 (회귀 0)', async () => {
    const orchestrator = makeOrchestrator({
      isCorrect: true,
      partialScore: 1,
      gradingMethod: 'ast',
      graderDigest: 'ast-v1',
      gradingLayersUsed: [1],
      rationale: 'x',
    });
    const measureSpy = vi.fn();
    const built = makeService({
      config: makeConfig(true),
      orchestrator,
      scopeValidator: makeScopeValidator(),
      activeEpoch: makeActiveEpoch(),
      gradingMeasurement: {
        measureGrading: measureSpy,
        recordLlmTimeout: vi.fn(),
      } as unknown as GradingMeasurementService,
    });
    // answerFormat=single-token (free-form 아님) → gradeFreeForm 미호출
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

    const saved = built.historyRepo.records[0] as unknown as {
      gradingMethod: string | null | undefined;
      userTokenHash: string | null | undefined;
      userTokenHashEpoch: number | null | undefined;
    };
    expect(saved.gradingMethod).toBeUndefined();
    expect(saved.userTokenHash).toBeUndefined();
    expect(saved.userTokenHashEpoch).toBeUndefined();
    expect(measureSpy).not.toHaveBeenCalled();
  });

  it('C2-6: activeEpoch 미주입 시 free-form 채점 후 persist 단계에서 throw (fail-closed)', async () => {
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
      // activeEpoch 미주입
    });
    const round = built.blankTyping.generateRound(makeFreeFormQuestion(), {
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
        answer: 'SELECT',
        submittedAt: 1_000,
        hintsUsed: 0,
      }),
    ).rejects.toThrow(/ActiveEpochLookup/);
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
      activeEpoch: makeActiveEpoch(),
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

/**
 * ADR-019 §5.1 PR-3 — SM-2 SR Tx2 배선.
 *
 *  - reviewQueueService 주입 시 정답/오답/hints 조합으로 upsertAfterAnswer 호출
 *  - 서비스 미주입 → SR 미호출 (회귀 0)
 *  - playerId '' (게스트) → SR 스킵
 *  - held → SR 스킵 (B-C3)
 *  - admin-override → overwriteAfterOverride 호출
 *  - 내부 예외 → recordSrUpsertFail + 학생 응답 정상 (fail-open)
 */
describe('GameSessionService.submitAnswer — SR Tx2 배선 (ADR-019 §5.1)', () => {
  function makeMcQuestion(): Question {
    return {
      id: 'q-mc-1',
      topic: 'sql-basics',
      week: 1,
      gameMode: 'multiple-choice',
      answerFormat: 'all-or-nothing',
      difficulty: 'EASY',
      content: {
        type: 'multiple-choice',
        stem: 'SELECT 는 무엇?',
        options: [
          { id: 'A', text: '조회' },
          { id: 'B', text: '삽입' },
          { id: 'C', text: '갱신' },
          { id: 'D', text: '삭제' },
        ],
      },
      answer: ['A'],
      explanation: 'SELECT 는 조회',
      status: 'active',
      source: 'pre-generated',
      createdAt: new Date(),
    } as Question;
  }

  function makeReviewQueueService(
    overrides: Partial<{
      upsertAfterAnswer: ReturnType<typeof vi.fn>;
      overwriteAfterOverride: ReturnType<typeof vi.fn>;
    }> = {},
  ): ReviewQueueService {
    return {
      upsertAfterAnswer: overrides.upsertAfterAnswer ?? vi.fn().mockResolvedValue(undefined),
      overwriteAfterOverride:
        overrides.overwriteAfterOverride ?? vi.fn().mockResolvedValue(undefined),
    } as unknown as ReviewQueueService;
  }

  function makeGradingMeasurement(): GradingMeasurementService {
    return {
      recordSrUpsertFail: vi.fn().mockResolvedValue(undefined),
    } as unknown as GradingMeasurementService;
  }

  function injectActiveRound(service: GameSessionService, round: Round): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).activeRounds.set(round.id, round);
  }

  it('MC 정답 + reviewQueueService 주입 → upsertAfterAnswer(quality=5) 호출', async () => {
    const rq = makeReviewQueueService();
    const built = makeService({ reviewQueueService: rq });
    const question = makeMcQuestion();
    const mc = built.registry.get('multiple-choice');
    const round = mc.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'A',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    expect((rq as unknown as { upsertAfterAnswer: ReturnType<typeof vi.fn> }).upsertAfterAnswer).toHaveBeenCalledOnce();
    const args = (rq as unknown as { upsertAfterAnswer: ReturnType<typeof vi.fn> }).upsertAfterAnswer.mock.calls[0]!;
    expect(args[0]).toBe('user-1');
    expect(args[1]).toBe('q-mc-1');
    expect(args[2]).toBe(5); // isCorrect=true, partialScore=null → fallback 1 → base 5
  });

  it('MC 오답 → upsertAfterAnswer(quality=0)', async () => {
    const rq = makeReviewQueueService();
    const built = makeService({ reviewQueueService: rq });
    const question = makeMcQuestion();
    const mc = built.registry.get('multiple-choice');
    const round = mc.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'B',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    const args = (rq as unknown as { upsertAfterAnswer: ReturnType<typeof vi.fn> }).upsertAfterAnswer.mock.calls[0]!;
    expect(args[2]).toBe(0); // isCorrect=false, partialScore=null → fallback 0 → base 0
  });

  it('BlankTyping 정답 + hints 2 → upsertAfterAnswer(quality=3, 5-2)', async () => {
    const rq = makeReviewQueueService();
    const built = makeService({ reviewQueueService: rq });
    const question = makeFakeBlankTypingQuestion();
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
      hintsUsed: 2,
    });

    const args = (rq as unknown as { upsertAfterAnswer: ReturnType<typeof vi.fn> }).upsertAfterAnswer.mock.calls[0]!;
    expect(args[2]).toBe(3); // base 5 - hintPenalty 2 = 3
  });

  it('reviewQueueService 미주입 → SR 호출 없음 (회귀 0)', async () => {
    const built = makeService(); // no reviewQueueService
    const question = makeMcQuestion();
    const mc = built.registry.get('multiple-choice');
    const round = mc.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    // Throw 없이 정상 동작
    const result = await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'A',
      submittedAt: 1_000,
      hintsUsed: 0,
    });
    expect(result.isCorrect).toBe(true);
    expect(built.historyRepo.records).toHaveLength(1);
  });

  it("playerId 빈 문자열 (게스트) → SR 스킵 (B A-CRITICAL #2 방어)", async () => {
    const rq = makeReviewQueueService();
    const built = makeService({ reviewQueueService: rq });
    const question = makeMcQuestion();
    const mc = built.registry.get('multiple-choice');
    const round = mc.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    try {
      await built.service.submitAnswer({
        roundId: round.id,
        playerId: '',
        answer: 'A',
        submittedAt: 1_000,
        hintsUsed: 0,
      });
    } catch {
      // historyRepo 가 '' userId 를 처리 못할 수는 있지만 — 본 테스트의 관심사는 아님
    }

    expect(
      (rq as unknown as { upsertAfterAnswer: ReturnType<typeof vi.fn> }).upsertAfterAnswer,
    ).not.toHaveBeenCalled();
    expect(
      (rq as unknown as { overwriteAfterOverride: ReturnType<typeof vi.fn> }).overwriteAfterOverride,
    ).not.toHaveBeenCalled();
  });

  it('upsertAfterAnswer throw → 학생 응답 정상 + recordSrUpsertFail 기록', async () => {
    const rq = makeReviewQueueService({
      upsertAfterAnswer: vi.fn().mockRejectedValue(new Error('db error')),
    });
    const gm = makeGradingMeasurement();
    const built = makeService({ reviewQueueService: rq, gradingMeasurement: gm });
    const question = makeMcQuestion();
    const mc = built.registry.get('multiple-choice');
    const round = mc.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });
    injectActiveRound(built.service, round);

    const result = await built.service.submitAnswer({
      roundId: round.id,
      playerId: 'user-1',
      answer: 'A',
      submittedAt: 1_000,
      hintsUsed: 0,
    });

    expect(result.isCorrect).toBe(true); // 학생 응답은 정상
    const recordMock = (gm as unknown as { recordSrUpsertFail: ReturnType<typeof vi.fn> })
      .recordSrUpsertFail;
    expect(recordMock).toHaveBeenCalledOnce();
    const call = recordMock.mock.calls[0]![0];
    expect(call.userId).toBe('user-1');
    expect(call.questionId).toBe('q-mc-1');
    expect(call.stage).toBe('upsert');
    expect((call.error as Error).message).toBe('db error');
  });

  it('overwriteAfterOverride throw → stage="overwrite" 로 기록', async () => {
    // admin-override 는 정상 답변 경로에서 발생하기 어려우므로 private 메서드 직접 호출.
    const rq = makeReviewQueueService({
      overwriteAfterOverride: vi.fn().mockRejectedValue(new Error('ovr err')),
    });
    const gm = makeGradingMeasurement();
    const built = makeService({ reviewQueueService: rq, gradingMeasurement: gm });

    const question = makeMcQuestion();
    const mc = built.registry.get('multiple-choice');
    const round = mc.generateRound(question, {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      timeLimit: 20,
    });

    // private 메서드 우회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (built.service as any).routeToReviewQueue(
      {
        roundId: round.id,
        playerId: 'user-1',
        answer: 'A',
        submittedAt: 1_000,
        hintsUsed: 0,
      },
      round.question.id,
      { isCorrect: true, score: 100, hintsUsed: 0, timeTakenMs: 0 } as EvaluationResult,
      {
        isCorrect: true,
        partialScore: 1,
        gradingMethod: 'admin-override',
        graderDigest: 'admin',
        gradingLayersUsed: [1],
        rationale: 'admin',
      } as GradingResult,
    );

    expect(
      (rq as unknown as { overwriteAfterOverride: ReturnType<typeof vi.fn> }).overwriteAfterOverride,
    ).toHaveBeenCalledOnce();
    const recordMock = (gm as unknown as { recordSrUpsertFail: ReturnType<typeof vi.fn> })
      .recordSrUpsertFail;
    expect(recordMock.mock.calls[0]![0].stage).toBe('overwrite');
  });

  it("gradingMethod='held' → SR 스킵 (B-C3) — routeToReviewQueue 직접 호출", async () => {
    const rq = makeReviewQueueService();
    const built = makeService({ reviewQueueService: rq });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (built.service as any).routeToReviewQueue(
      {
        roundId: 'r1',
        playerId: 'user-1',
        answer: 'x',
        submittedAt: 0,
        hintsUsed: 0,
      },
      'q-1',
      { isCorrect: false, score: 0, hintsUsed: 0, timeTakenMs: 0 } as EvaluationResult,
      {
        isCorrect: false,
        partialScore: 0,
        gradingMethod: 'held',
        graderDigest: 'x',
        gradingLayersUsed: [1, 2, 3],
        rationale: 'x',
      } as GradingResult,
    );

    expect(
      (rq as unknown as { upsertAfterAnswer: ReturnType<typeof vi.fn> }).upsertAfterAnswer,
    ).not.toHaveBeenCalled();
    expect(
      (rq as unknown as { overwriteAfterOverride: ReturnType<typeof vi.fn> }).overwriteAfterOverride,
    ).not.toHaveBeenCalled();
  });
});
