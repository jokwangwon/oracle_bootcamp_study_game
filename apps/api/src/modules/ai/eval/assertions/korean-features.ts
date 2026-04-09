import { extractJson } from './extract-json';
import type { AssertionContext, AssertionResult } from './types';

/**
 * MT6 계산적 보조 — 한국어 자연스러움 (SDD v2 §3.2).
 *
 * 본 assertion은 한국어 LLM judge(Tier 2)의 사전 필터로 동작한다.
 * 명백한 영어 출력/조사 누락/단조 어절 반복은 judge 호출 전에 차단해
 * judge 비용/편향을 줄인다.
 *
 * 측정 항목 (모두 통과해야 pass):
 *  1. 한글 비율 ≥ 30% — (가-힣 글자 수) / (비공백 총 글자 수)
 *  2. 어절 다양성 ≥ 0.6 — unique 어절 / 총 어절 (단, 어절 < 5개면 측정 보류)
 *  3. 조사 존재 — 한국어 기본 조사가 1회 이상 등장 (정규식 매칭)
 *
 * SDD §3.2 가중치: MT6 총점의 30% 비중. 본 assertion은 boolean을 반환하고,
 * 실제 점수 환산은 promptfoo + report-generator(단계 6)가 다른 가중치 항목과
 * 함께 처리한다.
 */

export const KOREAN_RATIO_THRESHOLD = 0.3;
export const EOJEOL_DIVERSITY_THRESHOLD = 0.6;
export const MIN_EOJEOL_FOR_DIVERSITY = 5;

const HANGUL_REGEX = /[가-힣]/g;
// 한국어 기본 조사 — 단어 끝에 붙는 형태 (의/은/는/이/가/을/를/에/에서/로/으로/와/과/도/만)
// 단순 substring 매칭으로는 false positive가 많아, 어절 끝 패턴으로 잡는다.
const PARTICLE_REGEX = /[가-힣](은|는|이|가|을|를|에|의|로|으로|와|과|도|만|에서|에게|부터|까지|보다)(\s|\.|,|!|\?|$)/;

interface FeatureMeasurement {
  koreanRatio: number;
  eojeolTotal: number;
  eojeolUnique: number;
  eojeolDiversity: number;
  hasParticle: boolean;
}

export function measureKoreanFeatures(text: string): FeatureMeasurement {
  const nonWhitespace = text.replace(/\s/g, '');
  const hangulMatches = text.match(HANGUL_REGEX) ?? [];
  const koreanRatio = nonWhitespace.length === 0 ? 0 : hangulMatches.length / nonWhitespace.length;

  const eojeols = text
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:]/g, ''))
    .filter((w) => w.length > 0);
  const eojeolTotal = eojeols.length;
  const eojeolUnique = new Set(eojeols).size;
  const eojeolDiversity = eojeolTotal === 0 ? 0 : eojeolUnique / eojeolTotal;

  const hasParticle = PARTICLE_REGEX.test(text);

  return { koreanRatio, eojeolTotal, eojeolUnique, eojeolDiversity, hasParticle };
}

export default async function koreanFeaturesAssertion(
  output: string,
  context: AssertionContext,
): Promise<AssertionResult> {
  const parsed = extractJson(output);
  if (!parsed.ok) {
    return {
      pass: false,
      score: 0,
      reason: `MT6-aux fail — JSON 파싱 실패 (${parsed.reason})`,
    };
  }

  const value = parsed.value as Record<string, unknown>;
  const gameMode = context.vars.gameMode;

  // 모드별로 검사 대상 텍스트 수집
  const texts: string[] = [];
  if (gameMode === 'term-match' && typeof value.description === 'string') {
    texts.push(value.description);
  }
  if (typeof value.explanation === 'string') {
    texts.push(value.explanation);
  }

  if (texts.length === 0) {
    return {
      pass: false,
      score: 0,
      reason: 'MT6-aux fail — 검사 대상 한국어 필드(description/explanation)를 찾지 못함',
    };
  }

  const combined = texts.join(' ');
  const features = measureKoreanFeatures(combined);

  const failures: string[] = [];

  // 1. 한글 비율
  if (features.koreanRatio < KOREAN_RATIO_THRESHOLD) {
    failures.push(
      `한글 비율 ${(features.koreanRatio * 100).toFixed(1)}% < ${KOREAN_RATIO_THRESHOLD * 100}%`,
    );
  }

  // 2. 어절 다양성 — 어절 수가 최소치 미만이면 측정 보류 (pass 처리하지 않고 fail)
  if (features.eojeolTotal < MIN_EOJEOL_FOR_DIVERSITY) {
    failures.push(`어절 ${features.eojeolTotal}개 < ${MIN_EOJEOL_FOR_DIVERSITY}개 (한국어 텍스트 부족)`);
  } else if (features.eojeolDiversity < EOJEOL_DIVERSITY_THRESHOLD) {
    failures.push(
      `어절 다양성 ${features.eojeolDiversity.toFixed(2)} < ${EOJEOL_DIVERSITY_THRESHOLD}`,
    );
  }

  // 3. 조사 존재
  if (!features.hasParticle) {
    failures.push('조사 미감지 (한국어 기본 조사 0개)');
  }

  if (failures.length > 0) {
    return {
      pass: false,
      score: Math.max(0, 1 - failures.length / 3),
      reason: `MT6-aux fail — ${failures.join('; ')}`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: `MT6-aux pass — 한글 ${(features.koreanRatio * 100).toFixed(0)}%, 다양성 ${features.eojeolDiversity.toFixed(2)}, 조사 OK`,
  };
}
