import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  Difficulty,
  GameModeId,
  QuestionContent,
  Topic,
} from '@oracle-game/shared';

import { QuestionEntity } from '../content/entities/question.entity';
import { AnswerHistoryEntity } from './entities/answer-history.entity';

/**
 * 사용자 오답 노트 (사용자 Q1~Q3, 2026-04-24).
 *
 *  - Q1=b: 문제당 1 row 로 집계 (`wrongCount` + `totalAttempts`).
 *  - Q2=a: SR due 뱃지와 완전 분리 — `answer_history` 만 읽고 `review_queue` 미참조.
 *  - Q3=b: 최종 시도가 정답이어도 이력 보존 + `currentlyCorrect` 플래그.
 *
 * 3-step 쿼리:
 *  1. answer_history GROUP BY question_id (wrongCount > 0 HAVING) + JOIN questions
 *     (topic/week/gameMode/status=active 필터).
 *  2. question_id 들로 questions 상세 조회 (content/explanation/scenario/rationale).
 *  3. question 당 최신 시도 (DISTINCT ON question_id ORDER created_at DESC).
 *
 * 페이지네이션: limit 기본 20 / 상한 100 / offset, overfetch+1 로 hasMore 판정.
 */
export interface MistakeFilters {
  topic?: Topic;
  week?: number;
  gameMode?: GameModeId;
  limit?: number;
  offset?: number;
}

export interface MistakeItem {
  questionId: string;
  question: {
    content: QuestionContent;
    explanation: string | null;
    scenario: string | null;
    rationale: string | null;
    answer: string[];
    topic: Topic;
    week: number;
    gameMode: GameModeId;
    difficulty: Difficulty;
  };
  wrongCount: number;
  totalAttempts: number;
  /**
   * Q3=b 뱃지 — 최신 시도가 정답이면 `true` (이력은 보존, UI 에서 "정답 처리됨" 뱃지).
   */
  currentlyCorrect: boolean;
  lastAttempt: {
    answer: string;
    isCorrect: boolean;
    answeredAt: Date;
    hintsUsed: number;
  } | null;
}

/**
 * 학습 범위(주차) / topic / gameMode 가 늘어나도 UI 가 하드코딩 없이 동적 대응하도록
 * 서버가 "내 오답 전체 인벤토리" 를 차원별 집계해서 같이 내려준다.
 *
 * summary 는 **필터와 무관한 전체** 집계 — 필터 드롭다운 옵션을 생성하고 "다른
 * 주차/토픽도 오답이 있다" 를 가시화. 필터를 통해 좁혀지는 건 mistakes 배열과
 * total 만.
 */
export interface MistakeSummary {
  byWeek: Array<{ week: number; count: number }>;
  byTopic: Array<{ topic: Topic; count: number }>;
  byGameMode: Array<{ gameMode: GameModeId; count: number }>;
}

