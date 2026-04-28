/**
 * 비대칭 3-카드 그리드 — 시안 D PR-8b PR-3 (concept-d §3.4).
 *
 * lg 데스크톱: 1.4fr_1fr_1fr (Primary 강조), sm: 균등 3열, mobile: 1열.
 * Primary 만 brand-gradient (그라디언트는 글라스보다 강한 anchor).
 * Ranking / Admin 은 Hero 와 동일한 글라스 톤 — 페이지 통일성.
 */

import Link from 'next/link';
import { ArrowRight, BookOpen, Lock, Settings2, Trophy } from 'lucide-react';

import type { CardsData } from '@/lib/home/types';

type Props = {
  cards: CardsData;
};

export function FeatureCards({ cards }: Props) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr]">
      <PrimaryCard
        modeChips={cards.primary.modeChips}
        chapterProgress={cards.primary.chapterProgress}
      />
      <RankingCard top={cards.ranking.top} me={cards.ranking.me} />
      <AdminCard locked={cards.admin.locked} />
    </section>
  );
}

function PrimaryCard({
  modeChips,
  chapterProgress,
}: {
  modeChips: string[];
  chapterProgress: CardsData['primary']['chapterProgress'];
}) {
  const progressPct = chapterProgress
    ? Math.round((chapterProgress.completed / chapterProgress.total) * 100)
    : 0;

  return (
    <Link
      href="/play/solo"
      className={
        'group relative isolate flex flex-col overflow-hidden rounded-2xl p-4 ' +
        'bg-brand-gradient text-brand-fg shadow-[0_18px_50px_-20px_rgba(2,132,199,0.55)] ' +
        'ring-1 ring-inset ring-white/20 ' +
        'transition-transform duration-200 hover:-translate-y-0.5 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
        'dark:shadow-[0_18px_60px_-20px_rgba(14,165,233,0.5)]'
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
      />

      {/* 헤더 row */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white/20">
          <BookOpen className="h-3 w-3" aria-hidden />
        </span>
        <span className="rounded bg-white/25 px-1.5 py-0.5 text-[9px] font-medium tracking-wider">
          PRIMARY
        </span>
        <ArrowRight
          aria-hidden
          className="ml-auto h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      </div>

      <h3 className="text-base font-medium">솔로 플레이</h3>
      <p className="mb-3 mt-0.5 text-xs opacity-85">5가지 모드로 풀어보기</p>

      {/* 모드 chips */}
      <div className="mb-3 flex flex-wrap gap-1">
        {modeChips.map((chip) => (
          <span
            key={chip}
            className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium"
          >
            {chip}
          </span>
        ))}
      </div>

      {/* 챕터 진행 mini 박스 (인증만) */}
      {chapterProgress && (
        <div className="mt-auto rounded-md bg-white/14 px-2.5 py-2 backdrop-blur-sm">
          <div className="mb-1.5 flex items-center justify-between text-[10px]">
            <span className="opacity-90">이번 챕터</span>
            <span className="font-medium">
              {chapterProgress.completed} / {chapterProgress.total} · +
              {chapterProgress.xpReward} XP
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/22">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progressPct}%` }}
              aria-hidden
            />
          </div>
        </div>
      )}
    </Link>
  );
}

function RankingCard({
  top,
  me,
}: {
  top: CardsData['ranking']['top'];
  me: CardsData['ranking']['me'];
}) {
  return (
    <Link
      href="/rankings"
      className={
        'group relative isolate flex flex-col overflow-hidden rounded-2xl p-4 ' +
        'border border-white/15 bg-bg-elevated/55 backdrop-blur-2xl ' +
        'shadow-[0_18px_50px_-24px_rgba(2,132,199,0.25)] ' +
        'ring-1 ring-inset ring-white/10 ' +
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
        'dark:border-white/10 dark:bg-bg-elevated/35 dark:ring-white/[0.07]'
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />

      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-sm font-medium text-fg">랭킹</h3>
      </div>

      {/* top 2 */}
      <ol className="space-y-1.5 text-xs text-fg-muted">
        {top.map((entry) => (
          <li key={entry.rank} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="w-3 text-fg-muted">{entry.rank}</span>
              <span className="text-fg">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums text-fg">
              {entry.score.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>

      <div className="my-2 h-px bg-border/60" aria-hidden />

      {/* 내 위치 highlight */}
      {me ? (
        <div className="flex items-center justify-between gap-2 rounded bg-brand/10 px-1.5 py-1 text-xs font-medium text-brand">
          <span className="flex items-center gap-2">
            <span className="w-3 text-brand/80">{me.rank}</span>
            <span>{me.name}</span>
          </span>
          <span className="tabular-nums">{me.score.toLocaleString()}</span>
        </div>
      ) : (
        <p className="rounded bg-bg-elevated/60 px-1.5 py-1 text-xs text-fg-muted">
          로그인하면 내 순위 표시
        </p>
      )}
    </Link>
  );
}

function AdminCard({ locked }: { locked: boolean }) {
  return (
    <Link
      href="/admin/scope"
      className={
        'group relative isolate flex flex-col overflow-hidden rounded-2xl p-4 ' +
        'border border-white/15 bg-bg-elevated/55 backdrop-blur-2xl ' +
        'shadow-[0_18px_50px_-24px_rgba(2,132,199,0.2)] ' +
        'ring-1 ring-inset ring-white/10 ' +
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
        'dark:border-white/10 dark:bg-bg-elevated/35 dark:ring-white/[0.07]'
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />

      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-bg-elevated text-fg-muted">
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-sm font-medium text-fg">학습 범위</h3>
      </div>

      <p className="text-xs leading-relaxed text-fg-muted">
        노션 import
        <br />
        화이트리스트 편집
      </p>

      <div className="mt-auto pt-3">
        <div className="mb-2 h-px bg-border/60" aria-hidden />
        {locked && (
          <span className="inline-flex items-center gap-1 text-[10px] text-fg-muted/80">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            관리자 전용
          </span>
        )}
      </div>
    </Link>
  );
}
