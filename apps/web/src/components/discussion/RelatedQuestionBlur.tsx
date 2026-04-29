'use client';

import Link from 'next/link';

/**
 * PR-12 §6.4 — HIGH-3 클라 블러 (2차 방어).
 *
 * 서버는 `body=[[BLUR:related-question]]` + isLocked:true 로 응답. 클라는 본문 자리에
 * 글라스 패널 + "문제 풀러 가기" 링크를 표시.
 *
 * 시안 D 글라스 톤 (concept-d §5.4) + blur(8px) + role=region (a11y).
 */
export function RelatedQuestionBlur({
  relatedQuestionId,
}: {
  relatedQuestionId: string;
}) {
  return (
    <div
      role="region"
      aria-label="관련 문제 풀이 후 공개"
      className="related-question-blur glass-panel relative overflow-hidden rounded-lg border border-border/40 bg-card/30 p-4 backdrop-blur-md"
      data-testid="related-question-blur"
    >
      <div
        aria-hidden="true"
        className="select-none pointer-events-none opacity-30 [filter:blur(8px)]"
      >
        ████ ████████ ████ █████ ███████ █████ ███
        <br />
        █████ ████ ███████████ ████ ██ █████
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm">
        <p className="text-sm font-medium">🔒 관련 문제 풀이 후 공개됩니다</p>
        <Link
          href={`/play/solo/${relatedQuestionId}`}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          문제 풀러 가기 →
        </Link>
      </div>
    </div>
  );
}
