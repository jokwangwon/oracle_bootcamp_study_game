'use client';

import { Brain, Check, Trophy } from 'lucide-react';
import { GAME_MODE_LABELS } from '@oracle-game/shared';
import { useCallback, useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { PracticeTrackStats, RankedTrackStats, SoloTrack } from '@/lib/play/types';

/**
 * 시안 β §3.1.2 / 시안 ε §3.3 — Layer 1 트랙 선택 (가장 중요).
 *
 * 두 글라스 타일 (랭킹 도전 / 개인 공부). 서로 배타. 선택 상태는 색 + 보더 두께
 * + 우상단 체크 아이콘 + `aria-checked` 4중 인코딩 (WCAG 1.4.1).
 *
 * 키보드: 좌우 화살표로 전환 (`role=radiogroup`).
 *
 * 시안 ε 시각 풍부화 (PR-9a' 변경):
 *  - 22px → 36px 아이콘 박스
 *  - 체크 마커 절대 위치를 우상단(top-2.5 right-2.5)으로 이동, 18px 원형
 *  - 선택 시 `border-2 border-brand` + `ring-2 ring-brand/15`
 *  - Stats row 신규 — 두 트랙이 다른 라인 노출 (props 옵셔널)
 */

type Props = {
  value: SoloTrack;
  onChange: (track: SoloTrack) => void;
  /**
   * 시안 ε §3.3.4 / §10.5 — 트랙별 stats row.
   * 각 prop 의 필드 모두 옵셔널 — 데이터 없으면 해당 행만 silent. 모든 행 silent 면
   * border-t 도 숨김.
   */
  rankedStats?: RankedTrackStats;
  practiceStats?: PracticeTrackStats;
};

export function TrackSelector({ value, onChange, rankedStats, practiceStats }: Props) {
  const groupId = useId();
  const rankedRef = useRef<HTMLButtonElement | null>(null);
  const practiceRef = useRef<HTMLButtonElement | null>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next: SoloTrack = value === 'ranked' ? 'practice' : 'ranked';
      onChange(next);
    },
    [onChange, value],
  );

  useEffect(() => {
    const ref = value === 'ranked' ? rankedRef : practiceRef;
    if (ref.current && document.activeElement?.closest('[role=radiogroup]')) {
      ref.current.focus();
    }
  }, [value]);

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      onKeyDown={handleKeyDown}
      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3"
    >
      <span id={`${groupId}-label`} className="sr-only">
        솔로 플레이 트랙 선택
      </span>

      <TrackTile
        ref={rankedRef}
        track="ranked"
        selected={value === 'ranked'}
        onSelect={() => onChange('ranked')}
        title="랭킹 도전"
        subtitle="고정 난이도 · 점수가 랭킹에 반영됩니다"
        icon={<Trophy className="size-[22px]" aria-hidden />}
        iconWrapClass="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
        statsRow={<RankedStatsRow stats={rankedStats} />}
      />

      <TrackTile
        ref={practiceRef}
        track="practice"
        selected={value === 'practice'}
        onSelect={() => onChange('practice')}
        title="개인 공부"
        subtitle="적응형 난이도 · 약점 분석"
        icon={<Brain className="size-[22px]" aria-hidden />}
        iconWrapClass="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
        statsRow={<PracticeStatsRow stats={practiceStats} />}
      />
    </div>
  );
}

type TileProps = {
  track: SoloTrack;
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconWrapClass: string;
  statsRow?: React.ReactNode;
};

const TrackTile = (() => {
  const Comp = ({
    ref,
    track,
    selected,
    onSelect,
    title,
    subtitle,
    icon,
    iconWrapClass,
    statsRow,
  }: TileProps & { ref: React.Ref<HTMLButtonElement> }) => (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      data-track={track}
      className={cn(
        'relative text-left rounded-xl p-3.5 transition-colors cursor-pointer',
        'bg-bg-elevated/55 backdrop-blur-2xl ring-1 ring-inset ring-white/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected
          ? 'border-2 border-brand ring-2 ring-brand/15'
          : 'border border-white/15 hover:border-brand/40',
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute top-2.5 right-2.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand text-brand-fg text-[10px]"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}

      <span
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2.5',
          iconWrapClass,
        )}
      >
        {icon}
      </span>

      <h3 className="text-sm font-medium text-fg m-0 mb-1">{title}</h3>
      <p className="text-xs text-fg-muted leading-relaxed mb-2.5">{subtitle}</p>

      {statsRow}
    </button>
  );

  Comp.displayName = 'TrackTile';
  return Comp;
})();

function RankedStatsRow({ stats }: { stats?: RankedTrackStats }) {
  const rows: Array<{ key: string; label: string; value: React.ReactNode }> = [];

  if (stats?.myRank !== undefined) {
    rows.push({
      key: 'rank',
      label: '내 순위',
      value: <span className="text-brand font-medium">{stats.myRank}위</span>,
    });
  }
  if (stats?.liveUserCount !== undefined && stats.liveUserCount > 0) {
    rows.push({
      key: 'live',
      label: '동기 풀이중',
      value: (
        <span className="inline-flex items-center gap-1 text-success font-medium">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-success animate-pulse" />
          {stats.liveUserCount}명
        </span>
      ),
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-fg-muted/80 italic">
        시작하면 통계가 쌓입니다
      </p>
    );
  }

  return (
    <dl className="pt-2 border-t border-white/10 flex flex-col gap-1 text-xs m-0">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between m-0">
          <dt className="text-fg-muted m-0">{row.label}</dt>
          <dd className="m-0 text-fg">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PracticeStatsRow({ stats }: { stats?: PracticeTrackStats }) {
  const rows: Array<{ key: string; label: string; value: React.ReactNode }> = [];

  if (stats?.studyDays !== undefined && stats.studyDays > 0) {
    rows.push({
      key: 'days',
      label: '누적 학습',
      value: <span className="text-fg font-medium">{stats.studyDays}일</span>,
    });
  }
  if (stats?.weakMode) {
    rows.push({
      key: 'weak',
      label: '약점 영역',
      value: <span className="text-fg-muted">{GAME_MODE_LABELS[stats.weakMode]}</span>,
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-fg-muted/80 italic">
        시작하면 통계가 쌓입니다
      </p>
    );
  }

  return (
    <dl className="pt-2 border-t border-white/10 flex flex-col gap-1 text-xs m-0">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between m-0">
          <dt className="text-fg-muted m-0">{row.label}</dt>
          <dd className="m-0 text-fg">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
