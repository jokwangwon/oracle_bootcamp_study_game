/**
 * 메인 페이지 ViewModel 진입점 — 시안 D (PR-8b).
 *
 * **현재 (PR-8b PR-1) 한계**: 본 프로젝트의 인증은 localStorage 기반(`auth-storage.ts`)
 * 이라 RSC 에서 토큰을 직접 볼 수 없다. ADR-020 PR-10 (httpOnly 쿠키) 이후에야
 * 진짜 RSC 데이터 로딩이 가능. 그 전까지는 client 측 헬퍼로 mock 을 분기한다.
 *
 * concept-d §4.1 의 "ViewModel 빌더 단계에서 인증 분기" 의도는 유지하되,
 * 호출 위치가 RSC 가 아니라 client component 라는 점만 다르다. PR-10 머지 시
 * 본 모듈을 server-only 로 옮기고 cookie 기반으로 재배선.
 */

import { hasToken } from '@/lib/auth-storage';

import { authedMock, guestMock } from './mock';
import type { HomeViewModel } from './types';

export function getHomeViewModelClient(): HomeViewModel {
  if (typeof window === 'undefined') {
    return guestMock;
  }
  return hasToken() ? authedMock : guestMock;
}
