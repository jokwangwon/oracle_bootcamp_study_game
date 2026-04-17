import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CURRICULUM_TOPICS,
  GAME_MODE_LABELS,
  type EvaluationCore,
  type GameMode,
  type GameModeId,
  type MultipleChoiceContent,
  type PlayerAnswer,
  type Question,
  type Round,
  type RoundConfig,
  type Topic,
} from '@oracle-game/shared';

const BASE_SCORE = 900;
const HINT_PENALTY_PER_USE = 0.2;
const TIME_BONUS_WEIGHT = 0.4;

/**
 * 객관식 게임 모드 (ADR-012 Mode 6)
 *
 * SDD §3.2 Mode 6: 4지선다 / N지선다. 단일/복수 정답 지원.
 * MVP-A 정책: 채점은 all-or-nothing (부분 점수 없음). 역피라미드 3단 채점은
 * MVP-B에서 free-form과 함께 도입 (ADR-013).
 *
 * 답안 입력: CSV로 옵션 id 전달. "B" (단일) / "A,B,D" (복수, 순서 무관).
 */
@Injectable()
export class MultipleChoiceMode implements GameMode {
  readonly id: GameModeId = 'multiple-choice';
  readonly name: string = GAME_MODE_LABELS['multiple-choice'];
  readonly description: string =
    '보기 중에서 정답을 선택하는 객관식 모드. 단일/복수 정답 모두 지원.';
  readonly supportedTopics: readonly Topic[] = CURRICULUM_TOPICS;

  generateRound(question: Question, config: RoundConfig): Round {
    if (question.content.type !== 'multiple-choice') {
      throw new Error(
        `MultipleChoiceMode는 multiple-choice 컨텐츠만 지원합니다. (received: ${question.content.type})`,
      );
    }

    const content = question.content;
    const hints = this.buildHints(content, question.answer);

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
    const content = round.question.content;
    const allowMultiple =
      content.type === 'multiple-choice' && Boolean(content.allowMultiple);

    const submitted = this.parseSelection(answer.answer);
    const expected = new Set(
      round.correctAnswers.map((id) => this.normalizeId(id)),
    );

    const isCorrect =
      (allowMultiple || submitted.size === 1) &&
      this.setsEqual(submitted, expected);

    return {
      roundId: round.id,
      playerId: answer.playerId,
      isCorrect,
      matchedAnswer: isCorrect
        ? [...expected].sort().join(',')
        : undefined,
      score: isCorrect ? this.calculateScore(round, answer) : 0,
      timeTakenMs: answer.submittedAt,
      hintsUsed: answer.hintsUsed,
    };
  }

  private buildHints(
    content: MultipleChoiceContent,
    answer: string[],
  ): string[] {
    const hints = [`보기 ${content.options.length}개 중 선택`];
    if (content.allowMultiple && answer.length > 1) {
      hints.push(`정답 ${answer.length}개`);
    }
    return hints;
  }

  private parseSelection(raw: string): Set<string> {
    return new Set(
      raw
        .split(',')
        .map((token) => this.normalizeId(token))
        .filter((token) => token.length > 0),
    );
  }

  private normalizeId(text: string): string {
    return text.trim().toUpperCase();
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
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
