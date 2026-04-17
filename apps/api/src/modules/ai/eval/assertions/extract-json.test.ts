import { describe, expect, it } from 'vitest';

import { extractJson } from './extract-json';

/**
 * extractJson 단위 테스트.
 *
 * 본 헬퍼는 LangChain StructuredOutputParser의 fenced-block 우선 규칙을
 * 따라야 하므로, OSS 모델이 자주 만드는 4가지 출력 패턴을 대표 케이스로 검증한다.
 */
describe('extractJson', () => {
  it('raw JSON 문자열을 그대로 파싱한다', () => {
    const result = extractJson('{"a":1,"b":"two"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ a: 1, b: 'two' });
    }
  });

  it('fenced ```json 블록에서 JSON을 추출한다', () => {
    const raw = '여기 결과입니다.\n```json\n{"sql":"SELECT * FROM EMP"}\n```\n끝.';
    const result = extractJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ sql: 'SELECT * FROM EMP' });
    }
  });

  it('언어 표시 없는 fenced ``` 블록도 추출한다', () => {
    const raw = '```\n{"x":42}\n```';
    const result = extractJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ x: 42 });
    }
  });

  it('파싱 실패 시 reason과 rawJsonText를 함께 반환한다', () => {
    const result = extractJson('this is not json at all');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/JSON\.parse/);
      expect(result.rawJsonText).toBe('this is not json at all');
    }
  });

  it('빈 문자열은 ok=false + 빈 출력 사유로 처리한다', () => {
    const result = extractJson('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/빈 출력/);
    }
  });
});
