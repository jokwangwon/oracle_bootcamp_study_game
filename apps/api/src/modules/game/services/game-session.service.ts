import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type Difficulty,
  type EvaluationResult,
  type GameModeId,
  type PlayerAnswer,
  type Round,
  type Topic,
} from '@oracle-game/shared';

import { QuestionPoolService } from '../../content/services/question-pool.service';
import { ScopeValidatorService } from '../../content/services/scope-validator.service';
import { GradingOrchestrator } from '../../grading/grading.orchestrator';
import type { GradingResult } from '../../grading/grading.types';
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
    if (
      answerFormat === 'free-form' &&
      this.isFreeFormGradingEnabled() &&
      this.gradingOrchestrator &&
      this.scopeValidator
    ) {
      result = await this.gradeFreeForm(round, answer, result);
    }

    // SDD §5.1 + §6.1: 모든 답변은 answer_history에 기록 (Spaced Repetition 전제).
    await this.historyRepo.save(
      this.historyRepo.create({
        userId: answer.playerId,
        questionId: round.question.id,
        answer: answer.answer,
        isCorrect: result.isCorrect,
        score: result.score,
        timeTakenMs: result.timeTakenMs,
        hintsUsed: result.hintsUsed,
        gameMode: round.question.gameMode,
      }),
    );

    this.activeRounds.delete(answer.roundId);
    return result;
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
  ): Promise<EvaluationResult> {
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

    return {
      ...base,
      isCorrect: gradingResult.isCorrect,
      // MVP 점수: partial_score × baseResult.score 최대값 (mode 난이도 반영).
      // base.score 는 mode.evaluateAnswer 가 정답 가정 시 부여한 원점수. 오답일 때 0.
      score: gradingResult.isCorrect
        ? Math.round(gradingResult.partialScore * this.maxScoreForFreeForm(round))
        : 0,
    };
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
