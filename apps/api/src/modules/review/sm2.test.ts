import { describe, expect, it } from 'vitest';

import { mapAnswerToQuality, sm2Next } from './sm2';

/**
 * ADR-019 §3 — SM-2 pure function TDD.
 *
 *  - §3.1 `sm2Next`: SM-2 canonical + SM-2-lite clamp [2.3, 2.6] 항상 ON (Q3=b).
 *  - §3.2 `mapAnswerToQuality`: base - hintPenalty. timePenalty 제거 (Q5=a).
 *
 * 두 함수 모두 외부 의존 0 (I/O·Date.now·랜덤 미사용). `anchor` 는 caller 가 주입.
 */

describe('sm2Next (ADR-019 §3.1)', () => {
  const initialPrev = { easeFactor: 2.5, intervalDays: 0, repetition: 0 };
  const anchor = new Date('2026-04-24T00:00:00.000Z');

  describe('quality < 3 — 실패 리셋 분기', () => {
    it('q=0 은 repetition=0 / intervalDays=1 로 리셋', () => {
      const prev = { easeFactor: 2.5, intervalDays: 15, repetition: 3 };
      const next = sm2Next(prev, 0, anchor);
      expect(next.repetition).toBe(0);
      expect(next.intervalDays).toBe(1);
    });

    it('q=2 도 실패 분기 (경계값)', () => {
      const prev = { easeFactor: 2.5, intervalDays: 6, repetition: 2 };
      const next = sm2Next(prev, 2, anchor);
      expect(next.repetition).toBe(0);
      expect(next.intervalDays).toBe(1);
    });
  });

  describe('quality >= 3 — 성공 분기', () => {
    it('q=3 은 성공 (경계값) → repetition +1', () => {
      const next = sm2Next(initialPrev, 3, anchor);
      expect(next.repetition).toBe(1);
      expect(next.intervalDays).toBe(1);
    });

    it('첫 성공 (rep 0 → 1) → intervalDays=1', () => {
      const next = sm2Next(initialPrev, 5, anchor);
      expect(next.repetition).toBe(1);
      expect(next.intervalDays).toBe(1);
    });

    it('두번째 성공 (rep 1 → 2) → intervalDays=6', () => {
      const prev = { easeFactor: 2.5, intervalDays: 1, repetition: 1 };
      const next = sm2Next(prev, 4, anchor);
      expect(next.repetition).toBe(2);
      expect(next.intervalDays).toBe(6);
    });

    it('세번째 이후 (rep 2 → 3) → round(prev.intervalDays * prev.easeFactor)', () => {
      const prev = { easeFactor: 2.5, intervalDays: 6, repetition: 2 };
      const next = sm2Next(prev, 5, anchor);
      expect(next.repetition).toBe(3);
      expect(next.intervalDays).toBe(15); // round(6 * 2.5)
    });

    it('round 은 수학적 반올림 (6 * 2.4 = 14.4 → 14)', () => {
      const prev = { easeFactor: 2.4, intervalDays: 6, repetition: 2 };
      const next = sm2Next(prev, 4, anchor);
      expect(next.intervalDays).toBe(14);
    });

    it('round 은 수학적 반올림 (6 * 2.55 = 15.3 → 15)', () => {
      const prev = { easeFactor: 2.55, intervalDays: 6, repetition: 2 };
      const next = sm2Next(prev, 4, anchor);
      expect(next.intervalDays).toBe(15);
    });
  });

  describe('easeFactor 공식 + SM-2-lite clamp [2.3, 2.6] 항상 ON', () => {
    it('q=5, prev.ease=2.5 → 계산값 2.6 (상한 경계)', () => {
      const next = sm2Next(initialPrev, 5, anchor);
      expect(next.easeFactor).toBeCloseTo(2.6, 5);
    });

    it('q=4, prev.ease=2.5 → 계산값 2.5 (중간)', () => {
      const next = sm2Next(initialPrev, 4, anchor);
      expect(next.easeFactor).toBeCloseTo(2.5, 5);
    });

    it('q=3, prev.ease=2.5 → 계산값 2.36 → clamp → 2.36 유지 (상·하한 미터치)', () => {
      const next = sm2Next(initialPrev, 3, anchor);
      expect(next.easeFactor).toBeCloseTo(2.36, 5);
    });

    it('q=2, prev.ease=2.5 → 계산값 2.18 → lite clamp 2.3', () => {
      const next = sm2Next(initialPrev, 2, anchor);
      expect(next.easeFactor).toBeCloseTo(2.3, 5);
    });

    it('q=0, prev.ease=2.5 → 계산값 1.7 → canonical 1.7 → lite clamp 2.3', () => {
      const next = sm2Next(initialPrev, 0, anchor);
      expect(next.easeFactor).toBeCloseTo(2.3, 5);
    });

    it('상한 초과 시도: prev.ease=2.7 + q=5 → lite clamp 2.6', () => {
      const prev = { easeFactor: 2.7, intervalDays: 6, repetition: 2 };
      const next = sm2Next(prev, 5, anchor);
      expect(next.easeFactor).toBeCloseTo(2.6, 5);
    });

    it('하한 canonical 1.3 은 lite clamp 2.3 에 가려짐 (prev.ease=1.0, q=5 도 2.3 이상)', () => {
      const prev = { easeFactor: 1.0, intervalDays: 0, repetition: 0 };
      const next = sm2Next(prev, 5, anchor);
      // 1.0 + 0.1 = 1.1 → canonical max(1.3, 1.1) = 1.3 → lite clamp → 2.3
      expect(next.easeFactor).toBeCloseTo(2.3, 5);
    });
  });

  describe('dueAt / lastReviewedAt / lastQuality 관측 필드', () => {
    it('dueAt = anchor + intervalDays × 86400000ms', () => {
      const next = sm2Next(initialPrev, 5, anchor);
      const expected = new Date(anchor.getTime() + 1 * 86400000);
      expect(next.dueAt.toISOString()).toBe(expected.toISOString());
    });

    it('dueAt 은 rep 3 고간격에서도 정확 (6d × 2.5 = 15d)', () => {
      const prev = { easeFactor: 2.5, intervalDays: 6, repetition: 2 };
      const next = sm2Next(prev, 5, anchor);
      const expected = new Date(anchor.getTime() + 15 * 86400000);
      expect(next.dueAt.toISOString()).toBe(expected.toISOString());
    });

    it('lastReviewedAt === anchor', () => {
      const next = sm2Next(initialPrev, 4, anchor);
      expect(next.lastReviewedAt.toISOString()).toBe(anchor.toISOString());
    });

    it('lastQuality === 전달된 quality', () => {
      const next = sm2Next(initialPrev, 3, anchor);
      expect(next.lastQuality).toBe(3);
    });
  });

  describe('부작용 금지 (pure function)', () => {
    it('prev 객체를 변경하지 않음', () => {
      const prev = { easeFactor: 2.5, intervalDays: 6, repetition: 2 };
      const snapshot = { ...prev };
      sm2Next(prev, 5, anchor);
      expect(prev).toEqual(snapshot);
    });

    it('anchor Date 객체를 변경하지 않음', () => {
      const anchorSnapshot = new Date(anchor.getTime());
      sm2Next(initialPrev, 5, anchor);
      expect(anchor.getTime()).toBe(anchorSnapshot.getTime());
    });
  });
});

