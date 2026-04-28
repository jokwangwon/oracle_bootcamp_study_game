'use client';

import { Check } from 'lucide-react';
import { GAME_MODE_LABELS, type GameModeId } from '@oracle-game/shared';

import { cn } from '@/lib/utils';

/**
 * 시안 β §3.1.4 — Layer 3 게임 모드 다중 선택 (옵션 1 핵심 변경).
 *
 * 한 세션 안에서 여러 모드 (예: 빈칸 4 + 용어 3 + MC 3) 가 섞여 출제된다.
 * 최소 1개 강제 — 모두 해제하려고 하면 마지막 1개 토글 비활성.
 *
 * 색 + 좌측 체크 아이콘 + `aria-pressed` 3중 인코딩 (WCAG 1.4.1).
 */

type Props = {
  value: GameModeId[];
  onChange: (modes: GameModeId[]) => void;
  availableModes: GameModeId[];
};

export function ModeMultiSelect({ value, onChange, availableModes }: Props) {
  const toggle = (mode: GameModeId) => {
    const isSelected = value.includes(mode);
    if (isSelected) {
      // 마지막 1개는 해제 불가
      if (value.length === 1) return;
      onChange(value.filter((m) => m !== mode));
    } else {
      onChange([...value, mode]);
    }
  };

  return (
    <div role="group" aria-label="게임 모드 선택" className="flex flex-wrap gap-2 mt-3">
      {availableModes.map((mode) => {
        const selected = value.includes(mode);
        const isLastSelected = selected && value.length === 1;
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
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              selected
                ? 'border border-brand bg-brand/10 text-brand font-medium'
                : 'border border-border bg-bg text-fg hover:border-brand/40',
              isLastSelected && 'opacity-80 cursor-not-allowed',
            )}
          >
            {selected && <Check aria-hidden className="size-3" strokeWidth={3} />}
            {GAME_MODE_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
