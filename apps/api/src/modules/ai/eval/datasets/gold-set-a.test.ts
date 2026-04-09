import { describe, expect, it } from 'vitest';

import { goldSetA, type EvalDatasetEntry } from './gold-set-a';
import { WEEK1_SQL_BASICS_QUESTIONS } from '../../../content/seed/data/week1-sql-basics.questions';

/**
 * Gold Set A 단위 테스트 (SDD v2 §4.1).
 *
 * Gold Set A는 평가의 Recall 트랙으로, 기존 시드 30문제(빈칸 15 + 용어 15)를
 * 평가용 EvalDatasetEntry로 변환한다. 작성자/검수자 분리는 불요(이미 운영 시드).
 *
 * 검증:
 *  - 전체 30개 (빈칸 15 + 용어 15)
 *  - 시드 source와 1:1 대응
 *  - 모든 entry가 기대 필드를 갖는다 (id, gameMode, topic, week, difficulty, vars)
 *  - id는 unique
 *  - vars.seedFocusKeyword는 시드 question.answer[0]에서 추출
 *  - vars.allowedKeywords는 비어있지 않다 (1주차 화이트리스트)
 *  - 모드별 분포 확인
 */

describe('Gold Set A', () => {
  it('정확히 30개 entry를 가진다 (시드 30 = 빈칸 15 + 용어 15)', () => {
    expect(goldSetA).toHaveLength(30);
  });

  it('시드 question 수와 1:1 대응한다', () => {
    expect(goldSetA.length).toBe(WEEK1_SQL_BASICS_QUESTIONS.length);
  });

  it('빈칸 타이핑 entry가 정확히 15개', () => {
    const blanks = goldSetA.filter((e) => e.gameMode === 'blank-typing');
    expect(blanks).toHaveLength(15);
  });

  it('용어 맞추기 entry가 정확히 15개', () => {
    const terms = goldSetA.filter((e) => e.gameMode === 'term-match');
    expect(terms).toHaveLength(15);
  });

  it('모든 entry id가 unique하다', () => {
    const ids = goldSetA.map((e) => e.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('모든 entry id는 prefix gold-a-로 시작한다', () => {
    for (const e of goldSetA) {
      expect(e.id).toMatch(/^gold-a-/);
    }
  });

  it('모든 entry가 sql-basics topic + week 1을 가진다', () => {
    for (const e of goldSetA) {
      expect(e.topic).toBe('sql-basics');
      expect(e.week).toBe(1);
    }
  });

  it('모든 entry vars.seedFocusKeyword는 비어있지 않은 string', () => {
    for (const e of goldSetA) {
      expect(typeof e.vars.seedFocusKeyword).toBe('string');
      expect(e.vars.seedFocusKeyword.length).toBeGreaterThan(0);
    }
  });

  it('모든 entry vars.allowedKeywords는 비어있지 않은 배열이고 seedFocusKeyword를 포함한다', () => {
    for (const e of goldSetA) {
      expect(Array.isArray(e.vars.allowedKeywords)).toBe(true);
      expect(e.vars.allowedKeywords.length).toBeGreaterThan(0);
      // seedFocusKeyword는 화이트리스트의 부분집합이어야 한다 (운영 검증과 일관)
      // 대문자 정규화 후 비교 — ScopeValidator/extractOracleTokens 규약과 동일
      const upperWhitelist = new Set(
        e.vars.allowedKeywords.map((k) => k.toUpperCase()),
      );
      expect(upperWhitelist.has(e.vars.seedFocusKeyword.toUpperCase())).toBe(
        true,
      );
    }
  });

  it('vars.difficulty가 시드 difficulty와 일치한다', () => {
    for (let i = 0; i < goldSetA.length; i += 1) {
      expect(goldSetA[i].vars.difficulty).toBe(WEEK1_SQL_BASICS_QUESTIONS[i].difficulty);
    }
  });

  it('EvalDatasetEntry 타입이 promptfoo 친화 형태(id + gameMode + vars)를 갖는다', () => {
    // 형 안전성: 컴파일 통과 + 런타임 필드 존재 확인
    const sample: EvalDatasetEntry = goldSetA[0];
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('gameMode');
    expect(sample).toHaveProperty('topic');
    expect(sample).toHaveProperty('week');
    expect(sample).toHaveProperty('difficulty');
    expect(sample).toHaveProperty('vars');
    expect(sample.vars).toHaveProperty('topic');
    expect(sample.vars).toHaveProperty('week');
    expect(sample.vars).toHaveProperty('difficulty');
    expect(sample.vars).toHaveProperty('allowedKeywords');
    expect(sample.vars).toHaveProperty('seedFocusKeyword');
  });
});
