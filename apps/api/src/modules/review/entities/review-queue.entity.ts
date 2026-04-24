import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ADR-019 — SM-2 Spaced Repetition 상태.
 *
 * ## 성격: 파생/캐시 테이블
 *
 * `review_queue` 는 `answer_history` 를 입력으로 하는 SM-2 상태의 materialized
 * projection 이다. 다음 성질을 갖는다:
 *
 *  1. **WORM 아님** — UPDATE 가 정상 동작. `(userId, questionId)` 행이 매 답변마다 갱신.
 *  2. **재생성 가능** — `answer_history` 를 시간순 replay 하면 전체 본 테이블을 재구성 가능.
 *  3. **`userTokenHash` 는 가변** — salt rotation 발생 시 다음 UPSERT 가 현재 epoch 로 재계산.
 *     `answer_history` 와 달리 과거 epoch 를 보존하지 않는다 (캐시 특성).
 *  4. **WORM 트리거 설치 금지** (ADR-019 §4.1, Agent A-CRITICAL #3) — `answer_history`
 *     트리거 (migration 1714000002000) 를 본 테이블에 복제하면 SM-2 가 불능화됨.
 *
 * ## SM-2 상태 축 (ADR-019 §3.1)
 *
 *  - `easeFactor` (numeric 4,3): 2.500 default. SM-2 canonical lower bound 1.3 +
 *    SM-2-lite clamp [2.3, 2.6] (env 항상 ON).
 *  - `intervalDays`: 다음 재학습까지 일수.
 *  - `repetition`: 연속 quality≥3 성공 횟수. q<3 시 0 으로 리셋.
 *  - `dueAt`: 다음 복습 예정 시각. `NOW() >= dueAt` 이면 오늘 due.
 *  - `lastReviewedAt`: 최근 답변 시점.
 *  - `lastQuality`: 관측용 (0~5).
 *
 * ## 알고리즘 교체 포인트
 *
 *  - `algorithmVersion` default `'sm2-v1'`. FSRS 전환 시 별도 value 로 marking →
 *    기존 행 마이그레이션 경로 확보 (ADR-019 §4.2).
 *
 * ## D3 Hybrid 대칭축 (ADR-019 §4.3, Agent B-C1)
 *
 *  - `userTokenHash` + `userTokenHashEpoch` — `answer_history` / `ops_event_log`
 *    와 동일 스키마 축. 단 **가변 캐시** 라 rotation 후 재계산 (과거 보존 X).
 */
@Entity('review_queue')
@Index('idx_review_queue_user_due', ['userId', 'dueAt'], {
  where: '"due_at" IS NOT NULL',
})
export class ReviewQueueEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    name: 'ease_factor',
    default: '2.500',
  })
  easeFactor!: string;

  @Column({ type: 'int', name: 'interval_days', default: 0 })
  intervalDays!: number;

  @Column({ type: 'int', default: 0 })
  repetition!: number;

  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'last_reviewed_at', nullable: true })
  lastReviewedAt!: Date | null;

  @Column({ type: 'smallint', name: 'last_quality', nullable: true })
  lastQuality!: number | null;

  /**
   * ADR-019 §4.2 — 알고리즘 교체 대비. 초기값 `'sm2-v1'`. FSRS 전환 시 별도 value.
   */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'algorithm_version',
    default: 'sm2-v1',
  })
  algorithmVersion!: string;

  /**
   * ADR-019 §4.3 + ADR-018 §4 D3 Hybrid 대칭성.
   * nullable — env salt/epoch 미주입 환경 (단위 테스트) 호환.
   */
  @Column({
    type: 'varchar',
    length: 32,
    name: 'user_token_hash',
    nullable: true,
  })
  userTokenHash!: string | null;

  @Column({
    type: 'smallint',
    name: 'user_token_hash_epoch',
    nullable: true,
  })
  userTokenHashEpoch!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
