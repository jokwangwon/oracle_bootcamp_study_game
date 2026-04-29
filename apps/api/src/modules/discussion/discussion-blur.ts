/**
 * PR-12 §6 — HIGH-3 related_question_id 블러 정책 (Q-R5-03=a, Q-R5-12=a).
 *
 * post 의 related_question 이 미풀이인 사용자에게 body 를 placeholder 로 치환하고
 * isLocked:true 플래그. 클라 RelatedQuestionBlur 컴포넌트가 시각 블러 + 풀이 CTA
 * 를 추가 (defense in depth).
 *
 * 정책 우선순위 (5단계):
 *  1) isDeleted=true        → mask 가 우선 처리 (본 helper 는 그대로 통과)
 *  2) relatedQuestionId=null → 매핑 없음, 공개
 *  3) userId=null            → 비인증 read = 공개 (Q-R5-11=a, 학습 동기)
 *  4) authorId === userId    → author 본인 = 항상 공개
 *  5) isUnlocked=true        → user_progress 매칭, 공개
 *  → 위 모두 미해당: body 마스킹 + isLocked:true
 */

export const BLUR_PLACEHOLDER = '[[BLUR:related-question]]';

export type BlurPostInput = {
  isDeleted: boolean;
  authorId: string;
  relatedQuestionId: string | null;
  body: string;
};

export type BlurInput = {
  post: BlurPostInput;
  userId: string | null;
  isUnlocked: boolean;
};

export type BlurResult = {
  body: string;
  isLocked: boolean;
};

export function applyBlurPolicy(input: BlurInput): BlurResult {
  const { post, userId, isUnlocked } = input;
  if (post.isDeleted) return { body: post.body, isLocked: false };
  if (!post.relatedQuestionId) return { body: post.body, isLocked: false };
  if (!userId) return { body: post.body, isLocked: false };
  if (post.authorId === userId) return { body: post.body, isLocked: false };
  if (isUnlocked) return { body: post.body, isLocked: false };
  return { body: BLUR_PLACEHOLDER, isLocked: true };
}