export interface MistakesResponse {
  mistakes: MistakeItem[];
  total: number;
  hasMore: boolean;
  summary: MistakeSummary;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class UserMistakesService {
  private readonly logger = new Logger(UserMistakesService.name);

  constructor(
    @InjectRepository(AnswerHistoryEntity)
    private readonly historyRepo: Repository<AnswerHistoryEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
  ) {}

  async getMistakes(
    userId: string,
    filters: MistakeFilters = {},
  ): Promise<MistakesResponse> {
    if (!userId) {
      return {
        mistakes: [],
        total: 0,
        hasMore: false,
        summary: { byWeek: [], byTopic: [], byGameMode: [] },
      };
    }

    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(filters.offset ?? 0, 0);

    // Summary 는 필터 무관 전체 인벤토리 — UI 드롭다운 생성 + 주차·토픽 확장 자동 대응.
    const summary = await this.computeSummary(userId);

    const statsQb = this.historyRepo
      .createQueryBuilder('ah')
      .innerJoin(QuestionEntity, 'q', 'q.id = ah.question_id')
      .select('ah.question_id', 'questionId')
      .addSelect(
        'COUNT(*) FILTER (WHERE ah.is_correct = false)::int',
        'wrongCount',
      )
      .addSelect('COUNT(*)::int', 'totalAttempts')
      .addSelect('MAX(ah.created_at)', 'lastAnsweredAt')
      .where('ah.user_id = :userId', { userId })
      .andWhere('q.status = :status', { status: 'active' })
      .groupBy('ah.question_id')
      // q.* 컬럼들은 본 group by 에 포함되지 않았으므로 별도 SELECT 불필요 — summary
      // 는 별도 쿼리에서 계산.
      .having('COUNT(*) FILTER (WHERE ah.is_correct = false) > 0');

    if (filters.topic) {
      statsQb.andWhere('q.topic = :topic', { topic: filters.topic });
    }
    if (filters.week !== undefined) {
      statsQb.andWhere('q.week = :week', { week: filters.week });
    }
    if (filters.gameMode) {
      statsQb.andWhere('q.game_mode = :gameMode', {
        gameMode: filters.gameMode,
      });
    }

    // total (filter 조건 만족 전체 count, 정렬/페이지 무관).
    const totalRows = await statsQb.clone().getRawMany();
    const total = totalRows.length;

    const pageRows = await statsQb
      .orderBy('MAX(ah.created_at)', 'DESC')
      .limit(limit + 1)
      .offset(offset)
      .getRawMany();

    const hasMore = pageRows.length > limit;
    const paged = pageRows.slice(0, limit);
    if (paged.length === 0) {
      return { mistakes: [], total, hasMore: false, summary };
    }

    const ids = paged.map((r) => r.questionId as string);
    const questions = await this.questionRepo.findBy({ id: In(ids) });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const latestAttempts = await this.historyRepo
      .createQueryBuilder('ah')
      .distinctOn(['ah.question_id'])
      .where('ah.user_id = :userId', { userId })
      .andWhere('ah.question_id IN (:...ids)', { ids })
      .orderBy('ah.question_id', 'ASC')
      .addOrderBy('ah.created_at', 'DESC')
      .getMany();
    const latestMap = new Map(latestAttempts.map((a) => [a.questionId, a]));

    const mistakes: MistakeItem[] = paged
      .map((row): MistakeItem | null => {
        const question = questionMap.get(row.questionId as string);
        if (!question) return null;
        const latest = latestMap.get(row.questionId as string);
        return {
          questionId: row.questionId as string,
          question: {
            content: question.content,
            explanation: question.explanation ?? null,
            scenario: question.scenario ?? null,
            rationale: question.rationale ?? null,
            answer: question.answer,
            topic: question.topic,
            week: question.week,
            gameMode: question.gameMode,
            difficulty: question.difficulty,
          },
          wrongCount: Number(row.wrongCount),
          totalAttempts: Number(row.totalAttempts),
          currentlyCorrect: latest?.isCorrect ?? false,
          lastAttempt: latest
            ? {
                answer: latest.answer,
                isCorrect: latest.isCorrect,
                answeredAt: latest.createdAt,
                hintsUsed: latest.hintsUsed,
              }
            : null,
        };
      })
      .filter((m): m is MistakeItem => m !== null);

    return { mistakes, total, hasMore, summary };
  }

  /**
   * 필터 무관 전체 오답 인벤토리를 차원별로 집계. 주차 / topic / gameMode 확장 시
   * UI 드롭다운 옵션을 하드코딩 없이 자동 생성 (사용자 지적: 학습 범위 확장 대응).
   *
   * 3 쿼리 (각 차원 독립 GROUP BY) — Postgres `COUNT(DISTINCT)` 로 문제 단위 집계.
   * 각 차원의 `count` 는 "user 가 해당 dim 에서 1회 이상 틀린 **문제 수**" (답변 수 아님).
   */
  private async computeSummary(userId: string): Promise<MistakeSummary> {
    const baseQb = () =>
      this.historyRepo
        .createQueryBuilder('ah')
        .innerJoin(QuestionEntity, 'q', 'q.id = ah.question_id')
        .where('ah.user_id = :userId', { userId })
        .andWhere('q.status = :status', { status: 'active' })
        .andWhere('ah.is_correct = false');

    const [byWeekRows, byTopicRows, byGameModeRows] = await Promise.all([
      baseQb()
        .select('q.week', 'dim')
        .addSelect('COUNT(DISTINCT ah.question_id)::int', 'count')
        .groupBy('q.week')
        .orderBy('q.week', 'ASC')
        .getRawMany(),
      baseQb()
        .select('q.topic', 'dim')
        .addSelect('COUNT(DISTINCT ah.question_id)::int', 'count')
        .groupBy('q.topic')
        .orderBy('q.topic', 'ASC')
        .getRawMany(),
      baseQb()
        .select('q.game_mode', 'dim')
        .addSelect('COUNT(DISTINCT ah.question_id)::int', 'count')
        .groupBy('q.game_mode')
        .orderBy('q.game_mode', 'ASC')
        .getRawMany(),
    ]);

    return {
      byWeek: byWeekRows.map((r) => ({
        week: Number(r.dim),
        count: Number(r.count),
      })),
      byTopic: byTopicRows.map((r) => ({
        topic: r.dim as Topic,
        count: Number(r.count),
      })),
      byGameMode: byGameModeRows.map((r) => ({
        gameMode: r.dim as GameModeId,
        count: Number(r.count),
      })),
    };
  }
}
