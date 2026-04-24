import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContentModule } from '../content/content.module';
import { QuestionEntity } from '../content/entities/question.entity';
import { OpsEventLogEntity } from './entities/ops-event-log.entity';
import { OpsQuestionMeasurementEntity } from './entities/ops-question-measurement.entity';
import { UserTokenHashSaltEpochEntity } from './entities/user-token-hash-salt-epoch.entity';
import { ConfigService } from '@nestjs/config';

import { EvalAdminGuard } from '../ai/eval/eval-admin.guard';
import { ActiveEpochLookup } from './active-epoch.lookup';
import { AdminReviewController } from './admin-review.controller';
import { AdminReviewService } from './admin-review.service';
import { GradingMeasurementService } from './grading-measurement.service';
import { OpsAggregationService } from './ops-aggregation.service';
import { OpsMeasurementService } from './ops-measurement.service';
import { PiiMaskerEventRecorder } from './pii-masker-event.recorder';
import { QuestionReportController } from './question-report.controller';
import { QuestionReportService } from './question-report.service';
import { SaltRotationService } from './salt-rotation.service';

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
      UserTokenHashSaltEpochEntity,
      QuestionEntity,
    ]),
    ContentModule,
  ],
  controllers: [QuestionReportController, AdminReviewController],
  providers: [
    OpsMeasurementService,
    GradingMeasurementService,
    QuestionReportService,
    OpsAggregationService,
    AdminReviewService,
    SaltRotationService,
    PiiMaskerEventRecorder,
    ActiveEpochLookup,
    EvalAdminGuard,
    {
      provide: 'EVAL_ADMIN_USERNAMES',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<string>('EVAL_ADMIN_USERNAMES'),
    },
  ],
  exports: [
    OpsMeasurementService,
    GradingMeasurementService,
    OpsAggregationService,
    SaltRotationService,
    PiiMaskerEventRecorder,
    ActiveEpochLookup,
  ],
})
export class OpsModule {}
