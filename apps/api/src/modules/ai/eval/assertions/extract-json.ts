/**
 * LLM raw 출력에서 JSON 객체를 추출.
 *
 * StructuredOutputParser(LangChain)와 동일한 추출 규칙을 따른다:
 *  1. 마크다운 fenced code block 우선:  ```json\n{...}\n```  또는  ```\n{...}\n```
 *  2. 첫 fenced block이 없으면 raw 텍스트 전체를 그대로 JSON으로 시도
 *
 * 본 헬퍼는 MT1(json-parse), MT2(zod-schema), MT3(scope-whitelist),
 * MT4(blank-consistency), MT8(sanitization)에서 공유되며,
 * 동일 규칙이 본 모듈 한 곳에만 존재하도록 단일화한다.
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §3.1)
 */

const FENCED_JSON_REGEX = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

export interface ExtractJsonResult {
  ok: true;
  /** 파싱된 JS 객체 (구조 검증은 호출자가 수행) */
  value: unknown;
  /** 파싱에 사용된 raw 문자열 (디버깅용) */
  rawJsonText: string;
}

export interface ExtractJsonFailure {
  ok: false;
  /** 추출/파싱이 실패한 이유 (한국어, 사용자에게 노출 가능) */
  reason: string;
  /** 파싱을 시도한 raw 문자열 (디버깅용) */
  rawJsonText: string;
}

export function extractJson(rawText: string): ExtractJsonResult | ExtractJsonFailure {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      reason: '빈 출력 — JSON으로 파싱할 텍스트가 없습니다',
      rawJsonText: '',
    };
  }

  const fencedMatch = trimmed.match(FENCED_JSON_REGEX);
  // fencedMatch[1]은 capture group이 매칭된 경우 항상 string. 안전하게 fallback.
  const candidate = fencedMatch?.[1] !== undefined ? fencedMatch[1].trim() : trimmed;

  try {
    const value: unknown = JSON.parse(candidate);
    return { ok: true, value, rawJsonText: candidate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `JSON.parse 실패: ${message}`,
      rawJsonText: candidate,
    };
  }
}
