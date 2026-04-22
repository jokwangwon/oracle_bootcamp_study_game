import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR-018 §8 금지 1 + §10 Session 5 — Layer 4 CI 회귀 방지 테스트.
 *
 * migrations/ 디렉토리의 어떤 파일도 `UPDATE answer_history SET user_token_hash`
 * 패턴을 포함하지 않도록 감시한다. pre-commit hook (`.githooks/pre-commit`) 은 staged
 * 변경만 스캔하지만, 본 테스트는 전체 디렉토리를 매 CI 실행마다 확인하므로 우회 차단.
 *
 * 본 패턴이 필요해질 경우 별도 ADR 로 정책 번복 후에만 본 테스트 수정 허용.
 */

const MIGRATIONS_DIR = path.resolve(__dirname);
// 패턴은 concat 으로 조립 — pre-commit hook 자체 스캔 오탐 방지
// (test 파일 소스코드에 완성된 금지 문자열이 등장하지 않도록).
const UPDATE_KW = 'UPDATE';
const SET_KW = 'SET';
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  new RegExp(`${UPDATE_KW}\\s+answer_history\\s+${SET_KW}\\s+user_token_hash`, 'i'),
  new RegExp(`${UPDATE_KW}\\s+"answer_history"\\s+${SET_KW}\\s+"user_token_hash"`, 'i'),
];

describe('Layer 4 CI — migrations 재계산 회귀 방지 (ADR-018 §8 금지 1)', () => {
  const files = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'),
  );

  it('migrations 디렉토리에 최소 1개 migration 파일 존재 (인프라 건재 확인)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} — user_token_hash UPDATE 패턴 미포함`, () => {
      const content = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(content, `forbidden pattern ${pattern} in ${file}`).not.toMatch(
          pattern,
        );
      }
    });
  }
});
