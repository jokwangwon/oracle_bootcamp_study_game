'use client';

/**
 * 메인 페이지 — 시안 D PR-8b 통합 (Hero + Journey + 비대칭 카드).
 *
 * **`'use client'` 사유**: 인증 분기가 localStorage 기반 (`auth-storage.ts`)
 * 이라 RSC 에서 토큰을 볼 수 없다. PR-10 (httpOnly 쿠키) 머지 후 RSC 로 환원.
 * `mounted` 가드로 hydration mismatch 방지 — PR-8 Header 와 동일 패턴.
 *
 * 출처: `docs/rationale/main-page-redesign-concept-d.md`
 */

import { useEffect, useState } from 'react';

import { FeatureCards } from '@/components/home/feature-cards';
import { HeroLivePanel } from '@/components/home/hero-live-panel';
import { JourneyStrip } from '@/components/home/journey-strip';
import { getHomeViewModelClient } from '@/lib/home/data';
import { guestMock } from '@/lib/home/mock';
import type { HomeViewModel } from '@/lib/home/types';

export default function HomePage() {
  const [vm, setVm] = useState<HomeViewModel>(guestMock);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const next = getHomeViewModelClient();
    setVm(next);
    setAuthed(next.hero.chapterLabel !== null);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <HeroLivePanel
        hero={vm.hero}
        todayQuestion={vm.todayQuestion}
        ticker={vm.ticker}
        guestTickerCopy={vm.guestTickerCopy}
      />

      <div className="mt-8">
        <JourneyStrip
          days={vm.journey.days}
          currentDay={vm.journey.currentDay}
          completedDays={vm.journey.completedDays}
          totalDays={vm.journey.totalDays}
          isGuest={!authed}
        />
      </div>

      <div className="mt-6">
        <FeatureCards cards={vm.cards} />
      </div>
    </main>
  );
}
