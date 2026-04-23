'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AUTH_CHANGED_EVENT, clearToken, hasToken } from '@/lib/auth-storage';

/**
 * 전역 헤더 — 로그인 상태에 따라 메뉴 표시.
 *
 * SSR 안전: 마운트 전에는 빈 자리만 차지하여 hydration mismatch 방지.
 *
 * 로그인/로그아웃 즉시 반영 (2026-04-23 수정):
 *  - `usePathname()` 변경 시 재체크 (로그인 성공 후 리다이렉트 → 갱신)
 *  - `auth-storage` 의 커스텀 이벤트 `AUTH_CHANGED_EVENT` 를 listen —
 *    같은 페이지 안에서 토큰 변경 시에도 즉시 반영
 *  - `storage` 이벤트도 listen — 다른 탭에서 로그인/로그아웃 한 경우 반영
 */
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
    <header
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '0.875rem 1.5rem',
        background: 'var(--bg-elevated)',
      }}
    >
      <nav
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          href="/"
          style={{
            fontWeight: 700,
            color: 'var(--fg)',
            textDecoration: 'none',
            fontSize: '1rem',
          }}
        >
          Oracle DBA 학습 게임
        </Link>

        <div style={{ display: 'flex', gap: '0.75rem', minHeight: 32 }}>
          {!mounted ? null : authed ? (
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: '0.45rem 0.9rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--fg)',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              로그아웃
            </button>
          ) : (
            <>
              <Link href="/login" style={linkBtnStyle}>
                로그인
              </Link>
              <Link
                href="/register"
                style={{ ...linkBtnStyle, background: 'var(--accent)', color: '#0f172a', borderColor: 'transparent' }}
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

const linkBtnStyle: React.CSSProperties = {
  padding: '0.45rem 0.9rem',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--fg)',
  textDecoration: 'none',
  fontSize: '0.85rem',
};
