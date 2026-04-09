import { describe, expect, it } from 'vitest';

import latencyAssertion, { LATENCY_THRESHOLD_MS } from './latency';
import type { AssertionContext } from './types';

/**
 * MT5 — 종단 지연 (SDD v2 §3.1).
 *
 * 합격선 C7 ≤ 60s (60_000ms). promptfoo가 wall-clock 측정값을 latencyMs로
 * 넘겨준다.
 */

const baseCtx: AssertionContext = {
  prompt: 'test',
  vars: {
    gameMode: 'blank-typing',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'EASY',
    allowedKeywords: ['SELECT'],
    seedFocusKeyword: 'SELECT',
  },
};

describe('MT5 latencyAssertion', () => {
  it('60s 이내면 pass', async () => {
    const result = await latencyAssertion('whatever', { ...baseCtx, latencyMs: 30_000 });
    expect(result.pass).toBe(true);
  });

  it('정확히 60s는 pass (≤ 경계)', async () => {
    const result = await latencyAssertion('whatever', { ...baseCtx, latencyMs: LATENCY_THRESHOLD_MS });
    expect(result.pass).toBe(true);
  });

  it('60s 초과면 fail', async () => {
    const result = await latencyAssertion('whatever', { ...baseCtx, latencyMs: 65_000 });
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/60/);
  });

  it('latencyMs 미제공 시 fail (방어적 — promptfoo 미연결)', async () => {
    const result = await latencyAssertion('whatever', baseCtx);
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/latency/i);
  });

  it('출력 내용은 무시 — 본 메트릭은 전적으로 latencyMs 기반', async () => {
    const result = await latencyAssertion('', { ...baseCtx, latencyMs: 100 });
    expect(result.pass).toBe(true);
  });
});
