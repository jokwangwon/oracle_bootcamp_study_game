import { Injectable } from '@nestjs/common';
import type { GameMode, GameModeId } from '@oracle-game/shared';

import { BlankTypingMode } from './blank-typing.mode';
import { MultipleChoiceMode } from './multiple-choice.mode';
import { TermMatchMode } from './term-match.mode';

/**
 * 게임 모드 레지스트리 (Strategy Pattern)
 *
 * 새 게임 모드 추가 시 여기에만 등록하면 된다.
 * GameMode 인터페이스만 구현하면 게임 엔진이 자동으로 사용한다.
 */
@Injectable()
export class GameModeRegistry {
  private readonly modes = new Map<GameModeId, GameMode>();

  constructor(
    blankTyping: BlankTypingMode,
    termMatch: TermMatchMode,
    multipleChoice: MultipleChoiceMode,
  ) {
    this.register(blankTyping);
    this.register(termMatch);
    this.register(multipleChoice);
  }

  private register(mode: GameMode): void {
    this.modes.set(mode.id, mode);
  }

  get(id: GameModeId): GameMode {
    const mode = this.modes.get(id);
    if (!mode) {
      throw new Error(`Game mode "${id}" is not registered`);
    }
    return mode;
  }

  list(): GameMode[] {
    return [...this.modes.values()];
  }
}
