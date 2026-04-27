import type {
  Difficulty,
  EvaluationResult,
  GameModeId,
  Round,
  Topic,
  UserProgress,
} from '@oracle-game/shared';

export interface FinishSoloResponse {
  progress: UserProgress;
  summary: {
    topic: Topic;
    week: number;
    gameMode: GameModeId;
    totalRounds: number;
    correctCount: number;
    accuracy: number;
    sessionScore: number;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface RequestOptions {
  token?: string;
  body?: unknown;
}

export interface ReviewQueueSummary {
  dueCount: number;
}

/**
 * 오답 노트 응답 (사용자 Q1~Q3, 2026-04-24).
 * 학습 범위 확장 대응 — summary 는 필터 무관 전체 인벤토리로 드롭다운 옵션 생성용.
 */
export interface MistakeItem {
  questionId: string;
  question: {
    content: unknown; // QuestionContent discriminated union — UI 에서 narrow
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
    answeredAt: string; // ISO string
    hintsUsed: number;
  } | null;
}

export type MistakeSortOption = 'recent' | 'wrongCount' | 'week' | 'topic';
export type MistakeStatus = 'all' | 'unresolved' | 'resolved';

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

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API ${method} ${path} failed: ${res.status} ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  auth: {
    register: (input: { username: string; email: string; password: string }) =>
      request<{ accessToken: string }>('POST', '/auth/register', { body: input }),
    login: (input: { email: string; password: string }) =>
      request<{ accessToken: string }>('POST', '/auth/login', { body: input }),
  },
  solo: {
    start: (
      token: string,
      input: {
        topic: Topic;
        week: number;
        gameMode: GameModeId;
        difficulty: Difficulty;
        rounds: number;
      },
    ) => request<Round[]>('POST', '/games/solo/start', { token, body: input }),

    answer: (
      token: string,
      input: {
        roundId: string;
        answer: string;
        submittedAt: number;
        hintsUsed: number;
      },
    ) => request<EvaluationResult>('POST', '/games/solo/answer', { token, body: input }),

    finish: (
      token: string,
      input: {
        topic: Topic;
        week: number;
        gameMode: GameModeId;
        totalRounds: number;
        correctCount: number;
        totalScore: number;
      },
    ) => request<FinishSoloResponse>('POST', '/games/solo/finish', { token, body: input }),

    /**
     * ADR-019 §5.2 PR-4 (백엔드) / PR-5 (UI 소비).
     * 오늘 due 인 review_queue 건수. ReviewBadge 컴포넌트 입력.
     */
    reviewQueue: (token: string) =>
      request<ReviewQueueSummary>('GET', '/games/solo/review-queue', { token }),
  },
  users: {
    /**
     * 오답 노트 (사용자 Q1~Q3, 2026-04-24). 계정별 persistent.
     * Q1=b 집계 / Q2=a SR 분리 / Q3=b 정답 처리 뱃지.
     */
    mistakes: (
      token: string,
      opts: {
        topic?: Topic;
        week?: number;
        gameMode?: GameModeId;
        search?: string;
        sort?: MistakeSortOption;
        status?: MistakeStatus;
        limit?: number;
        offset?: number;
      } = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.topic) params.set('topic', opts.topic);
      if (opts.week !== undefined) params.set('week', String(opts.week));
      if (opts.gameMode) params.set('gameMode', opts.gameMode);
      if (opts.search) params.set('search', opts.search);
      if (opts.sort) params.set('sort', opts.sort);
      if (opts.status) params.set('status', opts.status);
      if (opts.limit !== undefined) params.set('limit', String(opts.limit));
      if (opts.offset !== undefined) params.set('offset', String(opts.offset));
      const q = params.toString();
      return request<MistakesResponse>(
        'GET',
        `/users/me/mistakes${q ? `?${q}` : ''}`,
        { token },
      );
    },
  },
};
