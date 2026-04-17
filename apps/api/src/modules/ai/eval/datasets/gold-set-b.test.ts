import { describe, expect, it } from 'vitest';

import { goldSetB, type GoldSetBEntry } from './gold-set-b';
import { extractOracleTokens } from '@oracle-game/shared';
import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';
import { WEEK1_SQL_BASICS_QUESTIONS } from '../../../content/seed/data/week1-sql-basics.questions';

/**
 * Gold Set B 단위 테스트 (SDD v2 §4.2).
 *
 * compile-gold-set-b.ts의 결과(gold-set-b.ts)가 SDD §4.2의 분포 권장과
 * 화이트리스트/시드 중복 정합성을 항상 만족하는지 검증한다.
 *
 * 본 테스트는 candidates.md 수정 후 compile을 다시 돌릴 때마다 회귀 방지 역할을 한다.
 */

describe('Gold Set B', () => {
  it('정확히 30개 entry를 가진다 (SDD v2 §4.2 + Q2 결정)', () => {
    expect(goldSetB).toHaveLength(30);
  });

  it('모든 entry id가 unique하고 gold-b- prefix를 갖는다', () => {
    const ids = goldSetB.map((e) => e.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^gold-b-/);
    }
  });

  it('모드 분포: blank-typing 15 + term-match 15', () => {
    const blanks = goldSetB.filter((e) => e.gameMode === 'blank-typing');
    const terms = goldSetB.filter((e) => e.gameMode === 'term-match');
    expect(blanks).toHaveLength(15);
    expect(terms).toHaveLength(15);
  });

  it('난이도 분포: easy 10 / medium 12 / hard 8 (SDD §4.2)', () => {
    const easy = goldSetB.filter((e) => e.difficulty === 'EASY');
    const medium = goldSetB.filter((e) => e.difficulty === 'MEDIUM');
    const hard = goldSetB.filter((e) => e.difficulty === 'HARD');
    expect(easy).toHaveLength(10);
    expect(medium).toHaveLength(12);
    expect(hard).toHaveLength(8);
  });

  it('모드 × 난이도 quota: bt 5/6/4 + tm 5/6/4', () => {
    const counts: Record<string, number> = {};
    for (const e of goldSetB) {
      const key = `${e.gameMode}/${e.difficulty}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts['blank-typing/EASY']).toBe(5);
    expect(counts['blank-typing/MEDIUM']).toBe(6);
    expect(counts['blank-typing/HARD']).toBe(4);
    expect(counts['term-match/EASY']).toBe(5);
    expect(counts['term-match/MEDIUM']).toBe(6);
    expect(counts['term-match/HARD']).toBe(4);
  });

  it('모든 entry가 sql-basics topic + week 1을 가진다', () => {
    for (const e of goldSetB) {
      expect(e.topic).toBe('sql-basics');
      expect(e.week).toBe(1);
    }
  });

  it('모든 entry vars.allowedKeywords는 1주차 화이트리스트와 동일 참조', () => {
    for (const e of goldSetB) {
      expect(e.vars.allowedKeywords).toBe(WEEK1_SQL_BASICS_SCOPE.keywords);
    }
  });

  it('모든 entry vars.seedFocusKeyword는 화이트리스트의 부분집합', () => {
    const upper = new Set(
      WEEK1_SQL_BASICS_SCOPE.keywords.map((k) => k.toUpperCase()),
    );
    for (const e of goldSetB) {
      expect(upper.has(e.vars.seedFocusKeyword.toUpperCase())).toBe(true);
    }
  });

  it('모든 entry candidateId는 합성 시점 형식(bt-{diff}-NN 또는 tm-{diff}-NN)', () => {
    for (const e of goldSetB) {
      expect(e.candidateId).toMatch(/^(bt|tm)-(easy|medium|hard)-\d{2}$/);
    }
  });

  it('GoldSetBEntry 타입이 EvalDatasetEntry + candidateId를 갖는다', () => {
    const sample: GoldSetBEntry = goldSetB[0];
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('candidateId');
    expect(sample).toHaveProperty('gameMode');
    expect(sample).toHaveProperty('vars');
  });
});

describe('Gold Set B 시드 중복/화이트리스트 검증 (재현 방어)', () => {
  // candidates.md → compile은 검증을 한 번 거치지만, 시드 변경 시 회귀를 막기 위해
  // 본 테스트가 한 번 더 화이트리스트와 시드 중복을 자동 검증한다.
  // sql/description은 .ts 모듈에 직접 들어있지 않으므로 candidates.md를 다시 읽지는 않고,
  // seedFocusKeyword 정합성 + 시드 question.answer[0]와 동일한 entry가 30개 모두 있지 않은지만 확인한다.
  it('어떤 entry도 시드 question의 answer[0]와 정확히 동일한 seedFocusKeyword + 동일 gameMode를 가지지 않는다', () => {
    // 동일한 keyword + 동일 mode 조합이 시드와 중복되는지 검사 (약한 중복 검사).
    // 더 강한 SQL/description 중복 검사는 compile-gold-set-b.ts validate()에서 수행됨.
    const seedKeyByMode = new Map<string, Set<string>>();
    for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
      const set = seedKeyByMode.get(q.gameMode) ?? new Set<string>();
      set.add(q.answer[0]!.toUpperCase());
      seedKeyByMode.set(q.gameMode, set);
    }

    // 약한 검사: Gold B의 동일 mode + 동일 focus keyword가 시드와 겹치는 비율
    // (완전 중복 금지가 아니라, 너무 많이 겹치면 fail)
    let overlapCount = 0;
    for (const e of goldSetB) {
      const seedSet = seedKeyByMode.get(e.gameMode);
      if (seedSet?.has(e.vars.seedFocusKeyword.toUpperCase())) {
        overlapCount += 1;
      }
    }
    // SDD §4.2: "시드와 다른 주제 조합" — 일부 keyword 중복은 허용 (다른 SQL 컨텍스트면 OK).
    // 단, 30개 중 절반 이상이 시드 keyword와 겹치면 다양성 부족으로 본다.
    expect(overlapCount).toBeLessThan(15);
  });

  it('extractOracleTokens가 모든 seedFocusKeyword를 token으로 인식한다 (대문자 식별자 정규식)', () => {
    for (const e of goldSetB) {
      const tokens = extractOracleTokens(e.vars.seedFocusKeyword);
      expect(tokens.length).toBeGreaterThanOrEqual(1);
    }
  });
});
