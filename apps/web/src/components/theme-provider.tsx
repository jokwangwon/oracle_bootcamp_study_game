'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * ADR-020 §3.3 — next-themes 클라이언트 래퍼.
 *
 * - attribute='class' : <html> 에 .dark 토글 (Tailwind darkMode='class' 와 일치).
 * - defaultTheme='light' : Q15=b (programmers 지향).
 * - enableSystem : OS prefers-color-scheme 존중 + 토글 override.
 *
 * Layout (server component) 에서 children 을 감싸기 위해 별도 client wrapper 필요.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemeProvider {...props}>{children}</NextThemeProvider>;
}
