import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CodeSegment, HeroData, LiveTicker, TodayQuestion } from '@/lib/home/types';

type Props = {
  hero: HeroData;
  todayQuestion: TodayQuestion;
  ticker: LiveTicker | null;
  guestTickerCopy?: string;
  cohortCopy?: string;
};

export function HeroLivePanel({
  hero,
  todayQuestion,
  ticker,
  guestTickerCopy,
  cohortCopy = '아이티윌 94기 · 20명 학습 중',
}: Props) {
  const isGuest = hero.chapterLabel === null;

  return (
    <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <HeroCopy hero={hero} isGuest={isGuest} cohortCopy={cohortCopy} />
      <HeroPanel
        todayQuestion={todayQuestion}
        ticker={ticker}
        guestTickerCopy={guestTickerCopy}
      />
    </section>
  );
}

function HeroCopy({
  hero,
  isGuest,
  cohortCopy,
}: {
  hero: HeroData;
  isGuest: boolean;
  cohortCopy: string;
}) {
  const pillText = hero.chapterLabel ?? cohortCopy;
  const pillDotClass = isGuest ? 'bg-success' : 'bg-brand';

  return (
    <div className="flex flex-col">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${pillDotClass}`} />
        {pillText}
      </span>

      <h1 className="mt-4 whitespace-pre-line text-4xl font-medium leading-tight tracking-tight text-fg sm:text-5xl">
        {hero.title}
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-fg-muted sm:text-base">
        {hero.subtitle}
        {hero.streakIndicator && (
          <span
            aria-hidden
            className="ml-1.5 inline-block text-amber-600 dark:text-amber-400"
          >
            ●
          </span>
        )}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild className="bg-brand text-brand-fg hover:bg-brand/90">
          <Link href={hero.primaryCta.href} className="group/cta">
            {hero.primaryCta.label}
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover/cta:translate-x-0.5" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
        </Button>
      </div>
    </div>
  );
}

function HeroPanel({
  todayQuestion,
  ticker,
  guestTickerCopy,
}: {
  todayQuestion: TodayQuestion;
  ticker: LiveTicker | null;
  guestTickerCopy?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-sm">
      {/* Layer 1 — 다크 탭바 */}
      <div className="flex items-center justify-between bg-code-tab px-3 py-1.5 font-mono text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-brand">●</span>
          {todayQuestion.filename}
        </span>
        <span className="text-slate-500">{todayQuestion.modeLabel}</span>
      </div>

      {/* Layer 2 — 다크 코드 */}
      <pre
        aria-label="오늘의 문제 코드 미리보기"
        className="grid grid-cols-[28px_1fr] bg-code"
      >
        <div
          aria-hidden
          className="select-none border-r border-slate-800 px-2 py-2.5 text-right font-mono text-[12px] leading-7 text-slate-600"
        >
          {todayQuestion.code.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <code className="px-3 py-2.5 font-mono text-[12px] leading-7 text-slate-200">
          {todayQuestion.code.map((line, i) => (
            <div key={i}>
              {line.length === 0 ? (
                <>&nbsp;</>
              ) : (
                line.map((seg, j) => <CodeSegmentSpan key={j} seg={seg} />)
              )}
            </div>
          ))}
        </code>
      </pre>

      {/* Layer 3 — 라이트 티커 */}
      <div className="flex items-center gap-3 border-t border-border bg-bg-elevated px-3 py-2.5 text-xs text-fg-muted">
        {ticker ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="font-medium text-fg">{ticker.activeUsers}</span>명 풀이 중
            </span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>
              1위 {ticker.topPlayer.name}{' '}
              <span className="font-medium text-brand">
                {ticker.topPlayer.score.toLocaleString()}
              </span>
            </span>
            <span className="ml-auto">정답률 {ticker.accuracyPct}%</span>
          </>
        ) : (
          <span>{guestTickerCopy ?? '최근 풀이 1,247건'}</span>
        )}
      </div>
    </div>
  );
}

function CodeSegmentSpan({ seg }: { seg: CodeSegment }) {
  const className = segmentClass(seg.kind);
  if (className) return <span className={className}>{seg.text}</span>;
  return <>{seg.text}</>;
}

function segmentClass(kind: CodeSegment['kind']): string {
  switch (kind) {
    case 'keyword':
      return 'text-purple-400';
    case 'fn':
      return 'text-sky-400';
    case 'highlight':
      return 'rounded-sm bg-syntax-blank px-1 text-syntax-blank-fg';
    case 'plain':
    case undefined:
    default:
      return '';
  }
}
