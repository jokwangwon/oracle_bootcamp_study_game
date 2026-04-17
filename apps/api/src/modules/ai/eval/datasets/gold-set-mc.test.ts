import { describe, expect, it } from 'vitest';

import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';
import { goldSetMc } from './gold-set-mc';

describe('goldSetMc', () => {
  it('15 entries (MVP-A 초안)', () => {
    expect(goldSetMc.length).toBe(15);
  });

  it('모든 entry는 gameMode=multiple-choice', () => {
    for (const entry of goldSetMc) {
      expect(entry.gameMode).toBe('multiple-choice');
    }
  });

  it('id는 gold-mc-NN 형식이며 고유', () => {
    const ids = goldSetMc.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^gold-mc-\d{2}$/);
    }
  });

  it('seedFocusKeyword는 모두 week1-sql-basics 화이트리스트 내', () => {
    const allowed = new Set(WEEK1_SQL_BASICS_SCOPE.keywords);
    for (const entry of goldSetMc) {
      expect(
        allowed.has(entry.vars.seedFocusKeyword),
        `seedFocusKeyword '${entry.vars.seedFocusKeyword}' (entry=${entry.id})`,
      ).toBe(true);
    }
  });

  it('난이도 분포 EASY=5 / MEDIUM=7 / HARD=3', () => {
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const entry of goldSetMc) {
      counts[entry.difficulty] += 1;
    }
    expect(counts).toEqual({ EASY: 5, MEDIUM: 7, HARD: 3 });
  });
});
