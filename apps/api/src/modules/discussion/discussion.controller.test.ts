import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  DiscussionController,
  decodeCursor,
  encodeCursor,
} from './discussion.controller';
import type { DiscussionService } from './discussion.service';

/**
 * PR-10b Phase 5 — DiscussionController.
 *
 * 컨벤션 (auth-throttler.test.ts 헤더): vitest+esbuild emitDecoratorMetadata
 * 미지원 → 통합 e2e 별도 하네스. 본 spec 은 handler 가 service 를 정확히
 * delegate 하는지 + Throttle/Guard 메타데이터 회귀 만 검증.
 */

const THROTTLER_TTL_KEY = 'THROTTLER:TTL';
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';
const DISCUSSION_THROTTLE_NAME = 'discussion_write';
const WRITE_TTL_MS = 60_000;
const WRITE_LIMIT = 5;

const QUESTION_ID = '00000000-0000-4000-8000-0000000000a1';
const THREAD_ID = '00000000-0000-4000-8000-0000000000b1';
const POST_ID = '00000000-0000-4000-8000-0000000000d1';
const USER_ID = '00000000-0000-4000-8000-0000000000c1';

function makeService() {
  return {
    listThreadsByQuestion: vi.fn(),
    getThread: vi.fn(),
    createThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    listPostsByThread: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    castVote: vi.fn(),
    acceptPost: vi.fn(),
  } as unknown as DiscussionService & Record<string, ReturnType<typeof vi.fn>>;
}

function makeReq(): Request {
  return { user: { sub: USER_ID } } as unknown as Request;
}

/** PR-12 §7 — @Public() endpoint 의 비인증 요청 (req.user 없음). */
function makeAnonymousReq(): Request {
  return {} as unknown as Request;
}

function readNamed(handler: object, name: string) {
  return {
    ttl: Reflect.getMetadata(THROTTLER_TTL_KEY + name, handler),
    limit: Reflect.getMetadata(THROTTLER_LIMIT_KEY + name, handler),
  };
}

