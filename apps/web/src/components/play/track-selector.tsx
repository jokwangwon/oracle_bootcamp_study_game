'use client';

import { Brain, Check, Trophy } from 'lucide-react';
import { useCallback, useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { SoloTrack } from '@/lib/play/types';

/**
 * 시안 β §3.1.2 — Layer 1 트랙 선택 (가장 중요).
 *
 * 두 글라스 타일 (랭킹 도전 / 개인 공부). 서로 배타. 선택 상태는 색 + 보더 두께
 * + 좌상단 체크 아이콘 + `aria-checked` 4중 인코딩 (WCAG 1.4.1).
 *
 * 키보드: 좌우 화살표로 전환 (`role=radiogroup`).
 */

type Props = {
  value: SoloTrack;
  onChange: (track: SoloTrack) => void;
  /**
   * 랭킹 도전 타일에 표시될 라이브 동기 카운트. 정의 시에만 LIVE 배지 노출
   * (게스트 / 데이터 없음 시 숨김).
   */
  liveUserCount?: number;
};

export function TrackSelector({ value, onChange, liveUserCount }: Props) {
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

  // 선택 변경 시 해당 타일에 포커스 이동 (스크린리더 + 키보드 사용성)
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
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
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
        icon={<Trophy className="size-[18px]" aria-hidden />}
        iconWrapClass="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
        liveUserCount={liveUserCount}
      />

      <TrackTile
        ref={practiceRef}
        track="practice"
        selected={value === 'practice'}
        onSelect={() => onChange('practice')}
        title="개인 공부"
        subtitle="적응형 난이도 · 약점 분석"
        icon={<Brain className="size-[18px]" aria-hidden />}
        iconWrapClass="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
        infoBadge="랭킹에 반영되지 않습니다 · 자유롭게 학습하세요"
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
  liveUserCount?: number;
  infoBadge?: string;
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
    liveUserCount,
    infoBadge,
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
        'relative text-left rounded-xl p-5 transition-colors cursor-pointer',
        'bg-bg-elevated/55 backdrop-blur-2xl ring-1 ring-inset ring-white/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected
          ? 'border-2 border-brand'
          : 'border border-white/15 hover:border-brand/40',
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute top-3 right-3 inline-flex items-center justify-center size-5 rounded-full bg-brand text-brand-fg"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}

      <div className="flex items-center gap-2 mb-1">
        <span className={cn('inline-flex items-center justify-center size-8 rounded-md', iconWrapClass)}>
          {icon}
        </span>
        <span className="text-base font-medium text-fg">{title}</span>
      </div>

      <p className="text-xs text-fg-muted">{subtitle}</p>

      {liveUserCount !== undefined && liveUserCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-muted">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-success animate-pulse" />
          동기 {liveUserCount}명 풀이 중
        </p>
      )}

      {infoBadge && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-muted">
          <Check aria-hidden className="size-3 text-success" />
          {infoBadge}
        </p>
      )}
    </button>
  );

  Comp.displayName = 'TrackTile';
  return Comp;
})();
