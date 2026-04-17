import type { Topic } from './curriculum';

export type UserRole = 'player' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserProgress {
  userId: string;
  topic: Topic;
  week: number;
  totalScore: number;
  gamesPlayed: number;
  accuracy: number; // 0~1
  streak: number; // 현재 연속 정답 횟수
  lastPlayedAt: Date;
}
