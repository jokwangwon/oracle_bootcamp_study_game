/**
 * pure stat helpers (SDD v2 §10.3).
 *
 * 외부 stat 라이브러리 의존을 피하고 표준 알고리즘을 직접 구현. 모든 함수는
 * pure이며, 결정론(seeded RNG)으로 재현 가능 — 동일 seed면 동일 출력.
 *
 * 본 모듈이 제공하는 헬퍼:
 *  - `mean` / `percentile`: 기본 통계
 *  - `mulberry32`: seeded PRNG (재현 가능한 bootstrap)
 *  - `bootstrapPassRateCi`: pass rate의 95% bootstrap CI (1000회 default)
 *  - `macroStratifiedMean`: 난이도×모드 bucket 평균의 평균 (SDD §3.3)
 *  - `cohensD`: 두 분포 간 효과 크기
 *  - `bonferroniAdjustedAlpha`: 다중 비교 보정 (SDD §10.3)
 */

// ============================================================================
// 기본 통계
// ============================================================================

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * `p` 백분위수 (0..100). 단순 nearest-rank — N=100, p=95이면 95번째 원소.
 *
 * 본 구현은 단순함과 결정론을 우선한다 — interpolated (R7) 등의 변형은
 * 라운드 보고서 비교의 일관성에는 영향이 없으나 디버깅 비용을 늘린다.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!;
  const sorted = [...values].sort((a, b) => a - b);
  // nearest-rank: rank = ceil(p/100 * N), 1-indexed
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.max(0, Math.min(sorted.length - 1, rank - 1));
  return sorted[idx]!;
}

// ============================================================================
// Seeded PRNG (재현성)
// ============================================================================

/**
 * mulberry32 — 32-bit seeded PRNG. 표준 알고리즘.
 *
 * 동일 seed면 동일 시퀀스를 반환하므로, 본 PRNG를 사용하는 bootstrap이
 * 결정론적이 된다 (SDD §10.2).
 *
 * 출처: https://gist.github.com/tommyettinger/46a3c5b3eb6f0bdf6f8e
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Bootstrap 95% CI for pass rates
// ============================================================================

export interface BootstrapCi {
  /** bootstrap 평균 (관측 평균과 거의 동일) */
  mean: number;
  /** 95% CI 하한 */
  lower: number;
  /** 95% CI 상한 */
  upper: number;
}

export interface BootstrapOptions {
  samples?: number;
  seed?: number;
}

/**
 * pass rate의 nonparametric bootstrap 95% CI.
 *
 * 알고리즘:
 *  1. 관측값을 binary 벡터 [1,1,...,0,0] (passes 개의 1, total-passes 개의 0)
 *  2. 매 bootstrap iteration마다 length=total인 새 sample을 with-replacement로 draw
 *  3. 각 sample의 평균(=pass rate)을 기록
 *  4. samples 개의 sample rate를 정렬, 2.5/97.5 percentile = lower/upper
 *
 * 엣지 케이스:
 *  - total=0 → mean=0, lower=0, upper=0
 *  - passes=0 또는 passes=total → CI도 한 점에 수렴
 */
export function bootstrapPassRateCi(
  passes: number,
  total: number,
  options: BootstrapOptions = {},
): BootstrapCi {
  const samples = options.samples ?? 1000;
  const seed = options.seed ?? 42;

  if (total === 0) {
    return { mean: 0, lower: 0, upper: 0 };
  }

  // 관측 binary 벡터
  const observations: number[] = new Array(total);
  for (let i = 0; i < total; i += 1) {
    observations[i] = i < passes ? 1 : 0;
  }

  const observedRate = passes / total;

  // 양 극단(전체 pass / 전체 fail)은 bootstrap이 한 점에 수렴 — fast path
  if (passes === 0 || passes === total) {
    return { mean: observedRate, lower: observedRate, upper: observedRate };
  }

  const rng = mulberry32(seed);
  const sampleRates: number[] = new Array(samples);
  for (let s = 0; s < samples; s += 1) {
    let sum = 0;
    for (let i = 0; i < total; i += 1) {
      const idx = Math.floor(rng() * total);
      sum += observations[idx]!;
    }
    sampleRates[s] = sum / total;
  }

  sampleRates.sort((a, b) => a - b);
  const lower = sampleRates[Math.floor(samples * 0.025)]!;
  const upper = sampleRates[Math.min(samples - 1, Math.floor(samples * 0.975))]!;
  const bootstrapMean = mean(sampleRates);

  return {
    mean: bootstrapMean,
    lower,
    upper,
  };
}

// ============================================================================
// Macro stratified mean (SDD §3.3)
// ============================================================================

/**
 * bucket(난이도 × 모드)별 rate의 산술 평균.
 *
 * "macro" — bucket 크기와 무관하게 동등 가중치 (sample size 편향을 막기 위함).
 * NaN bucket(sample 없음)은 무시.
 */
export function macroStratifiedMean(bucketRates: readonly number[]): number {
  const valid = bucketRates.filter((r) => Number.isFinite(r));
  return mean(valid);
}

// ============================================================================
// Cohen's d (효과 크기)
// ============================================================================

/**
 * Cohen's d = (mean(a) - mean(b)) / pooled_std
 *
 * pooled_std = sqrt(((n_a - 1) * var_a + (n_b - 1) * var_b) / (n_a + n_b - 2))
 *
 * 분산이 모두 0인 경우 (모든 값이 동일):
 *  - 평균이 다르면 Infinity (의미: 무한히 큰 효과)
 *  - 평균도 같으면 0
 *
 * 빈 배열은 0 (방어적).
 */
export function cohensD(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const meanA = mean(a);
  const meanB = mean(b);
  const meanDiff = meanA - meanB;

  const varA = sampleVariance(a, meanA);
  const varB = sampleVariance(b, meanB);

  const nA = a.length;
  const nB = b.length;
  const denom = nA + nB - 2;
  if (denom <= 0) {
    return meanDiff === 0 ? 0 : Infinity;
  }

  const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / denom;

  if (pooledVar === 0) {
    return meanDiff === 0 ? 0 : Infinity * Math.sign(meanDiff);
  }

  return meanDiff / Math.sqrt(pooledVar);
}

function sampleVariance(values: readonly number[], precomputedMean: number): number {
  if (values.length < 2) return 0;
  let sumSq = 0;
  for (const v of values) {
    const diff = v - precomputedMean;
    sumSq += diff * diff;
  }
  return sumSq / (values.length - 1);
}

// ============================================================================
// Bonferroni adjustment (SDD §10.3)
// ============================================================================

/**
 * 다중 비교 보정 — 5 모델 10 페어 비교 시 α=0.05/10=0.005.
 *
 * comparisons=0은 의미가 없으므로 0을 반환 (방어적).
 */
export function bonferroniAdjustedAlpha(
  comparisons: number,
  baseAlpha = 0.05,
): number {
  if (comparisons <= 0) return 0;
  return baseAlpha / comparisons;
}
