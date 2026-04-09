import type { AssertionContext, AssertionResult } from './types';

/**
 * MT5 — 종단 지연 (SDD v2 §3.1).
 *
 * 합격선 C7 ≤ 60s. 본 assertion은 단일 호출에 대한 boolean을 반환하며,
 * 평균/p95 등의 집계는 promptfoo + report-generator(단계 6)가 담당한다.
 *
 * latencyMs는 promptfoo가 wall-clock으로 측정해 context에 주입한다.
 * 미제공 시(context 미연결) 본 assertion은 의도적으로 fail을 반환해
 * "측정 누락"을 명시적으로 노출한다 — 침묵 pass는 위험.
 */
export const LATENCY_THRESHOLD_MS = 60_000;

export default async function latencyAssertion(
  _output: string,
  context: AssertionContext,
): Promise<AssertionResult> {
  if (typeof context.latencyMs !== 'number') {
    return {
      pass: false,
      score: 0,
      reason: 'MT5 fail — latencyMs가 context에 없음 (promptfoo 측정 누락)',
    };
  }

  if (context.latencyMs > LATENCY_THRESHOLD_MS) {
    return {
      pass: false,
      score: 0,
      reason: `MT5 fail — ${context.latencyMs}ms > 60s 임계`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: `MT5 pass — ${context.latencyMs}ms`,
  };
}
