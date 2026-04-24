import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { GameModeId } from '@oracle-game/shared';

/**
 * SDD §5.1 + §5.2: 모든 답변 이력.
 *
 * 향후 Spaced Repetition (SM-2/FSRS) 알고리즘이 이 테이블을 입력으로 사용한다.
 * 따라서 모든 솔로/대전 답변은 정답 여부와 응답 시간을 함께 기록한다.
 *
 * 인덱스:
 *  - (user_id, created_at): 사용자별 최근 답변 조회
 *  - (user_id, question_id): SR 알고리즘이 동일 문제에 대한 이력을 조회
 */
@Entity('answer_history')
@Index(['userId', 'createdAt'])
@Index(['userId', 'questionId'])
export class AnswerHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'boolean', name: 'is_correct' })
  isCorrect!: boolean;

  @Column({ type: 'int', default: 0 })
  score!: number;

  @Column({ type: 'int', name: 'time_taken_ms' })
  timeTakenMs!: number;

  @Column({ type: 'int', name: 'hints_used', default: 0 })
  hintsUsed!: number;

  @Column({ type: 'varchar', length: 30, name: 'game_mode' })
  gameMode!: GameModeId;

  /**
   * ADR-013 §기록 필드 — 채점 메타 컬럼 (nullable, 점진적 도입).
   *
   * 현재 BlankTyping/TermMatch/MultipleChoice는 all-or-nothing 채점이라 null.
   * MVP-B 작성형 파이프라인 가동 시 채움:
   *   - grading_method: 'ast' | 'keyword' | 'llm-v{N}' | 'held' | 'admin-override'
   *   - grader_digest: AST/keyword는 harness_version, LLM은 모델 digest (ADR-011 pin 재사용)
   *   - grading_layers_used: [1], [1,2], [1,2,3] 중 하나 (역피라미드 경로 기록)
   *   - partial_score: 0.0 ~ 1.0, Layer 2 coverage 또는 Layer 3 confidence
   *
   * WORM 트리거는 별도 마이그레이션 (ADR-016 §6). 컬럼만 먼저 연다.
   */
  @Column({ type: 'varchar', length: 32, name: 'grading_method', nullable: true })
  gradingMethod!: string | null;

  @Column({ type: 'text', name: 'grader_digest', nullable: true })
  graderDigest!: string | null;

  @Column({ type: 'jsonb', name: 'grading_layers_used', nullable: true })
  gradingLayersUsed!: number[] | null;

  @Column({ type: 'numeric', precision: 4, scale: 3, name: 'partial_score', nullable: true })
  partialScore!: string | null;

  /**
   * consensus-007 S6-C2-6 — 역피라미드 채점의 사람-가독 근거 (복수 Layer '|' 결합).
   * MVP 대시보드/이의제기 UI 의 표시 원문. 외부 Langfuse 미전송.
   */
  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  /**
   * consensus-007 S6-C2-6 — AnswerSanitizer 플래그 (SUSPICIOUS_INPUT / BOUNDARY_ESCAPE 등).
   * null 이거나 빈 배열 → 감지된 이상 없음.
   */
  @Column({ type: 'jsonb', name: 'sanitization_flags', nullable: true })
  sanitizationFlags!: string[] | null;

  /**
   * consensus-007 S6-C2-6 — Layer 1 UNKNOWN 분류.
   * 값: dialect_unsupported | truly_invalid_syntax | empty_answer | non_sql_block | null
   */
  @Column({ type: 'varchar', length: 32, name: 'ast_failure_reason', nullable: true })
  astFailureReason!: string | null;

  /**
   * ADR-016 §7 + consensus-005 §커밋2 — userId 의 HMAC-SHA256 (첫 16 hex chars).
   *
   * 목적 (ADR-018 §4 D3 Hybrid 반영): Langfuse 에는 저장하지 않고 **DB 한정** 감사·분석용.
   *  - `answer_history.user_token_hash` 컬럼에만 저장.
   *  - Langfuse trace metadata 에는 `session_id` 만 기록 — ADR-018 §8 금지 6.
   * 산출: `hashUserToken(userId, env.USER_TOKEN_HASH_SALT)` (grading/user-token-hash.ts).
   *
   * nullable 인 이유:
   *  - 기존 all-or-nothing 게임 모드(BlankTyping/TermMatch/MC) 경로는 본 컬럼 미설정
   *  - 작성형 경로(free-form, Session 6 GameSessionService 배선 이후)만 기입
   */
  @Column({ type: 'varchar', length: 32, name: 'user_token_hash', nullable: true })
  userTokenHash!: string | null;

  /**
   * ADR-018 §4 + §5 — 해당 레코드 작성 시점 활성 salt 의 epoch_id.
   *
   * 목적: salt rotation 발생 후에도 "이 행의 user_token_hash 가 어느 salt 로 계산됐는지"
   * 복원 가능 (감사 쿼리). `user_token_hash_salt_epochs` 원장 조인 축.
   *
   * nullable 인 이유: `user_token_hash` 와 동일 정책 (free-form 경로 전에는 null).
   * 값이 있을 때는 현재 활성 epoch_id.
   */
  @Column({ type: 'smallint', name: 'user_token_hash_epoch', nullable: true })
  userTokenHashEpoch!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
