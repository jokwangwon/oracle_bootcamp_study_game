'use client';

import { ArrowRight, History } from 'lucide-react';
import { TOPIC_LABELS } from '@oracle-game/shared';

import { Button } from '@/components/ui/button';
import { CodePreviewPanel } from '@/components/code/code-preview-panel';
import type { CodeQuestion, LastSessionSummary, WeeklyStats } from '@/lib/play/types';

/**
 * 시안 ε §3.1 / §10.1 — `/play/solo` config phase Hero anchor.
 *
 * 시안 D `<HeroLivePanel>` 의 좌측 카피 + 우측 코드 패널 idiom 을 미러링.
 *
 * 책임:
 *  - 챕터 / 진도 pill, 시간대별 인사 h2, stats 메타 라인, CTA 한 쌍
 *  - 우측 `<CodePreviewPanel>` 호출 (Day N 추천 문제 정적 mock — 후속 PR 에서 endpoint 연결)
 *
 * 미책임: API 호출 (상위 page.tsx 가 fetch), 시작 (단지 prop 콜백 호출).
 *
 * 신규 사용자 분기 (§4.4):
 *  - pill: `Day 1 시작 · 부트캠프 20일 코스`
 *  - stats 메타: silent
 *  - CTA: `시작 가이드 보기` 1개
 *
 * 시간대별 인사 (§3.1.1):
 *  - 06–11: `좋은 아침이에요`
 *  - 11–17: `안녕하세요`
 *  - 17–22: `오늘 하루 어떠셨어요`
 *  - 22–06: `오늘도 늦게까지 고생 많아요`
 */

type Props = {
  user: { nickname: string; currentDay: number };
  weeklyStats: WeeklyStats | null;
  lastSession: LastSessionSummary | null;
  recommendedPreview: CodeQuestion;
  onRecommendedStart: () => void;
  onResumeSession?: () => void;
  onStartGuide?: () => void;
  /** 누적 정답률 — pill 우측. weekly accuracy 와 다른 누적 값 (선택). */
  cumulativeAccuracyPct?: number;
  /** Day N 추천 문제 평균 정답률 — Hero 우측 패널 Layer 3 (선택). */
  recommendedAccuracyPct?: number;
  /** XP 변화 — stats 메타 라인 (선택). */
  weeklyXpDelta?: number;
};

const BOOTCAMP_TOTAL_DAYS = 20;

export function ConfigHero({
  user,
  weeklyStats,
  lastSession,
  recommendedPreview,
  onRecommendedStart,
  onResumeSession,
  onStartGuide,
  cumulativeAccuracyPct,
  recommendedAccuracyPct,
  weeklyXpDelta,
}: Props) {
  const isNewUser = user.currentDay <= 1 && !weeklyStats;
  const greeting = pickTimeBasedGreeting(new Date());

  const pillText = isNewUser
    ? `Day 1 시작 · 부트캠프 ${BOOTCAMP_TOTAL_DAYS}일 코스`
    : cumulativeAccuracyPct !== undefined
      ? `DAY ${user.currentDay} / ${BOOTCAMP_TOTAL_DAYS} · 누적 정답률 ${cumulativeAccuracyPct}%`
      : `DAY ${user.currentDay} / ${BOOTCAMP_TOTAL_DAYS}`;

  return (
    <section className="rounded-xl bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 shadow-[0_24px_70px_-20px_rgba(2,132,199,0.25)] p-5 sm:p-6 mb-3 dark:shadow-[0_24px_80px_-20px_rgba(56,189,248,0.22)]">
      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4 items-center">
        <ConfigHeroCopy
          nickname={user.nickname}
          greeting={greeting}
          pillText={pillText}
          weeklyStats={weeklyStats}
          lastSession={lastSession}
          isNewUser={isNewUser}
          onRecommendedStart={onRecommendedStart}
          onResumeSession={onResumeSession}
          onStartGuide={onStartGuide}
          weeklyXpDelta={weeklyXpDelta}
        />
        <CodePreviewPanel
          code={recommendedPreview.code}
          filename={recommendedPreview.filename}
          topLabel={recommendedPreview.modeLabel}
          ariaLabel="Day별 추천 문제 코드 미리보기"
          bottomLeftLabel={`DAY ${user.currentDay} 추천 문제`}
          bottomRightLabel={
            recommendedAccuracyPct !== undefined ? `평균 정답률 ${recommendedAccuracyPct}%` : undefined
          }
        />
      </div>
    </section>
  );
}

