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

const BASE_SCORE = 1_200;
const HINT_PENALTY_PER_USE = 0.25; // 힌트 1회당 25% 차감
const TIME_BONUS_WEIGHT = 0.4;

/**
 * 용어 맞추기 게임 모드
 *
 * SDD §3.2 Mode 2: 설명을 보고 함수/키워드를 타이핑.
 * 학습 효과: 용어 ↔ 의미 양방향 연결.
 *
 * 힌트 시스템:
 *  1. 첫 글자 노출
 *  2. 글자 수 노출
 *  3. 카테고리 노출 (있는 경우)
 */
@Injectable()
export class TermMatchMode implements GameMode {
  readonly id: GameModeId = 'term-match';
  readonly name: string = GAME_MODE_LABELS['term-match'];
  readonly description: string =
    '설명을 보고 Oracle 함수/키워드를 타이핑하여 용어와 의미를 연결하는 게임';
  readonly supportedTopics: readonly Topic[] = CURRICULUM_TOPICS;

  generateRound(question: Question, config: RoundConfig): Round {
    if (question.content.type !== 'term-match') {
      throw new Error(
        `TermMatchMode는 term-match 컨텐츠만 지원합니다. (received: ${question.content.type})`,
      );
    }

    const primary = question.answer[0] ?? '';
    const hints = this.buildHints(primary, question.content.category);

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

  private buildHints(answer: string, category?: string): string[] {
    const hints: string[] = [];
    if (answer.length > 0) {
      hints.push(`첫 글자: ${answer[0]?.toUpperCase()}`);
      hints.push(`총 ${answer.length}글자`);
    }
    if (category) {
      hints.push(`카테고리: ${category}`);
    }
    return hints;
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
