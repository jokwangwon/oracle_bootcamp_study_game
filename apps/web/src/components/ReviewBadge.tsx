'use client';

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';

/**
 * ADR-019 §5.2 PR-5 — 세션 헤더 "오늘 복습 N" 뱃지.
 *
 * 소비 API: `GET /games/solo/review-queue` (백엔드 PR #21, PR-4).
 *
 * UX 정책:
 *  - 로딩 중 / 에러 시 **조용히 숨김** — SR 조회 실패가 솔로 플레이 시작을 막지 않는다.
 *  - `dueCount === 0` 도 표시 — SR 이 활성임을 학습자에게 가시화 (사용자 D1=d 정신).
 *  - `dueCount > 0` 은 강조 스타일 (accent 배경) 로 행동 유인.
 *
 * 접근성: `aria-label` 로 스크린리더에게 의미 제공.
 */
interface Props {
  token: string;
}

export function ReviewBadge({ token }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.solo
      .reviewQueue(token)
      .then((r) => {
        if (!cancelled) setCount(r.dueCount);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // 로딩 중 / 에러 시 조용히 숨김 (게임 시작 흐름 방해 금지)
  if (failed || count === null) return null;

  const emphasized = count > 0;
  return (
    <div
      aria-label={`오늘 복습 ${count}문제`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.45rem 0.85rem',
        background: emphasized ? 'var(--accent)' : 'var(--bg-elevated)',
        color: emphasized ? 'var(--accent-fg)' : 'var(--fg-muted)',
        border: emphasized ? 'none' : '1px solid var(--border)',
        borderRadius: 6,
        fontSize: '0.85rem',
        fontWeight: 500,
      }}
    >
      <span aria-hidden="true">📖</span>
      <span>오늘 복습</span>
      <span style={{ fontWeight: 700 }}>{count}</span>
      <span>문제</span>
    </div>
  );
}
