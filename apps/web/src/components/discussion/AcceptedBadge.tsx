/**
 * PR-12 §6.1.1 — Accepted post 배지.
 * 시안 D 골드 톤 (concept-d §5.4 — accent token).
 */
export function AcceptedBadge({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="채택된 답변"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 ${className ?? ''}`}
    >
      <span aria-hidden="true">✓</span>
      채택됨
    </span>
  );
}
