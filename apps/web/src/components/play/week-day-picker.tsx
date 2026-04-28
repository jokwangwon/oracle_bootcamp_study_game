'use client';

import { Minus, Plus } from 'lucide-react';
import { useCallback, useId, useRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * 시안 ε §3.4.3 / §10.4 — 주차 (Day) 선택 picker.
 *
 * 기존 PR-9a 의 native `<input type="number">` 를 풍부한 day picker 로 교체.
 *
 * 구성:
 *  1. 라벨 — `주차 · Day {N} 진행 중`
 *  2. 현재 선택 박스 — `Day {selected}` + −/+ step 버튼
 *  3. 20-dot strip — 시안 D Journey strip 의 미니버전
 *
 * Dot 4 상태 (시각 인코딩):
 *  - 선택 (selected): `bg-brand-strong` + outline (가장 강한 시각, 우선순위 1)
 *  - 오늘 (currentBootcampDay): `bg-amber-500` + ring
 *  - 풀이 완료 (playedDays 에 포함): `bg-brand`
 *  - 미진행 (currentBootcampDay 이후 미래): `bg-border`
 *
 * 양방향 sync: input + step 버튼 + dot 클릭 + 키보드 좌우 화살표 모두 동일 onChange.
 *
 * 컨테이너 `role="radiogroup"` (시안 ε §3.4.3 / §7.3 키보드).
 *
 * 명세: docs/rationale/solo-play-config-redesign-concept-epsilon.md §10.4.
 */

const TOTAL_DAYS = 20;

type Props = {
  value: number;
  onChange: (day: number) => void;
  currentBootcampDay: number;
  /** 사용자가 적어도 1번 풀어본 day 들 (1~20) */
  playedDays: Set<number>;
};

export function WeekDayPicker({ value, onChange, currentBootcampDay, playedDays }: Props) {
  const groupId = useId();
  const stripRef = useRef<HTMLDivElement | null>(null);

  const setDay = useCallback(
    (day: number) => {
      const clamped = Math.max(1, Math.min(TOTAL_DAYS, day));
      onChange(clamped);
    },
    [onChange],
  );

  const handleStripKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setDay(value + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.key === 'Home') {
        event.preventDefault();
        setDay(1);
      } else if (event.key === 'End') {
        event.preventDefault();
        setDay(TOTAL_DAYS);
      }
    },
    [setDay, value],
  );

  return (
    <div>
      <label
        htmlFor={`${groupId}-input`}
        className="block text-[10px] font-medium uppercase tracking-wider text-fg-muted mb-1.5"
      >
        주차 · <span className="text-fg font-medium">Day {value}</span> 진행 중
      </label>

      {/* 현재 선택 박스 (input + step) */}
      <div className="flex items-center gap-2 rounded-md bg-bg/60 border border-border px-2.5 py-1.5">
        <button
          type="button"
          aria-label="이전 day"
          onClick={() => setDay(value - 1)}
          disabled={value <= 1}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-bg-elevated disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <input
          id={`${groupId}-input`}
          type="number"
          min={1}
          max={TOTAL_DAYS}
          value={value}
          aria-label={`Day ${value} 선택됨`}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            setDay(Number.isNaN(n) ? 1 : n);
          }}
          className="flex-1 min-w-0 bg-transparent text-center text-sm text-fg tabular-nums focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="다음 day"
          onClick={() => setDay(value + 1)}
          disabled={value >= TOTAL_DAYS}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-bg-elevated disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* 20-dot strip */}
      <div
        ref={stripRef}
        role="radiogroup"
        aria-label="주차 선택"
        onKeyDown={handleStripKeyDown}
        className="grid grid-cols-20 gap-px mt-2"
      >
        {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((day) => (
          <DayDot
            key={day}
            day={day}
            isSelected={day === value}
            isToday={day === currentBootcampDay}
            isPlayed={playedDays.has(day)}
            isUnreached={day > currentBootcampDay}
            onSelect={() => setDay(day)}
          />
        ))}
      </div>
    </div>
  );
}

type DotProps = {
  day: number;
  isSelected: boolean;
  isToday: boolean;
  isPlayed: boolean;
  isUnreached: boolean;
  onSelect: () => void;
};

function DayDot({ day, isSelected, isToday, isPlayed, isUnreached, onSelect }: DotProps) {
  const status: 'selected' | 'today' | 'played' | 'unreached' = isSelected
    ? 'selected'
    : isToday
      ? 'today'
      : isPlayed
        ? 'played'
        : isUnreached
          ? 'unreached'
          : 'played';

  const statusLabel: Record<typeof status, string> = {
    selected: '선택됨',
    today: '오늘',
    played: '완료',
    unreached: '미진행',
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={isSelected ? 0 : -1}
      aria-label={`Day ${day}, ${statusLabel[status]}`}
      onClick={onSelect}
      className={cn(
        'h-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
        // 우선순위: selected > today > played > unreached
        isSelected
          ? 'bg-brand-strong outline outline-2 outline-brand'
          : isToday
            ? 'bg-amber-500 ring-1 ring-amber-200 dark:ring-amber-900'
            : isPlayed
              ? 'bg-brand'
              : 'bg-border',
      )}
    />
  );
}
