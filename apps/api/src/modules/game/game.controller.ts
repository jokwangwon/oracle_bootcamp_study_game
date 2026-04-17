import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
  async start(@Body() dto: StartSoloDto) {
    return this.sessionService.startSolo(dto);
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
