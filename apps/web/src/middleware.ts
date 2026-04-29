import { NextResponse, type NextRequest } from 'next/server';

/**
 * 사용자 결정 (2026-04-29) — 로그인 이전에는 모든 페이지 접근 차단.
 *
 * 화이트리스트:
 *  - /login / /register — 인증 페이지 자체
 *  - /_next/* / /favicon.ico — Next.js / static
 *  - /api/* — 본 web 의 API route 미사용. 백엔드는 별도 origin (3001) 이라 본
 *    middleware 적용 안 됨. 명시적 제외로 향후 도입 시 회귀 방지.
 *
 * 검증: cookie 'access' 존재 여부 만 확인 (PR-10a httpOnly cookie). 만료 토큰
 * 은 백엔드가 401 → api-client refresh 또는 /login redirect 로 처리. middleware
 * 는 1차 방어선 — UX 개선 + 리소스 절약.
 */
const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const access = req.cookies.get('access');
  if (!access) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // _next/*, favicon, icon (Next.js metadata API 자동 favicon), api 는 제외.
  matcher: ['/((?!_next/|favicon.ico|icon|apple-icon|api/).*)'],
};
