import * as fs from 'node:fs';

import type { ModelPin, OllamaTagsResponse, VerifyResult } from './types';

export type TagsFetcher = () => Promise<OllamaTagsResponse>;

/**
 * Ollama `/api/tags`로 현재 상태를 조회하여 승인 pin과 일치하는지 검증한다.
 *
 * ADR-011 채택 조건 #2 — 평가/운영에서 사용하는 모델의 digest drift를 차단.
 *
 * prefix 매칭: `/api/tags`가 12자리 short hash를 반환하고 pin에는 full hash를
 * 저장한 경우(또는 그 반대)에도 한쪽이 다른 쪽의 prefix면 일치로 인정한다.
 * 의도: 동일 blob의 표기 길이 차이는 drift가 아님.
 */
export async function verifyApprovedModel(
  model: string,
  pins: readonly ModelPin[],
  fetchTags: TagsFetcher,
): Promise<VerifyResult> {
  const pin = pins.find((p) => p.model === model);
  if (!pin) {
    return {
      ok: false,
      reason: 'not-pinned',
      model,
      message: `Model "${model}" has no entry in approved-models.json. Run pin-model CLI to add it.`,
    };
  }

  let tags: OllamaTagsResponse;
  try {
    tags = await fetchTags();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: 'not-found-in-ollama',
      model,
      pin,
      message: `Ollama /api/tags fetch failed: ${reason}`,
    };
  }

  const current = tags.models.find((m) => m.name === model);
  if (!current) {
    return {
      ok: false,
      reason: 'not-found-in-ollama',
      model,
      pin,
      message: `Model "${model}" not present in Ollama. Available: ${tags.models.map((m) => m.name).join(', ')}`,
    };
  }

  if (!digestsCompatible(pin.digest, current.digest)) {
    return {
      ok: false,
      reason: 'digest-mismatch',
      model,
      pin,
      currentDigest: current.digest,
      message: `Digest drift detected: pin=${pin.digest} current=${current.digest}. Model was replaced or re-pulled since approval.`,
    };
  }

  return { ok: true, pin, currentDigest: current.digest };
}

function digestsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.length !== nb.length) {
    const [shorter, longer] = na.length < nb.length ? [na, nb] : [nb, na];
    return longer.startsWith(shorter);
  }
  return false;
}

function normalize(hex: string): string {
  return hex.replace(/^sha256:/, '').toLowerCase();
}

export function loadPins(filePath: string): ModelPin[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${filePath} to contain a JSON array of ModelPin entries.`);
  }
  return parsed as ModelPin[];
}

export function savePins(filePath: string, pins: readonly ModelPin[]): void {
  fs.writeFileSync(filePath, JSON.stringify(pins, null, 2) + '\n', 'utf-8');
}

/**
 * 기본 `/api/tags` fetcher. OLLAMA_BASE_URL 환경변수를 사용.
 */
export function defaultTagsFetcher(baseUrl?: string): TagsFetcher {
  const url = `${baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'}/api/tags`;
  return async () => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Ollama /api/tags returned HTTP ${resp.status}`);
    return (await resp.json()) as OllamaTagsResponse;
  };
}
