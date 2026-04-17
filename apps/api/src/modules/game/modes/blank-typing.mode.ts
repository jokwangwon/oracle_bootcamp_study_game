import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CURRICULUM_TOPICS,
  GAME_MODE_LABELS,
  type EvaluationCore,
  type GameMode,
  type GameModeId,
  type PlayerAnswer,
  type Question,
  type Round,
  type RoundConfig,
  type Topic,
} from '@oracle-game/shared';

const BASE_SCORE = 1_000;
const HINT_PENALTY_PER_USE = 0.3; // 힌트 1회당 30% 차감
const TIME_BONUS_WEIGHT = 0.5; // 시간 보너스 가중치

/**
 * 빈칸 타이핑 게임 모드
 *
 * SDD §3.2 Mode 1: SQL 구문에서 빈칸을 타이핑으로 채우는 모드.
 * 학습 효과: SQL 문법이 손에 익음 (Motor Memory + Active Recall)
 */
@Injectable()
export class BlankTypingMode implements GameMode {
  readonly id: GameModeId = 'blank-typing';
  readonly name: string = GAME_MODE_LABELS['blank-typing'];
  readonly description: string =
    'SQL 구문에서 빈칸을 타이핑으로 채워 문법을 익히는 게임';
  readonly supportedTopics: readonly Topic[] = CURRICULUM_TOPICS;

  generateRound(question: Question, config: RoundConfig): Round {
    if (question.content.type !== 'blank-typing') {
      throw new Error(
        `BlankTypingMode는 blank-typing 컨텐츠만 지원합니다. (received: ${question.content.type})`,
      );
    }

    const hints = question.content.blanks
      .map((b) => b.hint)
      .filter((h): h is string => Boolean(h));

    return {
      id: randomUUID(),
      question,
      correctAnswers: question.answer,
      hints,
      timeLimit: config.timeLimit,
      config,
    };
  }

  evaluateAnswer(round: Round, answer: PlayerAnswer): EvaluationCore {
    const normalized = this.normalize(answer.answer);
    const matched = round.correctAnswers.find(
      (correct) => this.normalize(correct) === normalized,
    );

    const isCorrect = Boolean(matched);
    const timeTakenMs = answer.submittedAt;

    return {
      roundId: round.id,
      playerId: answer.playerId,
      isCorrect,
      matchedAnswer: matched,
      score: isCorrect ? this.calculateScore(round, answer) : 0,
      timeTakenMs,
      hintsUsed: answer.hintsUsed,
    };
  }

  private normalize(text: string): string {
    return text.trim().toUpperCase();
  }

  private calculateScore(round: Round, answer: PlayerAnswer): number {
    const timeLimitMs = round.timeLimit * 1_000;
    const elapsedMs = Math.min(answer.submittedAt, timeLimitMs);
    const timeRatio = 1 - elapsedMs / timeLimitMs;
    const timeBonus = 1 + timeRatio * TIME_BONUS_WEIGHT;

    const hintPenalty = Math.max(0, 1 - answer.hintsUsed * HINT_PENALTY_PER_USE);

    return Math.round(BASE_SCORE * timeBonus * hintPenalty);
  }
}
