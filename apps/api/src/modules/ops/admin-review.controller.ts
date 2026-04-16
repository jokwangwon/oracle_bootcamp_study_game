import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvalAdminGuard } from '../ai/eval/eval-admin.guard';
import { AdminReviewService } from './admin-review.service';

export class ReviewQuestionDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

interface JwtUser {
  sub: string;
}

@Controller('questions')
@UseGuards(JwtAuthGuard, EvalAdminGuard)
export class AdminReviewController {
  constructor(private readonly service: AdminReviewService) {}

  @Patch(':id/review')
  async review(
    @Param('id', ParseUUIDPipe) questionId: string,
    @Body() dto: ReviewQuestionDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtUser;
    const updated = await this.service.review({
      questionId,
      adminUserId: user.sub,
      action: dto.action,
      reason: dto.reason,
    });
    return { id: updated.id, status: updated.status };
  }
}
