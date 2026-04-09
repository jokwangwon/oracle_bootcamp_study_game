import { describe, expect, it } from 'vitest';
import {
  GAME_MODE_IDS,
  extractOracleTokens,
  questionContentSchema,
} from '@oracle-game/shared';

import { WEEK1_SQL_BASICS_QUESTIONS } from './data/week1-sql-basics.questions';
import { WEEK1_SQL_BASICS_SCOPE } from './data/week1-sql-basics.scope';
import { WEEK2_TRANSACTIONS_QUESTIONS } from './data/week2-transactions.questions';
import { WEEK2_TRANSACTIONS_SCOPE } from './data/week2-transactions.scope';

/**
 * 시드 데이터 단위 테스트.
 *
 * DB 없이 데이터 자체의 정합성을 검증한다 — SeedService가 부트 시 INSERT
 * 직전에 ScopeValidator로 다시 한 번 확인하지만, 코드 변경으로 인한
 * 데이터 ↔ 화이트리스트 drift를 가능한 한 일찍(=빌드 전) 잡아야 한다.
 *
 * 헌법 §3 — 계산적 검증 우선.
 *
 * extractOracleTokens는 packages/shared/src/utils/oracle-tokens.ts에서
 * import — ScopeValidator와 평가 하네스(MT4)와 동일 함수를 공유한다
 * (SDD v2 단계 0).
 */

