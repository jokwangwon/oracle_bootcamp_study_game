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
 * 사용자 오답 노트 (사용자 Q1~Q3 + UX 확장, 2026-04-24).
 *
 * ## 결정
 *  - Q1=b: 문제당 1 row 로 집계 (`wrongCount` + `totalAttempts`).
 *  - Q2=a: SR due 뱃지와 완전 분리 — `answer_history` 만 사용.
 *  - Q3=b: 최종 시도가 정답이어도 이력 보존 + `currentlyCorrect` 플래그.
 *
 * ## UX v2 (2026-04-24 저녁): 블로그 사이드바 검색
 *  - `search`: question content/explanation/scenario/rationale/answer ILIKE 검색.
 *  - `sort`: 'recent' (default) | 'wrongCount' | 'week' | 'topic'.
 *  - `status`: 'all' (default) | 'unresolved' | 'resolved'.
 *  - `summary`: 필터 무관 전체 인벤토리 → 좌측 사이드바 카운트 뱃지 자동 생성.
 *
 * ## 쿼리 전략
 *  1. summary (필터 무관) — 3 차원 독립 COUNT(DISTINCT question_id).
 *  2. stats (topic/week/gameMode/search 적용, 정렬 lastAnsweredAt DESC, **하드캡 500**).
 *  3. questions + latest attempts (DISTINCT ON question_id).
 *  4. 조립 → status 필터 → sort 재정렬 → 페이지네이션 (TS).
 *
 * status 필터를 TS 로 둔 이유: `currentlyCorrect` 는 "최신 시도" 파생값 (answer_history
 * 에 별도 컬럼 없음). DB 서브쿼리로도 가능하나 MVP 규모에서 TS 필터가 단순·안전.
 * MVP 학습자 ~20명 × 평균 오답 ~50건 = 1000 행 이내로 하드캡 500 내 수렴.
 */
export interface MistakeFilters {
  topic?: Topic;
  week?: number;
  gameMode?: GameModeId;
  /** 질문 본문·해설·시나리오·rationale·정답 ILIKE 검색 (부분 일치, 대소문자 무시). */
  search?: string;
  /** 정렬. 기본 'recent' (최근 답변순). */
  sort?: MistakeSortOption;
  /** 상태 필터. 기본 'all'. */
  status?: MistakeStatus;
  limit?: number;
  offset?: number;
}

export type MistakeSortOption = 'recent' | 'wrongCount' | 'week' | 'topic';
export type MistakeStatus = 'all' | 'unresolved' | 'resolved';

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
  currentlyCorrect: boolean;
  lastAttempt: {
    answer: string;
    isCorrect: boolean;
    answeredAt: Date;
    hintsUsed: number;
  } | null;
}

export interface MistakeSummary {
  byWeek: Array<{ week: number; count: number }>;
  byTopic: Array<{ topic: Topic; count: number }>;
  byGameMode: Array<{ gameMode: GameModeId; count: number }>;
  byStatus: { unresolved: number; resolved: number };
}

