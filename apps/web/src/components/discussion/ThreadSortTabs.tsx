'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SortMode } from '@/lib/discussion/types';

interface ThreadSortTabsProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
}

/**
 * PR-12 §6.1.3 — new / hot / top 정렬 토글.
 * URL ?sort=hot 동기화는 부모 컴포넌트에서 처리.
 */
export function ThreadSortTabs({ value, onChange }: ThreadSortTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as SortMode)}>
      <TabsList aria-label="토론 정렬" data-testid="thread-sort-tabs">
        <TabsTrigger value="new">최신</TabsTrigger>
        <TabsTrigger value="hot">인기</TabsTrigger>
        <TabsTrigger value="top">추천순</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
