import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import {
  CURRICULUM_TOPICS,
  GAME_MODE_IDS,
  type GameModeId,
  type Topic,
} from '@oracle-game/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserMistakesService } from './user-mistakes.service';
import { UsersService } from './users.service';

interface JwtUser {
  sub: string;
  username: string;
}

class MistakeQueryDto {
  @IsOptional()
  @IsString()
  @IsEnum(CURRICULUM_TOPICS)
  topic?: Topic;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  week?: number;

  @IsOptional()
  @IsString()
  @IsEnum(GAME_MODE_IDS)
  gameMode?: GameModeId;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mistakesService: UserMistakesService,
  ) {}

  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.usersService.findById(user.sub);
  }

  @Get('me/progress')
  async getMyProgress(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.usersService.getProgress(user.sub);
  }

  /**
   * 사용자 Q1~Q3 오답 노트. 계정별 persistent (answer_history 기반).
   * Q1=b 문제당 1 row 집계 / Q2=a SR 뱃지와 분리 / Q3=b 정답 처리 시 뱃지만 표시.
   */
  @Get('me/mistakes')
  async getMyMistakes(@Req() req: Request, @Query() query: MistakeQueryDto) {
    const user = req.user as JwtUser;
    return this.mistakesService.getMistakes(user.sub, {
      topic: query.topic,
      week: query.week,
      gameMode: query.gameMode,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
