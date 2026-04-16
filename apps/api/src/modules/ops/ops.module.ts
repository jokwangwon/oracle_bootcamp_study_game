import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContentModule } from '../content/content.module';
import { QuestionEntity } from '../content/entities/question.entity';
import { OpsEventLogEntity } from './entities/ops-event-log.entity';
import { OpsQuestionMeasurementEntity } from './entities/ops-question-measurement.entity';
import { OpsMeasurementService } from './ops-measurement.service';
import { QuestionReportController } from './question-report.controller';
import { QuestionReportService } from './question-report.service';

/**
 * 운영 모니터링 모듈 (Phase A).
 *
 * SDD `operational-monitoring-design.md` — ADR-011 조건 #3 이행.
 *
 * 책임:
 *  - AI 문제 생성 직후 inline MT3/MT4 재측정 (OpsMeasurementService)
 *  - 수강생 신고 엔드포인트 (POST /api/questions/:id/report)
 *
 * Phase B/C (집계 cron, 대시보드)는 별도 모듈로 분리 예정.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OpsQuestionMeasurementEntity,
      OpsEventLogEntity,
      QuestionEntity,
    ]),
    ContentModule,
  ],
  controllers: [QuestionReportController],
  providers: [OpsMeasurementService, QuestionReportService],
  exports: [OpsMeasurementService],
})
export class OpsModule {}
