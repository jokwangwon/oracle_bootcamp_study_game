/**
 * ADR-020 §3.1 — Tailwind CSS v3.4 설정.
 *
 * - darkMode 'class': next-themes 가 <html> 에 .dark 토글 (PR-4).
 * - content: src 하위 모든 ts/tsx — globals.css 외 클래스 추출.
 * - colors  : CSS 변수 브리지 (PR-2). globals.css :root / .dark 에서 정의된 토큰을
 *             Tailwind utility (`bg-bg`, `text-fg`, `border-border`, ...) 로 노출.
 *
 * shadcn/ui 초기화는 PR-5.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        success: 'var(--success)',
        error: 'var(--error)',
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
};
