/**
 * PR-12 §5.4 — Discussion DTO types (web).
 *
 * 서버 (apps/api/src/modules/discussion/) 응답 schema 와 1:1 매칭.
 * `myVote` 는 인증 사용자만 (서버 LEFT JOIN 결과, 비투표 시 0 또는 미포함).
 * `isLocked` 는 HIGH-3 블러 결과 (서버 마스킹 후 isLocked: true + body=[[BLUR:related-question]]).
 */

export type SortMode = 'new' | 'hot' | 'top';

export interface ThreadDto {
  id: string;
  questionId: string;
  authorId: string;
  title: string;
  body: string;
  score: number;
  postCount: number;
  lastActivityAt: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  myVote?: -1 | 0 | 1;
  isLocked?: boolean;
}

export interface PostDto {
  id: string;
  threadId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  score: number;
  isAccepted: boolean;
  isDeleted: boolean;
  relatedQuestionId: string | null;
  isLocked?: boolean;
  myVote?: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface VoteResponseDto {
  finalScore: number;
  myVote: -1 | 0 | 1;
}

export type ThreadCursorNew = { c: string; i: string };
export type ThreadCursorTop = { s: number; i: string };
export type ThreadCursorHot = { h: number; i: string };
export type ThreadCursor = ThreadCursorNew | ThreadCursorTop | ThreadCursorHot;

export interface ListThreadsResponse {
  items: ThreadDto[];
  nextCursor: string | null;
}

export interface ListPostsResponse {
  items: PostDto[];
  nextCursor: string | null;
}

export const BLUR_TOKEN = '[[BLUR:related-question]]';
