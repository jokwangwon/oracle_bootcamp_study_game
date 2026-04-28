'use client';

import { Sparkles } from 'lucide-react';
import { CURRICULUM_TOPICS, TOPIC_LABELS, type Difficulty, type GameModeId, type Topic } from '@oracle-game/shared';

import { Label } from '@/components/ui/label';
import { CONFIG_AVAILABLE_MODES, DIFFICULTY_OPTIONS } from '@/lib/play/mock';
import type { ModeStat, SoloConfigSelection } from '@/lib/play/types';
import { cn } from '@/lib/utils';

import { ModeMultiSelect } from './mode-multi-select';
import { WeekDayPicker } from './week-day-picker';

/**
 * 시안 β §3.1.3 ~ §3.1.6 / 시안 ε §3.4 ~ §3.5 — Layer 2/3/4 split form.
 *
 * 시안 ε 시각 변경 (PR-9a' 변경):
 *  - 한 카드 → 좌·우 split (좌: 주제+주차 / 우: 모드+난이도)
 *  - 주차 input 을 `<WeekDayPicker>` 로 교체
 *  - 난이도 chip — 색 분기 + 강도 dot (3중 인코딩: 색 + 강도 dot + 라벨)
 *
 * 변경 없음: 폼 데이터 흐름, 검증 로직, props 시그니처 (CTA 그룹은 page.tsx 로 이동
 * — Hero 의 CTA 와 별도. 본 컴포넌트는 split form 만 담당).
 */

type Props = {
  config: SoloConfigSelection;
  onConfigChange: (next: SoloConfigSelection) => void;
  /** 시안 ε §3.4.3 / §10.4 — WeekDayPicker 의 부트캠프 진도. */
  currentBootcampDay: number;
  /** 시안 ε §3.4.3 / §10.4 — 사용자가 적어도 1번 풀어본 day 들. */
  playedDays: Set<number>;
  /** 시안 ε §3.5.2 / §10.6 — 모드별 사용자 통계. */
  modeStats?: Record<GameModeId, ModeStat>;
};

export function ConfigForm({
  config,
  onConfigChange,
  currentBootcampDay,
  playedDays,
  modeStats,
}: Props) {
  const isPractice = config.track === 'practice';

  const update = <K extends keyof SoloConfigSelection>(key: K, value: SoloConfigSelection[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.1fr] gap-2.5 mb-3">
      {/* 좌측 — 주제 + 주차 */}
      <div className="rounded-xl bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 p-3.5 space-y-3">
        <FieldGroup labelText="주제" htmlFor="cfg-topic">
          <select
            id="cfg-topic"
            value={config.topic}
            onChange={(e) => update('topic', e.target.value as Topic)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {CURRICULUM_TOPICS.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t]}
              </option>
            ))}
          </select>
        </FieldGroup>

        <WeekDayPicker
          value={config.week}
          onChange={(week) => update('week', week)}
          currentBootcampDay={currentBootcampDay}
          playedDays={playedDays}
        />
      </div>

      {/* 우측 — 모드 + 난이도 */}
      <div className="rounded-xl bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 p-3.5">
        <div className="flex items-baseline justify-between mb-2">
          <Label className="text-[10px] font-medium text-fg-muted uppercase tracking-wider">
            게임 모드
          </Label>
          <span className="text-[11px] text-fg-muted">
            {config.modes.length === 1
              ? '1 선택됨 · 단일 모드'
              : `${config.modes.length} 선택됨 · 섞여 출제`}
          </span>
        </div>
        <ModeMultiSelect
          value={config.modes}
          onChange={(modes: GameModeId[]) => update('modes', modes)}
          availableModes={CONFIG_AVAILABLE_MODES}
          modeStats={modeStats}
        />

        <div className="mt-3">
          <Label className="text-[10px] font-medium text-fg-muted uppercase tracking-wider mb-1.5 block">
            난이도
          </Label>
          {isPractice ? (
            <div className="bg-bg-elevated border border-border rounded-md px-3 py-2 text-xs text-fg-muted flex items-center gap-2">
              <Sparkles className="size-3.5 text-purple-500 dark:text-purple-400 shrink-0" aria-hidden />
              <span>난이도가 정답률에 따라 자동 조정됩니다</span>
            </div>
          ) : (
            <DifficultyChips
              value={config.difficulty}
              onChange={(d) => update('difficulty', d)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 시안 ε §3.5.3 — 난이도 chip 3중 인코딩 (색 + 강도 dot + 라벨).
 *
 * 미선택 시 강도 dot 은 `text-border` (회색) — layout shift 방지.
 *
 * Tailwind utility 는 `text-difficulty-easy` / `bg-difficulty-easy-bg` /
 * `border-difficulty-easy` 사용 (시안 ε §5.2).
 */
function DifficultyChips({
  value,
  onChange,
}: {
  value: Difficulty | null;
  onChange: (d: Difficulty) => void;
}) {
  return (
    <div role="radiogroup" aria-label="난이도 선택" className="flex gap-1">
      {DIFFICULTY_OPTIONS.map((d) => {
        const selected = value === d;
        const tone = DIFFICULTY_TONE[d];
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(d)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              'border',
              selected
                ? `${tone.borderClass} ${tone.bgClass}`
                : 'border-border bg-bg/60 hover:border-brand/40',
            )}
          >
            <div
              className={cn(
                'font-medium',
                selected ? tone.textClass : 'text-fg-muted',
              )}
            >
              {d}
            </div>
            <div
              aria-hidden
              className={cn(
                'mt-0.5 text-[8px] leading-none tracking-[1px]',
                selected ? tone.textClass : 'text-border',
              )}
            >
              {tone.intensity}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const DIFFICULTY_TONE: Record<
  Difficulty,
  { borderClass: string; bgClass: string; textClass: string; intensity: string }
> = {
  EASY: {
    borderClass: 'border-difficulty-easy',
    bgClass: 'bg-difficulty-easy-bg',
    textClass: 'text-difficulty-easy',
    intensity: '●●○○○',
  },
  MEDIUM: {
    borderClass: 'border-difficulty-medium',
    bgClass: 'bg-difficulty-medium-bg',
    textClass: 'text-difficulty-medium',
    intensity: '●●●○○',
  },
  HARD: {
    borderClass: 'border-difficulty-hard',
    bgClass: 'bg-difficulty-hard-bg',
    textClass: 'text-difficulty-hard',
    intensity: '●●●●●',
  },
};

function FieldGroup({
  labelText,
  htmlFor,
  children,
}: {
  labelText: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-[10px] font-medium text-fg-muted uppercase tracking-wider mb-1.5 block">
        {labelText}
      </Label>
      {children}
    </div>
  );
}
