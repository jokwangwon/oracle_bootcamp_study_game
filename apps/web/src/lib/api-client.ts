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
  },
};
