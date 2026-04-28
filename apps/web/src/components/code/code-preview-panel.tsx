import type { ReactNode } from 'react';

import type { CodeLine, CodeSegment } from '@/lib/code/types';

/**
 * 시안 ε §10.2 — 코드 미리보기 글라스 패널.
 *
 * 시안 D `<HeroLivePanel>` 의 코드 영역 (Layer 1 탭바 + Layer 2 본문) 을 추출.
 * `/play/solo` config Hero 와 메인 Hero 가 같은 디자인 시스템을 공유하도록 단일 컴포넌트.
 *
 * 3-layer 구조:
 *  - Layer 1: 다크 탭바 (filename + topLabel)
 *  - Layer 2: 다크 코드 본문 (라인 넘버 + syntax 매핑)
 *  - Layer 3: 라이트 메타 (bottomLeftLabel + bottomRightLabel) — 또는 `bottomSlot` 으로 대체
 *
 * `bottomSlot` 은 시안 ε §10.2 spec 외 확장 — 메인 Hero 의 라이브 ticker 처럼
 * 라벨 두 개로 표현 안 되는 풍부한 Layer 3 컨텐츠를 받기 위해 추가. 제공 시
 * `bottomLeftLabel`/`bottomRightLabel` 보다 우선.
 *
 * 신택스 매핑은 `lib/code/types.ts` 의 `CodeSegmentKind` 와 1:1 — 시안 D §6.
 */

type Props = {
  code: CodeLine[];
  /** Layer 1 좌측 — 예: `recommended.sql` */
  filename: string;
  /** Layer 1 우측 — 예: `추천 문제 · 빈칸 1개` */
  topLabel: string;
  /** Layer 3 좌측 — 예: `DAY 16 추천 문제` */
  bottomLeftLabel?: string;
  /** Layer 3 우측 — 예: `평균 정답률 67%` */
  bottomRightLabel?: string;
  /** Layer 3 슬롯 — bottomLeft/Right 보다 우선. 메인 Hero ticker 등 풍부한 콘텐츠용. */
  bottomSlot?: ReactNode;
  /** `<pre aria-label>` — 스크린리더용 (시안 ε §7.3). default: `코드 미리보기`. */
  ariaLabel?: string;
};

export function CodePreviewPanel({
  code,
  filename,
  topLabel,
  bottomLeftLabel,
  bottomRightLabel,
  bottomSlot,
  ariaLabel = '코드 미리보기',
}: Props) {
  const showBottom = bottomSlot !== undefined || bottomLeftLabel !== undefined || bottomRightLabel !== undefined;

  return (
    <div
      className={
        'relative isolate overflow-hidden rounded-2xl ' +
        'border border-white/15 bg-bg-elevated/55 backdrop-blur-2xl ' +
        'shadow-[0_24px_70px_-20px_rgba(2,132,199,0.35)] ' +
        'ring-1 ring-inset ring-white/10 ' +
        'dark:border-white/10 dark:bg-bg-elevated/35 ' +
        'dark:shadow-[0_24px_80px_-20px_rgba(56,189,248,0.28)] ' +
        'dark:ring-white/[0.07]'
      }
    >
      {/* 상단 광택 highlight — 패널 가장자리 미세 빛 (1px) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/25"
      />

      {/* Layer 1 — 다크 탭바 */}
      <div className="flex items-center justify-between border-b border-white/5 bg-code-tab/75 px-3 py-1.5 font-mono text-[11px] text-slate-300 backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-brand">●</span>
          {filename}
        </span>
        <span className="text-slate-500">{topLabel}</span>
      </div>

      {/* Layer 2 — 다크 코드 */}
      <pre aria-label={ariaLabel} className="grid grid-cols-[28px_1fr] bg-code/95">
        <div
          aria-hidden
          className="select-none border-r border-slate-800/70 px-2 py-2.5 text-right font-mono text-[12px] leading-7 text-slate-600"
        >
          {code.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <code className="px-3 py-2.5 font-mono text-[12px] leading-7 text-slate-200">
          {code.map((line, i) => (
            <div key={i}>
              {line.length === 0 ? (
                <>&nbsp;</>
              ) : (
                line.map((seg, j) => <CodeSegmentSpan key={j} seg={seg} />)
              )}
            </div>
          ))}
        </code>
      </pre>

      {/* Layer 3 — 라이트 메타 */}
      {showBottom && (
        <div className="flex items-center gap-3 border-t border-white/10 bg-white/30 px-3 py-2.5 text-xs text-fg-muted backdrop-blur-xl dark:border-white/5 dark:bg-white/[0.04]">
          {bottomSlot ?? (
            <>
              {bottomLeftLabel && <span>{bottomLeftLabel}</span>}
              {bottomRightLabel && (
                <span className="ml-auto">{bottomRightLabel}</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CodeSegmentSpan({ seg }: { seg: CodeSegment }) {
  const className = segmentClass(seg.kind);
  if (className) return <span className={className}>{seg.text}</span>;
  return <>{seg.text}</>;
}

function segmentClass(kind: CodeSegment['kind']): string {
  switch (kind) {
    case 'keyword':
      return 'text-purple-400';
    case 'fn':
      return 'text-sky-400';
    case 'highlight':
      return 'rounded-sm bg-syntax-blank px-1 text-syntax-blank-fg';
    case 'plain':
    case undefined:
    default:
      return '';
  }
}
