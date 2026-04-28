import type { WeeklyStats } from '@/lib/play/types';

/**
 * 시안 ε §3.6 / §10.3 — 라이브 통계 strip.
 *
 * Hero anchor 와 폼 사이에 위치. 4 metric 그리드 (풀이 / 정답률 / 연속 / 일평균).
 *
 * 데이터 없음 (신규 사용자) 분기:
 *  - `stats === null` 이면 strip 자체를 silent (렌더 안 함)
 *
 * 모바일 (`< sm`): `grid-cols-2` 2x2 + 각 metric 의 라벨/값 세로 배치 (이미 디폴트).
 *
 * 명세: docs/rationale/solo-play-config-redesign-concept-epsilon.md §3.6 / §10.3.
 */

type Props = {
  stats: WeeklyStats | null;
  /** 헤더 우측 기간 라벨 — 예: `4월 22 ~ 28일`. 미제공 시 `이번 주`. */
  dateRangeLabel?: string;
};

export function WeeklyStatsStrip({ stats, dateRangeLabel }: Props) {
  if (!stats) return null;

  const accuracyPctRounded = Math.round(stats.accuracy * 100);

  return (
    <section
      aria-label="이번 주 학습 통계"
      className="rounded-xl bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 px-4 py-3 mb-3"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-medium text-fg m-0">이번 주 학습 통계</h3>
        <span className="text-[10px] text-fg-muted">{dateRangeLabel ?? '이번 주'}</span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="풀이" value={String(stats.solved)} />
        <Metric
          label="정답률"
          value={String(accuracyPctRounded)}
          unit={<span className="text-[10px] text-fg-muted">%</span>}
        />
        <Metric
          label="연속"
          value={String(stats.streak)}
          unit={
            <span aria-hidden className="text-[10px] text-amber-500 dark:text-amber-400">
              ●
            </span>
          }
        />
        <Metric label="일평균" value={stats.dailyAvg.toFixed(1)} />
      </dl>
    </section>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] text-fg-muted mb-0.5">{label}</dt>
      <dd className="m-0 inline-flex items-baseline gap-0.5 text-base sm:text-lg font-medium text-fg tabular-nums">
        {value}
        {unit}
      </dd>
    </div>
  );
}
