'use client';

import type { SortMode } from '@/lib/discussion/types';

interface ThreadSortTabsProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
}

const OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'new', label: '최신' },
  { value: 'hot', label: '인기' },
  { value: 'top', label: '추천순' },
];

/**
 * PR-12 §6.1.3 — new / hot / top 정렬 토글.
 *
 * Radix Tabs 가 아닌 raw role=tablist + 버튼 그룹. 이유: Radix Tabs 는 TabsContent
 * 를 동반해야 aria-controls 가 유효한 ID 를 참조하고, 본 컴포넌트는 외부에서
 * 데이터를 mutate 하기만 함 (TabsContent 미사용). axe-core
 * "aria-valid-attr-value" 위반 회피 + 키보드 ←→ 이동만 수동 구현.
 */
export function ThreadSortTabs({ value, onChange }: ThreadSortTabsProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const idx = OPTIONS.findIndex((o) => o.value === value);
    if (idx === -1) return;
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % OPTIONS.length
        : (idx - 1 + OPTIONS.length) % OPTIONS.length;
    const nextOpt = OPTIONS[nextIdx];
    if (nextOpt) onChange(nextOpt.value);
  };

  return (
    <div
      role="tablist"
      aria-label="토론 정렬"
      onKeyDown={handleKey}
      data-testid="thread-sort-tabs"
      className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? 'bg-background text-foreground shadow' : ''
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
