import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Repository } from 'typeorm';

import { DiscussionService, type ThreadCursor } from './discussion.service';
import { DiscussionThreadEntity } from './entities/discussion-thread.entity';

/**
 * PR-10b Phase 4a — DiscussionService Thread CRUD.
 *
 * ADR-020 §5.3 (API) / §5.4 (정책) / §4.2.1 C 절 (sanitize) 이행.
 *
 * 권장값 결정 (Phase 4 plan):
 *  - Q2=a composite cursor (createdAt, id)
 *  - Q3=a Service 응답에서 isDeleted=true 시 body "[삭제된 게시물]" 치환
 *  - Q5=a unit test only (vi.fn mock repo)
 *
 * sanitize 헬퍼는 Phase 3 (sanitize-post-body.ts) 의 `sanitizePostBody` /
 * `sanitizeTitle` 을 재사용.
 */

const NOW = new Date('2026-04-29T00:00:00Z');
const QUESTION_ID = '00000000-0000-4000-8000-0000000000a1';
const THREAD_ID = '00000000-0000-4000-8000-0000000000b1';
const USER_ID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000c2';

type MockRepo = {
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
};

function makeRepo(): MockRepo {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
}

function makeService(threadRepo: MockRepo) {
  return new DiscussionService(
    threadRepo as unknown as Repository<DiscussionThreadEntity>,
    { now: () => NOW },
  );
}

