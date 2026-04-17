import type { Difficulty, Topic } from './curriculum';
import type { AnswerFormat, GameModeId } from './game';

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
  | ScenarioContent
  | MultipleChoiceContent;

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
 * 객관식 콘텐츠 (ADR-012)
 *
 * options[i].id 가 정답 참조 키. Question.answer 는 정답 option id 배열.
 * 단일 정답: answer.length === 1. 복수 정답(All-that-apply): answer.length >= 2.
 * stem: 문제 지문 (선택 전 사용자가 읽는 본문). SQL 블록이면 prompt 레벨에서 코드블록 처리.
 */
export interface MultipleChoiceContent {
  type: 'multiple-choice';
  stem: string;
  options: Array<{
    id: string; // 'A' | 'B' | 'C' | 'D' | ... (안정 식별자)
    text: string;
  }>;
  /** 복수 정답 허용 여부 (기본 false = 단일 정답) */
  allowMultiple?: boolean;
}

/**
 * 문제 (DB에 저장되는 단위)
 */
export interface Question {
  id: string;
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  /**
   * 답안 형식 축 (ADR-012). DB 컬럼은 not null / default 'single-token'.
   * GameMode와 직교 조합됨 — 예: gameMode='blank-typing' + answerFormat='multiple-choice'
   * 는 "빈칸을 보기 중에서 고르는" 객관식 변형.
   *
   * 인터페이스 상 optional인 이유: 기존 시드/픽스처/AI 생성기 호환. DB에서 읽을 때는
   * 항상 값이 채워져 있으며, 미지정 시 런타임 기본값은 'single-token'.
   */
  answerFormat?: AnswerFormat;
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
