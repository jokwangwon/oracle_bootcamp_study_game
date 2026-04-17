import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QuestionEntity } from './entities/question.entity';
import { WeeklyScopeEntity } from './entities/weekly-scope.entity';
import { QuestionPoolService } from './services/question-pool.service';
import { ScopeValidatorService } from './services/scope-validator.service';
import { ContentController } from './content.controller';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionEntity, WeeklyScopeEntity])],
  providers: [QuestionPoolService, ScopeValidatorService, SeedService],
  controllers: [ContentController],
  exports: [QuestionPoolService, ScopeValidatorService],
})
export class ContentModule {}
