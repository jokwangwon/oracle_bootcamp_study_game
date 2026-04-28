import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IsNull, type DataSource, type EntityManager, type Repository } from 'typeorm';

import { DiscussionService, type ThreadCursor } from './discussion.service';
import { DiscussionPostEntity } from './entities/discussion-post.entity';
import { DiscussionThreadEntity } from './entities/discussion-thread.entity';
import { DiscussionVoteEntity } from './entities/discussion-vote.entity';

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
const POST_ID = '00000000-0000-4000-8000-0000000000d1';
const PARENT_POST_ID = '00000000-0000-4000-8000-0000000000d2';
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

type MockManager = {
  findOne: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  increment: ReturnType<typeof vi.fn>;
};

function makeManager(overrides: Partial<MockManager> = {}): MockManager {
  return {
    findOne: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    increment: vi.fn(),
    ...overrides,
  };
}

function makeDataSource(manager: MockManager) {
  return {
    transaction: vi.fn(async (cb: (m: EntityManager) => unknown) => {
      return cb(manager as unknown as EntityManager);
    }),
  } as unknown as DataSource;
}

function makeService(
  threadRepo: MockRepo,
  postRepo: MockRepo = makeRepo(),
  voteRepo: MockRepo = makeRepo(),
  ds: DataSource = makeDataSource(makeManager()),
) {
  return new DiscussionService(
    threadRepo as unknown as Repository<DiscussionThreadEntity>,
    postRepo as unknown as Repository<DiscussionPostEntity>,
    voteRepo as unknown as Repository<DiscussionVoteEntity>,
    ds,
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

function makePost(overrides: Partial<DiscussionPostEntity> = {}): DiscussionPostEntity {
  return {
    id: POST_ID,
    threadId: THREAD_ID,
    authorId: USER_ID,
    parentId: null,
    body: '<p>답변 본문</p>',
    score: 0,
    isAccepted: false,
    isDeleted: false,
    relatedQuestionId: null,
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

describe('DiscussionService — castVote (Phase 4c)', () => {
  let threadRepo: MockRepo;
  let postRepo: MockRepo;
  let voteRepo: MockRepo;
  let manager: MockManager;
  let ds: DataSource;

  beforeEach(() => {
    threadRepo = makeRepo();
    postRepo = makeRepo();
    voteRepo = makeRepo();
    manager = makeManager();
    ds = makeDataSource(manager);
  });

  describe('UPSERT + atomic score increment (Q1=a / Q8=a)', () => {
    it('value=+1, existing=null → INSERT vote + increment(+1)', async () => {
      manager.findOne.mockResolvedValue(null);
      manager.insert.mockResolvedValue({ identifiers: [{}], raw: [], generatedMaps: [] });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: 1,
      });

      expect(manager.insert).toHaveBeenCalledOnce();
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.increment).toHaveBeenCalledOnce();
      const incArgs = manager.increment.mock.calls[0]!;
      expect(incArgs[0]).toBe(DiscussionPostEntity); // target=post
      expect(incArgs[1]).toEqual({ id: POST_ID });
      expect(incArgs[2]).toBe('score');
      expect(incArgs[3]).toBe(1);
      expect(out.change).toBe(1);
    });

    it('value=-1, existing=null → INSERT vote + increment(-1)', async () => {
      manager.findOne.mockResolvedValue(null);
      manager.insert.mockResolvedValue({ identifiers: [{}], raw: [], generatedMaps: [] });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: -1,
      });

      expect(manager.insert).toHaveBeenCalledOnce();
      expect(manager.increment.mock.calls[0]![3]).toBe(-1);
      expect(out.change).toBe(-1);
    });

    it('value=+1, existing=+1 (동일) → noop (insert/update/delete/increment 모두 미호출)', async () => {
      manager.findOne.mockResolvedValue({
        userId: USER_ID,
        targetType: 'post',
        targetId: POST_ID,
        value: 1,
      });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: 1,
      });

      expect(manager.insert).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.increment).not.toHaveBeenCalled();
      expect(out.change).toBe(0);
    });

    it('value=+1, existing=-1 (toggle) → UPDATE + increment(+2)', async () => {
      manager.findOne.mockResolvedValue({
        userId: USER_ID,
        targetType: 'post',
        targetId: POST_ID,
        value: -1,
      });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: 1,
      });

      expect(manager.update).toHaveBeenCalledOnce();
      expect(manager.insert).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.increment.mock.calls[0]![3]).toBe(2);
      expect(out.change).toBe(2);
    });

    it('value=-1, existing=+1 (toggle) → UPDATE + increment(-2)', async () => {
      manager.findOne.mockResolvedValue({
        userId: USER_ID,
        targetType: 'post',
        targetId: POST_ID,
        value: 1,
      });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: -1,
      });

      expect(manager.update).toHaveBeenCalledOnce();
      expect(manager.increment.mock.calls[0]![3]).toBe(-2);
      expect(out.change).toBe(-2);
    });

    it('value=0, existing=+1 → DELETE + increment(-1)', async () => {
      manager.findOne.mockResolvedValue({
        userId: USER_ID,
        targetType: 'post',
        targetId: POST_ID,
        value: 1,
      });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: 0,
      });

      expect(manager.delete).toHaveBeenCalledOnce();
      expect(manager.insert).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.increment.mock.calls[0]![3]).toBe(-1);
      expect(out.change).toBe(-1);
    });

    it('value=0, existing=null → noop (Q7=a 멱등 철회)', async () => {
      manager.findOne.mockResolvedValue(null);
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      const out = await service.castVote(USER_ID, {
        targetType: 'post',
        targetId: POST_ID,
        value: 0,
      });

      expect(manager.insert).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.increment).not.toHaveBeenCalled();
      expect(out.change).toBe(0);
    });

    it('targetType=thread → increment 가 DiscussionThreadEntity 대상으로 호출', async () => {
      manager.findOne.mockResolvedValue(null);
      manager.insert.mockResolvedValue({ identifiers: [{}], raw: [], generatedMaps: [] });
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      await service.castVote(USER_ID, {
        targetType: 'thread',
        targetId: THREAD_ID,
        value: 1,
      });

      const incArgs = manager.increment.mock.calls[0]!;
      expect(incArgs[0]).toBe(DiscussionThreadEntity);
      expect(incArgs[1]).toEqual({ id: THREAD_ID });
    });
  });

  describe('self-vote 트리거 매핑 (Q4=a)', () => {
    it('PG QueryFailedError code=23514 (check_violation) → ForbiddenException', async () => {
      manager.findOne.mockResolvedValue(null);
      const pgError = new QueryFailedError(
        'INSERT INTO discussion_votes',
        [],
        Object.assign(new Error('self-vote prohibited'), { code: '23514' }),
      );
      manager.insert.mockRejectedValue(pgError);
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      await expect(
        service.castVote(USER_ID, { targetType: 'post', targetId: POST_ID, value: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('다른 PG 에러 (code !== 23514) 는 그대로 전파 (오진 방지)', async () => {
      manager.findOne.mockResolvedValue(null);
      const pgError = new QueryFailedError(
        'INSERT INTO discussion_votes',
        [],
        Object.assign(new Error('connection lost'), { code: '08006' }),
      );
      manager.insert.mockRejectedValue(pgError);
      const service = makeService(threadRepo, postRepo, voteRepo, ds);

      await expect(
        service.castVote(USER_ID, { targetType: 'post', targetId: POST_ID, value: 1 }),
      ).rejects.toBeInstanceOf(QueryFailedError);
    });
  });
});

describe('DiscussionService — acceptPost (Phase 4c, Q6=a 1-accept rule)', () => {
  let threadRepo: MockRepo;
  let postRepo: MockRepo;
  let voteRepo: MockRepo;
  let manager: MockManager;
  let ds: DataSource;

  beforeEach(() => {
    threadRepo = makeRepo();
    postRepo = makeRepo();
    voteRepo = makeRepo();
    manager = makeManager();
    ds = makeDataSource(manager);
  });

  it('post 미존재 → NotFoundException', async () => {
    postRepo.findOne.mockResolvedValue(null);
    const service = makeService(threadRepo, postRepo, voteRepo, ds);

    await expect(service.acceptPost(USER_ID, POST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('thread author 불일치 → ForbiddenException (UPDATE 미호출)', async () => {
    postRepo.findOne.mockResolvedValue(makePost());
    threadRepo.findOne.mockResolvedValue(makeThread({ authorId: OTHER_USER_ID }));
    const service = makeService(threadRepo, postRepo, voteRepo, ds);

    await expect(service.acceptPost(USER_ID, POST_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('thread author 일치 → 같은 thread 내 다른 accepted 모두 false + 본 post true (트랜잭션)', async () => {
    postRepo.findOne.mockResolvedValue(makePost({ isAccepted: false }));
    threadRepo.findOne.mockResolvedValue(makeThread()); // authorId=USER_ID
    manager.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
    const service = makeService(threadRepo, postRepo, voteRepo, ds);

    await service.acceptPost(USER_ID, POST_ID);

    // 트랜잭션 내부 update 호출 2회 — (1) 같은 thread 내 다른 post unaccept, (2) 본 post accept
    expect(manager.update).toHaveBeenCalledTimes(2);
    const calls = manager.update.mock.calls;
    // 첫 호출: 같은 thread + isAccepted=true 인 다른 post 만 false 로
    expect(calls[0]![0]).toBe(DiscussionPostEntity);
    expect(calls[0]![1]).toMatchObject({ threadId: THREAD_ID });
    expect(calls[0]![2]).toEqual({ isAccepted: false });
    // 두번째 호출: 본 post 만 isAccepted=true
    expect(calls[1]![0]).toBe(DiscussionPostEntity);
    expect(calls[1]![1]).toEqual({ id: POST_ID });
    expect(calls[1]![2]).toEqual({ isAccepted: true });
  });

  it('이미 isAccepted=true 인 post 재호출 → noop (Q6=a 1-accept rule)', async () => {
    postRepo.findOne.mockResolvedValue(makePost({ isAccepted: true }));
    threadRepo.findOne.mockResolvedValue(makeThread());
    const service = makeService(threadRepo, postRepo, voteRepo, ds);

    await service.acceptPost(USER_ID, POST_ID);

    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('DiscussionService — Post CRUD (Phase 4b)', () => {
  let threadRepo: MockRepo;
  let postRepo: MockRepo;

  beforeEach(() => {
    threadRepo = makeRepo();
    postRepo = makeRepo();
  });

  describe('createPost', () => {
    it('thread 미존재 → NotFoundException (post insert 미호출)', async () => {
      threadRepo.findOne.mockResolvedValue(null);
      const service = makeService(threadRepo, postRepo);

      await expect(
        service.createPost(USER_ID, THREAD_ID, { body: '<p>답변</p>' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(postRepo.insert).not.toHaveBeenCalled();
    });

    it('parentId 지정 + parent 미존재 → NotFoundException', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread());
      postRepo.findOne.mockResolvedValue(null);
      const service = makeService(threadRepo, postRepo);

      await expect(
        service.createPost(USER_ID, THREAD_ID, {
          body: '<p>대댓글</p>',
          parentId: PARENT_POST_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(postRepo.insert).not.toHaveBeenCalled();
    });

    it('parentId 지정 + parent.parentId !== null (2-level 시도) → BadRequestException', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread());
      postRepo.findOne.mockResolvedValue(
        makePost({ id: PARENT_POST_ID, parentId: 'some-other-post' }),
      );
      const service = makeService(threadRepo, postRepo);

      await expect(
        service.createPost(USER_ID, THREAD_ID, {
          body: '<p>3-level 시도</p>',
          parentId: PARENT_POST_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(postRepo.insert).not.toHaveBeenCalled();
    });

    it('정상 INSERT — sanitize body + thread.postCount++ + lastActivityAt=now', async () => {
      threadRepo.findOne.mockResolvedValue(makeThread({ postCount: 4 }));
      postRepo.insert.mockResolvedValue({
        identifiers: [{ id: POST_ID }],
        raw: [],
        generatedMaps: [],
      });
      threadRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      const service = makeService(threadRepo, postRepo);

      const out = await service.createPost(USER_ID, THREAD_ID, {
        body: '<p>ok</p><script>alert(1)</script>',
      });

      // post insert
      expect(postRepo.insert).toHaveBeenCalledOnce();
      const inserted = postRepo.insert.mock.calls[0]![0];
      expect(inserted).toMatchObject({
        threadId: THREAD_ID,
        authorId: USER_ID,
        parentId: null,
        score: 0,
        isAccepted: false,
        isDeleted: false,
      });
      expect(inserted.body).toBe('<p>ok</p>');
      expect(inserted.body).not.toMatch(/<script/i);

      // thread postCount + lastActivityAt 갱신
      expect(threadRepo.update).toHaveBeenCalledOnce();
      const [where, patch] = threadRepo.update.mock.calls[0]!;
      expect(where).toEqual({ id: THREAD_ID });
      expect(patch.postCount).toBe(5);
      expect(patch.lastActivityAt).toEqual(NOW);

      expect(out.id).toBe(POST_ID);
    });
  });

  describe('listPostsByThread', () => {
    it('parentId undefined → 직속 답변만 (parentId IsNull) + createdAt ASC', async () => {
      postRepo.find.mockResolvedValue([makePost()]);
      const service = makeService(threadRepo, postRepo);

      await service.listPostsByThread(THREAD_ID, {});

      const args = postRepo.find.mock.calls[0]![0];
      expect(args.where.threadId).toBe(THREAD_ID);
      expect(args.where.parentId).toEqual(IsNull()); // typeorm FindOperator
      expect(args.order).toEqual({ createdAt: 'ASC' });
    });

    it('parentId 지정 → 그 값으로 필터 (1-level children)', async () => {
      postRepo.find.mockResolvedValue([]);
      const service = makeService(threadRepo, postRepo);

      await service.listPostsByThread(THREAD_ID, { parentId: PARENT_POST_ID });

      const args = postRepo.find.mock.calls[0]![0];
      expect(args.where).toMatchObject({
        threadId: THREAD_ID,
        parentId: PARENT_POST_ID,
      });
    });

    it('isDeleted=true 인 post 의 body 가 "[삭제된 게시물]" 로 치환된다', async () => {
      postRepo.find.mockResolvedValue([
        makePost({ id: 'p1', body: '<p>살아있음</p>' }),
        makePost({ id: 'p2', isDeleted: true, body: '<p>지워짐</p>' }),
      ]);
      const service = makeService(threadRepo, postRepo);

      const out = await service.listPostsByThread(THREAD_ID, {});

      expect(out[0]!.body).toBe('<p>살아있음</p>');
      expect(out[1]!.body).toBe('[삭제된 게시물]');
    });
  });

  describe('updatePost (IDOR)', () => {
    it('author 일치 → sanitize 후 UPDATE', async () => {
      postRepo.findOne.mockResolvedValue(makePost());
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      const service = makeService(threadRepo, postRepo);

      await service.updatePost(USER_ID, POST_ID, {
        body: '<p>수정</p><img src=x onerror=alert(1)>',
      });

      expect(postRepo.update).toHaveBeenCalledOnce();
      const [where, patch] = postRepo.update.mock.calls[0]!;
      expect(where).toEqual({ id: POST_ID });
      expect(patch.body).toBe('<p>수정</p>');
      expect(patch.body).not.toMatch(/onerror|<img/i);
    });

    it('author 불일치 → ForbiddenException (UPDATE 미호출)', async () => {
      postRepo.findOne.mockResolvedValue(makePost({ authorId: OTHER_USER_ID }));
      const service = makeService(threadRepo, postRepo);

      await expect(
        service.updatePost(USER_ID, POST_ID, { body: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(postRepo.update).not.toHaveBeenCalled();
    });

    it('post 미존재 → NotFoundException', async () => {
      postRepo.findOne.mockResolvedValue(null);
      const service = makeService(threadRepo, postRepo);

      await expect(
        service.updatePost(USER_ID, POST_ID, { body: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deletePost (IDOR + soft delete)', () => {
    it('author 일치 → isDeleted=true UPDATE', async () => {
      postRepo.findOne.mockResolvedValue(makePost());
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      const service = makeService(threadRepo, postRepo);

      await service.deletePost(USER_ID, POST_ID);

      const [where, patch] = postRepo.update.mock.calls[0]!;
      expect(where).toEqual({ id: POST_ID });
      expect(patch.isDeleted).toBe(true);
    });

    it('author 불일치 → ForbiddenException', async () => {
      postRepo.findOne.mockResolvedValue(makePost({ authorId: OTHER_USER_ID }));
      const service = makeService(threadRepo, postRepo);

      await expect(service.deletePost(USER_ID, POST_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(postRepo.update).not.toHaveBeenCalled();
    });
  });
});
