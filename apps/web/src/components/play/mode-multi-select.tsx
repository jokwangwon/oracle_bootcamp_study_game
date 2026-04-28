'use client';

import {
  AlignLeft,
  Check,
  CheckCircle,
  Circle,
  FolderTree,
  HelpCircle,
  type LucideIcon,
  Pencil,
  TrendingUp,
} from 'lucide-react';
import { GAME_MODE_LABELS, type GameModeId } from '@oracle-game/shared';

import { cn } from '@/lib/utils';
import type { ModeStat } from '@/lib/play/types';

/**
 * 시안 β §3.1.4 / 시안 ε §3.5.2 — Layer 3 게임 모드 다중 선택.
 *
 * 한 세션 안에서 여러 모드가 섞여 출제. 최소 1개 강제.
 *
 * 시안 ε 시각 풍부화 (PR-9a' 변경):
 *  - 가로 wrap → 세로 list (각 chip 의 메타 정보가 우측에 들어가야 가독성 ↑)
 *  - 각 chip = 4 col 구조: [icon 13px] [라벨 flex-1] [메타 텍스트] [선택 마커]
 *  - lucide 아이콘 매핑 (시안 ε §6.2)
 *  - 메타 텍스트 색 분기 (시안 ε §3.5.2)
 *
 * 다중 선택 로직 / 최소 1개 강제 / `aria-pressed` 는 변경 없음.
 */

type Props = {
  value: GameModeId[];
  onChange: (modes: GameModeId[]) => void;
  availableModes: GameModeId[];
  /** 시안 ε §3.5.2 / §10.6 — 모드별 사용자 통계. 없으면 메타 라인 silent. */
  modeStats?: Record<GameModeId, ModeStat>;
};

export function ModeMultiSelect({ value, onChange, availableModes, modeStats }: Props) {
  const toggle = (mode: GameModeId) => {
    const isSelected = value.includes(mode);
    if (isSelected) {
      if (value.length === 1) return;
      onChange(value.filter((m) => m !== mode));
    } else {
      onChange([...value, mode]);
    }
  };

  return (
    <div role="group" aria-label="게임 모드 선택" className="flex flex-col gap-1.5 mt-2">
      {availableModes.map((mode) => {
        const selected = value.includes(mode);
        const isLastSelected = selected && value.length === 1;
        const stat = modeStats?.[mode];
        const Icon = ModeIcon[mode] ?? HelpCircle;
        return (
          <button
            key={mode}
            type="button"
            role="switch"
            aria-pressed={selected}
            aria-disabled={isLastSelected}
            disabled={isLastSelected}
            onClick={() => toggle(mode)}
            title={isLastSelected ? '최소 1개 모드를 선택하세요' : undefined}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              selected
                ? 'bg-brand/10 border border-brand'
                : 'bg-bg/60 border border-border hover:border-brand/40',
              isLastSelected && 'opacity-80 cursor-not-allowed',
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                'h-[13px] w-[13px] shrink-0',
                selected ? 'text-brand' : 'text-fg-muted',
              )}
            />

            <span
              className={cn(
                'flex-1 text-left',
                selected ? 'text-fg font-medium' : 'text-fg',
              )}
            >
              {GAME_MODE_LABELS[mode]}
            </span>

            {stat && <ModeStatMeta stat={stat} />}

            {selected ? (
              <Check aria-hidden className="h-[11px] w-[11px] text-brand shrink-0" strokeWidth={3} />
            ) : (
              <Circle aria-hidden className="h-[11px] w-[11px] text-fg-muted/40 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ModeStatMeta({ stat }: { stat: ModeStat }) {
  const { estimatedMinutes, accuracyPct } = stat;

  if (accuracyPct === undefined) {
    // 데이터 없는 모드 — 시간만, 더 흐리게 (시안 ε §3.5.2)
    return (
      <span className="text-[10px] text-fg-muted/70 shrink-0">~{estimatedMinutes}분</span>
    );
  }

  // 정답률 < 50% 약점 → text-error (시안 ε §3.5.2)
  const colorClass = accuracyPct < 50 ? 'text-error' : 'text-fg-muted';

  return (
    <span className={cn('text-[10px] shrink-0', colorClass)}>
      ~{estimatedMinutes}분 · 정답률 {accuracyPct}%
    </span>
  );
}

/**
 * 시안 ε §6.2 — 모드별 lucide 아이콘 매핑.
 *
 * 미정 모드는 `<HelpCircle />` fallback (현재 코드베이스의 `scenario` 가 미정 영역).
 */
const ModeIcon: Partial<Record<GameModeId, LucideIcon>> = {
  'blank-typing': Pencil,
  'term-match': AlignLeft,
  'multiple-choice': CheckCircle,
  'result-predict': TrendingUp,
  'category-sort': FolderTree,
};
