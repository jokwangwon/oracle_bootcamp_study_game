import { NextResponse, type NextRequest } from 'next/server';

/**
 * 사용자 결정 (2026-04-29) — 메인 화면 + 인증 페이지만 게스트 공개.
 * 학습/토론/관리/오답노트 등은 모두 인증 필수.
 *
 * 화이트리스트:
 *  - /         — 게스트 미리보기 (Hero / 메타 칩 등)
 *  - /login / /register — 인증 페이지 자체
 *  - /_next/* / /favicon.ico / /icon* — Next.js / static (matcher 에서 제외)
 *  - /api/*    — 본 web 의 API route 미사용 (백엔드는 별도 origin)
 *
 * 검증: cookie 'access' 존재 여부 만 확인 (PR-10a httpOnly cookie). 만료 토큰
 * 은 백엔드가 401 → api-client refresh 또는 /login redirect 로 처리. middleware
 * 는 1차 방어선 — UX 개선 + 리소스 절약.
 */
const PUBLIC_PATHS = ['/', '/login', '/register'];

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
