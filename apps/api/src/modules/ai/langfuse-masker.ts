import { createHash } from 'node:crypto';
import type { BaseMessage, MessageContent } from '@langchain/core/messages';
import type { ChainValues } from '@langchain/core/utils/types';
import type { LLMResult } from '@langchain/core/outputs';

/**
 * Langfuse masker (consensus-005 선행 PR — MVP-B Session 4 준비).
 *
 * 목적: `langfuse-langchain` CallbackHandler 가 Langfuse cloud 로 전송하는 payload
 * 에서 학생 답안 평문을 제거한다. AnswerSanitizer (Session 1) 이후 채점용 프롬프트에
 * 실린 학생 답안은 `<student_answer id="{nonce}">...</student_answer id="{nonce}">`
 * 태그로 둘러싸인 구간만 마스킹 대상이다 (Session 4 본 커밋에서 태그 도입).
 *
 * 출력 형식: `[HASH={sha256_hex16}|LEN={n}|KW={sqlKeyword1,sqlKeyword2,sqlKeyword3}]`
 *
 * 본 모듈은 **순수 함수만** 제공한다 — Langfuse CallbackHandler 오버라이드는
 * `masking-callback-handler.ts` 가 담당. 테스트 용이성과 계산적 검증(CLAUDE.md §2)
 * 원칙을 따른다.
 */

export const SQL_RESERVED_KEYWORDS: ReadonlySet<string> = new Set<string>([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
  'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES', 'SET',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'ON', 'USING',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'MINUS',
  'AS', 'IS', 'NULL', 'IN', 'LIKE', 'BETWEEN', 'EXISTS',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'SEQUENCE', 'TRIGGER',
  'WITH', 'CONNECT', 'START', 'PRIOR',
  'MERGE', 'MATCHED',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'NVL', 'DECODE', 'LISTAGG', 'ROWNUM', 'DUAL',
  'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'CONSTRAINT', 'CHECK', 'UNIQUE', 'DEFAULT',
]);

export const STUDENT_ANSWER_TAG_PATTERN =
  /<student_answer id="([^"]+)">([\s\S]*?)<\/student_answer id="\1">/g;

const STUDENT_ANSWER_TAG_RESIDUAL = /<\/?student_answer\b/;

export const BOUNDARY_ESCAPE_SENTINEL = '[BOUNDARY_ESCAPE_DETECTED]';
export const RATIONALE_MAX_LENGTH = 500;
export const RATIONALE_TRUNCATE_MARK = '…';

export function hashPii(text: string, len = 16): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, len);
}

export function extractSqlKeywordsTop3(text: string): string[] {
  const tokens = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const counts = new Map<string, number>();
  for (const raw of tokens) {
    const upper = raw.toUpperCase();
    if (!SQL_RESERVED_KEYWORDS.has(upper)) continue;
    counts.set(upper, (counts.get(upper) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([kw]) => kw);
}

export function maskStudentAnswerInText(text: string): string {
  const replaced = text.replace(
    STUDENT_ANSWER_TAG_PATTERN,
    (_full, _nonce, inner: string) => {
      const hash = hashPii(inner);
      const len = inner.length;
      const kws = extractSqlKeywordsTop3(inner).join(',');
      return `[HASH=${hash}|LEN=${len}|KW=${kws}]`;
    },
  );

  if (STUDENT_ANSWER_TAG_RESIDUAL.test(replaced)) {
    // 태그 불균형(id 불일치, 열린 태그만, 닫힌 태그만 등) → 전체 치환.
    // 평문 일부 유지로 인한 부분 노출 위험 제거.
    return BOUNDARY_ESCAPE_SENTINEL;
  }
  return replaced;
}

export function maskMessageContent(content: MessageContent): MessageContent {
  if (typeof content === 'string') {
    return maskStudentAnswerInText(content);
  }
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text') {
        const textPart = part as { type: 'text'; text: string };
        return { ...textPart, text: maskStudentAnswerInText(textPart.text) };
      }
      return part;
    });
  }
  return content;
}

export function maskChatMessages(messages: BaseMessage[][]): BaseMessage[][] {
  return messages.map((batch) =>
    batch.map((msg) => {
      const cloned: BaseMessage = Object.assign(
        Object.create(Object.getPrototypeOf(msg) as object),
        msg,
      );
      cloned.content = maskMessageContent(msg.content);
      return cloned;
    }),
  );
}

export function maskPromptStrings(prompts: string[]): string[] {
  return prompts.map(maskStudentAnswerInText);
}

export function maskChainValues(values: ChainValues): ChainValues {
  const out: ChainValues = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === 'string' ? maskStudentAnswerInText(v) : v;
  }
  return out;
}

export function maskLlmOutput(output: LLMResult): LLMResult {
  if (!output.generations || output.generations.length === 0) {
    return { ...output, generations: [] };
  }
  const maskText = (raw: string): string => {
    const masked = maskStudentAnswerInText(raw);
    if (masked.length > RATIONALE_MAX_LENGTH) {
      return masked.slice(0, RATIONALE_MAX_LENGTH) + RATIONALE_TRUNCATE_MARK;
    }
    return masked;
  };
  return {
    ...output,
    generations: output.generations.map((batch) =>
      batch.map((gen) => ({ ...gen, text: maskText(gen.text) })),
    ),
  };
}
