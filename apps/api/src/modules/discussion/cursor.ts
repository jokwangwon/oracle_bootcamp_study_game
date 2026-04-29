import { BadRequestException } from '@nestjs/common';

/**
 * PR-12 §5.1 — sort 별 cursor schema 분기 (Q-R5-14=b).
 *
 * - sort=new → {c: ISO timestamp, i: id} — createdAt 기준 페이지네이션
 * - sort=top → {s: number, i: id}        — score 기준
 * - sort=hot → {h: number, i: id}        — Reddit log10 hot value 기준
 *
 * 인코딩: base64url(JSON.stringify(cursor)). 잘못된 sort+cursor 조합 → BadRequest.
 */

export type ThreadSort = 'new' | 'hot' | 'top';
export const THREAD_SORTS: ReadonlyArray<ThreadSort> = ['new', 'hot', 'top'];

export type ThreadCursorNew = { c: string; i: string };
export type ThreadCursorTop = { s: number; i: string };
export type ThreadCursorHot = { h: number; i: string };
export type ThreadCursor = ThreadCursorNew | ThreadCursorTop | ThreadCursorHot;

function isThreadSort(v: unknown): v is ThreadSort {
  return typeof v === 'string' && (THREAD_SORTS as ReadonlyArray<string>).includes(v);
}

function isThreadCursorNew(v: unknown): v is ThreadCursorNew {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { c?: unknown }).c === 'string' &&
    typeof (v as { i?: unknown }).i === 'string'
  );
}

function isThreadCursorTop(v: unknown): v is ThreadCursorTop {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { s?: unknown }).s === 'number' &&
    typeof (v as { i?: unknown }).i === 'string'
  );
}

function isThreadCursorHot(v: unknown): v is ThreadCursorHot {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { h?: unknown }).h === 'number' &&
    typeof (v as { i?: unknown }).i === 'string'
  );
}

export function encodeCursor(cursor: ThreadCursor, sort: ThreadSort): string {
  if (!isThreadSort(sort)) throw new BadRequestException('invalid_sort');
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(s: string, sort: ThreadSort): ThreadCursor {
  if (!isThreadSort(sort)) throw new BadRequestException('invalid_sort');
  let obj: unknown;
  try {
    const decoded = Buffer.from(s, 'base64url').toString('utf8');
    obj = JSON.parse(decoded);
  } catch {
    throw new BadRequestException('invalid_cursor');
  }
  if (sort === 'new') {
    if (!isThreadCursorNew(obj)) throw new BadRequestException('invalid_cursor');
    const created = new Date(obj.c);
    if (Number.isNaN(created.valueOf())) {
      throw new BadRequestException('invalid_cursor');
    }
    return obj;
  }
  if (sort === 'top') {
    if (!isThreadCursorTop(obj)) throw new BadRequestException('invalid_cursor');
    return obj;
  }
  if (sort === 'hot') {
    if (!isThreadCursorHot(obj)) throw new BadRequestException('invalid_cursor');
    return obj;
  }
  throw new BadRequestException('invalid_sort');
}