function ConfigHeroCopy({
  nickname,
  greeting,
  pillText,
  weeklyStats,
  lastSession,
  isNewUser,
  onRecommendedStart,
  onResumeSession,
  onStartGuide,
  weeklyXpDelta,
}: {
  nickname: string;
  greeting: string;
  pillText: string;
  weeklyStats: WeeklyStats | null;
  lastSession: LastSessionSummary | null;
  isNewUser: boolean;
  onRecommendedStart: () => void;
  onResumeSession?: () => void;
  onStartGuide?: () => void;
  weeklyXpDelta?: number;
}) {
  return (
    <div className="flex flex-col">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand mb-2.5">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
        {pillText}
      </span>

      <h2 className="whitespace-pre-line text-xl sm:text-2xl font-medium leading-tight tracking-tight text-fg">
        {`${greeting} ${nickname} 님,\n어떻게 학습할까요?`}
      </h2>

      {!isNewUser && weeklyStats && (
        <StatsMetaLine stats={weeklyStats} weeklyXpDelta={weeklyXpDelta} />
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {isNewUser ? (
          <Button
            type="button"
            onClick={onStartGuide}
            disabled={!onStartGuide}
            className="bg-brand-gradient text-brand-fg disabled:opacity-50"
          >
            시작 가이드 보기
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={onRecommendedStart}
              className="bg-brand-gradient text-brand-fg group/cta"
            >
              추천으로 시작
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
            </Button>
            {lastSession && onResumeSession && (
              <Button
                type="button"
                variant="outline"
                onClick={onResumeSession}
                title={`Day ${lastSession.day} ${TOPIC_LABELS[lastSession.topic]} · ${formatDaysAgo(lastSession.lastPlayedAt)}`}
              >
                <History className="mr-1 h-4 w-4" aria-hidden />
                이어서 학습
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatsMetaLine({
  stats,
  weeklyXpDelta,
}: {
  stats: WeeklyStats;
  weeklyXpDelta?: number;
}) {
  // 데이터 0 이면 silent — 구분자(`|`) 도 함께 제거 (§3.1.1)
  const items: Array<{ key: string; node: React.ReactNode }> = [];
  if (stats.streak > 0) {
    items.push({
      key: 'streak',
      node: (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="text-amber-500 dark:text-amber-400">●</span>
          {stats.streak}일 연속
        </span>
      ),
    });
  }
  if (stats.solved > 0) {
    items.push({
      key: 'solved',
      node: <span>이번 주 풀이 {stats.solved}</span>,
    });
  }
  if (weeklyXpDelta !== undefined && weeklyXpDelta > 0) {
    items.push({
      key: 'xp',
      node: <span>+{weeklyXpDelta} XP</span>,
    });
  }
  if (items.length === 0) return null;

  return (
    <p className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
      {items.map((item, i) => (
        <span key={item.key} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden className="text-border">|</span>}
          {item.node}
        </span>
      ))}
    </p>
  );
}

function pickTimeBasedGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour >= 6 && hour < 11) return '좋은 아침이에요';
  if (hour >= 11 && hour < 17) return '안녕하세요';
  if (hour >= 17 && hour < 22) return '오늘 하루 어떠셨어요';
  return '오늘도 늦게까지 고생 많아요';
}

function formatDaysAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}
