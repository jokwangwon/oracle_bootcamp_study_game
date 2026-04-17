import { Injectable } from '@nestjs/common';
import { Parser } from 'node-sql-parser';

import type { AstFailureReason, LayerVerdict } from '../grading.types';

/**
 * ADR-013 Layer 1 — AST Canonicalize grader (MVP-B Session 3, 커밋 1).
 *
 * node-sql-parser 5.4.0 은 Oracle dialect 를 네이티브 지원하지 않으므로
 * MySQL → PostgresQL 순차 fallback 으로 파싱을 시도한다. 학생 답안과
 * expected 답안 각각을 canonical SQL 문자열로 정규화(대소문자 통일 +
 * 공백·주석 제거 + 세미콜론 제거)한 뒤 완전 일치 여부로 PASS/FAIL 을
 * 판정한다.
 *
 * 파싱 실패 시 `verdict='UNKNOWN'` + `astFailureReason` 을 기록한다.
 * **Session 3 은 기록만(행동 분기 없음)** — Orchestrator 가 UNKNOWN 을
 * 받으면 기존 경로대로 Layer 2 (KeywordCoverageGrader) 로 자연 강등된다.
 * 사유별 행동 분기(예: `truly_invalid_syntax` → 즉시 FAIL)는 Session 4+
 * Rewriter 도입 시 별도 합의로 추가한다.
 *
 * 프로젝션 순서만 의미 있고 WHERE/GROUP BY 등 집합 절은 순서에 무관하다는
 * ADR-013 Line 53 규정은 node-sql-parser 의 `sqlify` 가 canonical 순서로
 * 직렬화해주므로 자연히 만족된다.
 */

export const AST_GRADER_VERSION = 'ast-v1';

/** Oracle 고유 구문 감지 — dialect_unsupported vs truly_invalid_syntax 분류용. */
const DIALECT_KEYWORDS: readonly RegExp[] = [
  /\bCONNECT\s+BY\b/i,
  /\bSTART\s+WITH\b/i,
  /\bPRIOR\b/i,
  /\bLISTAGG\b/i,
  /\bMERGE\s+INTO\b/i,
  /\(\s*\+\s*\)/,
];

/** `BEGIN ... END;` 또는 `DECLARE ... BEGIN ... END;` 형태의 PL/SQL 블록. */
const PLSQL_BLOCK = /^\s*(DECLARE\b|BEGIN\b)[\s\S]*?END\s*;?\s*$/i;

/** node-sql-parser 가 공식 지원하는 dialect 중 Oracle 과 가장 호환되는 순서. */
const DIALECTS = ['MySQL', 'PostgresQL'] as const;

export interface AstGradeInput {
  studentAnswer: string;
  expected: readonly string[];
}

type ParseResult =
  | { ok: true; canonical: string }
  | { ok: false; reason: AstFailureReason; detail: string };

@Injectable()
export class AstCanonicalGrader {
  private readonly parser = new Parser();

  grade(input: AstGradeInput): LayerVerdict {
    if (!input.expected || input.expected.length === 0) {
      throw new Error('AstCanonicalGrader: expected는 최소 1개 이상 필요');
    }

    const pre = preprocess(input.studentAnswer);
    if (pre.kind === 'empty') {
      return unknown('empty_answer', 'Layer 1 UNKNOWN — 빈 답안(공백/주석만)');
    }
    if (pre.kind === 'plsql') {
      return unknown(
        'non_sql_block',
        'Layer 1 UNKNOWN — PL/SQL 블록은 AST 채점 범위 외',
      );
    }

    const student = this.tryParse(input.studentAnswer);
    if (!student.ok) {
      return unknown(
        student.reason,
        `Layer 1 UNKNOWN — student parse failure: ${truncate(student.detail, 120)}`,
      );
    }

    const expectedCanonicals: string[] = [];
    for (const e of input.expected) {
      const p = this.tryParse(e);
      if (p.ok) expectedCanonicals.push(p.canonical);
    }
    if (expectedCanonicals.length === 0) {
      return unknown(
        'dialect_unsupported',
        'Layer 1 UNKNOWN — all expected templates unparseable (seed CI leakage suspected)',
      );
    }

    for (const exp of expectedCanonicals) {
      if (student.canonical === exp) {
        return {
          verdict: 'PASS',
          confidence: 1,
          rationale: `Layer 1 AST match (canonical=${truncate(student.canonical, 80)})`,
          graderDigest: AST_GRADER_VERSION,
        };
      }
    }

    return {
      verdict: 'FAIL',
      confidence: 0,
      rationale: `Layer 1 AST mismatch (student=${truncate(student.canonical, 60)}, expected_candidates=${expectedCanonicals.length})`,
      graderDigest: AST_GRADER_VERSION,
    };
  }

  private tryParse(sql: string): ParseResult {
    const errors: string[] = [];
    for (const database of DIALECTS) {
      try {
        const ast = this.parser.astify(sql, { database });
        const root = Array.isArray(ast) ? ast[0] : ast;
        if (!root || (root as { type?: string }).type === 'unknown') {
          return { ok: false, reason: 'empty_answer', detail: 'AST type=unknown' };
        }
        const raw = this.parser.sqlify(ast, { database });
        return { ok: true, canonical: canonicalize(raw) };
      } catch (e) {
        errors.push(String((e as Error)?.message ?? e));
      }
    }
    const reason: AstFailureReason = hasDialectKeyword(sql)
      ? 'dialect_unsupported'
      : 'truly_invalid_syntax';
    return { ok: false, reason, detail: errors.join(' || ') };
  }
}

function preprocess(sql: string): { kind: 'empty' | 'plsql' | 'sql' } {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length === 0) return { kind: 'empty' };
  if (PLSQL_BLOCK.test(sql)) return { kind: 'plsql' };
  return { kind: 'sql' };
}

function hasDialectKeyword(sql: string): boolean {
  return DIALECT_KEYWORDS.some((re) => re.test(sql));
}

function canonicalize(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*$/, '')
    .trim()
    .toUpperCase();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

function unknown(reason: AstFailureReason, rationale: string): LayerVerdict {
  return {
    verdict: 'UNKNOWN',
    rationale,
    graderDigest: AST_GRADER_VERSION,
    astFailureReason: reason,
  };
}
