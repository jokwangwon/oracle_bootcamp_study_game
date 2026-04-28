/**
 * 메인 페이지 ViewModel — 시안 D (PR-8b).
 *
 * RSC `page.tsx` 가 `getHomeViewModel()` 로 받아서 4 영역 컴포넌트에 props 로 전달.
 * 인증/게스트 분기는 빌더 단계에서 처리하고, 컴포넌트는 받은 데이터만 렌더한다.
 *
 * 출처: `docs/rationale/main-page-redesign-concept-d.md` §4.
 */

export type CtaLink = {
  label: string;
  href: string;
};

export type HeroData = {
  /** null 이면 게스트 — pill 컴포넌트가 코호트 카피로 분기 */
  chapterLabel: string | null;
  /** `\n` 포함 가능 — `whitespace-pre-line` 으로 렌더 */
  title: string;
  subtitle: string;
  /** subtitle 끝 amber 도트 (인증 streak 강조) */
  streakIndicator: boolean;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
};

export type CodeSegmentKind = 'keyword' | 'fn' | 'highlight' | 'plain';

export type CodeSegment = {
  text: string;
  kind?: CodeSegmentKind;
};

export type CodeLine = CodeSegment[];

export type TodayQuestion = {
  filename: string;
  modeLabel: string;
  code: CodeLine[];
};

export type LiveTicker = {
  activeUsers: number;
  topPlayer: { name: string; score: number };
  accuracyPct: number;
};

export type JourneyDayStatus = 'done' | 'recent' | 'today' | 'upcoming';

export type JourneyDay = {
  day: number;
  status: JourneyDayStatus;
};

export type JourneyData = {
  days: JourneyDay[];
  currentDay: number;
  completedDays: number;
  totalDays: number;
};

export type ChapterProgress = {
  completed: number;
  total: number;
  xpReward: number;
};

export type RankingEntry = {
  rank: number;
  name: string;
  score: number;
};

export type CardsData = {
  primary: {
    modeChips: string[];
    chapterProgress: ChapterProgress | null;
  };
  ranking: {
    top: RankingEntry[];
    me: RankingEntry | null;
  };
  admin: {
    locked: boolean;
  };
};

export type HomeViewModel = {
  hero: HeroData;
  todayQuestion: TodayQuestion;
  /** null 이면 게스트 — Layer 3 가 정적 카피로 fallback */
  ticker: LiveTicker | null;
  guestTickerCopy?: string;
  journey: JourneyData;
  cards: CardsData;
};
