import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type EvaluationResult,
  type GameModeId,
  type PlayerAnswer,
  type Round,
  type Topic,
  type Difficulty,
} from '@oracle-game/shared';

import { QuestionPoolService } from '../../content/services/question-pool.service';
import { ScopeValidatorService } from '../../content/services/scope-validator.service';
import { LlmJudgeTimeoutError } from '../../grading/graders/llm-judge.grader';
import { GradingOrchestrator } from '../../grading/grading.orchestrator';
import type { GradingResult } from '../../grading/grading.types';
import { hashUserToken } from '../../grading/user-token-hash';
import { ActiveEpochLookup } from '../../ops/active-epoch.lookup';
import { GradingMeasurementService } from '../../ops/grading-measurement.service';
import { AnswerHistoryEntity } from '../../users/entities/answer-history.entity';
import { UsersService } from '../../users/users.service';
import { GameModeRegistry } from '../modes/game-mode.registry';

const DEFAULT_TIME_LIMIT_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 20,
  MEDIUM: 15,
  HARD: 10,
};

interface StartSoloInput {
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  difficulty: Difficulty;
  rounds: number;
}

export interface FinishSoloInput {
  userId: string;
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  totalRounds: number;
  correctCount: number;
  totalScore: number;
}

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);
  // 활성 라운드를 메모리에 보관 (단일 인스턴스 가정).
  // 멀티 인스턴스 확장 시 Redis로 이전.
  private readonly activeRounds = new Map<string, Round>();

  constructor(
    private readonly registry: GameModeRegistry,
    private readonly pool: QuestionPoolService,
    private readonly usersService: UsersService,
    @InjectRepository(AnswerHistoryEntity)
    private readonly historyRepo: Repository<AnswerHistoryEntity>,
    // consensus-007 S6-C2-4 — free-form 채점 분기 의존성. Optional 로 구성하여
    // 기존 단위 테스트 호출자 (MC/blank/term 경로) 회귀 0. flag=false 시 호출 경로 없음.
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly gradingOrchestrator?: GradingOrchestrator,
    @Optional() private readonly scopeValidator?: ScopeValidatorService,
    // consensus-007 S6-C2-5 — LLM-judge timeout / grading_measured 이벤트 기록.
    @Optional() private readonly gradingMeasurement?: GradingMeasurementService,
    // consensus-007 S6-C2-6 — active epoch 조회 (user_token_hash_epoch 채움).
    @Optional() private readonly activeEpoch?: ActiveEpochLookup,
  ) {}

  /**
   * consensus-007 S6-C2-4 — free-form 채점 분기 활성화 여부.
   * 기본 false (프로덕션 보수). ENABLE_FREE_FORM_GRADING=true 에서만 분기.
   */
  private isFreeFormGradingEnabled(): boolean {
    return this.config?.get<boolean>('ENABLE_FREE_FORM_GRADING') === true;
  }

  async startSolo(input: StartSoloInput): Promise<Round[]> {
    if (input.rounds < 1 || input.rounds > 50) {
      throw new BadRequestException('rounds는 1~50 사이여야 합니다');
    }

    const mode = this.registry.get(input.gameMode);
    const questions = await this.pool.pickRandom(
      {
        topic: input.topic,
        week: input.week,
        gameMode: input.gameMode,
        difficulty: input.difficulty,
      },
      input.rounds,
    );

    if (questions.length === 0) {
      throw new BadRequestException(
        `해당 조건의 활성 문제가 없습니다 (topic=${input.topic}, week=${input.week}, mode=${input.gameMode})`,
      );
    }

    const timeLimit = DEFAULT_TIME_LIMIT_BY_DIFFICULTY[input.difficulty];

    const rounds = questions.map((question) =>
      mode.generateRound(question, {
        topic: input.topic,
        week: input.week,
        difficulty: input.difficulty,
        timeLimit,
      }),
    );

    for (const round of rounds) {
      this.activeRounds.set(round.id, round);
    }

    return rounds;
  }

  async submitAnswer(answer: PlayerAnswer): Promise<EvaluationResult> {
    const round = this.activeRounds.get(answer.roundId);
    if (!round) {
      throw new BadRequestException(`Round ${answer.roundId} not found or expired`);
    }
    const mode = this.registry.get(round.question.gameMode);
    const baseResult = mode.evaluateAnswer(round, answer);

    // SDD §6.1 — 라운드 결과에 정답/해설 노출 (학습 효과 강화)
    let result: EvaluationResult = {
      ...baseResult,
      correctAnswer: round.question.answer,
      explanation: round.question.explanation ?? null,
    };

    // consensus-007 S6-C2-4 — free-form 답안 경로 (ENABLE_FREE_FORM_GRADING=true 한정).
    // flag=false 이거나 answerFormat 이 free-form 이 아니면 기존 mode.evaluateAnswer 유지.
    // GradingModule DI 미구성 환경(단위 테스트 기본)도 자동으로 기존 경로 유지 — 회귀 0.
    const answerFormat = round.question.answerFormat;
    let gradingResult: GradingResult | null = null;
    const gradingStart = Date.now();
    if (
      answerFormat === 'free-form' &&
      this.isFreeFormGradingEnabled() &&
      this.gradingOrchestrator &&
      this.scopeValidator
    ) {
      try {
        const graded = await this.gradeFreeForm(round, answer, result);
        result = graded.evaluation;
        gradingResult = graded.gradingResult;
      } catch (err) {
        if (err instanceof LlmJudgeTimeoutError) {
          // consensus-007 S6-C2-5 + PR #15 CRITICAL-1 — held persist (감사 체인
          // 완전 보존) + ops event + HTTP 503 응답 (Q3=B, 학생 재시도 유도).
          await this.persistHeldAnswer(answer, round, result, err);
          await this.gradingMeasurement?.recordLlmTimeout({
            questionId: round.question.id,
            userId: answer.playerId,
            payload: {
              timeoutMs: err.timeoutMs,
              layerAttempted: 3,
              elapsedMs: err.elapsedMs,
              retriable: true,
            },
          });
          this.activeRounds.delete(answer.roundId);
          throw new ServiceUnavailableException(
            '채점 서비스 일시 지연. 잠시 후 다시 시도해 주세요.',
          );
        }
        throw err;
      }
    }

    // SDD §5.1 + §6.1: 모든 답변은 answer_history에 기록 (Spaced Repetition 전제).
    // consensus-007 S6-C2-6 — free-form 경로는 7항 + user_token_hash + epoch 포함.
    const historyInput = await this.buildAnswerHistoryInput(
      answer,
      round,
      result,
      gradingResult,
    );
    await this.historyRepo.save(this.historyRepo.create(historyInput));

    // consensus-007 S6-C2-6 — grading_measured 이벤트 (MT6/MT8 집계 입력).
    // free-form 채점이 실제로 일어난 경우에만. fail-safe (warn).
    if (gradingResult && this.gradingMeasurement) {
      const latencyMs = Date.now() - gradingStart;
      await this.gradingMeasurement.measureGrading({
        questionId: round.question.id,
        userId: answer.playerId,
        payload: {
          gradingMethod: gradingResult.gradingMethod,
          gradingLayersUsed: gradingResult.gradingLayersUsed,
          astFailureReason: gradingResult.astFailureReason,
          partialScore: gradingResult.partialScore,
          graderDigest: gradingResult.graderDigest,
          layer1Resolved: gradingResult.gradingMethod === 'ast',
          layer3Invoked:
            gradingResult.gradingLayersUsed.includes(3) &&
            gradingResult.gradingMethod === 'llm',
          judgeInvocationCount:
            gradingResult.gradingLayersUsed.includes(3) ? 1 : 0,
          heldForReview: gradingResult.gradingMethod === 'held',
          sanitizationFlagCount: gradingResult.sanitizationFlags?.length ?? 0,
          latencyMs,
        },
      });
    }

    this.activeRounds.delete(answer.roundId);
    return result;
  }

  /**
   * consensus-007 S6-C2-6 — answer_history INSERT 입력 조립.
   *
   * free-form 경로는 7항 메타 + user_token_hash + user_token_hash_epoch 포함.
   * 비-free-form 경로는 기존 필드만 (회귀 0).
   *
   * fail-closed: free-form 경로에서 activeEpoch / salt 누락 시 throw.
   */
  private async buildAnswerHistoryInput(
    answer: PlayerAnswer,
    round: Round,
    result: EvaluationResult,
    gradingResult: GradingResult | null,
  ): Promise<Partial<AnswerHistoryEntity>> {
    const base: Partial<AnswerHistoryEntity> = {
      userId: answer.playerId,
      questionId: round.question.id,
      answer: answer.answer,
      isCorrect: result.isCorrect,
      score: result.score,
      timeTakenMs: result.timeTakenMs,
      hintsUsed: result.hintsUsed,
      gameMode: round.question.gameMode,
    };

    if (!gradingResult) {
      return base;
    }

    if (!this.activeEpoch) {
      throw new Error(
        'free-form 채점 경로에 ActiveEpochLookup 이 주입되어야 합니다 (consensus-007 S6-C2-6 fail-closed).',
      );
    }
    const salt = this.config?.get<string>('USER_TOKEN_HASH_SALT');
    if (!salt) {
      throw new Error(
        'USER_TOKEN_HASH_SALT 환경변수가 비어있습니다 (ADR-016 §7 fail-closed).',
      );
    }

    const [epochId] = await Promise.all([this.activeEpoch.getActiveEpochId()]);
    const userTokenHash = hashUserToken(answer.playerId, salt);

    return {
      ...base,
      gradingMethod: gradingResult.gradingMethod,
      graderDigest: gradingResult.graderDigest,
      gradingLayersUsed: gradingResult.gradingLayersUsed,
      partialScore: gradingResult.partialScore.toFixed(3),
      rationale: gradingResult.rationale,
      sanitizationFlags: gradingResult.sanitizationFlags ?? null,
      astFailureReason: gradingResult.astFailureReason ?? null,
      userTokenHash,
      userTokenHashEpoch: epochId,
    };
  }

  /**
   * consensus-007 S6-C2-5 + PR #15 CRITICAL-1 — Layer 3 LLM timeout 시 held
   * 감사 레코드 저장. **buildAnswerHistoryInput 를 재사용하여 WORM 감사 체인의
   * 7항 (+ user_token_hash + epoch) 을 완전 기록**한다 (Agent B CRITICAL 격상
   * 근거). 정상 채점 실패가 아니라 운영 이상(timeout) 상황이므로 감사는 오히려
   * 더 강화되어야 한다 (ADR-016 §6 WORM, ADR-018 §4 D3 Hybrid 정신).
   *
   * save 실패 시 `ops_event_log(kind='measurement_fail', cause='held_persist_fail')`
   * 강제 기록 → 학생은 HTTP 503 받지만 운영자 사후 복구용 단서 유지.
   */
  private async persistHeldAnswer(
    answer: PlayerAnswer,
    round: Round,
    base: EvaluationResult,
    timeoutErr: LlmJudgeTimeoutError,
  ): Promise<void> {
    const heldResult: GradingResult = {
      isCorrect: false,
      partialScore: 0,
      gradingMethod: 'held',
      graderDigest: 'timeout@layer3',
      gradingLayersUsed: [1, 2, 3],
      rationale: `LLM timeout after ${timeoutErr.timeoutMs}ms (Layer 3)`,
      sanitizationFlags: timeoutErr.sanitizationFlags
        ? [...timeoutErr.sanitizationFlags]
        : undefined,
      // Layer 1/2 통과 후 Layer 3 timeout 이므로 astFailureReason 은 없음.
      astFailureReason: undefined,
    };
    // held row 의 base 는 isCorrect/score 가 0 이어야 한다 (buildAnswerHistoryInput
    // 이 result 에서 꺼내므로 명시적으로 덮어쓴다).
    const heldBase: EvaluationResult = {
      ...base,
      isCorrect: false,
      score: 0,
    };

    try {
      const historyInput = await this.buildAnswerHistoryInput(
        answer,
        round,
        heldBase,
        heldResult,
      );
      await this.historyRepo.save(this.historyRepo.create(historyInput));
    } catch (err) {
      // WORM 감사 체인 보존을 위해 ops_event_log 에 강제 기록.
      // 학생은 이미 HTTP 503 을 받을 예정이므로 여기서 throw 는 금물.
      this.logger.warn(
        `held answer_history persist 실패 (fail-safe) question=${round.question.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.gradingMeasurement?.recordHeldPersistFail({
        questionId: round.question.id,
        userId: answer.playerId,
        error: err,
      });
    }
  }

  /**
   * consensus-007 S6-C2-4 — free-form 3단 채점 분기 (ADR-013).
   *
   * Layer 1 (AST) → Layer 2 (Keyword) → Layer 3 (LLM-judge) 역피라미드.
   * GradingOrchestrator 는 grade() 단일 진입점을 노출하므로 본 메서드는:
   *  1. scopeValidator 로 allowlist 조회 (week, topic 누적)
   *  2. orchestrator.grade 호출 (sessionId = roundId 재사용, ADR-018 §4 D3 Hybrid)
   *  3. GradingResult → EvaluationResult 매핑 (isCorrect + score 덮어쓰기)
   *
   * 7항 answer_history persist 와 user_token_hash_epoch 는 C2-6 에서 확장.
   * timeout 정책 (LLM_JUDGE_TIMEOUT_MS + held) 은 C2-5 에서 확장.
   */
  private async gradeFreeForm(
    round: Round,
    answer: PlayerAnswer,
    base: EvaluationResult,
  ): Promise<{ evaluation: EvaluationResult; gradingResult: GradingResult }> {
    const orchestrator = this.gradingOrchestrator!;
    const scopeValidator = this.scopeValidator!;

    const allowlist = await scopeValidator.getAllowlist(
      round.question.week,
      round.question.topic,
    );

    const expected = round.correctAnswers;
    const gradingResult: GradingResult = await orchestrator.grade({
      studentAnswer: answer.answer,
      expected,
      allowlist,
      sessionId: round.id,
    });

    const evaluation: EvaluationResult = {
      ...base,
      isCorrect: gradingResult.isCorrect,
      // MVP 점수: partial_score × baseResult.score 최대값 (mode 난이도 반영).
      // base.score 는 mode.evaluateAnswer 가 정답 가정 시 부여한 원점수. 오답일 때 0.
      score: gradingResult.isCorrect
        ? Math.round(gradingResult.partialScore * this.maxScoreForFreeForm(round))
        : 0,
    };

    return { evaluation, gradingResult };
  }

  private maxScoreForFreeForm(round: Round): number {
    // 기존 mode.evaluateAnswer 의 점수 체계와 맞추기 위해 baseResult 접근이
    // 어려우므로 난이도 상수로 고정. BlankTypingMode 와 대체로 정렬된 값.
    switch (round.config.difficulty) {
      case 'EASY':
        return 100;
      case 'MEDIUM':
        return 150;
      case 'HARD':
        return 200;
      default:
        return 100;
    }
  }

  /**
   * 솔로 세션 종료: user_progress 갱신 (SDD §6.1).
   *
   * 클라이언트가 한 세트의 결과를 집계하여 전송한다. server는 검증 후
   * UsersService.recordSessionProgress에 위임하여 누적 통계를 갱신한다.
   *
   * 위변조 방지를 위해 향후 answer_history와 교차 검증 가능하지만,
   * MVP에서는 솔로 모드의 신뢰도가 핵심이 아니므로 단순 위임으로 유지한다.
   */
  async finishSolo(input: FinishSoloInput) {
    const progress = await this.usersService.recordSessionProgress({
      userId: input.userId,
      topic: input.topic,
      week: input.week,
      totalRounds: input.totalRounds,
      correctCount: input.correctCount,
      sessionScore: input.totalScore,
    });

    return {
      progress,
      summary: {
        topic: input.topic,
        week: input.week,
        gameMode: input.gameMode,
        totalRounds: input.totalRounds,
        correctCount: input.correctCount,
        accuracy: input.totalRounds > 0 ? input.correctCount / input.totalRounds : 0,
        sessionScore: input.totalScore,
      },
    };
  }
}
