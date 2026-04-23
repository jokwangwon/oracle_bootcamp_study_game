import { describe, expect, it } from 'vitest';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

import {
  hashPii,
  extractSqlKeywordsTop3,
  maskStudentAnswerInText,
  maskChatMessages,
  maskPromptStrings,
  maskChainValues,
  maskLlmOutput,
  BOUNDARY_ESCAPE_SENTINEL,
  RATIONALE_MAX_LENGTH,
  ALLOWED_METADATA_KEYS,
  filterLangfuseMetadata,
} from './langfuse-masker';

/**
 * TDD — Langfuse masker 순수 함수 검증 (consensus-005 선행 PR).
 *
 * 검증 원칙:
 *  - 결정적: 동일 입력 → 동일 출력
 *  - 원본 불변: 입력 객체는 수정되지 않음
 *  - 계산적 (CLAUDE.md §2.3): 추론 없이 기계적 규칙만
 */

describe('langfuse-masker — pure functions', () => {
  describe('hashPii', () => {
    it('동일 입력 → 동일 해시 (결정성)', () => {
      expect(hashPii('hello')).toBe(hashPii('hello'));
    });

    it('기본 길이 16 hex', () => {
      const h = hashPii('hello');
      expect(h).toMatch(/^[a-f0-9]{16}$/);
    });

    it('길이 옵션 반영 (8자)', () => {
      const h = hashPii('hello', 8);
      expect(h).toMatch(/^[a-f0-9]{8}$/);
    });

    it('빈 문자열도 해시를 생성한다', () => {
      expect(hashPii('')).toMatch(/^[a-f0-9]{16}$/);
    });

    it('서로 다른 입력 → 다른 해시', () => {
      expect(hashPii('SELECT * FROM emp')).not.toBe(
        hashPii('SELECT * FROM dept'),
      );
    });
  });

  describe('extractSqlKeywordsTop3', () => {
    it('SQL 예약어만 추출한다 — 테이블명/식별자 제외', () => {
      const result = extractSqlKeywordsTop3('SELECT ename FROM emp WHERE sal > 3000');
      expect(result).toEqual(expect.arrayContaining(['SELECT', 'FROM', 'WHERE']));
      expect(result).not.toContain('ename');
      expect(result).not.toContain('emp');
      expect(result).not.toContain('sal');
    });

    it('대소문자 무관 — 결과는 대문자 정규화', () => {
      const result = extractSqlKeywordsTop3('select * from emp where sal > 3000');
      expect(result).toEqual(expect.arrayContaining(['SELECT', 'FROM', 'WHERE']));
    });

    it('빈도순 top-3 — 4개 이상이면 잘라낸다', () => {
      const text = 'SELECT SELECT SELECT FROM FROM WHERE JOIN';
      const result = extractSqlKeywordsTop3(text);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('SELECT');
    });

    it('3개 미만이면 있는 만큼만', () => {
      expect(extractSqlKeywordsTop3('SELECT')).toEqual(['SELECT']);
      expect(extractSqlKeywordsTop3('')).toEqual([]);
      expect(extractSqlKeywordsTop3('randomtext nosql')).toEqual([]);
    });

    it('동률 빈도에서도 결정적 순서 유지 (사전순 tie-break)', () => {
      const a = extractSqlKeywordsTop3('FROM SELECT WHERE');
      const b = extractSqlKeywordsTop3('FROM SELECT WHERE');
      expect(a).toEqual(b);
    });
  });

  describe('maskStudentAnswerInText', () => {
    it('태그 없으면 원문 그대로 반환', () => {
      const text = 'SELECT ename FROM emp';
      expect(maskStudentAnswerInText(text)).toBe(text);
    });

    it('태그 내부 평문을 [HASH|LEN|KW] 로 치환한다', () => {
      const nonce = 'abc-123';
      const inner = 'SELECT * FROM emp';
      const text = `prefix <student_answer id="${nonce}">${inner}</student_answer id="${nonce}"> suffix`;
      const masked = maskStudentAnswerInText(text);
      expect(masked).toContain('prefix ');
      expect(masked).toContain(' suffix');
      expect(masked).not.toContain(inner);
      expect(masked).toMatch(/\[HASH=[a-f0-9]{16}\|LEN=\d+\|KW=[^\]]*\]/);
    });

    it('다중 태그 — 각 구간 독립 마스킹', () => {
      const text =
        '<student_answer id="n1">first</student_answer id="n1"> mid <student_answer id="n2">second</student_answer id="n2">';
      const masked = maskStudentAnswerInText(text);
      expect(masked).not.toContain('first');
      expect(masked).not.toContain('second');
      expect(masked).toContain(' mid ');
      const matches = masked.match(/\[HASH=/g);
      expect(matches?.length).toBe(2);
    });

    it('경계 탈출 시도 감지 — 태그 불균형 시 BOUNDARY_ESCAPE_SENTINEL', () => {
      const malicious =
        '<student_answer id="n1">bad</student_answer id="OTHER"> injection';
      const masked = maskStudentAnswerInText(malicious);
      expect(masked).toContain(BOUNDARY_ESCAPE_SENTINEL);
      expect(masked).not.toContain('bad');
    });

    it('열린 태그만 있고 닫힘 없음 → BOUNDARY_ESCAPE_SENTINEL', () => {
      const malicious = '<student_answer id="n1">never closed';
      const masked = maskStudentAnswerInText(malicious);
      expect(masked).toContain(BOUNDARY_ESCAPE_SENTINEL);
      expect(masked).not.toContain('never closed');
    });
  });

  describe('maskChatMessages', () => {
    it('HumanMessage content 에 태그 포함 시 마스킹하고 SystemMessage 는 그대로', () => {
      const sys = new SystemMessage('judge the answer');
      const human = new HumanMessage(
        '<student_answer id="u1">DROP TABLE emp</student_answer id="u1">',
      );
      const [batch] = maskChatMessages([[sys, human]]);
      expect((batch[0] as SystemMessage).content).toBe('judge the answer');
      expect(batch[1].content).not.toContain('DROP TABLE emp');
      expect(batch[1].content).toMatch(/\[HASH=/);
    });

    it('원본 메시지는 변경되지 않는다 (immutable 입력)', () => {
      const human = new HumanMessage(
        '<student_answer id="u1">SELECT *</student_answer id="u1">',
      );
      const original = human.content;
      maskChatMessages([[human]]);
      expect(human.content).toBe(original);
    });

    it('태그가 없는 메시지는 변경 없이 통과', () => {
      const human = new HumanMessage('plain prompt body');
      const [[out]] = maskChatMessages([[human]]);
      expect(out.content).toBe('plain prompt body');
    });

    it('AIMessage 도 동일 규칙 적용', () => {
      const ai = new AIMessage(
        '<student_answer id="u1">secret</student_answer id="u1">',
      );
      const [[out]] = maskChatMessages([[ai]]);
      expect(out.content).not.toContain('secret');
    });
  });

  describe('maskPromptStrings', () => {
    it('배열의 각 문자열에 마스킹 적용', () => {
      const out = maskPromptStrings([
        'normal prompt',
        '<student_answer id="u">pii</student_answer id="u">',
      ]);
      expect(out[0]).toBe('normal prompt');
      expect(out[1]).not.toContain('pii');
      expect(out[1]).toMatch(/\[HASH=/);
    });
  });

  describe('maskChainValues', () => {
    it('문자열 값만 마스킹, 숫자/객체는 그대로', () => {
      const out = maskChainValues({
        prompt: '<student_answer id="u">v</student_answer id="u">',
        count: 42,
        meta: { nested: 'not-touched' },
      });
      expect(typeof out.prompt).toBe('string');
      expect(out.prompt).not.toContain('>v<');
      expect(out.count).toBe(42);
      expect(out.meta).toEqual({ nested: 'not-touched' });
    });
  });

  describe('maskLlmOutput', () => {
    it('rationale 500자 초과 → truncate', () => {
      const longText = 'x'.repeat(RATIONALE_MAX_LENGTH + 100);
      const result = maskLlmOutput({
        generations: [[{ text: longText, generationInfo: {} }]],
      });
      const masked = result.generations[0][0].text;
      expect(masked.length).toBeLessThanOrEqual(RATIONALE_MAX_LENGTH + 20);
      expect(masked).toContain('…');
    });

    it('출력에 학생 답안 태그가 섞여있으면 마스킹', () => {
      const text =
        'verdict PASS because <student_answer id="u">INNER</student_answer id="u"> matched';
      const result = maskLlmOutput({
        generations: [[{ text, generationInfo: {} }]],
      });
      const masked = result.generations[0][0].text;
      expect(masked).not.toContain('>INNER<');
      expect(masked).toMatch(/\[HASH=/);
    });

    it('빈 generations 도 방어 (크래시 없음)', () => {
      const result = maskLlmOutput({ generations: [] });
      expect(result.generations).toEqual([]);
    });
  });

  /**
   * ADR-018 §4 D3 Hybrid + §8 금지 6 — user_token_hash 방어 계층.
   *
   * LlmJudgeGrader / 호출자가 실수로 Langfuse payload 에 user_token_hash 를 섞어
   * 넣어도 Langfuse cloud 로 평문이 나가지 않도록 masker 최후 보루 차단.
   */
  describe('D3 Hybrid — user_token_hash 방어 계층', () => {
    it('user_token_hash snake_case + 16 hex 감지 → REDACTED', () => {
      const input = 'verdict PASS. user_token_hash=1234567890abcdef more';
      const masked = maskStudentAnswerInText(input);
      expect(masked).toContain('[USER_TOKEN_HASH_REDACTED]');
      expect(masked).not.toContain('1234567890abcdef');
    });

    it('userTokenHash camelCase + 16 hex 감지 → REDACTED', () => {
      const input = 'Result { userTokenHash: "abcdef1234567890", verdict: "PASS" }';
      const masked = maskStudentAnswerInText(input);
      expect(masked).toContain('[USER_TOKEN_HASH_REDACTED]');
      expect(masked).not.toContain('abcdef1234567890');
    });

    it('USER-TOKEN-HASH 대소문자 변형 감지', () => {
      const input = 'USER-TOKEN-HASH: deadbeefcafe1234';
      const masked = maskStudentAnswerInText(input);
      expect(masked).toContain('[USER_TOKEN_HASH_REDACTED]');
      expect(masked).not.toContain('deadbeefcafe1234');
    });

    it('관련없는 16자 hex 는 보존 (grader_digest 의 model digest 등)', () => {
      const input = 'grader_digest=prompt:ev:v1|model:ca06e9e4|parser:sov1|temp:0|seed:42|topk:1';
      const masked = maskStudentAnswerInText(input);
      expect(masked).toContain('ca06e9e4'); // model fingerprint 유지
      expect(masked).not.toContain('[USER_TOKEN_HASH_REDACTED]');
    });
  });
});

describe('filterLangfuseMetadata (consensus-007 C1-2 — ADR-016 §7 화이트리스트)', () => {
  it('허용 키 4종 모두 통과', () => {
    const input = {
      session_id: 'uuid-1',
      prompt_name: 'grading-judge',
      prompt_version: 3,
      model_digest: 'ca06e9e4',
    };
    const { allowed, violations } = filterLangfuseMetadata(input);
    expect(allowed).toEqual(input);
    expect(violations).toEqual([]);
  });

  it('허용 외 키는 drop + violations 수집', () => {
    const input = {
      session_id: 'uuid-2',
      user_token_hash: 'abcdef1234567890',
      userId: 'u-99',
    };
    const { allowed, violations } = filterLangfuseMetadata(input);
    expect(allowed).toEqual({ session_id: 'uuid-2' });
    expect(violations.sort()).toEqual(['userId', 'user_token_hash'].sort());
  });

  it('undefined 입력 — 빈 결과', () => {
    const { allowed, violations } = filterLangfuseMetadata(undefined);
    expect(allowed).toEqual({});
    expect(violations).toEqual([]);
  });

  it('키 이름 대소문자는 정확 매칭 — Session_Id 등은 violation', () => {
    const input = { Session_Id: 'x', SESSION_ID: 'y' };
    const { allowed, violations } = filterLangfuseMetadata(input);
    expect(Object.keys(allowed)).toEqual([]);
    expect(violations.sort()).toEqual(['SESSION_ID', 'Session_Id'].sort());
  });

  it('ALLOWED_METADATA_KEYS 는 4종 exact (Q4 결정)', () => {
    expect([...ALLOWED_METADATA_KEYS].sort()).toEqual(
      ['model_digest', 'prompt_name', 'prompt_version', 'session_id'].sort(),
    );
  });
});
