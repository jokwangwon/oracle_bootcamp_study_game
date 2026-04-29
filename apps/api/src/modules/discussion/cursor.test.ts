import { describe, it, expect } from 'vitest';

import {
  decodeCursor,
  encodeCursor,
  type ThreadCursor,
  type ThreadCursorHot,
  type ThreadCursorNew,
  type ThreadCursorTop,
} from './cursor';
import { BadRequestException } from '@nestjs/common';

/**
 * PR-12 §5.1 (Q-R5-14=b) — sort 별 cursor schema 분기.
 *
 * sort=new → {c: ISO, i: id}
 * sort=top → {s: number, i: id}
 * sort=hot → {h: number, i: id}
 *
 * base64url + JSON. round-trip 보장. 잘못된 sort+cursor 조합은 BadRequest.
 */

const ID = '00000000-0000-4000-8000-0000000000a1';
const NOW = new Date('2026-04-29T00:00:00Z');

describe('cursor — sort=new {c,i}', () => {
  it('encode → decode round-trip 안정', () => {
    const c: ThreadCursorNew = { c: NOW.toISOString(), i: ID };
    const s = encodeCursor(c, 'new');
    expect(decodeCursor(s, 'new')).toEqual(c);
  });

  it('decode 잘못된 base64 → BadRequest', () => {
    expect(() => decodeCursor('!!!not-base64!!!', 'new')).toThrow(
      BadRequestException,
    );
  });

  it('decode schema 불일치 (top schema 입력 + sort=new) → BadRequest', () => {
    const wrong = encodeCursor({ s: 10, i: ID } as ThreadCursorTop, 'top');
    expect(() => decodeCursor(wrong, 'new')).toThrow(BadRequestException);
  });
});

describe('cursor — sort=top {s,i}', () => {
  it('encode → decode round-trip', () => {
    const c: ThreadCursorTop = { s: 42, i: ID };
    expect(decodeCursor(encodeCursor(c, 'top'), 'top')).toEqual(c);
  });

  it('s 가 음수일 때도 안정 (downvoted thread)', () => {
    const c: ThreadCursorTop = { s: -3, i: ID };
    expect(decodeCursor(encodeCursor(c, 'top'), 'top')).toEqual(c);
  });
});

describe('cursor — sort=hot {h,i}', () => {
  it('encode → decode round-trip', () => {
    const c: ThreadCursorHot = { h: 12345.6789, i: ID };
    const out = decodeCursor(encodeCursor(c, 'hot'), 'hot') as ThreadCursorHot;
    expect(out.h).toBeCloseTo(c.h, 4);
    expect(out.i).toBe(ID);
  });
});

describe('cursor — invalid sort', () => {
  it('encodeCursor 가 잘못된 sort 토큰을 거부', () => {
    expect(() =>
      encodeCursor({ s: 1, i: ID } as ThreadCursor, 'invalid' as never),
    ).toThrow(BadRequestException);
  });

  it('decodeCursor 가 잘못된 sort 토큰을 거부', () => {
    expect(() =>
      decodeCursor(encodeCursor({ s: 1, i: ID }, 'top'), 'invalid' as never),
    ).toThrow(BadRequestException);
  });
});
