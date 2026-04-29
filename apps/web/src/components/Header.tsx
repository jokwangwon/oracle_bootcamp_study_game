'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { AUTH_CHANGED_EVENT, clearToken } from '@/lib/auth-storage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

export function Header() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  /**
   * PR-10a §4.2.1 — httpOnly cookie 는 JS 가 읽을 수 없으므로 me() endpoint 호출로
   * 인증 상태 추적. 401 시 api-client 의 자동 refresh interceptor 가 1회 retry.
   * 그래도 401 이면 비인증.
   */
  // mount 시 1회만 me() 호출. pathname 변경 (페이지 이동) 시 재호출은
  // throttle 누적 + 401 무한 루프 위험. 같은 탭 인증 상태 갱신은 아래
  // AUTH_CHANGED_EVENT 리스너가 처리.
  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    void apiClient.auth
      .me()
      .then(() => {
        if (!cancelled) setAuthed(true);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 같은 탭의 login/logout 즉시 반영 (login/register/logout 핸들러가 이벤트 발행).
  useEffect(() => {
    const refresh = () => {
      void apiClient.auth
        .me()
        .then(() => setAuthed(true))
        .catch(() => setAuthed(false));
    };
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, []);

  async function handleLogout() {
    try {
      await apiClient.auth.logout();
    } catch {
      // logout endpoint 가 실패해도 클라이언트 상태는 무효화 진행 (cookie 는 expire 자연 소멸).
    }
    clearToken(); // localStorage legacy fallback 정리.
    setAuthed(false);
    router.push('/login');
  }

  return (
    <header className="border-b border-border bg-bg-elevated">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-base font-bold text-fg no-underline transition-colors hover:text-brand">
          Oracle DBA 학습 게임
        </Link>

        <div className="flex min-h-8 items-center gap-2">
          <ThemeToggle />
          {!mounted ? null : authed ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/play/solo">플레이</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/review/mistakes">오답 노트</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">로그인</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-brand text-brand-fg hover:bg-brand/90"
              >
                <Link href="/register">회원가입</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