function makeThread(overrides: Partial<DiscussionThreadEntity> = {}): DiscussionThreadEntity {
  return {
    id: THREAD_ID,
    questionId: QUESTION_ID,
    authorId: USER_ID,
    title: 'Q: 트랜잭션 격리 수준',
    body: '<p>READ COMMITTED 가 기본인가요?</p>',
    score: 0,
    postCount: 0,
    lastActivityAt: NOW,
    isDeleted: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('DiscussionService — Thread CRUD (Phase 4a)', () => {
  let threadRepo: MockRepo;

  beforeEach(() => {
    threadRepo = makeRepo();
  });

  describe('createThread', () => {
    it('title/body 를 sanitize 한 뒤 INSERT (lastActivityAt=now, score=0, postCount=0)', async () => {
      threadRepo.insert.mockResolvedValue({
        identifiers: [{ id: THREAD_ID }],
        raw: [],
        generatedMaps: [],
      });
      const service = makeService(threadRepo);

      const out = await service.createThread(USER_ID, QUESTION_ID, {
        title: '트랜잭션',
        body: '<p>안녕</p>',
      });

      expect(threadRepo.insert).toHaveBeenCalledOnce();
      const inserted = threadRepo.insert.mock.calls[0]![0];
      expect(inserted).toMatchObject({
        questionId: QUESTION_ID,
        authorId: USER_ID,
        title: '트랜잭션',
        body: '<p>안녕</p>',
        score: 0,
        postCount: 0,
        lastActivityAt: NOW,
        isDeleted: false,
      });
      expect(out.id).toBe(THREAD_ID);
    });

    it('title 의 모든 HTML 태그 제거 (sanitizeTitle plain text only)', async () => {
      threadRepo.insert.mockResolvedValue({
        identifiers: [{ id: THREAD_ID }],
        raw: [],
        generatedMaps: [],
      });
      const service = makeService(threadRepo);

      await service.createThread(USER_ID, QUESTION_ID, {
        title: '제목 <script>alert(1)</script><strong>강조</strong>',
        body: '<p>x</p>',
      });

      const inserted = threadRepo.insert.mock.calls[0]![0];
      expect(inserted.title).toBe('제목 강조');
    });

    it('body 의 OWASP XSS payload 가 sanitize-html 화이트리스트로 차단된다', async () => {
      threadRepo.insert.mockResolvedValue({
        identifiers: [{ id: THREAD_ID }],
        raw: [],
        generatedMaps: [],
      });
      const service = makeService(threadRepo);

      await service.createThread(USER_ID, QUESTION_ID, {
        title: 't',
        body: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>',
      });

      const inserted = threadRepo.insert.mock.calls[0]![0];
      expect(inserted.body).toContain('<p>ok</p>');
      expect(inserted.body).not.toMatch(/<script|onerror|<img/i);
    });
  });

  describe('getThread', () => {
    it('존재하는 thread 반환', async () => {
      const t = makeThread();
      threadRepo.findOne.mockResolvedValue(t);
      const service = makeService(threadRepo);

      const out = await service.getThread(THREAD_ID);

      expect(threadRepo.findOne).toHaveBeenCalledWith({ where: { id: THREAD_ID } });
      expect(out).toEqual(t);
    });

    it('isDeleted=true 인 경우 body 가 "[삭제된 게시물]" 로 치환된다 (§5.4)', async () => {
      threadRepo.findOne.mockResolvedValue(
        makeThread({ isDeleted: true, body: '<p>원본 본문</p>' }),
      );
      const service = makeService(threadRepo);

      const out = await service.getThread(THREAD_ID);

      expect(out.body).toBe('[삭제된 게시물]');
      expect(out.isDeleted).toBe(true);
    });

    it('미존재 시 NotFoundException', async () => {
      threadRepo.findOne.mockResolvedValue(null);
      const service = makeService(threadRepo);

      await expect(service.getThread(THREAD_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listThreadsByQuestion', () => {
    it('default sort=new — createdAt DESC + isDeleted=false + take=20 (default limit)', async () => {
      threadRepo.find.mockResolvedValue([makeThread()]);
      const service = makeService(threadRepo);

      await service.listThreadsByQuestion(QUESTION_ID, {});

      expect(threadRepo.find).toHaveBeenCalledOnce();
      const args = threadRepo.find.mock.calls[0]![0];
      expect(args.where).toMatchObject({ questionId: QUESTION_ID, isDeleted: false });
      expect(args.order).toEqual({ createdAt: 'DESC', id: 'DESC' });
      expect(args.take).toBe(20);
    });

    it('limit > 50 은 50 으로 clamp (HIGH-6)', async () => {
      threadRepo.find.mockResolvedValue([]);
      const service = makeService(threadRepo);

      await service.listThreadsByQuestion(QUESTION_ID, { limit: 9999 });

      expect(threadRepo.find.mock.calls[0]![0].take).toBe(50);
    });

    it('composite cursor (createdAt, id) — createdAt < cursor.createdAt OR (등호 시 id <)', async () => {
      threadRepo.find.mockResolvedValue([]);
      const service = makeService(threadRepo);
      const cursor: ThreadCursor = { createdAt: NOW, id: THREAD_ID };

      await service.listThreadsByQuestion(QUESTION_ID, { cursor });

      const args = threadRepo.find.mock.calls[0]![0];
      // composite cursor 는 raw query 표현식이라 호출 인자에 cursor 가 포함되었는지만 검증
      expect(JSON.stringify(args.where)).toContain(THREAD_ID);
    });

    it('응답에 isDeleted=true 항목이 있어도 body 가 치환되어 반환된다', async () => {
      threadRepo.find.mockResolvedValue([
        makeThread({ id: 't1', isDeleted: false, body: '<p>살아있음</p>' }),
        makeThread({ id: 't2', isDeleted: true, body: '<p>지워짐</p>' }),
      ]);
      const service = makeService(threadRepo);

      const out = await service.listThreadsByQuestion(QUESTION_ID, {});

      expect(out).toHaveLength(2);
      expect(out[0]!.body).toBe('<p>살아있음</p>');
      expect(out[1]!.body).toBe('[삭제된 게시물]');
    });
  });

  describe('updateThread (IDOR)', () => {
    it('author 일치 → sanitize 후 UPDATE 호출', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread());
      threadRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      const service = makeService(threadRepo);

      await service.updateThread(USER_ID, THREAD_ID, {
        title: '<p>새 제목</p>',
        body: '<p>새 본문</p><script>x</script>',
      });

      expect(threadRepo.update).toHaveBeenCalledOnce();
      const [where, patch] = threadRepo.update.mock.calls[0]!;
      expect(where).toEqual({ id: THREAD_ID });
      expect(patch.title).toBe('새 제목'); // sanitizeTitle
      expect(patch.body).toBe('<p>새 본문</p>'); // sanitizePostBody
      expect(patch.body).not.toMatch(/<script/i);
    });

    it('author 불일치 → ForbiddenException (IDOR 방어, UPDATE 미호출)', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread({ authorId: OTHER_USER_ID }));
      const service = makeService(threadRepo);

      await expect(
        service.updateThread(USER_ID, THREAD_ID, { title: 't', body: 'b' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(threadRepo.update).not.toHaveBeenCalled();
    });

    it('thread 미존재 → NotFoundException', async () => {
      threadRepo.findOne.mockResolvedValue(null);
      const service = makeService(threadRepo);

      await expect(
        service.updateThread(USER_ID, THREAD_ID, { title: 't', body: 'b' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteThread (IDOR + soft delete)', () => {
    it('author 일치 → isDeleted=true UPDATE', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread());
      threadRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      const service = makeService(threadRepo);

      await service.deleteThread(USER_ID, THREAD_ID);

      const [where, patch] = threadRepo.update.mock.calls[0]!;
      expect(where).toEqual({ id: THREAD_ID });
      expect(patch.isDeleted).toBe(true);
    });

    it('author 불일치 → ForbiddenException (UPDATE 미호출)', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread({ authorId: OTHER_USER_ID }));
      const service = makeService(threadRepo);

      await expect(service.deleteThread(USER_ID, THREAD_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(threadRepo.update).not.toHaveBeenCalled();
    });
  });
});
