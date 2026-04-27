/**
 * ADR-020 §3.1 — Tailwind CSS v3.4 설정 (PR-1 인프라 단계).
 *
 * - darkMode 'class': next-themes 가 <html> 에 .dark 토글 (PR-4).
 * - content : src 하위 모든 ts/tsx — globals.css 외 클래스 추출.
 *
 * theme 토큰 매핑 (CSS 변수 ↔ Tailwind colors) 은 PR-2 에서 추가.
 * shadcn/ui 초기화는 PR-5.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
