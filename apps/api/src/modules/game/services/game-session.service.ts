import { BadRequestException, Injectable } from '@nestjs/common';
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
  // 활성 라운드를 메모리에 보관 (단일 인스턴스 가정).
  // 멀티 인스턴스 확장 시 Redis로 이전.
  private readonly activeRounds = new Map<string, Round>();

  constructor(
    private readonly registry: GameModeRegistry,
    private readonly pool: QuestionPoolService,
    private readonly usersService: UsersService,
    @InjectRepository(AnswerHistoryEntity)
    private readonly historyRepo: Repository<AnswerHistoryEntity>,
  ) {}

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
    const result = {
      ...baseResult,
      correctAnswer: round.question.answer,
      explanation: round.question.explanation ?? null,
    };

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
