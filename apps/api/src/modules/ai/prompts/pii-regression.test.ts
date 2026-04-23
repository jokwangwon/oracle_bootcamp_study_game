import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * consensus-007 S6-C1-5 — prompt template PII 회귀 방지 (ADR-016 §7 / ADR-018 §8 금지 6).
 *
 * LLM 에 보내는 prompt 본문 은 **절대로** 학생 식별자 또는 그 파생정보를 포함해서는
 * 안 된다. 본 테스트는 `apps/api/src/modules/ai/prompts/*.prompt.ts` 파일 전체를
 * 정규식 스캔하여 금지 패턴을 감지하면 FAIL.
 *
 * 금지 패턴 (정확 매칭):
 *  - `user_token_hash` / `userTokenHash` / `user-token-hash`
 *  - `userId` / `user_id` / `user-id`
 *  - `user_token_hash_epoch` / `userTokenHashEpoch`
 *
 * 허용 (false positive 방지):
 *  - `session_id` (D3 Hybrid 허용 키, ADR-016 §7)
 *  - 일반 `salt` / `hash` (SQL 예약어/컨텍스트 무관)
 *  - 주석 내 ADR 참조 (예: "ADR-018 §8 금지 6")
 *
 * 참고: 본 테스트 소스에는 금지 문자열을 자기 스캔하지 않도록 runtime concat 으로
 * 패턴 조립 (worm-regression.test.ts 와 동일 방어).
 */

const __filename = fileURLToPath(import.meta.url);
const PROMPTS_DIR = dirname(__filename);

// runtime concat — 본 파일 자체 스캔 시 false positive 방지.
const U = 'u';
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: U + 'ser_token_hash', regex: new RegExp(U + 'ser[_-]?token[_-]?hash', 'i') },
  { name: U + 'serId', regex: new RegExp(`\\b${U}ser[_-]?id\\b`, 'i') },
  { name: U + 'ser_token_hash_epoch', regex: new RegExp(U + 'ser[_-]?token[_-]?hash[_-]?epoch', 'i') },
];

function listPromptFiles(): string[] {
  return readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith('.prompt.ts'))
    .map((f) => join(PROMPTS_DIR, f));
}

function stripComments(source: string): string {
  // ADR 참조 등 주석 내 언급은 허용 — block + line 주석 제거 후 스캔.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('prompt template PII 회귀 방지 (consensus-007 C1-5)', () => {
  const files = listPromptFiles();

  it('최소 1개의 *.prompt.ts 파일이 prompts/ 디렉토리에 존재', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const name = file.split('/').slice(-1)[0];
    it(`${name} — 금지 키워드 부재 (주석 제외 본문 스캔)`, () => {
      const body = stripComments(readFileSync(file, 'utf8'));
      for (const { name: patternName, regex } of FORBIDDEN_PATTERNS) {
        expect(
          regex.test(body),
          `${name}: forbidden pattern "${patternName}" 감지. ADR-016 §7 / ADR-018 §8 금지 6 위반.`,
        ).toBe(false);
      }
    });
  }
});
