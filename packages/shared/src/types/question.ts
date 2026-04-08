import type { Difficulty, Topic } from './curriculum';
import type { GameModeId } from './game';

/**
 * 문제 컨텐츠 (게임 모드별로 다른 구조)
 *
 * Discriminated union으로 모드별 컨텐츠를 안전하게 분리한다.
 */
export type QuestionContent =
  | BlankTypingContent
  | TermMatchContent
  | ResultPredictContent
  | CategorySortContent
  | ScenarioContent;

export interface BlankTypingContent {
  type: 'blank-typing';
  sql: string; // 빈칸이 ___로 표시된 SQL문
  blanks: Array<{
    position: number;
    answer: string;
    hint?: string;
  }>;
}

export interface TermMatchContent {
  type: 'term-match';
  description: string;
  category?: string; // 예: "SQL 함수", "DCL 명령어"
}

export interface ResultPredictContent {
  type: 'result-predict';
  sql: string;
  options?: string[]; // 객관식인 경우
  expectedResult: string;
}

export interface CategorySortContent {
  type: 'category-sort';
  items: Array<{
    name: string;
    correctCategory: string;
  }>;
  categories: string[];
}

export interface ScenarioContent {
  type: 'scenario';
  scenario: string; // 상황 설명
  oraError?: string; // ORA-XXXXX 에러 메시지 (선택)
  steps: Array<{
    description: string;
    expectedSql: string;
    hint?: string;
  }>;
}

/**
 * 문제 (DB에 저장되는 단위)
 */
export interface Question {
  id: string;
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  difficulty: Difficulty;
  content: QuestionContent;
  answer: string[]; // 정답 (복수 허용)
  explanation?: string | null;
  status: QuestionStatus;
  source: QuestionSource;
  createdAt: Date;
}

export type QuestionStatus = 'pending_review' | 'active' | 'rejected' | 'archived';
export type QuestionSource = 'pre-generated' | 'ai-realtime' | 'manual';
