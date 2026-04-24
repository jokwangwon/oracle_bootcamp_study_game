import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import type {
  AnswerFormat,
  Difficulty,
  GameModeId,
  QuestionContent,
  QuestionSource,
  QuestionStatus,
  Topic,
} from '@oracle-game/shared';

import { QuestionEntity } from '../entities/question.entity';

export interface QuestionQuery {
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  difficulty?: Difficulty;
}

/**
 * ADR-019 §5.2 PR-4 — `pickQuestions(..., { srRatio: 0.7 })` 가 SR due 문제를
 * 먼저 뽑은 뒤 random 보충을 요청할 때, 이미 포함된 id 를 제외하기 위한 옵션.
 * 미사용 시 (빈 배열 또는 undefined) 기존 동작 유지 (회귀 0).
 */
export interface PickRandomOpts {
  excludeIds?: string[];
}

/**
 * 새 문제 저장 입력. Partial<QuestionEntity>나 QuestionContent
 * (discriminated union 5개)를 그대로 노출하면 TypeORM의 DeepPartial
 * generic 추론과 결합하여 TS2589 (excessively deep) 가 발생한다.
 *
 * 따라서 content는 unknown으로 두고, 호출자가 questionContentSchema (Zod)
 * 또는 기타 런타임 검증을 통해 정확성을 보장한다 — 헌법 §3 (계산적 검증).
 */
export interface SaveQuestionInput {
  topic: Topic;
  week: number;
  gameMode: GameModeId;
  /** ADR-012 — 미지정 시 DB default 'single-token' */
  answerFormat?: AnswerFormat;
  difficulty: Difficulty;
  content: unknown;
  answer: string[];
  explanation: string | null;
  status: QuestionStatus;
  source: QuestionSource;
}

@Injectable()
export class QuestionPoolService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
  ) {}

  /**
   * 주어진 조건에 맞는 활성 문제를 무작위로 N개 조회한다.
   * 학습 범위 누적: 1주차 사용자도 1주차까지의 모든 문제를 풀 수 있도록
   * `week <= request.week` 로 누적 조회한다.
   *
   * ADR-019 §5.2 PR-4 — `opts.excludeIds` 로 특정 문제 제외 가능.
   * SR due 문제 먼저 편성 후 random 보충 시 중복 방지에 사용.
   */
  async pickRandom(
    query: QuestionQuery,
    count: number,
    opts?: PickRandomOpts,
  ): Promise<QuestionEntity[]> {
    const qb = this.questionRepo
      .createQueryBuilder('q')
      .where('q.status = :status', { status: 'active' })
      .andWhere('q.topic = :topic', { topic: query.topic })
      .andWhere('q.gameMode = :gameMode', { gameMode: query.gameMode })
      .andWhere('q.week <= :week', { week: query.week });

    if (query.difficulty) {
      qb.andWhere('q.difficulty = :difficulty', { difficulty: query.difficulty });
    }

    if (opts?.excludeIds && opts.excludeIds.length > 0) {
      qb.andWhere('q.id NOT IN (:...excludeIds)', {
        excludeIds: opts.excludeIds,
      });
    }

    qb.orderBy('RANDOM()').limit(count);

    return qb.getMany();
  }

  async findById(id: string): Promise<QuestionEntity> {
    const q = await this.questionRepo.findOne({ where: { id } });
    if (!q) {
      throw new NotFoundException(`Question ${id} not found`);
    }
    return q;
  }

  async countByWeek(week: number): Promise<number> {
    return this.questionRepo.count({
      where: { status: 'active', week: LessThanOrEqual(week) },
    });
  }

  async save(input: SaveQuestionInput): Promise<QuestionEntity> {
    // questionRepo.create는 DeepPartial<QuestionEntity>를 받는데 이 generic이
    // jsonb + discriminated union과 결합하면 TS2589 폭발. SaveQuestionInput을
    // 이미 좁혔으므로 unknown 경유 캐스팅으로 추론을 끊는다 (런타임은 동일).
    const entity = this.questionRepo.create(
      input as unknown as QuestionEntity,
    );
    return this.questionRepo.save(entity);
  }
}
