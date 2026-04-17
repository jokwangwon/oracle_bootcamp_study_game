'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { clearToken, hasToken } from '@/lib/auth-storage';

/**
 * 전역 헤더 — 로그인 상태에 따라 메뉴 표시.
 *
 * SSR 안전: 마운트 전에는 빈 자리만 차지하여 hydration mismatch 방지.
 */
export function Header() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(hasToken());
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
