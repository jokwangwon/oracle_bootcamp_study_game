'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GAME_MODE_LABELS,
  TOPIC_LABELS,
  type GameModeId,
  type Topic,
} from '@oracle-game/shared';

import {
  apiClient,
  type MistakeItem,
  type MistakeSortOption,
  type MistakeStatus,
  type MistakesResponse,
} from '@/lib/api-client';
import { getToken } from '@/lib/auth-storage';

/**
 * 오답 노트 v2 (블로그 사이드바 스타일, 2026-04-24 저녁).
 *
 *  - 좌측 고정 사이드바: 🔍 검색 + 📚 주제 + 📅 주차 + 🎮 모드 + 🚨 상태
 *    각 항목에 카운트 뱃지 (summary 기반 — 학습 범위 확장 자동 대응).
 *  - 우측: 정렬 dropdown + 필터 칩 + 카드 리스트 + 페이지네이션.
 *  - Q8=a desktop-first; <1024px 에서 사이드바는 상단 스택.
 */

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

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

  // 필터 상태
  const [topic, setTopic] = useState<Topic | ''>('');
  const [week, setWeek] = useState<number | ''>('');
  const [gameMode, setGameMode] = useState<GameModeId | ''>('');
  const [status, setStatus] = useState<MistakeStatus>('all');
  const [sort, setSort] = useState<MistakeSortOption>('recent');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  // 검색 debounce
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

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
        status: status === 'all' ? undefined : status,
        sort,
        search: search.trim() || undefined,
        limit: PAGE_LIMIT,
        offset,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token, topic, week, gameMode, status, sort, search, offset]);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  // 필터 변경 시 첫 페이지로
  useEffect(() => {
    setOffset(0);
  }, [topic, week, gameMode, status, sort, search]);

  const resetFilters = useCallback(() => {
    setTopic('');
    setWeek('');
    setGameMode('');
    setStatus('all');
    setSort('recent');
    setSearchInput('');
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (topic) c++;
    if (week !== '') c++;
    if (gameMode) c++;
    if (status !== 'all') c++;
    if (search.trim()) c++;
    return c;
  }, [topic, week, gameMode, status, search]);

  if (!authChecked) {
    return (
      <div style={{ padding: '1.5rem', color: 'var(--fg-muted)' }}>
        로그인 확인 중...
      </div>
    );
  }

  return (
    <div data-mistakes-grid style={pageGridStyle}>
      {/* 좌측 사이드바 */}
      <aside data-mistakes-sidebar style={sidebarStyle}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--fg-muted)',
              marginBottom: '0.35rem',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            🔍 검색
          </label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="문제/해설/정답..."
            style={searchInputStyle}
          />
        </div>

        <SidebarSection
          label="🚨 상태"
          items={[
            { key: 'all', label: '전체', count: data?.total ?? 0 },
            {
              key: 'unresolved',
              label: '미해결',
              count: data?.summary.byStatus.unresolved ?? 0,
            },
            {
              key: 'resolved',
              label: '정답 처리됨',
              count: data?.summary.byStatus.resolved ?? 0,
            },
          ]}
          activeKey={status}
          onSelect={(k) => setStatus(k as MistakeStatus)}
        />

        <SidebarSection
          label="📅 주차"
          items={[
            { key: '', label: '전체', count: totalFromSummary(data?.summary.byWeek) },
            ...(data?.summary.byWeek.map((w) => ({
              key: String(w.week),
              label: `${w.week}주차`,
              count: w.count,
            })) ?? []),
          ]}
          activeKey={week === '' ? '' : String(week)}
          onSelect={(k) => setWeek(k === '' ? '' : Number.parseInt(k, 10))}
        />

        <SidebarSection
          label="📚 주제"
          items={[
            { key: '', label: '전체', count: totalFromSummary(data?.summary.byTopic) },
            ...(data?.summary.byTopic.map((t) => ({
              key: t.topic,
              label: TOPIC_LABELS[t.topic] ?? t.topic,
              count: t.count,
            })) ?? []),
          ]}
          activeKey={topic}
          onSelect={(k) => setTopic(k as Topic | '')}
        />

        <SidebarSection
          label="🎮 게임 모드"
          items={[
            { key: '', label: '전체', count: totalFromSummary(data?.summary.byGameMode) },
            ...(data?.summary.byGameMode.map((g) => ({
              key: g.gameMode,
              label: GAME_MODE_LABELS[g.gameMode] ?? g.gameMode,
              count: g.count,
            })) ?? []),
          ]}
          activeKey={gameMode}
          onSelect={(k) => setGameMode(k as GameModeId | '')}
        />

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            style={resetButtonStyle}
          >
            필터 초기화 ({activeFilterCount})
          </button>
        )}
      </aside>

      {/* 우측 메인 */}
      <main style={mainStyle}>
        <header style={mainHeaderStyle}>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>오답 노트</h1>
            {data ? (
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                {data.total} 문제{' '}
                {activeFilterCount > 0 ? (
                  <span style={{ color: 'var(--accent)' }}>(필터 적용됨)</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <SortDropdown value={sort} onChange={setSort} />
        </header>

        {/* 활성 필터 칩 */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {topic && <Chip onRemove={() => setTopic('')}>{TOPIC_LABELS[topic] ?? topic}</Chip>}
            {week !== '' && <Chip onRemove={() => setWeek('')}>{week}주차</Chip>}
            {gameMode && <Chip onRemove={() => setGameMode('')}>{GAME_MODE_LABELS[gameMode] ?? gameMode}</Chip>}
            {status !== 'all' && (
              <Chip onRemove={() => setStatus('all')}>
                {status === 'unresolved' ? '미해결' : '정답 처리됨'}
              </Chip>
            )}
            {search.trim() && (
              <Chip onRemove={() => setSearchInput('')}>검색: {search.trim()}</Chip>
            )}
          </div>
        )}

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

        {data && (data.hasMore || offset > 0) && (
          <div style={pagerStyle}>
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
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function totalFromSummary(
  items: Array<{ count: number }> | undefined,
): number {
  return items?.reduce((s, i) => s + i.count, 0) ?? 0;
}

function SidebarSection({
  label,
  items,
  activeKey,
  onSelect,
}: {
  label: string;
  items: Array<{ key: string; label: string; count: number }>;
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--fg-muted)',
          fontWeight: 600,
          letterSpacing: 0.5,
          marginBottom: '0.35rem',
        }}
      >
        {label}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key || 'all'}>
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                style={sidebarItemStyle(active)}
              >
                <span>{item.label}</span>
                <span style={{ color: active ? 'var(--accent-fg)' : 'var(--fg-muted)', fontSize: '0.75rem' }}>
                  {item.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: MistakeSortOption;
  onChange: (v: MistakeSortOption) => void;
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
      정렬
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MistakeSortOption)}
        style={selectStyle}
      >
        <option value="recent">최근 답변순</option>
        <option value="wrongCount">자주 틀린 순</option>
        <option value="week">주차순</option>
        <option value="topic">주제순</option>
      </select>
    </label>
  );
}

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.6rem',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        color: 'var(--fg)',
        fontSize: '0.75rem',
        cursor: 'pointer',
      }}
    >
      {children}
      <span style={{ color: 'var(--fg-muted)' }}>×</span>
    </button>
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
          gap: '0.4rem',
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
            fontSize: '0.88rem',
            marginTop: 0,
            marginBottom: '0.5rem',
          }}
        >
          📋 {m.question.scenario}
        </p>
      ) : null}

      <pre style={preStyle}>{stem}</pre>

      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
        {m.lastAttempt ? (
          <Row
            label="내 마지막 답"
            value={m.lastAttempt.answer}
            emphasis={m.lastAttempt.isCorrect ? 'success' : 'error'}
          />
        ) : null}
        <Row label="정답" value={m.question.answer.join(' | ')} emphasis="success" />
        {m.question.explanation ? <Row label="해설" value={m.question.explanation} /> : null}
        {m.question.rationale ? <Row label="💡 왜?" value={m.question.rationale} /> : null}
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
        padding: '0.22rem 0.55rem',
        background: bg,
        color,
        border: '1px solid var(--border)',
        borderRadius: 4,
        fontSize: '0.72rem',
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
    emphasis === 'error' ? '#ef4444' : emphasis === 'success' ? '#22c55e' : 'var(--fg)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.5rem' }}>
      <span style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{ color, fontSize: '0.88rem', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles

const pageGridStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '1.5rem',
  display: 'grid',
  gridTemplateColumns: '240px 1fr',
  gap: '1.5rem',
  color: 'var(--fg)',
  alignItems: 'start',
};

const sidebarStyle: React.CSSProperties = {
  position: 'sticky',
  top: '1rem',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-elevated)',
  maxHeight: 'calc(100vh - 2rem)',
  overflowY: 'auto',
};

const mainStyle: React.CSSProperties = {
  minWidth: 0, // 중요: grid 자식이 overflow 하지 않도록
};

const mainHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  marginBottom: '1rem',
  gap: '1rem',
  flexWrap: 'wrap',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  background: 'var(--bg)',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.85rem',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem',
  background: 'var(--bg-elevated)',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: '0.85rem',
};

function sidebarItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '0.35rem 0.5rem',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--accent-fg)' : 'var(--fg)',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.82rem',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: 2,
  };
}

const resetButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  marginTop: '0.5rem',
  background: 'transparent',
  color: 'var(--fg-muted)',
  border: '1px dashed var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const preStyle: React.CSSProperties = {
  padding: '0.75rem',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  overflow: 'auto',
  fontSize: '0.85rem',
  margin: '0.5rem 0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const pagerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'center',
  marginTop: '1.5rem',
};

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
