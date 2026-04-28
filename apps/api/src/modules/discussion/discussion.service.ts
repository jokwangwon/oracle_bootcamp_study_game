import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  IsNull,
  LessThan,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { DiscussionPostEntity } from './entities/discussion-post.entity';
import { DiscussionThreadEntity } from './entities/discussion-thread.entity';
import {
  DiscussionVoteEntity,
  type DiscussionVoteTarget,
  type DiscussionVoteValue,
} from './entities/discussion-vote.entity';
import { sanitizePostBody, sanitizeTitle } from './sanitize-post-body';

/**
 * PR-10b §5 — R4 토론 서비스 (Phase 4a: Thread CRUD).
 *
 * 명세:
 *  - §5.3 API endpoint 9종 (Phase 5 controller 가 호출)
 *  - §5.4 정책 — soft delete + body "[삭제된 게시물]" 치환 + cursor pagination + limit ≤ 50
 *  - §4.2.1 C 절 — sanitize-html 화이트리스트 (저장 직전 적용, defense in depth)
 *
 * Phase 분해:
 *  - Phase 4a: Thread CRUD + IDOR (본 파일 5 메서드)
 *  - Phase 4b: Post CRUD (createPost / listPosts / updatePost / deletePost)
 *  - Phase 4c: Vote / Accept (R6 UNIQUE + self-vote 트리거 활용 + 배타 accept)
 */

/** §5.4 cursor — composite (createdAt, id) 로 sort=new/hot/top 모두 안정. */
export type ThreadCursor = { createdAt: Date; id: string };

/** §5.4 soft delete body 치환 문자열. */
export const DELETED_BODY_PLACEHOLDER = '[삭제된 게시물]';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50; // §5.4 HIGH-6

export type CreateThreadDto = { title: string; body: string };
export type UpdateThreadDto = { title: string; body: string };
export type ListThreadsOpts = {
  sort?: 'new' | 'hot' | 'top';
  cursor?: ThreadCursor;
  limit?: number;
};

export type CreatePostDto = { body: string; parentId?: string | null };
export type UpdatePostDto = { body: string };
export type ListPostsOpts = { parentId?: string | null };

export type CastVoteDto = {
  targetType: DiscussionVoteTarget;
  targetId: string;
  value: -1 | 0 | 1;
};

/** PG SQLSTATE 23514 = check_violation. self-vote 트리거의 ERRCODE. */
const PG_CHECK_VIOLATION = '23514';

@Injectable()
export class DiscussionService {
  constructor(
    @InjectRepository(DiscussionThreadEntity)
    private readonly threadRepo: Repository<DiscussionThreadEntity>,
    @InjectRepository(DiscussionPostEntity)
    private readonly postRepo: Repository<DiscussionPostEntity>,
    @InjectRepository(DiscussionVoteEntity)
    private readonly voteRepo: Repository<DiscussionVoteEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly opts: { now?: () => Date } = {},
  ) {}

  private now(): Date {
    return this.opts.now ? this.opts.now() : new Date();
  }

  /** §5.4 — isDeleted=true 시 body 를 응답에서 치환 (DB 원본 보존). */
  private mask<T extends { body: string; isDeleted: boolean }>(entity: T): T {
    return entity.isDeleted ? { ...entity, body: DELETED_BODY_PLACEHOLDER } : entity;
  }