export interface MistakesResponse {
  mistakes: MistakeItem[];
  total: number;
  hasMore: boolean;
  summary: MistakeSummary;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const STATS_HARD_CAP = 500;

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
        summary: {
          byWeek: [],
          byTopic: [],
          byGameMode: [],
          byStatus: { unresolved: 0, resolved: 0 },
        },
      };
    }

    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(filters.offset ?? 0, 0);
    const status: MistakeStatus = filters.status ?? 'all';
    const sort: MistakeSortOption = filters.sort ?? 'recent';

    // Step 1: summary (필터 무관 전체 인벤토리 — 좌측 사이드바 네비게이션)
    const [dimensions, statusSummary] = await Promise.all([
      this.computeDimensionSummary(userId),
      this.computeStatusSummary(userId),
    ]);

    const summary: MistakeSummary = { ...dimensions, byStatus: statusSummary };

    // Step 2: stats (topic/week/gameMode/search 필터 DB 에서, 하드캡 500)
    const statsRows = await this.fetchStats(userId, filters);
    if (statsRows.length === 0) {
      return { mistakes: [], total: 0, hasMore: false, summary };
    }

    const ids = statsRows.map((r) => r.questionId);
    const [questions, latestAttempts] = await Promise.all([
      this.questionRepo.findBy({ id: In(ids) }),
      this.fetchLatestAttempts(userId, ids),
    ]);

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const latestMap = new Map(latestAttempts.map((a) => [a.questionId, a]));

    // Step 3: 조립
    const allItems = statsRows
      .map((row): MistakeItem | null => {
        const question = questionMap.get(row.questionId);
        if (!question) return null;
        const latest = latestMap.get(row.questionId);
        return {
          questionId: row.questionId,
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

    // Step 4: status 필터
    const statusFiltered = this.applyStatusFilter(allItems, status);

    // Step 5: sort (기본 recent 은 DB 정렬 그대로 유지)
    const sorted = this.applySort(statusFiltered, sort);

    // Step 6: pagination
    const total = sorted.length;
    const paged = sorted.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { mistakes: paged, total, hasMore, summary };
  }

  /**
   * 좌측 사이드바 "주제/주차/게임모드별 오답 수" 뱃지 생성용. 필터 무관 전체 인벤토리.
   */
  private async computeDimensionSummary(userId: string): Promise<{
    byWeek: MistakeSummary['byWeek'];
    byTopic: MistakeSummary['byTopic'];
    byGameMode: MistakeSummary['byGameMode'];
  }> {
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

  /**
   * "미해결 / 정답 처리" 뱃지 카운트. 필터 무관.
   *
   *  - unresolved = 최신 시도가 오답(false/null) 인 문제 수
   *  - resolved = 최신 시도가 정답(true) 이나 과거 오답 이력이 있는 문제 수
   */
  private async computeStatusSummary(
    userId: string,
  ): Promise<{ unresolved: number; resolved: number }> {
    // 문제별 최신 시도 is_correct 조회
    const wrongQuestions = await this.historyRepo
      .createQueryBuilder('ah')
      .innerJoin(QuestionEntity, 'q', 'q.id = ah.question_id')
      .select('DISTINCT ah.question_id', 'questionId')
      .where('ah.user_id = :userId', { userId })
      .andWhere('q.status = :status', { status: 'active' })
      .andWhere('ah.is_correct = false')
      .getRawMany();

    if (wrongQuestions.length === 0) return { unresolved: 0, resolved: 0 };

    const ids = wrongQuestions.map((r) => r.questionId);
    const latest = await this.fetchLatestAttempts(userId, ids);
    let unresolved = 0;
    let resolved = 0;
    for (const attempt of latest) {
      if (attempt.isCorrect) resolved += 1;
      else unresolved += 1;
    }
    return { unresolved, resolved };
  }

  /**
   * 오답 집계 쿼리 — topic/week/gameMode/search 필터 + lastAnsweredAt DESC 정렬.
   * 하드캡 STATS_HARD_CAP(500) 으로 대량 폭주 방어.
   */
  private async fetchStats(
    userId: string,
    filters: MistakeFilters,
  ): Promise<
    Array<{ questionId: string; wrongCount: number; totalAttempts: number; lastAnsweredAt: Date }>
  > {
    const qb = this.historyRepo
      .createQueryBuilder('ah')
      .innerJoin(QuestionEntity, 'q', 'q.id = ah.question_id')
      .select('ah.question_id', 'questionId')
      .addSelect('COUNT(*) FILTER (WHERE ah.is_correct = false)::int', 'wrongCount')
      .addSelect('COUNT(*)::int', 'totalAttempts')
      .addSelect('MAX(ah.created_at)', 'lastAnsweredAt')
      .where('ah.user_id = :userId', { userId })
      .andWhere('q.status = :status', { status: 'active' })
      .groupBy('ah.question_id')
      .having('COUNT(*) FILTER (WHERE ah.is_correct = false) > 0')
      .orderBy('MAX(ah.created_at)', 'DESC')
      .limit(STATS_HARD_CAP);

    if (filters.topic) {
      qb.andWhere('q.topic = :topic', { topic: filters.topic });
    }
    if (filters.week !== undefined) {
      qb.andWhere('q.week = :week', { week: filters.week });
    }
    if (filters.gameMode) {
      qb.andWhere('q.game_mode = :gameMode', { gameMode: filters.gameMode });
    }
    if (filters.search && filters.search.trim().length > 0) {
      const pattern = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(q.content::text ILIKE :pattern OR q.explanation ILIKE :pattern OR q.scenario ILIKE :pattern OR q.rationale ILIKE :pattern OR q.answer::text ILIKE :pattern)',
        { pattern },
      );
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      questionId: r.questionId as string,
      wrongCount: Number(r.wrongCount),
      totalAttempts: Number(r.totalAttempts),
      lastAnsweredAt: new Date(r.lastAnsweredAt),
    }));
  }

  private async fetchLatestAttempts(
    userId: string,
    questionIds: string[],
  ): Promise<AnswerHistoryEntity[]> {
    if (questionIds.length === 0) return [];
    return this.historyRepo
      .createQueryBuilder('ah')
      .distinctOn(['ah.question_id'])
      .where('ah.user_id = :userId', { userId })
      .andWhere('ah.question_id IN (:...ids)', { ids: questionIds })
      .orderBy('ah.question_id', 'ASC')
      .addOrderBy('ah.created_at', 'DESC')
      .getMany();
  }

  private applyStatusFilter(items: MistakeItem[], status: MistakeStatus): MistakeItem[] {
    if (status === 'unresolved') return items.filter((m) => !m.currentlyCorrect);
    if (status === 'resolved') return items.filter((m) => m.currentlyCorrect);
    return items;
  }

  private applySort(items: MistakeItem[], sort: MistakeSortOption): MistakeItem[] {
    const copy = [...items];
    switch (sort) {
      case 'wrongCount':
        // wrongCount DESC, tie → lastAnsweredAt DESC
        copy.sort((a, b) => {
          if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
          return compareLastAnsweredDesc(a, b);
        });
        return copy;
      case 'week':
        // week ASC, tie → wrongCount DESC
        copy.sort((a, b) => {
          if (a.question.week !== b.question.week) {
            return a.question.week - b.question.week;
          }
          return b.wrongCount - a.wrongCount;
        });
        return copy;
      case 'topic':
        // topic ASC, tie → week ASC → wrongCount DESC
        copy.sort((a, b) => {
          if (a.question.topic !== b.question.topic) {
            return a.question.topic.localeCompare(b.question.topic);
          }
          if (a.question.week !== b.question.week) {
            return a.question.week - b.question.week;
          }
          return b.wrongCount - a.wrongCount;
        });
        return copy;
      case 'recent':
      default:
        // DB 이미 lastAnsweredAt DESC. 안정성 위해 재정렬.
        copy.sort(compareLastAnsweredDesc);
        return copy;
    }
  }
}

function compareLastAnsweredDesc(a: MistakeItem, b: MistakeItem): number {
  const aTs = a.lastAttempt?.answeredAt.getTime() ?? 0;
  const bTs = b.lastAttempt?.answeredAt.getTime() ?? 0;
  return bTs - aTs;
}
