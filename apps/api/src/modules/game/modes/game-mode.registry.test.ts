import { describe, expect, it } from 'vitest';

import { BlankTypingMode } from './blank-typing.mode';
import { GameModeRegistry } from './game-mode.registry';
import { MultipleChoiceMode } from './multiple-choice.mode';
import { TermMatchMode } from './term-match.mode';

describe('GameModeRegistry', () => {
  function buildRegistry() {
    return new GameModeRegistry(
      new BlankTypingMode(),
      new TermMatchMode(),
      new MultipleChoiceMode(),
    );
  }

  it('등록된 모드를 ID로 조회한다', () => {
    const registry = buildRegistry();
    expect(registry.get('blank-typing').id).toBe('blank-typing');
    expect(registry.get('term-match').id).toBe('term-match');
    expect(registry.get('multiple-choice').id).toBe('multiple-choice');
  });

  it('미등록 모드 조회 시 예외를 던진다', () => {
    const registry = buildRegistry();
    // @ts-expect-error: 의도적으로 잘못된 ID 전달
    expect(() => registry.get('unknown-mode')).toThrow();
  });

  it('list()로 모든 등록된 모드를 반환한다', () => {
    const registry = buildRegistry();
    const ids = registry.list().map((m) => m.id);
    expect(ids).toContain('blank-typing');
    expect(ids).toContain('term-match');
    expect(ids).toContain('multiple-choice');
  });
});