  async createThread(
    authorId: string,
    questionId: string,
    dto: CreateThreadDto,
  ): Promise<DiscussionThreadEntity> {
    const now = this.now();
    const draft: Partial<DiscussionThreadEntity> = {
      questionId,
      authorId,
      title: sanitizeTitle(dto.title),
      body: sanitizePostBody(dto.body),
      score: 0,
      postCount: 0,
      lastActivityAt: now,
      isDeleted: false,
    };
    const result = await this.threadRepo.insert(draft as DiscussionThreadEntity);
    const id = result.identifiers[0]?.id as string;
    return {
      ...(draft as DiscussionThreadEntity),
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getThread(threadId: string): Promise<DiscussionThreadEntity> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('thread_not_found');
    return this.mask(thread);
  }

  async listThreadsByQuestion(
    questionId: string,
    opts: ListThreadsOpts,
  ): Promise<DiscussionThreadEntity[]> {
    const take = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const base = { questionId, isDeleted: false } as const;
    const where = opts.cursor
      ? [
          { ...base, createdAt: LessThan(opts.cursor.createdAt) },
          { ...base, createdAt: opts.cursor.createdAt, id: LessThan(opts.cursor.id) },
        ]
      : base;
    // sort=hot/top 의 정확한 정렬식 (§5.4) 은 PR-12 (web 토론 페이지) 시점에 raw query
    // 로 도입. Phase 4a 는 sort=new (createdAt DESC) + composite cursor 안정화에 집중.
    const list = await this.threadRepo.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take,
    });
    return list.map((t) => this.mask(t));
  }

  async updateThread(
    authorId: string,
    threadId: string,
    dto: UpdateThreadDto,
  ): Promise<void> {
    const existing = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!existing) throw new NotFoundException('thread_not_found');
    if (existing.authorId !== authorId) throw new ForbiddenException('discussion_idor');
    await this.threadRepo.update(
      { id: threadId },
      {
        title: sanitizeTitle(dto.title),
        body: sanitizePostBody(dto.body),
      },
    );
  }

  async deleteThread(authorId: string, threadId: string): Promise<void> {
    const existing = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!existing) throw new NotFoundException('thread_not_found');
    if (existing.authorId !== authorId) throw new ForbiddenException('discussion_idor');
    await this.threadRepo.update({ id: threadId }, { isDeleted: true });
  }

  // ───────────────────────────── Post (Phase 4b) ─────────────────────────────

  async createPost(
    authorId: string,
    threadId: string,
    dto: CreatePostDto,
  ): Promise<DiscussionPostEntity> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('thread_not_found');

    const parentId = dto.parentId ?? null;
    if (parentId) {
      const parent = await this.postRepo.findOne({ where: { id: parentId } });
      if (!parent) throw new NotFoundException('parent_post_not_found');
      // §5.4 — 1-level nested only. parent.parentId 가 null 이어야 함.
      if (parent.parentId !== null) {
        throw new BadRequestException('nested_depth_exceeded');
      }
    }

    const now = this.now();
    const draft: Partial<DiscussionPostEntity> = {
      threadId,
      authorId,
      parentId,
      body: sanitizePostBody(dto.body),
      score: 0,
      isAccepted: false,
      isDeleted: false,
      relatedQuestionId: null,
    };
    const result = await this.postRepo.insert(draft as DiscussionPostEntity);
    const id = result.identifiers[0]?.id as string;

    // thread.postCount++ + lastActivityAt=now (cache)
    await this.threadRepo.update(
      { id: threadId },
      { postCount: thread.postCount + 1, lastActivityAt: now },
    );

    return {
      ...(draft as DiscussionPostEntity),
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async listPostsByThread(
    threadId: string,
    opts: ListPostsOpts = {},
  ): Promise<DiscussionPostEntity[]> {
    // parentId 미지정 → 직속 답변만 (parentId IS NULL).
    // parentId 명시 → 그 값으로 1-level 자식 조회.
    const parentClause =
      opts.parentId === undefined || opts.parentId === null
        ? IsNull()
        : opts.parentId;
    const list = await this.postRepo.find({
      where: { threadId, parentId: parentClause },
      order: { createdAt: 'ASC' },
    });
    return list.map((p) => this.mask(p));
  }

  async updatePost(
    authorId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<void> {
    const existing = await this.postRepo.findOne({ where: { id: postId } });
    if (!existing) throw new NotFoundException('post_not_found');
    if (existing.authorId !== authorId) throw new ForbiddenException('discussion_idor');
    await this.postRepo.update(
      { id: postId },
      { body: sanitizePostBody(dto.body) },
    );
  }

  async deletePost(authorId: string, postId: string): Promise<void> {
    const existing = await this.postRepo.findOne({ where: { id: postId } });
    if (!existing) throw new NotFoundException('post_not_found');
    if (existing.authorId !== authorId) throw new ForbiddenException('discussion_idor');
    await this.postRepo.update({ id: postId }, { isDeleted: true });
  }

  // ─────────────────────────── Vote / Accept (Phase 4c) ──────────────────────

  /**
   * §5.3 POST /api/discussion/vote — 동일 트랜잭션 안에서 vote UPSERT/DELETE +
   * target.score 원자 increment (Q1=a/Q8=a). value=0 이면 철회 (멱등 — Q7=a).
   *
   * self-vote 트리거(1714000012000) 위반 (ERRCODE=23514) → ForbiddenException
   * 변환 (Q4=a). 그 외 PG 에러는 그대로 전파.
   */
  async castVote(
    userId: string,
    dto: CastVoteDto,
  ): Promise<{ change: number }> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(DiscussionVoteEntity, {
        where: {
          userId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      });
      const oldValue = existing?.value ?? 0;
      const newValue = dto.value;

      // 동일 (또는 둘 다 0) → noop. value=0 + existing=null 케이스 포함.
      if (oldValue === newValue) return { change: 0 };

      const targetEntity =
        dto.targetType === 'thread' ? DiscussionThreadEntity : DiscussionPostEntity;
      const change = newValue - oldValue;

      try {
        if (newValue === 0) {
          await manager.delete(DiscussionVoteEntity, {
            userId,
            targetType: dto.targetType,
            targetId: dto.targetId,
          });
        } else if (existing) {
          await manager.update(
            DiscussionVoteEntity,
            {
              userId,
              targetType: dto.targetType,
              targetId: dto.targetId,
            },
            { value: newValue as DiscussionVoteValue },
          );
        } else {
          await manager.insert(DiscussionVoteEntity, {
            userId,
            targetType: dto.targetType,
            targetId: dto.targetId,
            value: newValue as DiscussionVoteValue,
          });
        }

        await manager.increment(
          targetEntity,
          { id: dto.targetId },
          'score',
          change,
        );
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string } | undefined)?.code ===
            PG_CHECK_VIOLATION
        ) {
          throw new ForbiddenException('self_vote_forbidden');
        }
        throw err;
      }

      return { change };
    });
  }

  /**
   * §5.3 POST /api/discussion/posts/:postId/accept — thread author only.
   *
   * Q6=a 1-accept rule: thread 안에 isAccepted=true 인 post 가 0 또는 1개. 새
   * accept 시 같은 thread 의 기존 accepted 모두 false 후 본 post true. 이미
   * accepted 인 post 재호출은 noop. unaccept 별도 endpoint 없음.
   */
  async acceptPost(userId: string, postId: string): Promise<void> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('post_not_found');

    const thread = await this.threadRepo.findOne({ where: { id: post.threadId } });
    if (!thread || thread.authorId !== userId) {
      throw new ForbiddenException('discussion_idor');
    }

    if (post.isAccepted) return; // 1-accept rule + 멱등.

    await this.dataSource.transaction(async (manager) => {
      // (1) 같은 thread 의 기존 accepted post 모두 unaccept.
      await manager.update(
        DiscussionPostEntity,
        { threadId: post.threadId, isAccepted: true },
        { isAccepted: false },
      );
      // (2) 본 post accept.
      await manager.update(
        DiscussionPostEntity,
        { id: postId },
        { isAccepted: true },
      );
    });
  }
}
