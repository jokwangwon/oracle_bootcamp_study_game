'use client';

import { Sparkles } from 'lucide-react';
import { CURRICULUM_TOPICS, TOPIC_LABELS, type Difficulty, type GameModeId, type Topic } from '@oracle-game/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONFIG_AVAILABLE_MODES, DIFFICULTY_OPTIONS } from '@/lib/play/mock';
import type { SoloConfigSelection } from '@/lib/play/types';
import { cn } from '@/lib/utils';

import { ModeMultiSelect } from './mode-multi-select';

/**
 * 시안 β §3.1.3 ~ §3.1.6 — Layer 2/3/4 + CTA 그룹.
 *
 * Layer 1 (TrackSelector) 는 상위가 렌더하고 본 폼은 그 결과로 분기.
 *
 * 구조:
 *  - 글라스 카드 한 개 안에:
 *    - Layer 2: 주제 (native select) + 주차 (number input)
 *    - Layer 3: 모드 다중 선택 (옵션 1)
 *    - Layer 4: 난이도 (트랙별 분기 — ranked: 라디오 chip / practice: AUTO 안내)
 *  - 별도 row: CTA (시작하기 + 보조 2개)
 */

type Props = {
  config: SoloConfigSelection;
  onConfigChange: (next: SoloConfigSelection) => void;
  onStart: () => void;
  onRecommendWeek?: () => void;
  onJumpToMistakes?: () => void;
  starting?: boolean;
};

export function ConfigForm({
  config,
  onConfigChange,
  onStart,
  onRecommendWeek,
  onJumpToMistakes,
  starting,
}: Props) {
  const isPractice = config.track === 'practice';
  const startDisabled = starting || config.modes.length === 0 || (config.track === 'ranked' && !config.difficulty);

  const update = <K extends keyof SoloConfigSelection>(key: K, value: SoloConfigSelection[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <>
      <div className="rounded-xl bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 p-5 mb-4 space-y-5">
        {/* Layer 2 — 주제 / 주차 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <FieldGroup labelText="주차" htmlFor="cfg-week">
            <Input
              id="cfg-week"
              type="number"
              min={1}
              max={20}
              value={config.week}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                update('week', Number.isNaN(n) ? 1 : Math.max(1, Math.min(20, n)));
              }}
            />
          </FieldGroup>
        </div>

        {/* Layer 3 — 모드 다중 선택 */}
        <div>
          <div className="flex items-baseline gap-2">
            <Label className="text-xs font-medium text-fg-muted uppercase tracking-wider">게임 모드</Label>
            <span className="text-[11px] text-fg-muted">2개 이상 선택하면 라운드에서 섞여 출제됩니다</span>
          </div>
          <ModeMultiSelect
            value={config.modes}
            onChange={(modes: GameModeId[]) => update('modes', modes)}
            availableModes={CONFIG_AVAILABLE_MODES}
          />
        </div>

        {/* Layer 4 — 난이도 (트랙별 분기) */}
        <div>
          <Label className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2 block">
            난이도
          </Label>
          {isPractice ? (
            <div className="bg-bg-elevated border border-border rounded-md px-3 py-2 text-xs text-fg-muted flex items-start gap-2">
              <Sparkles className="size-3.5 mt-0.5 text-purple-600 dark:text-purple-400" aria-hidden />
              <span>
                난이도는 자동으로 조정됩니다 — 정답률에 따라 EASY ↔ MEDIUM ↔ HARD 사이를 오갑니다.
              </span>
            </div>
          ) : (
            <div role="radiogroup" aria-label="난이도 선택" className="flex gap-2">
              {DIFFICULTY_OPTIONS.map((d) => {
                const selected = config.difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update('difficulty', d)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                      selected
                        ? 'border border-brand bg-brand/10 text-brand font-medium'
                        : 'border border-border bg-bg text-fg hover:border-brand/40',
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CTA 그룹 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          onClick={onStart}
          disabled={startDisabled}
          className="bg-brand-gradient text-brand-fg disabled:opacity-50 sm:flex-1"
        >
          {starting ? '시작 중...' : '시작하기 →'}
        </Button>

        {onRecommendWeek && (
          <Button type="button" variant="outline" onClick={onRecommendWeek}>
            오늘의 추천 주차
          </Button>
        )}

        {onJumpToMistakes && (
          <Button type="button" variant="outline" onClick={onJumpToMistakes}>
            최근 오답 다시 보기
          </Button>
        )}
      </div>
    </>
  );
}

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
      <Label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5 block">
        {labelText}
      </Label>
      {children}
    </div>
  );
}
