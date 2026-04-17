/**
 * 클라이언트 사이드 토큰 저장소.
 *
 * 임시로 localStorage를 사용 (MVP 1단계). 향후 httpOnly 쿠키 + refresh
 * token 흐름으로 교체 예정 (SDD §7.1 `/api/auth/refresh`).
 *
 * SSR 환경에서 호출되어도 안전하도록 모든 함수가 typeof window 가드를
 * 둔다. 서버 렌더링 시점에는 토큰이 없는 것으로 간주.
 */

const TOKEN_KEY = 'oracle-game.accessToken';

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return getToken() !== null;
}
