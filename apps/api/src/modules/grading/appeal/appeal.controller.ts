import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APPEAL_REASONS, type AppealReason } from '../entities/grading-appeal.entity';
import { AppealService, APPEAL_MAX_NOTE_LENGTH } from './appeal.service';

/**
 * ADR-016 §추가 이의제기 엔드포인트.
 *
 * POST /api/grading/:answerHistoryId/appeal
 * Auth: JWT (req.user.sub 가 userId).
 * Rate limit: 분당 10 / 일당 5 (AppealRateLimiter).
 */

export class SubmitAppealDto {
  @IsIn(APPEAL_REASONS)
  reason!: AppealReason;

  @IsOptional()
  @IsString()
  @MaxLength(APPEAL_MAX_NOTE_LENGTH)
  note?: string;
}

interface JwtUser {
  sub: string;
}

@Controller('grading')
@UseGuards(JwtAuthGuard)
export class AppealController {
  constructor(private readonly service: AppealService) {}

  @Post(':answerHistoryId/appeal')
  async submit(
    @Param('answerHistoryId', ParseUUIDPipe) answerHistoryId: string,
    @Body() dto: SubmitAppealDto,
    @Req() req: Request,
  ): Promise<{ id: string; status: 'pending'; createdAt: Date }> {
    const user = req.user as JwtUser;
    return this.service.submit({
      answerHistoryId,
      userId: user.sub,
      reason: dto.reason,
      note: dto.note ?? null,
    });
  }
}
