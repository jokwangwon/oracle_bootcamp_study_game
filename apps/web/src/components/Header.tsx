'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AUTH_CHANGED_EVENT, clearToken, hasToken } from '@/lib/auth-storage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(hasToken());
  }, [pathname]);

  useEffect(() => {
    const refresh = () => setAuthed(hasToken());
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  function handleLogout() {
    clearToken();
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
