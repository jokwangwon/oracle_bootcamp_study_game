'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * ADR-020 §3.3 / §7 4.1.2 — light ↔ dark 토글.
 *
 * - mounted 가드: next-themes 는 클라이언트에서 결정되므로 마운트 전에는
 *   고정 자리만 차지하여 hydration mismatch 방지.
 * - aria-label / aria-pressed: WCAG 2.1 AA Name/Role/Value.
 * - resolvedTheme 사용 — defaultTheme='system' 일 때 OS prefers-color-scheme 반영.
 *   현재 defaultTheme='light' (Q15=b) 라 초기값 light.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-pressed={isDark}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--fg)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {/* 아이콘은 mounted 후에만 의미 있음. 이전엔 빈 자리 유지로 hydration mismatch 방지. */}
      {mounted && (isDark ? <Moon size={16} /> : <Sun size={16} />)}
    </button>
  );
}