describe('mapAnswerToQuality (ADR-019 §3.2)', () => {
  describe('held gradingMethod 스킵', () => {
    it("gradingMethod='held' → null (SR 편입 스킵, B-C3)", () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: null,
          hintsUsed: 0,
          gradingMethod: 'held',
        }),
      ).toBeNull();
    });

    it("정답이어도 gradingMethod='held' 면 null", () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 0,
          gradingMethod: 'held',
        }),
      ).toBeNull();
    });
  });

  describe('base 매핑 (정답)', () => {
    it('isCorrect=true, ps=1 → 5 (완벽)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 0,
          gradingMethod: 'ast',
        }),
      ).toBe(5);
    });

    it('isCorrect=true, ps=0.85 → 4 (부분, ≥0.7)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 0.85,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(4);
    });

    it('isCorrect=true, ps=0.7 (경계값) → 4', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 0.7,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(4);
    });

    it('isCorrect=true, ps=0.69 → 3 (<0.7)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 0.69,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(3);
    });

    it('isCorrect=true, ps=0.5 → 3', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 0.5,
          hintsUsed: 0,
          gradingMethod: 'llm-judge',
        }),
      ).toBe(3);
    });
  });

  describe('base 매핑 (오답)', () => {
    it('isCorrect=false, ps=0.5 → 2 (≥0.3)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0.5,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(2);
    });

    it('isCorrect=false, ps=0.3 (경계값) → 2', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0.3,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(2);
    });

    it('isCorrect=false, ps=0.29 → 1 (<0.3, >0)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0.29,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(1);
    });

    it('isCorrect=false, ps=0.1 → 1', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0.1,
          hintsUsed: 0,
          gradingMethod: 'keyword',
        }),
      ).toBe(1);
    });

    it('isCorrect=false, ps=0 → 0 (완전 오답)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0,
          hintsUsed: 0,
          gradingMethod: 'exact',
        }),
      ).toBe(0);
    });
  });

  describe('partialScore null fallback (MC/BlankTyping/TermMatch all-or-nothing)', () => {
    it('ps=null + isCorrect=true → fallback 1 → base 5', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: null,
          hintsUsed: 0,
          gradingMethod: 'exact',
        }),
      ).toBe(5);
    });

    it('ps=null + isCorrect=false → fallback 0 → base 0', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: null,
          hintsUsed: 0,
          gradingMethod: 'exact',
        }),
      ).toBe(0);
    });
  });

  describe('hintPenalty (0~2 clamp) + timePenalty 제거', () => {
    it('hints=1 → base 5 - 1 = 4', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 1,
          gradingMethod: 'ast',
        }),
      ).toBe(4);
    });

    it('hints=2 → base 5 - 2 = 3', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 2,
          gradingMethod: 'ast',
        }),
      ).toBe(3);
    });

    it('hints=3 → penalty clamp 2 → base 5 - 2 = 3 (hints=2 와 동일)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 3,
          gradingMethod: 'ast',
        }),
      ).toBe(3);
    });

    it('hints=10 → penalty clamp 2 → 동일', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 10,
          gradingMethod: 'ast',
        }),
      ).toBe(3);
    });

    it('quality 하한 clamp 0: base 0 + hints → -1 방지 (q=0 유지)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0,
          hintsUsed: 2,
          gradingMethod: 'keyword',
        }),
      ).toBe(0);
    });

    it('quality 하한 clamp 0: base 1 - hints 2 → 0 (음수 방지)', () => {
      expect(
        mapAnswerToQuality({
          isCorrect: false,
          partialScore: 0.1,
          hintsUsed: 2,
          gradingMethod: 'keyword',
        }),
      ).toBe(0);
    });
  });

  describe('admin-override 는 본 함수에서 별도 분기 없음 (service 계층에서 overwrite 라우팅)', () => {
    it("gradingMethod='admin-override' 여도 정상 매핑 (base - hintPenalty)", () => {
      // admin-override 는 ReviewQueueService.overwriteAfterOverride 에서 처리.
      // 본 pure function 이 호출되면 일반 케이스로 매핑함.
      expect(
        mapAnswerToQuality({
          isCorrect: true,
          partialScore: 1,
          hintsUsed: 0,
          gradingMethod: 'admin-override',
        }),
      ).toBe(5);
    });
  });
});
