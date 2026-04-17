import { describe, expect, it } from 'vitest';

import {
  bootstrapPassRateCi,
  bonferroniAdjustedAlpha,
  cohensD,
  macroStratifiedMean,
  mean,
  percentile,
  mulberry32,
} from './aggregate';

/**
 * pure stat helpers 단위 테스트 (SDD v2 §10.3).
 *
 * 본 모듈은 외부 stat 라이브러리 없이 표준 알고리즘을 직접 구현한다.
 * 결정론(seeded RNG)으로 재현 가능 — 동일 seed면 동일 결과.
 */

describe('mean', () => {
  it('빈 배열은 0', () => {
    expect(mean([])).toBe(0);
  });
  it('단일 원소는 그 값', () => {
    expect(mean([7])).toBe(7);
  });
  it('여러 원소의 산술 평균', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });
});

describe('percentile', () => {
  it('빈 배열은 0', () => {
    expect(percentile([], 50)).toBe(0);
  });
  it('단일 원소는 그 값', () => {
    expect(percentile([42], 95)).toBe(42);
  });
  it('p50 = 중앙값', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });
  it('p95는 상위 5% 임계 (nearest-rank: 100원소 [0..99]면 sorted[94]=94)', () => {
    // nearest-rank 정의: rank = ceil(95/100 * 100) = 95, 0-indexed = 94
    const arr = Array.from({ length: 100 }, (_, i) => i);
    expect(percentile(arr, 95)).toBe(94);
  });
  it('정렬되지 않은 입력도 정확히 처리', () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
  });
});

describe('mulberry32 (seeded PRNG)', () => {
  it('동일 seed는 동일 시퀀스 반환 (재현성)', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 10; i += 1) {
      expect(r1()).toBeCloseTo(r2(), 12);
    }
  });
  it('다른 seed는 다른 시퀀스', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(43);
    expect(r1()).not.toBe(r2());
  });
  it('출력은 [0, 1) 범위', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 100; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('bootstrapPassRateCi', () => {
  it('전체 pass(30/30)면 mean=1.0, lower≈1.0, upper=1.0', () => {
    const ci = bootstrapPassRateCi(30, 30, { samples: 1000, seed: 42 });
    expect(ci.mean).toBe(1.0);
    expect(ci.lower).toBe(1.0);
    expect(ci.upper).toBe(1.0);
  });

  it('전체 fail(0/30)이면 mean=0, lower=0, upper=0', () => {
    const ci = bootstrapPassRateCi(0, 30, { samples: 1000, seed: 42 });
    expect(ci.mean).toBe(0);
    expect(ci.lower).toBe(0);
    expect(ci.upper).toBe(0);
  });

  it('15/30 (50%)는 lower < 0.5 < upper, mean ≈ 0.5', () => {
    const ci = bootstrapPassRateCi(15, 30, { samples: 1000, seed: 42 });
    expect(ci.mean).toBeGreaterThan(0.3);
    expect(ci.mean).toBeLessThan(0.7);
    expect(ci.lower).toBeLessThan(ci.mean);
    expect(ci.upper).toBeGreaterThan(ci.mean);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
  });

  it('동일 seed는 동일 CI 반환 (재현성)', () => {
    const a = bootstrapPassRateCi(20, 30, { samples: 500, seed: 42 });
    const b = bootstrapPassRateCi(20, 30, { samples: 500, seed: 42 });
    expect(a.mean).toBeCloseTo(b.mean, 10);
    expect(a.lower).toBeCloseTo(b.lower, 10);
    expect(a.upper).toBeCloseTo(b.upper, 10);
  });

  it('total=0은 mean=0, lower=0, upper=0 (방어적)', () => {
    const ci = bootstrapPassRateCi(0, 0, { samples: 100, seed: 42 });
    expect(ci.mean).toBe(0);
    expect(ci.lower).toBe(0);
    expect(ci.upper).toBe(0);
  });
});

describe('macroStratifiedMean', () => {
  it('빈 배열은 0', () => {
    expect(macroStratifiedMean([])).toBe(0);
  });
  it('단일 bucket의 rate를 그대로 반환', () => {
    expect(macroStratifiedMean([0.95])).toBe(0.95);
  });
  it('여러 bucket의 산술 평균 (가중치 없음 — macro)', () => {
    // SDD §3.3: macro stratified — 각 bucket의 평균을 다시 평균
    // (bucket 크기와 무관)
    expect(macroStratifiedMean([1.0, 0.8, 0.6])).toBeCloseTo(0.8);
  });
  it('NaN bucket은 무시 (sample 없는 bucket)', () => {
    expect(macroStratifiedMean([1.0, 0.5, NaN])).toBeCloseTo(0.75);
  });
});

describe('cohensD', () => {
  it('두 분포가 동일하면 d=0', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    expect(cohensD(a, b)).toBeCloseTo(0);
  });

  it('a가 b보다 크면 d > 0', () => {
    const a = [3, 4, 5, 6, 7];
    const b = [1, 2, 3, 4, 5];
    expect(cohensD(a, b)).toBeGreaterThan(0);
  });

  it('큰 평균 차이 + 작은 분산 → 큰 |d|', () => {
    const a = [10, 10, 10, 10];
    const b = [1, 1, 1, 1];
    // 분산 0인 경우는 fallback (NaN 방지) — 매우 큰 d 또는 sentinel
    const d = cohensD(a, b);
    expect(Number.isFinite(d) || d === Infinity).toBe(true);
    if (Number.isFinite(d)) expect(d).toBeGreaterThan(2);
  });

  it('빈 배열은 0', () => {
    expect(cohensD([], [])).toBe(0);
    expect(cohensD([1], [])).toBe(0);
  });
});

describe('bonferroniAdjustedAlpha', () => {
  it('5 모델 10 페어 비교 (α=0.05) → α=0.005', () => {
    expect(bonferroniAdjustedAlpha(10, 0.05)).toBeCloseTo(0.005);
  });
  it('comparisons=1이면 α 그대로', () => {
    expect(bonferroniAdjustedAlpha(1, 0.05)).toBe(0.05);
  });
  it('기본 α는 0.05', () => {
    expect(bonferroniAdjustedAlpha(10)).toBeCloseTo(0.005);
  });
  it('comparisons=0은 0 (방어적)', () => {
    expect(bonferroniAdjustedAlpha(0, 0.05)).toBe(0);
  });
});
