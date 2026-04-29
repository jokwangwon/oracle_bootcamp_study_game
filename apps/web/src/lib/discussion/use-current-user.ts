'use client';

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';

/**
 * PR-12 — 토론 페이지에서 self-vote 차단 / accept 권한 분기 등에 사용하는
 * 현재 사용자 id 를 mount 1회만 fetch.
 *
 * me() 401 은 게스트 정상 흐름 — null 반환. api-client.ts 의 skipRetry 로
 * 자동 refresh retry 안 함 (무한 루프 방어).
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient.auth
      .me()
      .then((me) => {
        if (!cancelled) setUserId(me.id);
      })
      .catch(() => {
        if (!cancelled) setUserId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return userId;
}
