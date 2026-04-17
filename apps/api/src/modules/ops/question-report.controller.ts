import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { StudentReportReason } from './entities/ops-event-log.entity';
import { QuestionReportService } from './question-report.service';

export class ReportQuestionDto {
  @IsIn(['incorrect_answer', 'sql_error', 'other'])
  reason!: StudentReportReason;
}

interface JwtUser {
  sub: string;
}

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionReportController {
  constructor(private readonly service: QuestionReportService) {}

  @Post(':id/report')
  async report(
    @Param('id', ParseUUIDPipe) questionId: string,
    @Body() dto: ReportQuestionDto,
    @Req() req: Request,
  ): Promise<{ eventId: string }> {
    const user = req.user as JwtUser;
    return this.service.report(questionId, user.sub, dto.reason);
  }
}