describe('DiscussionController — handler delegate', () => {
  let service: ReturnType<typeof makeService>;
  let controller: DiscussionController;

  beforeEach(() => {
    service = makeService();
    controller = new DiscussionController(service);
  });

  it('listThreadsByQuestion — sort=hot/cursor/limit + 인증 사용자 → service 에 userId 전달', async () => {
    service.listThreadsByQuestion.mockResolvedValue([]);
    const cursor = encodeCursor({ h: 1234.5, i: THREAD_ID }, 'hot');

    await controller.listThreadsByQuestion(
      QUESTION_ID,
      makeReq(),
      'hot',
      cursor,
      '30',
    );

    expect(service.listThreadsByQuestion).toHaveBeenCalledWith(
      QUESTION_ID,
      {
        sort: 'hot',
        cursor: { h: 1234.5, i: THREAD_ID },
        limit: 30,
      },
      USER_ID,
    );
  });

  it('listThreadsByQuestion — 비인증 요청 (@Public) → service 에 userId=null 전달', async () => {
    service.listThreadsByQuestion.mockResolvedValue([]);
    await controller.listThreadsByQuestion(QUESTION_ID, makeAnonymousReq());
    expect(service.listThreadsByQuestion).toHaveBeenCalledWith(
      QUESTION_ID,
      expect.any(Object),
      null,
    );
  });

  it('listThreadsByQuestion — invalid sort → BadRequestException', async () => {
    await expect(
      controller.listThreadsByQuestion(
        QUESTION_ID,
        makeReq(),
        "'; DROP TABLE--",
        undefined,
        undefined,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('getThread — 인증 사용자 → service.getThread(threadId, userId)', async () => {
    service.getThread.mockResolvedValue({} as never);

    await controller.getThread(THREAD_ID, makeReq());

    expect(service.getThread).toHaveBeenCalledWith(THREAD_ID, USER_ID);
  });

  it('getThread — 비인증 (@Public) → service.getThread(threadId, null)', async () => {
    service.getThread.mockResolvedValue({} as never);
    await controller.getThread(THREAD_ID, makeAnonymousReq());
    expect(service.getThread).toHaveBeenCalledWith(THREAD_ID, null);
  });

  it('createThread — req.user.sub + questionId + dto delegate', async () => {
    service.createThread.mockResolvedValue({} as never);

    await controller.createThread(
      QUESTION_ID,
      { title: 't', body: 'b' },
      makeReq(),
    );

    expect(service.createThread).toHaveBeenCalledWith(USER_ID, QUESTION_ID, {
      title: 't',
      body: 'b',
    });
  });

  it('updateThread — req.user.sub + threadId + dto delegate', async () => {
    await controller.updateThread(THREAD_ID, { title: 't', body: 'b' }, makeReq());
    expect(service.updateThread).toHaveBeenCalledWith(USER_ID, THREAD_ID, {
      title: 't',
      body: 'b',
    });
  });

  it('deleteThread — req.user.sub + threadId delegate', async () => {
    await controller.deleteThread(THREAD_ID, makeReq());
    expect(service.deleteThread).toHaveBeenCalledWith(USER_ID, THREAD_ID);
  });

  it('listPostsByThread — parentId Query string passthrough + userId', async () => {
    service.listPostsByThread.mockResolvedValue([]);
    await controller.listPostsByThread(THREAD_ID, makeReq(), POST_ID);
    expect(service.listPostsByThread).toHaveBeenCalledWith(
      THREAD_ID,
      { parentId: POST_ID },
      USER_ID,
    );
  });

  it('listPostsByThread — 비인증 (@Public) → userId=null', async () => {
    service.listPostsByThread.mockResolvedValue([]);
    await controller.listPostsByThread(THREAD_ID, makeAnonymousReq());
    expect(service.listPostsByThread).toHaveBeenCalledWith(
      THREAD_ID,
      expect.any(Object),
      null,
    );
  });

  it('createPost — req.user.sub + threadId + dto delegate', async () => {
    service.createPost.mockResolvedValue({} as never);
    await controller.createPost(THREAD_ID, { body: 'x' }, makeReq());
    expect(service.createPost).toHaveBeenCalledWith(USER_ID, THREAD_ID, {
      body: 'x',
    });
  });

  it('updatePost — req.user.sub + postId + dto delegate', async () => {
    await controller.updatePost(POST_ID, { body: 'x' }, makeReq());
    expect(service.updatePost).toHaveBeenCalledWith(USER_ID, POST_ID, {
      body: 'x',
    });
  });

  it('deletePost — req.user.sub + postId delegate', async () => {
    await controller.deletePost(POST_ID, makeReq());
    expect(service.deletePost).toHaveBeenCalledWith(USER_ID, POST_ID);
  });

  it('castVote — req.user.sub + dto delegate', async () => {
    service.castVote.mockResolvedValue({ change: 1 });
    const out = await controller.castVote(
      { targetType: 'post', targetId: POST_ID, value: 1 },
      makeReq(),
    );
    expect(service.castVote).toHaveBeenCalledWith(USER_ID, {
      targetType: 'post',
      targetId: POST_ID,
      value: 1,
    });
    expect(out).toEqual({ change: 1 });
  });

  it('acceptPost — req.user.sub + postId delegate', async () => {
    await controller.acceptPost(POST_ID, makeReq());
    expect(service.acceptPost).toHaveBeenCalledWith(USER_ID, POST_ID);
  });
});

describe('DiscussionController cursor base64url helpers (PR-12 sort 별 schema)', () => {
  it('sort=new — encode → decode round-trip {c,i}', () => {
    const original = {
      c: '2026-04-29T12:34:56.789Z',
      i: THREAD_ID,
    };
    const decoded = decodeCursor(encodeCursor(original, 'new'), 'new') as {
      c: string;
      i: string;
    };
    expect(decoded.c).toBe(original.c);
    expect(decoded.i).toBe(original.i);
  });

  it('sort=top — encode → decode round-trip {s,i}', () => {
    const original = { s: 42, i: THREAD_ID };
    const decoded = decodeCursor(encodeCursor(original, 'top'), 'top') as {
      s: number;
      i: string;
    };
    expect(decoded).toEqual(original);
  });

  it('sort=hot — encode → decode round-trip {h,i}', () => {
    const original = { h: 1234.5, i: THREAD_ID };
    const decoded = decodeCursor(encodeCursor(original, 'hot'), 'hot') as {
      h: number;
      i: string;
    };
    expect(decoded.h).toBeCloseTo(1234.5, 4);
    expect(decoded.i).toBe(THREAD_ID);
  });

  it('잘못된 base64 → BadRequestException("invalid_cursor")', () => {
    expect(() => decodeCursor('!!!not-base64!!!', 'new')).toThrow(
      'invalid_cursor',
    );
  });

  it('shape 불일치 (필드 누락) → BadRequestException', () => {
    const bad = Buffer.from(JSON.stringify({ x: 1 }), 'utf8').toString(
      'base64url',
    );
    expect(() => decodeCursor(bad, 'new')).toThrow('invalid_cursor');
  });

  it('Invalid Date (sort=new) → BadRequestException', () => {
    const bad = Buffer.from(
      JSON.stringify({ c: 'not-a-date', i: THREAD_ID }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(bad, 'new')).toThrow('invalid_cursor');
  });

  it('schema 불일치 (top schema → sort=new) → BadRequestException', () => {
    const wrong = encodeCursor({ s: 1, i: THREAD_ID }, 'top');
    expect(() => decodeCursor(wrong, 'new')).toThrow('invalid_cursor');
  });
});

describe('DiscussionController @Throttle / @UseGuards 메타데이터 (ADR-020 §5.3)', () => {
  it('write endpoint 5종 (createThread/updateThread/deleteThread/createPost/updatePost) 에 named throttler 적용', () => {
    const writeHandlers = [
      DiscussionController.prototype.createThread,
      DiscussionController.prototype.updateThread,
      DiscussionController.prototype.deleteThread,
      DiscussionController.prototype.createPost,
      DiscussionController.prototype.updatePost,
    ];
    for (const h of writeHandlers) {
      const { ttl, limit } = readNamed(h, DISCUSSION_THROTTLE_NAME);
      expect(ttl, h.name).toBe(WRITE_TTL_MS);
      expect(limit, h.name).toBe(WRITE_LIMIT);
    }
  });

  it('vote / acceptPost / deletePost 도 동일 throttle 적용', () => {
    for (const h of [
      DiscussionController.prototype.castVote,
      DiscussionController.prototype.acceptPost,
      DiscussionController.prototype.deletePost,
    ]) {
      const { ttl, limit } = readNamed(h, DISCUSSION_THROTTLE_NAME);
      expect(ttl, h.name).toBe(WRITE_TTL_MS);
      expect(limit, h.name).toBe(WRITE_LIMIT);
    }
  });

  it('read endpoint (listThreadsByQuestion / getThread / listPostsByThread) 에는 throttle 미적용', () => {
    for (const h of [
      DiscussionController.prototype.listThreadsByQuestion,
      DiscussionController.prototype.getThread,
      DiscussionController.prototype.listPostsByThread,
    ]) {
      const { ttl, limit } = readNamed(h, DISCUSSION_THROTTLE_NAME);
      expect(ttl, h.name).toBeUndefined();
      expect(limit, h.name).toBeUndefined();
    }
  });

  it('클래스 레벨 @UseGuards 에 JwtAuthGuard + ThrottlerGuard 등록', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DiscussionController) as
      | Array<unknown>
      | undefined;
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(ThrottlerGuard);
  });
});

describe('DiscussionController — @Public() 메타데이터 (Phase 3c)', () => {
  it('read 3종 (listThreadsByQuestion / getThread / listPostsByThread) 에 IS_PUBLIC_KEY=true', () => {
    for (const h of [
      DiscussionController.prototype.listThreadsByQuestion,
      DiscussionController.prototype.getThread,
      DiscussionController.prototype.listPostsByThread,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, h), h.name).toBe(true);
    }
  });

  it('write 7종 (createThread/updateThread/deleteThread/createPost/updatePost/deletePost/castVote/acceptPost) 에 IS_PUBLIC_KEY 미적용', () => {
    for (const h of [
      DiscussionController.prototype.createThread,
      DiscussionController.prototype.updateThread,
      DiscussionController.prototype.deleteThread,
      DiscussionController.prototype.createPost,
      DiscussionController.prototype.updatePost,
      DiscussionController.prototype.deletePost,
      DiscussionController.prototype.castVote,
      DiscussionController.prototype.acceptPost,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, h), h.name).toBeUndefined();
    }
  });
});
