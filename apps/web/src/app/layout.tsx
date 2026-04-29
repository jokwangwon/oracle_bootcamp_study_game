import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Oracle DBA 학습 게임',
  description: 'Oracle DBA 부트캠프 용어/함수 암기를 위한 게임',
  icons: {
    // src/app/icon.svg 를 명시 link 로 head 주입. 브라우저의 자동 /favicon.ico
    // 요청은 별도 — 콘솔 노이즈일 뿐 기능 영향 없음.
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ADR-020 §3.3 — suppressHydrationWarning 은 next-themes 가 <html> 에
  // class 를 동적으로 토글하는 것에 대한 정상 동작.
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
