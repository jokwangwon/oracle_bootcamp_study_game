'use client';

/**
 * 메인 페이지 — 시안 D PR-8b PR-1 (Hero 교체).
 *
 * **PR-1 범위**: Hero 영역만 시안 D 의 3-layer 통합 패널로 교체. Journey strip
 * (PR-2) 와 비대칭 카드 그리드 (PR-3) 는 후속 PR.
 *
 * **`'use client'` 사유**: 인증 분기가 localStorage 기반 (`auth-storage.ts`)
 * 이라 RSC 에서 토큰을 볼 수 없다. PR-10 (httpOnly 쿠키) 머지 후 RSC 로 환원.
 * `mounted` 가드로 hydration mismatch 방지 — PR-8 Header 와 동일 패턴.
 *
 * 출처: `docs/rationale/main-page-redesign-concept-d.md`
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Trophy, Settings2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { HeroLivePanel } from '@/components/home/hero-live-panel';
import { getHomeViewModelClient } from '@/lib/home/data';
import { guestMock } from '@/lib/home/mock';
import type { HomeViewModel } from '@/lib/home/types';

const featureCards = [
  {
    href: '/play/solo',
    title: '솔로 플레이',
    desc: '주차/주제/난이도 선택. 빈칸·용어·MC 등 5가지 모드.',
    icon: BookOpen,
    primary: true,
  },
  {
    href: '/rankings',
    title: '랭킹',
    desc: '동기 수강생들과 점수 경쟁',
    icon: Trophy,
    primary: false,
  },
  {
    href: '/admin/scope',
    title: '학습 범위 관리',
    desc: '(관리자) 노션 자료 import 및 화이트리스트 편집',
    icon: Settings2,
    primary: false,
  },
] as const;

export default function HomePage() {
  const [vm, setVm] = useState<HomeViewModel>(guestMock);

  useEffect(() => {
    setVm(getHomeViewModelClient());
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <HeroLivePanel
        hero={vm.hero}
        todayQuestion={vm.todayQuestion}
        ticker={vm.ticker}
        guestTickerCopy={vm.guestTickerCopy}
      />

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featureCards.map((c) => (
          <Link key={c.href} href={c.href} className="group block focus:outline-none">
            <Card
              className={
                'relative h-full overflow-hidden border-border bg-bg-elevated transition-all duration-200 ' +
                'hover:-translate-y-0.5 hover:border-brand hover:shadow-lg ' +
                'group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg'
              }
            >
              {c.primary && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand via-brand/70 to-transparent"
                />
              )}
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </div>
                <CardTitle className="text-lg text-fg">{c.title}</CardTitle>
                <CardDescription className="text-fg-muted">{c.desc}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
