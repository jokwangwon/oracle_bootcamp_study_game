/**
 * ADR-019 §3 — SM-2 Spaced Repetition pure functions.
 *
 *  - §3.1 `sm2Next` — canonical SM-2 + SM-2-lite clamp [2.3, 2.6] 항상 ON (Q3=b).
 *  - §3.2 `mapAnswerToQuality` — base - hintPenalty. timePenalty 제거 (Q5=a).
 *
 * 외부 의존 0 (I/O·Date.now·랜덤 미사용). caller 가 `anchor` 주입.
 * held/admin-override 라우팅은 서비스 계층(§5.1)에서 처리.
 */

export interface Sm2PrevState {
  easeFactor: number;
  intervalDays: number;
  repetition: number;
}

export interface Sm2Result {
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  dueAt: Date;
  lastReviewedAt: Date;
  lastQuality: number;
}

export interface MapAnswerToQualityInput {
  isCorrect: boolean;
  partialScore: number | null;
  hintsUsed: number;
  gradingMethod: string;
}

const DAY_MS = 86_400_000;
const EASE_CANONICAL_MIN = 1.3;
const EASE_LITE_MIN = 2.3;
const EASE_LITE_MAX = 2.6;
const HINT_PENALTY_MAX = 2;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function sm2Next(
  prev: Sm2PrevState,
  quality: number,
  anchor: Date = new Date(),
): Sm2Result {
  let repetition: number;
  let intervalDays: number;

  if (quality < 3) {
    repetition = 0;
    intervalDays = 1;
  } else {
    repetition = prev.repetition + 1;
    if (repetition === 1) {
      intervalDays = 1;
    } else if (repetition === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prev.intervalDays * prev.easeFactor);
    }
  }

  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  let ease = prev.easeFactor + delta;
  ease = Math.max(EASE_CANONICAL_MIN, ease);
  ease = clamp(ease, EASE_LITE_MIN, EASE_LITE_MAX);

  const dueAt = new Date(anchor.getTime() + intervalDays * DAY_MS);
  const lastReviewedAt = new Date(anchor.getTime());

  return {
    easeFactor: ease,
    intervalDays,
    repetition,
    dueAt,
    lastReviewedAt,
    lastQuality: quality,
  };
}

export function mapAnswerToQuality(
  input: MapAnswerToQualityInput,
): number | null {
  if (input.gradingMethod === 'held') {
    return null;
  }

  const ps = input.partialScore ?? (input.isCorrect ? 1 : 0);

  let base: number;
  if (input.isCorrect) {
    base = ps === 1 ? 5 : ps >= 0.7 ? 4 : 3;
  } else {
    base = ps >= 0.3 ? 2 : ps > 0 ? 1 : 0;
  }

  const hintPenalty = Math.min(input.hintsUsed, HINT_PENALTY_MAX);
  return clamp(base - hintPenalty, 0, 5);
}
