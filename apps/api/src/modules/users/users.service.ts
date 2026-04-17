import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Topic } from '@oracle-game/shared';

import { UserEntity } from './entities/user.entity';
import { UserProgressEntity } from './entities/user-progress.entity';

export interface RecordSessionProgressInput {
  userId: string;
  topic: Topic;
  week: number;
  totalRounds: number;
  correctCount: number;
  sessionScore: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserProgressEntity)
    private readonly progressRepo: Repository<UserProgressEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<UserEntity> {
    const user = this.userRepo.create({ ...input, role: 'player' });
    return this.userRepo.save(user);
  }

  async getProgress(userId: string): Promise<UserProgressEntity[]> {
    return this.progressRepo.find({ where: { userId } });
  }

  /**
   * 솔로 세션 종료 시 user_progress upsert.
   *
   * 정책 (SDD §6.1):
   *  - totalScore: 누적 합산
   *  - gamesPlayed: +1
   *  - accuracy: 라운드 가중 평균 (totalCorrectAnswers / totalRoundsPlayed)
   *  - streak: 100% 정답 세션이면 totalRounds 만큼 증가, 아니면 reset(0)
   *
   * streak 정책은 MVP 단순화 — "한 세션 내내 무결점이면 연속, 한 번 틀리면 reset".
   * 추후 라운드 단위 streak으로 정교화 가능.
   */
  async recordSessionProgress(
    input: RecordSessionProgressInput,
  ): Promise<UserProgressEntity> {
    const { userId, topic, week, totalRounds, correctCount, sessionScore } = input;

    if (totalRounds <= 0) {
      throw new BadRequestException('totalRounds는 1 이상이어야 합니다');
    }
    if (correctCount < 0 || correctCount > totalRounds) {
      throw new BadRequestException(
        `correctCount(${correctCount})는 0 이상 totalRounds(${totalRounds}) 이하여야 합니다`,
      );
    }
    if (sessionScore < 0) {
      throw new BadRequestException('sessionScore는 0 이상이어야 합니다');
    }

    const isPerfect = correctCount === totalRounds;

    const existing = await this.progressRepo.findOne({
      where: { userId, topic, week },
    });

    if (!existing) {
      const created = this.progressRepo.create({
        userId,
        topic,
        week,
        totalScore: sessionScore,
        gamesPlayed: 1,
        totalRoundsPlayed: totalRounds,
        totalCorrectAnswers: correctCount,
        accuracy: correctCount / totalRounds,
        streak: isPerfect ? totalRounds : 0,
      });
      return this.progressRepo.save(created);
    }

    existing.totalScore += sessionScore;
    existing.gamesPlayed += 1;
    existing.totalRoundsPlayed += totalRounds;
    existing.totalCorrectAnswers += correctCount;
    existing.accuracy =
      existing.totalRoundsPlayed > 0
        ? existing.totalCorrectAnswers / existing.totalRoundsPlayed
        : 0;
    existing.streak = isPerfect ? existing.streak + totalRounds : 0;

    return this.progressRepo.save(existing);
  }
}
