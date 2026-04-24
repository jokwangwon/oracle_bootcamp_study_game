import { Module } from '@nestjs/common';

import { ContentModule } from '../content/content.module';
import { GradingModule } from '../grading/grading.module';
import { OpsModule } from '../ops/ops.module';
import { UsersModule } from '../users/users.module';
import { GameController } from './game.controller';
import { GameSessionService } from './services/game-session.service';
import { GameModeRegistry } from './modes/game-mode.registry';
import { BlankTypingMode } from './modes/blank-typing.mode';
import { MultipleChoiceMode } from './modes/multiple-choice.mode';
import { TermMatchMode } from './modes/term-match.mode';

@Module({
  imports: [ContentModule, UsersModule, GradingModule, OpsModule],
  providers: [
    GameSessionService,
    GameModeRegistry,
    BlankTypingMode,
    TermMatchMode,
    MultipleChoiceMode,
  ],
  controllers: [GameController],
})
export class GameModule {}
