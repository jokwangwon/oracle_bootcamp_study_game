/**
 * PR-12 §6.1.5 — Soft-deleted post/thread 자리표시.
 * 본문은 서버에서 이미 mask 처리되어 빈 문자열이거나 [[BLUR:...]] 토큰.
 */
export function DeletedPlaceholder({ kind }: { kind: 'thread' | 'post' }) {
  return (
    <p
      className="text-sm italic text-muted-foreground"
      data-testid={`deleted-${kind}`}
    >
      [삭제된 {kind === 'thread' ? '토론' : '게시물'}]
    </p>
  );
}
