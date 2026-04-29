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

/**
 * 401 자동 refresh 시 재시도 동안 한 번만 refresh 호출 보장 (concurrent request race 방지).
 * backend Redis SETNX 가 server-side race 는 막지만, client 에서 동일 요청을 N번
 * 동시에 fail-retry 하면 N번 refresh 호출 → 비효율. 단일 promise 캐시.
 */
let inflightRefresh: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`refresh failed: ${res.status}`);
      }
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // dual-mode: cookie 가 우선이고 Bearer 는 transition window 호환 (Phase 7).
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    // PR-10a §4.2.1 — httpOnly cookie 자동 송신 + CORS credentials.
    credentials: 'include',
  });

  // 401 → 자동 refresh 1회 retry. 단 본질적으로 게스트가 401 일 수 있는 endpoint
  // (/auth/refresh, /auth/login, /auth/register, /users/me) 는 refresh 시도 자체가
  // 무의미 — refresh cookie 도 없는 상태이면 retry 도 401 → 무한 호출 위험.
  const skipRetry =
    path === '/auth/refresh' ||
    path === '/auth/login' ||
    path === '/auth/register' ||
    path === '/users/me';
  if (res.status === 401 && !retried && !skipRetry) {
    try {
      await refreshOnce();
      return request<T>(method, path, options, true);
    } catch {
      // refresh 실패 → 401 그대로 전파
    }
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API ${method} ${path} failed: ${res.status} ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

export interface MeResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export const apiClient = {
  auth: {
    register: (input: { username: string; email: string; password: string }) =>
      request<{ accessToken: string; refreshToken: string }>('POST', '/auth/register', {
        body: input,
      }),
    login: (input: { email: string; password: string }) =>
      request<{ accessToken: string; refreshToken: string }>('POST', '/auth/login', {
        body: input,
      }),
    /** Header 의 인증 상태 polling 용 — 401 시 자동 refresh 후 retry. */
    me: () => request<MeResponse>('GET', '/users/me'),
    /** PR-10a §4.2.1 B — incrementTokenEpoch + revokeAllForUser + clearCookie. */
    logout: () => request<{ ok: true }>('POST', '/auth/logout', { body: {} }),
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
