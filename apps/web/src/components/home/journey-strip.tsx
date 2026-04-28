/**
 * Journey strip — 시안 D PR-8b PR-2 (concept-d §3.3).
 *
 * 부트캠프 20-day 진행 막대. 4 상태(done/recent/today/upcoming) 색 인코딩 +
 * 위치 + 라벨 3중 인코딩 (WCAG 1.4.1 색만 사용 금지).
 *
 * 톤: Hero 패널과 동일한 Apple Vision 글라스 (통일성).
 */

import type { JourneyData, JourneyDayStatus } from '@/lib/home/types';

type Props = JourneyData & {
  /** 게스트 — 챕터 미리보기 라벨 (모든 막대 회색) */
  isGuest?: boolean;
};

export function JourneyStrip({
  days,
  currentDay,
  completedDays,
  totalDays,
  isGuest = false,
}: Props) {
  const pct = Math.round((completedDays / totalDays) * 100);
  const ariaLabel = isGuest
    ? `부트캠프 챕터 미리보기 — 총 ${totalDays}일 과정`
    : `부트캠프 진행률: ${totalDays}일 중 ${currentDay}일째, ${pct}% 완료`;

  return (
    <section
      role="img"
      aria-label={ariaLabel}
      className={
        'relative isolate overflow-hidden rounded-2xl p-4 ' +
        'border border-white/15 bg-bg-elevated/55 backdrop-blur-2xl ' +
        'shadow-[0_18px_50px_-24px_rgba(2,132,199,0.25)] ' +
        'ring-1 ring-inset ring-white/10 ' +
        'dark:border-white/10 dark:bg-bg-elevated/35 ' +
        'dark:shadow-[0_18px_60px_-24px_rgba(56,189,248,0.22)] ' +
        'dark:ring-white/[0.07]'
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/20"
      />

      {/* 헤더 라인 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-fg-muted">
          {isGuest ? '부트캠프 미리보기' : '부트캠프 여정'}
        </span>
        {isGuest ? (
          <span className="text-xs text-fg-muted">{totalDays}일 과정</span>
        ) : (
          <span className="text-xs text-fg-muted">
            <span className="font-medium text-fg">
              {completedDays} / {totalDays}일
            </span>
            <span className="mx-1.5 text-fg-muted/50">·</span>
            <span className="font-medium text-fg">{pct}%</span>
          </span>
        )}
      </div>

      {/* 20-grid 진행 막대 */}
      <div className="grid grid-cols-20 gap-0.5" aria-hidden>
        {days.map((d) => (
          <div key={d.day} className={`h-2 rounded-sm ${barClass(d.status)}`} />
        ))}
      </div>

      {/* 하단 3분할 라벨 */}
      <div className="mt-2 flex justify-between text-[10px] text-fg-muted">
        {isGuest ? (
          <>
            <span>
              <span className="font-medium text-brand">SQL</span> Day 1~13
            </span>
            <span className="text-fg-muted">3주차 PL/SQL</span>
            <span>
              <span className="font-medium text-fg">PL/SQL</span> Day 14~20
            </span>
          </>
        ) : (
          <>
            <span>
              <span className="font-medium text-brand">SQL</span> Day 1~13
            </span>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              ▲ Day {currentDay} (오늘)
            </span>
            <span>
              <span className="font-medium text-fg">PL/SQL</span> Day 14~20
            </span>
          </>
        )}
      </div>
    </section>
  );
}

function barClass(status: JourneyDayStatus): string {
  switch (status) {
    case 'done':
      return 'bg-brand';
    case 'recent':
      return 'bg-brand/60';
    case 'today':
      return 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900';
    case 'upcoming':
    default:
      return 'bg-border';
  }
}