describe('seed data: week1-sql-basics', () => {
  const allowed = new Set(WEEK1_SQL_BASICS_SCOPE.keywords);

  describe('scope', () => {
    it('1주차 sql-basics 화이트리스트가 정의되어 있다', () => {
      expect(WEEK1_SQL_BASICS_SCOPE.week).toBe(1);
      expect(WEEK1_SQL_BASICS_SCOPE.topic).toBe('sql-basics');
      expect(WEEK1_SQL_BASICS_SCOPE.keywords.length).toBeGreaterThan(0);
    });

    it('화이트리스트의 모든 키워드는 검증 정규식을 통과하는 형식이다 (대문자 2글자 이상)', () => {
      for (const keyword of WEEK1_SQL_BASICS_SCOPE.keywords) {
        const tokens = extractOracleTokens(keyword);
        expect(tokens, `keyword "${keyword}" should match ORACLE_TOKEN_REGEX`).toEqual([keyword]);
      }
    });

    it('화이트리스트에 중복이 없다', () => {
      const set = new Set(WEEK1_SQL_BASICS_SCOPE.keywords);
      expect(set.size).toBe(WEEK1_SQL_BASICS_SCOPE.keywords.length);
    });
  });

  describe('questions: 갯수와 메타데이터', () => {
    it('정확히 30개의 시드 문제가 존재한다 (빈칸 15 + 용어 15)', () => {
      expect(WEEK1_SQL_BASICS_QUESTIONS).toHaveLength(30);

      const blanks = WEEK1_SQL_BASICS_QUESTIONS.filter(
        (q) => q.gameMode === 'blank-typing',
      );
      const terms = WEEK1_SQL_BASICS_QUESTIONS.filter(
        (q) => q.gameMode === 'term-match',
      );
      expect(blanks).toHaveLength(15);
      expect(terms).toHaveLength(15);
    });

    it('모든 문제의 topic/week/status/source가 일관된다', () => {
      for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
        expect(q.topic).toBe('sql-basics');
        expect(q.week).toBe(1);
        expect(q.status).toBe('active');
        expect(q.source).toBe('pre-generated');
        expect(GAME_MODE_IDS).toContain(q.gameMode);
      }
    });

    it('모든 문제의 답이 비어있지 않다', () => {
      for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
        expect(q.answer.length).toBeGreaterThan(0);
        for (const a of q.answer) {
          expect(a.trim()).not.toBe('');
        }
      }
    });
  });

  describe('questions: content 스키마 (Zod)', () => {
    it('모든 content가 questionContentSchema를 통과한다', () => {
      for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
        const result = questionContentSchema.safeParse(q.content);
        expect(
          result.success,
          `content for question with answer=${JSON.stringify(q.answer)} failed: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    });
  });

  describe('questions: 화이트리스트 적합성 (계산적 검증)', () => {
    it('모든 빈칸타이핑 SQL의 Oracle 토큰이 화이트리스트에 포함된다', () => {
      const blanks = WEEK1_SQL_BASICS_QUESTIONS.filter(
        (q) => q.content.type === 'blank-typing',
      );
      for (const q of blanks) {
        if (q.content.type !== 'blank-typing') continue;
        const tokens = extractOracleTokens(q.content.sql);
        const outOfScope = tokens.filter((t) => !allowed.has(t));
        expect(
          outOfScope,
          `out-of-scope tokens in SQL: ${q.content.sql}`,
        ).toEqual([]);
      }
    });

    it('모든 용어맞추기 description의 Oracle 토큰이 화이트리스트에 포함된다', () => {
      const terms = WEEK1_SQL_BASICS_QUESTIONS.filter(
        (q) => q.content.type === 'term-match',
      );
      for (const q of terms) {
        if (q.content.type !== 'term-match') continue;
        const tokens = extractOracleTokens(q.content.description);
        const outOfScope = tokens.filter((t) => !allowed.has(t));
        expect(
          outOfScope,
          `out-of-scope tokens in description: ${q.content.description}`,
        ).toEqual([]);
      }
    });

    it('모든 정답의 Oracle 토큰이 화이트리스트에 포함된다', () => {
      for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
        const joined = q.answer.join(' ');
        const tokens = extractOracleTokens(joined);
        const outOfScope = tokens.filter((t) => !allowed.has(t));
        expect(
          outOfScope,
          `out-of-scope tokens in answer: ${joined}`,
        ).toEqual([]);
      }
    });
  });

  describe('questions: 빈칸-정답 일관성', () => {
    it('빈칸타이핑의 blanks[].answer가 question.answer에 포함된다', () => {
      for (const q of WEEK1_SQL_BASICS_QUESTIONS) {
        if (q.content.type !== 'blank-typing') continue;
        for (const blank of q.content.blanks) {
          expect(
            q.answer.map((a) => a.toUpperCase()),
            `blank.answer "${blank.answer}" should be present in question.answer for SQL: ${q.content.sql}`,
          ).toContain(blank.answer.toUpperCase());
        }
      }
    });
  });
});

describe('seed data: week2-transactions', () => {
  const allowed = new Set(WEEK2_TRANSACTIONS_SCOPE.keywords);

  describe('scope', () => {
    it('2주차 transactions 화이트리스트가 정의되어 있다', () => {
      expect(WEEK2_TRANSACTIONS_SCOPE.week).toBe(2);
      expect(WEEK2_TRANSACTIONS_SCOPE.topic).toBe('transactions');
      expect(WEEK2_TRANSACTIONS_SCOPE.keywords.length).toBeGreaterThan(0);
    });

    it('화이트리스트의 모든 키워드는 검증 정규식을 통과하는 형식이다 (대문자 2글자 이상)', () => {
      for (const keyword of WEEK2_TRANSACTIONS_SCOPE.keywords) {
        const tokens = extractOracleTokens(keyword);
        expect(tokens, `keyword "${keyword}" should match ORACLE_TOKEN_REGEX`).toEqual([keyword]);
      }
    });

    it('화이트리스트에 중복이 없다', () => {
      const set = new Set(WEEK2_TRANSACTIONS_SCOPE.keywords);
      expect(set.size).toBe(WEEK2_TRANSACTIONS_SCOPE.keywords.length);
    });

    it('트랜잭션 핵심 명령(COMMIT/ROLLBACK/SAVEPOINT/ISOLATION 등)은 1주차에 없다', () => {
      // SQL 일반 단어(IN, READ 등)는 1주차/2주차 양쪽에 자연스럽게 등장 가능 →
      // 완전 격리는 검증하지 않는다. 다만 트랜잭션 학습의 핵심 키워드만큼은
      // 1주차로 새지 않아야 학습 진도 분리가 의미를 가진다.
      const transactionCoreKeywords = [
        'COMMIT',
        'ROLLBACK',
        'SAVEPOINT',
        'TRANSACTION',
        'ISOLATION',
        'SERIALIZABLE',
        'COMMITTED',
        'CONSISTENT',
        'NOWAIT',
        'SCN',
      ];
      const w1 = new Set(WEEK1_SQL_BASICS_SCOPE.keywords);
      const leaked = transactionCoreKeywords.filter((k) => w1.has(k));
      expect(
        leaked,
        `트랜잭션 핵심 키워드가 week1에 누락됨: ${leaked.join(', ')}`,
      ).toEqual([]);
    });
  });

  describe('questions: 갯수와 메타데이터', () => {
    it('정확히 30개의 시드 문제가 존재한다 (빈칸 15 + 용어 15)', () => {
      expect(WEEK2_TRANSACTIONS_QUESTIONS).toHaveLength(30);

      const blanks = WEEK2_TRANSACTIONS_QUESTIONS.filter(
        (q) => q.gameMode === 'blank-typing',
      );
      const terms = WEEK2_TRANSACTIONS_QUESTIONS.filter(
        (q) => q.gameMode === 'term-match',
      );
      expect(blanks).toHaveLength(15);
      expect(terms).toHaveLength(15);
    });

    it('모든 문제의 topic/week/status/source가 일관된다', () => {
      for (const q of WEEK2_TRANSACTIONS_QUESTIONS) {
        expect(q.topic).toBe('transactions');
        expect(q.week).toBe(2);
        expect(q.status).toBe('active');
        expect(q.source).toBe('pre-generated');
        expect(GAME_MODE_IDS).toContain(q.gameMode);
      }
    });

    it('모든 문제의 답이 비어있지 않다', () => {
      for (const q of WEEK2_TRANSACTIONS_QUESTIONS) {
        expect(q.answer.length).toBeGreaterThan(0);
        for (const a of q.answer) {
          expect(a.trim()).not.toBe('');
        }
      }
    });
  });

  describe('questions: content 스키마 (Zod)', () => {
    it('모든 content가 questionContentSchema를 통과한다', () => {
      for (const q of WEEK2_TRANSACTIONS_QUESTIONS) {
        const result = questionContentSchema.safeParse(q.content);
        expect(
          result.success,
          `content for question with answer=${JSON.stringify(q.answer)} failed: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`,
        ).toBe(true);
      }
    });
  });

  describe('questions: 화이트리스트 적합성 (계산적 검증)', () => {
    it('모든 빈칸타이핑 SQL의 Oracle 토큰이 week2 화이트리스트에 포함된다', () => {
      const blanks = WEEK2_TRANSACTIONS_QUESTIONS.filter(
        (q) => q.content.type === 'blank-typing',
      );
      for (const q of blanks) {
        if (q.content.type !== 'blank-typing') continue;
        const tokens = extractOracleTokens(q.content.sql);
        const outOfScope = tokens.filter((t) => !allowed.has(t));
        expect(
          outOfScope,
          `out-of-scope tokens in SQL: ${q.content.sql}`,
        ).toEqual([]);
      }
    });

    it('모든 용어맞추기 description의 Oracle 토큰이 week2 화이트리스트에 포함된다', () => {
      const terms = WEEK2_TRANSACTIONS_QUESTIONS.filter(
        (q) => q.content.type === 'term-match',
      );
      for (const q of terms) {
        if (q.content.type !== 'term-match') continue;
        const tokens = extractOracleTokens(q.content.description);
        const outOfScope = tokens.filter((t) => !allowed.has(t));
        expect(
          outOfScope,
          `out-of-scope tokens in description: ${q.content.description}`,
        ).toEqual([]);
      }
    });

    it('모든 정답의 Oracle 토큰이 week2 화이트리스트에 포함된다', () => {
      for (const q of WEEK2_TRANSACTIONS_QUESTIONS) {
        const joined = q.answer.join(' ');
        const tokens = extractOracleTokens(joined);
        const outOfScope = tokens.filter((t) => !allowed.has(t));
        expect(
          outOfScope,
          `out-of-scope tokens in answer: ${joined}`,
        ).toEqual([]);
      }
    });
  });

  describe('questions: 빈칸-정답 일관성', () => {
    it('빈칸타이핑의 blanks[].answer가 question.answer에 포함된다', () => {
      for (const q of WEEK2_TRANSACTIONS_QUESTIONS) {
        if (q.content.type !== 'blank-typing') continue;
        for (const blank of q.content.blanks) {
          expect(
            q.answer.map((a) => a.toUpperCase()),
            `blank.answer "${blank.answer}" should be present in question.answer for SQL: ${q.content.sql}`,
          ).toContain(blank.answer.toUpperCase());
        }
      }
    });
  });
});
