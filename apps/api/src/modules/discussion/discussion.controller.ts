import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  decodeCursor as decodeThreadCursor,
  encodeCursor as encodeThreadCursor,
  THREAD_SORTS,
  type ThreadCursor,
  type ThreadSort,
} from './cursor';
import { DiscussionService } from './discussion.service';
import type { DiscussionPostEntity } from './entities/discussion-post.entity';
import type { DiscussionThreadEntity } from './entities/discussion-thread.entity';
import type { DiscussionVoteTarget } from './entities/discussion-vote.entity';

/**
 * PR-10b Phase 5 — R4 토론 REST API.
 *
 * ADR-020 §5.3 endpoint 11종 (read 4 + write 7). 모두 JwtAuthGuard 보호.
 * write endpoint 는 ThrottlerGuard + 분당 5회 (discussion_write named).
 *
 * 컨벤션 (auth-throttler.test.ts 헤더 인용):
 *  - vitest+esbuild emitDecoratorMetadata 미지원 → 통합 e2e 는 별도 하네스에서.
 *  - 본 PR 은 handler 단위 unit test + Throttle 메타데이터 회귀 만 검증.
 */

const WRITE_TTL_MS = 60_000;
const WRITE_LIMIT = 5;
const DISCUSSION_THROTTLE_NAME = 'discussion_write';
const BODY_MAX = 20_000;
const TITLE_MAX = 200;

class CreateThreadBodyDto {
  @IsString() @MinLength(1) @MaxLength(TITLE_MAX) title!: string;
  @IsString() @MinLength(1) @MaxLength(BODY_MAX) body!: string;
}

class UpdateThreadBodyDto {
  @IsString() @MinLength(1) @MaxLength(TITLE_MAX) title!: string;
  @IsString() @MinLength(1) @MaxLength(BODY_MAX) body!: string;
}

class CreatePostBodyDto {
  @IsString() @MinLength(1) @MaxLength(BODY_MAX) body!: string;
  @IsOptional() @IsUUID() parentId?: string;
}

class UpdatePostBodyDto {
  @IsString() @MinLength(1) @MaxLength(BODY_MAX) body!: string;
}

class CastVoteBodyDto {
  @IsIn(['thread', 'post']) targetType!: DiscussionVoteTarget;
  @IsUUID() targetId!: string;
  @IsInt() @IsIn([-1, 0, 1]) value!: -1 | 0 | 1;
}

interface JwtUser {
  sub: string;
}

/**
 * PR-12 §5.1 — cursor sort 별 schema 분기는 `cursor.ts` 모듈에 위임.
 * 본 파일에는 controller 호환성을 위해 동일 이름 alias 만 export.
 */
export const encodeCursor = encodeThreadCursor;
export const decodeCursor = decodeThreadCursor;
export type { ThreadCursor };

function parseSort(raw: string | undefined): ThreadSort {
  const sort = (raw ?? 'new') as ThreadSort;
  if (!(THREAD_SORTS as ReadonlyArray<string>).includes(sort)) {
    throw new BadRequestException('invalid_sort');
  }
  return sort;
}

@Controller('discussion')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class DiscussionController {
  constructor(private readonly service: DiscussionService) {}

  // ───────────────────────────── Thread (read) ─────────────────────────────

  @Get('questions/:questionId/threads')
  async listThreadsByQuestion(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Query('sort') sortRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<DiscussionThreadEntity[]> {
    const sort = parseSort(sortRaw);
    const limitNum = limit ? Number.parseInt(limit, 10) : undefined;
    return this.service.listThreadsByQuestion(questionId, {
      sort,
      cursor: cursor ? decodeThreadCursor(cursor, sort) : undefined,
      limit: Number.isFinite(limitNum) ? limitNum : undefined,
    });
  }

  @Get('threads/:threadId')
  async getThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ): Promise<DiscussionThreadEntity> {
    return this.service.getThread(threadId);
  }

  // ───────────────────────────── Thread (write) ────────────────────────────

  @Post('questions/:questionId/threads')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  async createThread(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: CreateThreadBodyDto,
    @Req() req: Request,
  ): Promise<DiscussionThreadEntity> {
    const user = req.user as JwtUser;
    return this.service.createThread(user.sub, questionId, dto);
  }

  @Patch('threads/:threadId')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() dto: UpdateThreadBodyDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtUser;
    await this.service.updateThread(user.sub, threadId, dto);
  }

  @Delete('threads/:threadId')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtUser;
    await this.service.deleteThread(user.sub, threadId);
  }

  // ───────────────────────────── Post ──────────────────────────────────────

  @Get('threads/:threadId/posts')
  async listPostsByThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Query('parentId') parentId?: string,
  ): Promise<DiscussionPostEntity[]> {
    return this.service.listPostsByThread(threadId, { parentId });
  }

  @Post('threads/:threadId/posts')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  async createPost(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() dto: CreatePostBodyDto,
    @Req() req: Request,
  ): Promise<DiscussionPostEntity> {
    const user = req.user as JwtUser;
    return this.service.createPost(user.sub, threadId, dto);
  }

  @Patch('posts/:postId')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: UpdatePostBodyDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtUser;
    await this.service.updatePost(user.sub, postId, dto);
  }

  @Delete('posts/:postId')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtUser;
    await this.service.deletePost(user.sub, postId);
  }

  // ───────────────────────────── Vote / Accept ─────────────────────────────

  @Post('vote')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  async castVote(
    @Body() dto: CastVoteBodyDto,
    @Req() req: Request,
  ): Promise<{ change: number }> {
    const user = req.user as JwtUser;
    return this.service.castVote(user.sub, dto);
  }

  @Post('posts/:postId/accept')
  @Throttle({ [DISCUSSION_THROTTLE_NAME]: { ttl: WRITE_TTL_MS, limit: WRITE_LIMIT } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtUser;
    await this.service.acceptPost(user.sub, postId);
  }
}
