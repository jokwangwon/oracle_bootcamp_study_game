'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GAME_MODE_LABELS,
  TOPIC_LABELS,
  type GameModeId,
  type Topic,
} from '@oracle-game/shared';

import { apiClient, type MistakeItem, type MistakesResponse } from '@/lib/api-client';
import { getToken } from '@/lib/auth-storage';

/**
 * 오답 노트 (사용자 Q1~Q3, 2026-04-24).
 *  - Q1=b: 문제당 1 row 집계 (N번 틀림 뱃지)
 *  - Q2=a: SR 뱃지와 분리 — 이 페이지는 answer_history 기반 전체 오답
 *  - Q3=b: 최종 정답이어도 이력 보존 + "정답 처리됨" 뱃지
 *
 * 학습 범위 확장 대응 — 주차/토픽 드롭다운은 summary.byWeek / byTopic 으로 **동적** 생성.
 */

const PAGE_LIMIT = 20;

export default function MistakesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    setAuthChecked(true);
  }, [router]);

  const [topic, setTopic] = useState<Topic | ''>('');
  const [week, setWeek] = useState<number | ''>('');
  const [gameMode, setGameMode] = useState<GameModeId | ''>('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<MistakesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.users.mistakes(token, {
        topic: topic || undefined,
        week: week === '' ? undefined : week,
        gameMode: gameMode || undefined,
        limit: PAGE_LIMIT,
        offset,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token, topic, week, gameMode, offset]);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  // 필터 변경 시 첫 페이지로
  useEffect(() => {
    setOffset(0);
  }, [topic, week, gameMode]);

  // 학습 범위 확장 대응 — 드롭다운 옵션을 summary 에서 동적 생성
  const availableWeeks = useMemo(
    () => data?.summary.byWeek.map((w) => w.week) ?? [],
    [data],
  );
  const availableTopics = useMemo(
    () => data?.summary.byTopic.map((t) => t.topic) ?? [],
    [data],
  );
  const availableGameModes = useMemo(
    () => data?.summary.byGameMode.map((g) => g.gameMode) ?? [],
    [data],
  );

  if (!authChecked) {
    return (
      <Container>
        <p style={{ color: 'var(--fg-muted)' }}>로그인 확인 중...</p>
      </Container>
    );
  }

  return (
    <Container>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>오답 노트</h1>
        {data ? (
          <span style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
            총 <strong style={{ color: 'var(--fg)' }}>{data.total}</strong> 문제 ·
            전체 인벤토리 {data.summary.byWeek.reduce((s, w) => s + w.count, 0)} 건
          </span>
        ) : null}
      </div>

      {/* 차원별 요약 (네비게이션 힌트) */}
      {data && data.summary.byWeek.length > 0 ? (
        <SummaryBar summary={data.summary} onWeekClick={(w) => setWeek(w)} />
      ) : null}

      {/* 필터 */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <FilterSelect
          label="주차"
          value={week === '' ? '' : String(week)}
          onChange={(v) => setWeek(v === '' ? '' : Number.parseInt(v, 10))}
          options={availableWeeks.map((w) => ({ value: String(w), label: `${w}주차` }))}
        />
        <FilterSelect
          label="주제"
          value={topic}
          onChange={(v) => setTopic(v as Topic | '')}
          options={availableTopics.map((t) => ({
            value: t,
            label: TOPIC_LABELS[t] ?? t,
          }))}
        />
        <FilterSelect
          label="게임 모드"
          value={gameMode}
          onChange={(v) => setGameMode(v as GameModeId | '')}
          options={availableGameModes.map((g) => ({
            value: g,
            label: GAME_MODE_LABELS[g] ?? g,
          }))}
        />
      </div>

      {loading && (
        <p style={{ color: 'var(--fg-muted)' }}>불러오는 중...</p>
      )}
      {error && (
        <p style={{ color: 'var(--error)' }}>오류: {error}</p>
      )}

      {!loading && !error && data && data.mistakes.length === 0 && (
        <div
          style={{
            padding: '2rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            textAlign: 'center',
            color: 'var(--fg-muted)',
          }}
        >
          🎉 해당 조건에 오답이 없습니다.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data?.mistakes.map((m) => (
          <MistakeCard key={m.questionId} mistake={m} />
        ))}
      </div>

      {/* 페이지네이션 */}
      {data && (data.total > PAGE_LIMIT || offset > 0) && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'center',
            marginTop: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
            disabled={offset === 0}
            style={pagerBtnStyle(offset === 0)}
          >
            ← 이전
          </button>
          <span style={{ alignSelf: 'center', color: 'var(--fg-muted)' }}>
            {Math.floor(offset / PAGE_LIMIT) + 1}
          </span>
          <button
            type="button"
            onClick={() => setOffset(offset + PAGE_LIMIT)}
            disabled={!data.hasMore}
            style={pagerBtnStyle(!data.hasMore)}
          >
            다음 →
          </button>
        </div>
      )}
    </Container>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '1.5rem',
        color: 'var(--fg)',
      }}
    >
      {children}
    </div>
  );
}

