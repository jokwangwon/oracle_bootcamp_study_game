import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroLivePanel } from '../hero-live-panel';
import type { HeroData, LiveTicker, TodayQuestion } from '@/lib/home/types';

const baseHero: HeroData = {
  chapterLabel: 'DAY 16 / 20 · PL/SQL CURSOR',
  title: '오늘의 PL/SQL,\n4문제만 풀고 가요',
  subtitle: '연속 학습',
  streakIndicator: false,
  primaryCta: { label: '이어서', href: '/play/solo' },
  secondaryCta: { label: '챕터', href: '/play/solo' },
};

const baseTicker: LiveTicker = {
  activeUsers: 12,
  topPlayer: { name: '김OO', score: 100 },
  accuracyPct: 50,
};

function mkTodayQuestion(overrides: Partial<TodayQuestion> = {}): TodayQuestion {
  return {
    filename: 'x.sql',
    modeLabel: '빈칸',
    code: [[{ text: 'SELECT' }]],
    ...overrides,
  };
}

describe('<HeroLivePanel /> — PR-12 §3.2 discussion 메타 칩', () => {
  // 6.3.3 todayQuestion.discussionCount > 0 시 메타 칩 표시
  it('discussionCount > 0 + questionId → 메타 칩 표시 + href = /play/solo/[id]/discussion', () => {
    render(
      <HeroLivePanel
        hero={baseHero}
        todayQuestion={mkTodayQuestion({
          questionId: '00000000-0000-4000-8000-000000000016',
          discussionCount: 4,
        })}
        ticker={baseTicker}
      />,
    );
    const chip = screen.getByTestId('discussion-meta-chip');
    expect(chip).toHaveTextContent(/토론 4개/);
    expect(chip).toHaveAttribute(
      'href',
      '/play/solo/00000000-0000-4000-8000-000000000016/discussion',
    );
  });

  // 6.3.4 discussionCount = 0 시 칩 미표시
  it('discussionCount = 0 → 메타 칩 미표시 (silent)', () => {
    render(
      <HeroLivePanel
        hero={baseHero}
        todayQuestion={mkTodayQuestion({
          questionId: '00000000-0000-4000-8000-000000000016',
          discussionCount: 0,
        })}
        ticker={baseTicker}
      />,
    );
    expect(screen.queryByTestId('discussion-meta-chip')).toBeNull();
  });

  it('questionId 없으면 미표시', () => {
    render(
      <HeroLivePanel
        hero={baseHero}
        todayQuestion={mkTodayQuestion({ discussionCount: 5 })}
        ticker={baseTicker}
      />,
    );
    expect(screen.queryByTestId('discussion-meta-chip')).toBeNull();
  });

  // 6.3.5 게스트 (chapterLabel = null) 도 칩 표시 (read-only 페이지 진입)
  it('게스트도 칩 표시 (read-only 페이지 진입 — Q-R5-11=a)', () => {
    render(
      <HeroLivePanel
        hero={{ ...baseHero, chapterLabel: null }}
        todayQuestion={mkTodayQuestion({
          questionId: '00000000-0000-4000-8000-000000000016',
          discussionCount: 3,
        })}
        ticker={null}
      />,
    );
    expect(screen.getByTestId('discussion-meta-chip')).toBeInTheDocument();
  });
});
