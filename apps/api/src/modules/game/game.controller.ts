import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import {
  CURRICULUM_TOPICS,
  GAME_MODE_IDS,
  type Difficulty,
  type GameModeId,
  type Topic,
} from '@oracle-game/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GameSessionService } from './services/game-session.service';

class StartSoloDto {
  @IsString()
  @IsEnum(CURRICULUM_TOPICS)
  topic!: Topic;

  @IsInt()
  @Min(1)
  week!: number;

  @IsString()
  @IsEnum(GAME_MODE_IDS)
  gameMode!: GameModeId;

  @IsString()
  @IsEnum(['EASY', 'MEDIUM', 'HARD'])
  difficulty!: Difficulty;

  @IsInt()
  @Min(1)
  @Max(50)
  rounds = 10;
}

class SubmitAnswerDto {
  @IsString()
  roundId!: string;

  @IsString()
  answer!: string;

  @IsNumber()
  @Min(0)
  submittedAt!: number;

  @IsInt()
  @Min(0)
  hintsUsed = 0;
}

class FinishSoloDto {
  @IsString()
  @IsEnum(CURRICULUM_TOPICS)
  topic!: Topic;

  @IsInt()
  @Min(1)
  week!: number;

  @IsString()
  @IsEnum(GAME_MODE_IDS)
  gameMode!: GameModeId;

  @IsInt()
  @Min(1)
  @Max(50)
  totalRounds!: number;

  @IsInt()
  @Min(0)
  correctCount!: number;

  @IsInt()
  @Min(0)
  totalScore!: number;
}

interface JwtUser {
  sub: string;
}

@Controller('games/solo')
@UseGuards(JwtAuthGuard)
export class GameController {
  constructor(private readonly sessionService: GameSessionService) {}

  @Post('start')
  async start(@Body() dto: StartSoloDto, @Req() req: Request) {
    const user = req.user as JwtUser;
    // ADR-019 §5.2 PR-4 — JWT user.sub 를 서비스로 전파. 있으면 SR 혼합 경로,
    // 없으면 기존 random 경로 (이 라우터는 JwtAuthGuard 후이므로 항상 존재).
    return this.sessionService.startSolo({ ...dto, userId: user.sub });
  }

  /**
   * ADR-019 §5.2 PR-4 — 세션 헤더 "오늘 복습 N" 뱃지 (PR-5 UI 소비).
   * 전체 topic/gameMode 범위에서 오늘 due 인 review_queue 행 수.
   */
  @Get('review-queue')
  async reviewQueue(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.sessionService.getReviewQueueSummary(user.sub);
  }

  @Post('answer')
  async answer(@Body() dto: SubmitAnswerDto, @Req() req: Request) {
    const user = req.user as JwtUser;
    return this.sessionService.submitAnswer({
      roundId: dto.roundId,
      playerId: user.sub,
      answer: dto.answer,
      submittedAt: dto.submittedAt,
      hintsUsed: dto.hintsUsed,
    });
  }

  @Post('finish')
  async finish(@Body() dto: FinishSoloDto, @Req() req: Request) {
    const user = req.user as JwtUser;
    return this.sessionService.finishSolo({
      userId: user.sub,
      topic: dto.topic,
      week: dto.week,
      gameMode: dto.gameMode,
      totalRounds: dto.totalRounds,
      correctCount: dto.correctCount,
      totalScore: dto.totalScore,
    });
  }
}