function SummaryBar({
  summary,
  onWeekClick,
}: {
  summary: MistakesResponse['summary'];
  onWeekClick: (week: number | '') => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}
    >
      {summary.byWeek.map((w) => (
        <button
          key={w.week}
          type="button"
          onClick={() => onWeekClick(w.week)}
          style={{
            padding: '0.35rem 0.75rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            color: 'var(--fg)',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          {w.week}주차 <strong>{w.count}</strong>
        </button>
      ))}
    </div>
  );
}

function MistakeCard({ mistake: m }: { mistake: MistakeItem }) {
  const content = m.question.content as {
    type: string;
    sql?: string;
    description?: string;
    stem?: string;
  };
  const stem =
    content.type === 'blank-typing'
      ? content.sql
      : content.type === 'term-match'
        ? content.description
        : content.type === 'multiple-choice'
          ? content.stem
          : JSON.stringify(content, null, 2);

  return (
    <article
      style={{
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-elevated)',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}
      >
        <Badge>{m.question.week}주차</Badge>
        <Badge>{TOPIC_LABELS[m.question.topic] ?? m.question.topic}</Badge>
        <Badge>{GAME_MODE_LABELS[m.question.gameMode] ?? m.question.gameMode}</Badge>
        <Badge>{m.question.difficulty}</Badge>
        <Badge variant="error">{m.wrongCount}번 틀림</Badge>
        {m.currentlyCorrect ? (
          <Badge variant="success">✅ 정답 처리됨</Badge>
        ) : null}
      </header>

      {m.question.scenario ? (
        <p
          style={{
            color: 'var(--fg-muted)',
            fontSize: '0.9rem',
            marginTop: 0,
            marginBottom: '0.5rem',
          }}
        >
          📋 {m.question.scenario}
        </p>
      ) : null}

      <pre
        style={{
          padding: '0.75rem',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'auto',
          fontSize: '0.9rem',
          margin: '0.5rem 0',
        }}
      >
        {stem}
      </pre>

      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
        {m.lastAttempt ? (
          <Row
            label="내 마지막 답"
            value={m.lastAttempt.answer}
            emphasis={m.lastAttempt.isCorrect ? 'success' : 'error'}
          />
        ) : null}
        <Row label="정답" value={m.question.answer.join(' | ')} emphasis="success" />
        {m.question.explanation ? (
          <Row label="해설" value={m.question.explanation} />
        ) : null}
        {m.question.rationale ? (
          <Row label="💡 왜?" value={m.question.rationale} />
        ) : null}
      </div>
    </article>
  );
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: 'error' | 'success';
}) {
  const bg =
    variant === 'error'
      ? 'rgba(239, 68, 68, 0.15)'
      : variant === 'success'
        ? 'rgba(34, 197, 94, 0.15)'
        : 'var(--bg)';
  const color =
    variant === 'error'
      ? '#ef4444'
      : variant === 'success'
        ? '#22c55e'
        : 'var(--fg-muted)';
  return (
    <span
      style={{
        padding: '0.25rem 0.6rem',
        background: bg,
        color,
        border: '1px solid var(--border)',
        borderRadius: 4,
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'error' | 'success';
}) {
  const color =
    emphasis === 'error'
      ? '#ef4444'
      : emphasis === 'success'
        ? '#22c55e'
        : 'var(--fg)';
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.5rem' }}
    >
      <span style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ color, fontSize: '0.9rem', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.85rem',
        color: 'var(--fg-muted)',
      }}
    >
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.35rem 0.5rem',
          background: 'var(--bg-elevated)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: '0.85rem',
        }}
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: disabled ? 'var(--bg)' : 'var(--bg-elevated)',
    color: disabled ? 'var(--fg-muted)' : 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

