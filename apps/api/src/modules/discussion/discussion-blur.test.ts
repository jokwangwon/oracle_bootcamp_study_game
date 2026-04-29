import { describe, expect, it } from 'vitest';

import { BLUR_PLACEHOLDER, applyBlurPolicy } from './discussion-blur';

/**
 * PR-12 §6 — HIGH-3 related_question_id 블러 (CRITICAL C-3, Q-R5-03=a).
 *
 * 정책 우선순위:
 *  1) isDeleted=true → 본문 그대로 (mask 가 별도 처리)
 *  2) relatedQuestionId=null → 매핑 없음, 공개
 *  3) userId=null → 비인증 read = 공개 (Q-R5-11=a 학습 동기)
 *  4) authorId === userId → author 본인 = 항상 공개
 *  5) isUnlocked=true (user_progress 매칭) → 공개
 *  6) 위 모두 미해당 → body 마스킹 + isLocked:true
 */

const POST_ID = '00000000-0000-4000-8000-0000000000d1';
const RELATED_Q = '00000000-0000-4000-8000-0000000000e1';
const USER_A = '00000000-0000-4000-8000-0000000000c1';
const USER_B = '00000000-0000-4000-8000-0000000000c2';

function makePost(overrides: {
  isDeleted?: boolean;
  authorId?: string;
  relatedQuestionId?: string | null;
  body?: string;
} = {}) {
  return {
    isDeleted: false,
    authorId: USER_A,
    relatedQuestionId: RELATED_Q,
    body: '<p>본문</p>',
    ...overrides,
  };
}

describe('applyBlurPolicy — HIGH-3 마스킹 (Phase 3b)', () => {
  it('3.5 미풀이 user (다른 user_id, isUnlocked=false) → body 마스킹 + isLocked:true', () => {
    const out = applyBlurPolicy({
      post: makePost(),
      userId: USER_B,
      isUnlocked: false,
    });
    expect(out.body).toBe(BLUR_PLACEHOLDER);
    expect(out.isLocked).toBe(true);
  });

  it('3.6 풀이한 user (isUnlocked=true) → 본문 그대로', () => {
    const out = applyBlurPolicy({
      post: makePost(),
      userId: USER_B,
      isUnlocked: true,
    });
    expect(out.body).toBe('<p>본문</p>');
    expect(out.isLocked).toBe(false);
  });

  it('3.7 author 본인 → 항상 unmasked (isUnlocked 무관)', () => {
    const out = applyBlurPolicy({
      post: makePost({ authorId: USER_A }),
      userId: USER_A,
      isUnlocked: false,
    });
    expect(out.body).toBe('<p>본문</p>');
    expect(out.isLocked).toBe(false);
  });

  it('3.8 비인증 read (userId=null) → 모든 본문 공개 (Q-R5-11=a)', () => {
    const out = applyBlurPolicy({
      post: makePost(),
      userId: null,
      isUnlocked: false,
    });
    expect(out.body).toBe('<p>본문</p>');
    expect(out.isLocked).toBe(false);
  });

  it('3.9 relatedQuestionId=null → 매핑 없음, 공개', () => {
    const out = applyBlurPolicy({
      post: makePost({ relatedQuestionId: null }),
      userId: USER_B,
      isUnlocked: false,
    });
    expect(out.body).toBe('<p>본문</p>');
    expect(out.isLocked).toBe(false);
  });

  it('isDeleted=true 항목은 mask 가 우선 처리 → 본 helper 는 그대로 통과', () => {
    const out = applyBlurPolicy({
      post: makePost({ isDeleted: true, body: '[삭제된 게시물]' }),
      userId: USER_B,
      isUnlocked: false,
    });
    expect(out.body).toBe('[삭제된 게시물]');
    expect(out.isLocked).toBe(false);
  });
});
