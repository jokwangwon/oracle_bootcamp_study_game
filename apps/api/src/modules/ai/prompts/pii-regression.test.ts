import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * consensus-007 S6-C1-5 — prompt template PII 회귀 방지 (ADR-016 §7 / ADR-018 §8 금지 6).
 *
 * LLM 에 보내는 prompt 본문 은 **절대로** 학생 식별자 또는 그 파생정보를 포함해서는
 * 안 된다. 본 테스트는 `apps/api/src` 하위 **모든** 디렉토리의 `*.prompt.ts` 파일을
 * 재귀 스캔하여 금지 패턴을 감지하면 FAIL.
 *
 * ADR-020 §4.5 (CRITICAL-B5, PR-7) — 본래 hook 과 본 테스트는 `ai/prompts/` 평면
 * glob 만 지켰으나, 신규 모듈 (예: `discussion/prompts/`) 신설 시 회귀 가드 밖으로
 * 빠지는 위험이 있어 양쪽 모두 재귀로 확장한다.
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
// prompts/pii-regression.test.ts → prompts → ai → modules → src
const API_SRC_DIR = join(dirname(__filename), '..', '..', '..');

// runtime concat — 본 파일 자체 스캔 시 false positive 방지.
const U = 'u';
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: U + 'ser_token_hash', regex: new RegExp(U + 'ser[_-]?token[_-]?hash', 'i') },
  { name: U + 'serId', regex: new RegExp(`\\b${U}ser[_-]?id\\b`, 'i') },
  { name: U + 'ser_token_hash_epoch', regex: new RegExp(U + 'ser[_-]?token[_-]?hash[_-]?epoch', 'i') },
];

/**
 * `*.prompt.ts` 파일을 root 하위에서 재귀로 수집.
 *
 * `node_modules` / `dist` / `coverage` 등 빌드 산출물 디렉토리는 스킵.
 * 심볼릭 링크 미사용 가정 (정상 src 트리).
 */
export function findPromptFilesRecursively(root: string): string[] {
  const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.next', '.turbo']);
  const out: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile() && entry.endsWith('.prompt.ts')) {
        out.push(full);
      }
    }
  }

  walk(root);
  return out.sort();
}

function stripComments(source: string): string {
  // ADR 참조 등 주석 내 언급은 허용 — block + line 주석 제거 후 스캔.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('findPromptFilesRecursively (PR-7, ADR-020 §4.5)', () => {
  let tmpRoot: string;

  beforeAll(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'pii-regression-helper-'));
    // 평면: <root>/prompts/a.prompt.ts
    mkdirSync(join(tmpRoot, 'prompts'), { recursive: true });
    writeFileSync(join(tmpRoot, 'prompts', 'a.prompt.ts'), '// a');
    // 중첩: <root>/discussion/prompts/b.prompt.ts (재귀 글롭이 잡아야 함)
    mkdirSync(join(tmpRoot, 'discussion', 'prompts'), { recursive: true });
    writeFileSync(join(tmpRoot, 'discussion', 'prompts', 'b.prompt.ts'), '// b');
    // 더 깊게: <root>/m/sub/prompts/c.prompt.ts
    mkdirSync(join(tmpRoot, 'm', 'sub', 'prompts'), { recursive: true });
    writeFileSync(join(tmpRoot, 'm', 'sub', 'prompts', 'c.prompt.ts'), '// c');
    // 비대상 확장자 — 잡히면 안 됨
    writeFileSync(join(tmpRoot, 'prompts', 'a.test.ts'), '// not a prompt');
    writeFileSync(join(tmpRoot, 'prompts', 'helper.ts'), '// not a prompt');
    // 빌드 산출물 — 스킵돼야 함
    mkdirSync(join(tmpRoot, 'node_modules', 'x', 'prompts'), { recursive: true });
    writeFileSync(join(tmpRoot, 'node_modules', 'x', 'prompts', 'd.prompt.ts'), '// d');
    mkdirSync(join(tmpRoot, 'dist', 'prompts'), { recursive: true });
    writeFileSync(join(tmpRoot, 'dist', 'prompts', 'e.prompt.ts'), '// e');
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('평면 prompts/ 와 중첩 prompts/ 모두 잡는다', () => {
    const found = findPromptFilesRecursively(tmpRoot).map((f) => f.slice(tmpRoot.length + 1));
    expect(found).toContain(join('prompts', 'a.prompt.ts'));
    expect(found).toContain(join('discussion', 'prompts', 'b.prompt.ts'));
    expect(found).toContain(join('m', 'sub', 'prompts', 'c.prompt.ts'));
  });

  it('*.prompt.ts 가 아닌 파일은 잡지 않는다', () => {
    const found = findPromptFilesRecursively(tmpRoot);
    expect(found.some((f) => f.endsWith('a.test.ts'))).toBe(false);
    expect(found.some((f) => f.endsWith('helper.ts'))).toBe(false);
  });

  it('node_modules / dist 디렉토리는 스킵한다', () => {
    const found = findPromptFilesRecursively(tmpRoot);
    expect(found.some((f) => f.includes(`${tmpRoot}/node_modules`))).toBe(false);
    expect(found.some((f) => f.includes(`${tmpRoot}/dist`))).toBe(false);
  });
});

describe('prompt template PII 회귀 방지 (consensus-007 C1-5, PR-7 재귀)', () => {
  const files = findPromptFilesRecursively(API_SRC_DIR);

  it('apps/api/src 하위에서 최소 1개의 *.prompt.ts 가 발견', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(API_SRC_DIR.length + 1);
    it(`${rel} — 금지 키워드 부재 (주석 제외 본문 스캔)`, () => {
      const body = stripComments(readFileSync(file, 'utf8'));
      for (const { name: patternName, regex } of FORBIDDEN_PATTERNS) {
        expect(
          regex.test(body),
          `${rel}: forbidden pattern "${patternName}" 감지. ADR-016 §7 / ADR-018 §8 금지 6 위반.`,
        ).toBe(false);
      }
    });
  }
});
