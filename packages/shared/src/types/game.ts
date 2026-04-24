import type { Difficulty, Topic } from './curriculum';
import type { Question } from './question';

/**
 * 게임 모드 식별자 (ADR-012 §구현 범위 1 — multiple-choice 추가)
 */
export const GAME_MODE_IDS = [
  'blank-typing',
  'term-match',
  'result-predict',
  'category-sort',
  'scenario',
  'multiple-choice',
] as const;

export type GameModeId = (typeof GAME_MODE_IDS)[number];

export const GAME_MODE_LABELS: Record<GameModeId, string> = {
  'blank-typing': '빈칸 타이핑',
  'term-match': '용어 맞추기',
  'result-predict': '결과 예측',
  'category-sort': '카테고리 분류',
  scenario: '시나리오 시뮬레이션',
  'multiple-choice': '객관식',
};

/**
 * 답안 형식 축 (ADR-012) — GameMode와 직교하게 조합됨.
 * MVP-A: single-token + multiple-choice 만 사용. 나머지는 MVP-B/C 도입.
 */
export const ANSWER_FORMATS = [
  'single-token',
  'free-form',
  'multiple-choice',
  'reorder',
  'drag-compose',
  'output-select',
] as const;

export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

/**
 * 라운드 생성 설정
 */
export interface RoundConfig {
  topic: Topic;
  week: number;
  difficulty: Difficulty;
  timeLimit: number; // seconds
}

/**
 * 한 라운드 = 한 문제 + 정답 + 메타데이터
 */
export interface Round {
  id: string;
  question: Question;
  correctAnswers: string[]; // 복수 정답 허용 (대소문자 무시)
  hints: string[];
  timeLimit: number;
  config: RoundConfig;
}

/**
 * 플레이어가 제출한 답변
 */
export interface PlayerAnswer {
  roundId: string;
  playerId: string;
  answer: string;
  submittedAt: number; // epoch ms
  hintsUsed: number;
  /**
   * ADR-016 §7 + ADR-018 §4 D3 Hybrid + consensus-007 C2-1.
   *
   * free-form 채점 경로(Layer 3 LLM-judge) 에서 Langfuse trace metadata 의
   * `session_id` 키로 전파된다 (화이트리스트 4종 중 하나). ADR-018 §8 금지 6
   * 에 따라 userId 파생정보는 Langfuse 로 절대 전송되지 않는다.
   *
   * MC / blank-typing / term-match 등 all-or-nothing 경로는 사용하지 않는다.
   */
  sessionId?: string;
}

/**
 * 채점 결과 (mode 내부 반환 — 채점 정보만)
 */
export interface EvaluationCore {
  roundId: string;
  playerId: string;
  isCorrect: boolean;
  matchedAnswer?: string; // 어떤 정답과 매칭되었는지
  score: number;
  timeTakenMs: number;
  hintsUsed: number;
}

/**
 * 채점 결과 (외부 응답 — 정답/해설 포함)
 *
 * SDD §6.1 + IMPLEMENTATION_STATUS §6 — 오답/정답 모두 응답에서 정답/해설을
 * 즉시 노출한다 (학습 효과 강화). 클라이언트는 isCorrect=false면 정답 + 해설을
 * 표시, true면 해설만 표시하는 식으로 활용. 정답/해설은 game-session 레이어가
 * round.question에서 채워서 mode의 채점 결과와 합친다.
 */
export interface EvaluationResult extends EvaluationCore {
  /** 정답 (모든 허용 정답). blank 모드는 빈칸별 정답 배열. */
  correctAnswer: string[];
  /** AI/관리자가 작성한 해설. 없으면 null */
  explanation: string | null;
}

/**
 * 게임 모드 인터페이스 (Strategy Pattern)
 *
 * 모든 게임 모드는 이 인터페이스를 구현한다.
 * 새로운 모드 추가 시 이 인터페이스만 구현하면 된다.
 */
export interface GameMode {
  readonly id: GameModeId;
  readonly name: string;
  readonly description: string;
  readonly supportedTopics: readonly Topic[];

  /**
   * 라운드 생성: 문제 풀에서 조건에 맞는 문제를 선택하거나 AI로 생성
   */
  generateRound(question: Question, config: RoundConfig): Round;

  /**
   * 답변 채점: 정답 여부 + 점수 계산.
   * 정답/해설(EvaluationResult 확장 필드)은 session 레이어가 채운다.
   */
  evaluateAnswer(round: Round, answer: PlayerAnswer): EvaluationCore;
}
