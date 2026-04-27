import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QuestionEntity } from '../content/entities/question.entity';
import { UserEntity } from './entities/user.entity';
import { UserProgressEntity } from './entities/user-progress.entity';
import { AnswerHistoryEntity } from './entities/answer-history.entity';
import { UserMistakesService } from './user-mistakes.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserProgressEntity,
      AnswerHistoryEntity,
      // 오답 노트용 JOIN 쿼리. 동일 entity 를 여러 모듈이 register 해도 TypeORM 은
      // 단일 repo 로 해석.
      QuestionEntity,
    ]),
  ],
  providers: [UsersService, UserMistakesService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
