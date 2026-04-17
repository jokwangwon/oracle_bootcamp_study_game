import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { Difficulty, GameModeId, Topic } from '@oracle-game/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestionPoolService } from './services/question-pool.service';

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly pool: QuestionPoolService) {}

  @Get()
  async list(
    @Query('topic') topic: Topic,
    @Query('week') week: string,
    @Query('mode') mode: GameModeId,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('count') count = '10',
  ) {
    return this.pool.pickRandom(
      {
        topic,
        week: Number.parseInt(week, 10),
        gameMode: mode,
        difficulty,
      },
      Number.parseInt(count, 10),
    );
  }
}
