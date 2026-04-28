'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Notebook, Sparkles } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  type Difficulty,
  type EvaluationResult,
  type Round,
} from '@oracle-game/shared';
import { apiClient, type FinishSoloResponse } from '@/lib/api-client';
import { getToken } from '@/lib/auth-storage';
import { ReviewBadge } from '@/components/ReviewBadge';
import { ConfigForm } from '@/components/play/config-form';
import { ConfigHero } from '@/components/play/config-hero';
import { TrackSelector } from '@/components/play/track-selector';
import { WeeklyStatsStrip } from '@/components/play/weekly-stats-strip';
import {
  DEFAULT_CONFIG,
  MOCK_LAST_SESSION,
  MOCK_MODE_STATS,
  MOCK_PRACTICE_TRACK_STATS,
  MOCK_RANKED_TRACK_STATS,
  MOCK_RECOMMENDED_PREVIEW,
  MOCK_WEEKLY_STATS,
  PRACTICE_INITIAL_CONFIG,
} from '@/lib/play/mock';
import { Button } from '@/components/ui/button';
import type { SoloConfigSelection, SoloTrack } from '@/lib/play/types';

type Phase = 'config' | 'playing' | 'finished';

/**
 * 시안 ε §3.1 / §3.4.3 mock — 백엔드 endpoint 준비 전 정적 값.
 *
 * 후속 PR 에서 1:1 swap (시안 ε §4.2):
 *  - `MOCK_NICKNAME` → `useUser()` 훅의 `currentUser.nickname`
 *  - `MOCK_CURRENT_BOOTCAMP_DAY` → `userStats.currentDay`
 *  - `MOCK_PLAYED_DAYS` → `userPracticeStats.playedDays`
 *  - `MOCK_CUMULATIVE_ACCURACY_PCT` → `userStats.accuracyPct`
 *  - `MOCK_RECOMMENDED_ACCURACY_PCT` → `recommendedPreview.averageAccuracyPct`
 *  - `MOCK_WEEKLY_XP_DELTA` → `userWeeklyStats.xpDelta`
 *  - `MOCK_DATE_RANGE_LABEL` → 클라이언트 계산 (이번 주 월~일)
 */
const MOCK_NICKNAME = '플레이어';
const MOCK_CURRENT_BOOTCAMP_DAY = 16;
const MOCK_PLAYED_DAYS: Set<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
const MOCK_CUMULATIVE_ACCURACY_PCT = 78;
const MOCK_RECOMMENDED_ACCURACY_PCT = 67;
const MOCK_WEEKLY_XP_DELTA = 120;
const MOCK_DATE_RANGE_LABEL = '4월 22 ~ 28일';

/**
 * Next 14 — `useSearchParams()` 는 prerender 시 Suspense 경계 필수.
 * Inner 컴포넌트를 Suspense 로 감싸 build 시 missing-suspense-with-csr-bailout 회피.
 */
export default function SoloPlayPage() {
  return (
    <Suspense fallback={null}>
      <SoloPlayPageInner />
    </Suspense>
  );
}

function SoloPlayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setLocalToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 마운트 시 토큰 확인 → 없으면 /login으로 즉시 리다이렉트
  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    setLocalToken(t);
    setAuthChecked(true);
  }, [router]);

  const [phase, setPhase] = useState<Phase>('config');
  // 시안 β PR-9a — 단일 config 객체 (트랙 / 주제 / 주차 / 모드 다중 / 난이도)
  const [config, setConfig] = useState<SoloConfigSelection>(() => {
    const trackParam = searchParams?.get('track');
    return trackParam === 'practice' ? PRACTICE_INITIAL_CONFIG : DEFAULT_CONFIG;
  });
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finishResponse, setFinishResponse] = useState<FinishSoloResponse | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [starting, setStarting] = useState(false);

  // 트랙 변경 시 difficulty 자동 보정 (practice → null, ranked → 기존 또는 EASY)
  const handleTrackChange = useCallback((nextTrack: SoloTrack) => {
    setConfig((prev) => {
      if (nextTrack === prev.track) return prev;
      const nextDifficulty: Difficulty | null =
        nextTrack === 'practice' ? null : prev.difficulty ?? 'EASY';
      return { ...prev, track: nextTrack, difficulty: nextDifficulty };
    });
  }, []);

  // 시안 ε §3.1.4 (Session 12 변경) — `overrides` 인자로 호출자가 임시 config 덮어쓰기.
  // `추천으로 시작` / `이어서 학습` CTA 가 setConfig + startGame 을 한 번에 호출.
  // setState 비동기성 회피 — `effective` 로 즉시 시작 + 시각 동기화는 setConfig 별도.
  const startGame = useCallback(
    async (overrides?: Partial<SoloConfigSelection>) => {
      if (!token) return;
      const effective: SoloConfigSelection = overrides ? { ...config, ...overrides } : config;
      const [primaryMode] = effective.modes;
      if (!primaryMode) return;
      setError(null);
      setFinishResponse(null);
      setStarting(true);
      if (overrides) setConfig(effective);
      try {
        // 시안 β §4.2 — 백엔드 변경 전 단계: modes[0] / difficulty ?? 'EASY' 로 변환해
        // 기존 시그니처 호환. 트랙별 라운드 mix / 적응형 난이도는 별도 백엔드 PR.
        const data = await apiClient.solo.start(token, {
          topic: effective.topic,
          week: effective.week,
          gameMode: primaryMode,
          difficulty: effective.difficulty ?? 'EASY',
          rounds: 10,
        });
        setRounds(data);
        setResults([]);
        setCurrentIndex(0);
        setPhase('playing');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setStarting(false);
      }
    },
    [token, config],
  );

  // 'finished' 진입 시 1회 server에 세션 결과 제출
  // (StrictMode로 useEffect가 두 번 실행될 수 있으므로 ref로 1회 제한)
  const finishedSubmittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'finished') return;
    if (results.length === 0) return;
    if (!token) return;

    // 동일 세션에 대해 중복 제출 방지
    const sessionKey = rounds.map((r) => r.id).join(',');
    if (finishedSubmittedRef.current === sessionKey) return;
    finishedSubmittedRef.current = sessionKey;

    const correctCount = results.filter((r) => r.isCorrect).length;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);

    setFinishing(true);
    const [primaryMode] = config.modes;
    if (!primaryMode) return;
    apiClient.solo
      .finish(token, {
        topic: config.topic,
        week: config.week,
        // PR-9a 단계 — 백엔드는 단일 mode 만 받음. 첫 번째 모드를 대표로 전달.
        gameMode: primaryMode,
        totalRounds: results.length,
        correctCount,
        totalScore,
      })
      .then((res) => {
        setFinishResponse(res);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'finish 실패');
      })
      .finally(() => {
        setFinishing(false);
      });
  }, [phase, results, rounds, token, config]);

  // 인증 미확인 시 빈 컨테이너 (리다이렉트 진행 중)
  if (!authChecked) {
    return (
      <Container>
        <p style={{ color: 'var(--fg-muted)' }}>로그인 확인 중...</p>
      </Container>
    );
  }

  if (phase === 'config') {
    const startDisabled =
      starting || config.modes.length === 0 || (config.track === 'ranked' && !config.difficulty);

    return (
      <ConfigContainer>
        {/* 시안 ε §3.1 — Hero anchor (좌: 인사+CTA / 우: 추천 코드 패널) */}
        <ConfigHero
          user={{ nickname: MOCK_NICKNAME, currentDay: MOCK_CURRENT_BOOTCAMP_DAY }}
          weeklyStats={MOCK_WEEKLY_STATS}
          lastSession={MOCK_LAST_SESSION}
          recommendedPreview={MOCK_RECOMMENDED_PREVIEW}
          cumulativeAccuracyPct={MOCK_CUMULATIVE_ACCURACY_PCT}
          recommendedAccuracyPct={MOCK_RECOMMENDED_ACCURACY_PCT}
          weeklyXpDelta={MOCK_WEEKLY_XP_DELTA}
          onRecommendedStart={() => {
            void startGame({ week: MOCK_CURRENT_BOOTCAMP_DAY });
          }}
          onResumeSession={(() => {
            const last = MOCK_LAST_SESSION;
            if (!last) return undefined;
            return () => {
              void startGame({ topic: last.topic, week: last.day });
            };
          })()}
        />

        {/* 시안 ε §3.2 — 본문 섹션 라벨 (페이지의 진짜 main heading. Hero 가 시선 흡수하므로 작게) */}
        <h1 className="text-base sm:text-lg font-medium text-fg mt-6 mb-3 px-1">
          솔로 플레이 설정
        </h1>

        {/* 시안 β §3.1.2 / 시안 ε §3.3 — Layer 1 트랙 선택 (랭킹 도전 / 개인 공부) */}
        <TrackSelector
          value={config.track}
          onChange={handleTrackChange}
          rankedStats={token ? MOCK_RANKED_TRACK_STATS : undefined}
          practiceStats={token ? MOCK_PRACTICE_TRACK_STATS : undefined}
        />

        {/* 시안 ε §3.4 / §3.5 — Split 폼 (좌: 주제+주차 / 우: 모드+난이도) */}
        <ConfigForm
          config={config}
          onConfigChange={setConfig}
          currentBootcampDay={MOCK_CURRENT_BOOTCAMP_DAY}
          playedDays={MOCK_PLAYED_DAYS}
          modeStats={MOCK_MODE_STATS}
        />

        {/* 시안 ε §3.6 — 라이브 통계 strip (신규 사용자는 strip 자체 silent) */}
        <WeeklyStatsStrip stats={MOCK_WEEKLY_STATS} dateRangeLabel={MOCK_DATE_RANGE_LABEL} />

        {/* 시안 ε §3.7 — CTA 그룹 (시작하기 + 최근 오답 + 오늘의 챌린지 + ReviewBadge) */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="button"
            onClick={() => {
              void startGame();
            }}
            disabled={startDisabled}
            className="flex-1 min-w-[140px] bg-brand-gradient text-brand-fg disabled:opacity-50"
          >
            {starting ? '시작 중...' : '시작하기 →'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/review/mistakes')}
          >
            <Notebook className="mr-1 h-3 w-3" aria-hidden />
            최근 오답
          </Button>
          {/* 오늘의 챌린지 — 시안 ε §3.7 / §14: 본 PR 은 placeholder route, 백엔드 미연결 */}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/play/solo?challenge=daily')}
            disabled
            title="오늘의 챌린지 — 다음 PR 에서 백엔드 연결"
          >
            <Sparkles className="mr-1 h-3 w-3" aria-hidden />
            오늘의 챌린지
          </Button>
          {token ? <ReviewBadge token={token} /> : null}
        </div>

        {error && (
          <p role="alert" className="text-sm text-error mt-4">
            {error}
          </p>
        )}
      </ConfigContainer>
    );
  }

  if (phase === 'playing') {
    const current = rounds[currentIndex];
    if (!current) {
      return (
        <Container>
          <p>라운드를 불러오는 중...</p>
        </Container>
      );
    }
    return (
      <RoundPlayer
        round={current}
        token={token ?? ''}
        roundNumber={currentIndex + 1}
        totalRounds={rounds.length}
        onComplete={(result) => {
          setResults((prev) => [...prev, result]);
          if (currentIndex + 1 >= rounds.length) {
            setPhase('finished');
          } else {
            setCurrentIndex(currentIndex + 1);
          }
        }}
      />
    );
  }

  // finished
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const correctCount = results.filter((r) => r.isCorrect).length;
  return (
    <Container>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>게임 종료</h1>
      <p style={{ marginBottom: '0.5rem' }}>
        정답률: {correctCount} / {results.length} (
        {Math.round((correctCount / Math.max(1, results.length)) * 100)}%)
      </p>
      <p style={{ marginBottom: '1.5rem' }}>이번 세션 점수: {totalScore}</p>

      {finishing && (
        <p style={{ color: 'var(--fg-muted)', marginBottom: '1rem' }}>
          진도 반영 중...
        </p>
      )}

      {finishResponse && (
        <section
          style={{
            background: 'var(--bg-elevated)',
            padding: '1.25rem',
            borderRadius: 8,
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>누적 진도</h2>
          <p>총 점수: {finishResponse.progress.totalScore}</p>
          <p>플레이 횟수: {finishResponse.progress.gamesPlayed}</p>
          <p>
            누적 정답률: {Math.round(finishResponse.progress.accuracy * 100)}%
          </p>
          <p>현재 연속 정답: {finishResponse.progress.streak}</p>
        </section>
      )}

      {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}

      <button
        type="button"
        onClick={() => setPhase('config')}
        style={{
          padding: '0.75rem 1.5rem',
          background: 'var(--brand)',
          border: 'none',
          borderRadius: 8,
          color: 'var(--brand-fg)',
          fontWeight: 700,
        }}
      >
        다시 플레이
      </button>
    </Container>
  );
}

function RoundPlayer({
  round,
  token,
  roundNumber,
  totalRounds,
  onComplete,
}: {
  round: Round;
  token: string;
  roundNumber: number;
  totalRounds: number;
  onComplete: (result: EvaluationResult) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EvaluationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setAnswer('');
    setHintsUsed(0);
    setLastResult(null);
    setError(null);
    startedAt.current = Date.now();
  }, [round.id]);

  // 즉시 피드백 후 "다음" 진행 (UX #1, ux-redesign-brief-v1.md §2.1)
  const advance = () => {
    if (!lastResult) return;
    onComplete(lastResult);
  };

  const submit = async () => {
    if (submitting || lastResult) return; // 중복 제출/피드백 중 제출 방지
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiClient.solo.answer(token, {
        roundId: round.id,
        answer,
        submittedAt: Date.now() - startedAt.current,
        hintsUsed,
      });
      setLastResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const content = round.question.content;
  const showingFeedback = lastResult !== null;
  const scenario = round.question.scenario ?? null;
  const rationale = round.question.rationale ?? null;

  return (
    <Container>
      <p style={{ color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
        라운드 {roundNumber} / {totalRounds}
      </p>

      {/*
        UX #2 개정 (2026-04-23 사용자 피드백): `rationale` 에 정답 문법 이름이
        포함돼 있어 풀이 전 노출 시 스포일러. 문제 풀이 단계에는 **scenario 만**,
        rationale 은 제출 후 FeedbackCard 에서 공개.
      */}
      {scenario && <ContextPanel scenario={scenario} />}

      {content.type === 'blank-typing' && (
        <pre
          style={{
            background: 'var(--bg-elevated)',
            padding: '1.25rem',
            borderRadius: 8,
            marginBottom: '1.5rem',
            fontSize: '1rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {content.sql}
        </pre>
      )}

      {content.type === 'term-match' && (
        <p
          style={{
            background: 'var(--bg-elevated)',
            padding: '1.25rem',
            borderRadius: 8,
            marginBottom: '1.5rem',
            fontSize: '1.1rem',
          }}
        >
          {content.description}
        </p>
      )}

      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          if (showingFeedback) advance();
          else submit();
        }}
        placeholder={showingFeedback ? '제출 완료 — Enter 로 다음 라운드' : '정답을 입력하세요'}
        readOnly={showingFeedback}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--fg)',
          opacity: showingFeedback ? 0.6 : 1,
        }}
        autoFocus
      />

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        {!showingFeedback && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'var(--brand)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--brand-fg)',
              fontWeight: 700,
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? '채점 중...' : '제출'}
          </button>
        )}
        {showingFeedback && (
          <button
            type="button"
            onClick={advance}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'var(--brand)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--brand-fg)',
              fontWeight: 700,
            }}
            autoFocus
          >
            {roundNumber >= totalRounds ? '결과 보기' : '다음 라운드 →'}
          </button>
        )}
        {!showingFeedback && hintsUsed < round.hints.length && (
          <button
            type="button"
            onClick={() => setHintsUsed(hintsUsed + 1)}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--fg)',
            }}
          >
            힌트 보기 ({hintsUsed + 1}/{round.hints.length})
          </button>
        )}
      </div>

      {hintsUsed > 0 && (
        <ul
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-elevated)',
            borderRadius: 8,
            listStyle: 'disc inside',
            color: 'var(--fg-muted)',
          }}
        >
          {round.hints.slice(0, hintsUsed).map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      {showingFeedback && (
        <FeedbackCard
          result={lastResult!}
          submittedAnswer={answer}
          rationale={rationale}
        />
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: '1rem' }}>{error}</p>}
    </Container>
  );
}

/**
 * UX #1 즉시 피드백 카드 (ux-redesign-brief-v1.md §2.1).
 * 정/오 + 사용자 답 + 정답 + 해설을 한 번에 표시. 카드 색상으로 정/오 즉시 인지.
 */
function FeedbackCard({
  result,
  submittedAnswer,
  rationale,
}: {
  result: EvaluationResult;
  submittedAnswer: string;
  rationale: string | null;
}) {
  const correct = result.isCorrect;
  const accent = correct ? 'var(--success, #10b981)' : 'var(--error, #ef4444)';
  return (
    <section
      aria-live="polite"
      style={{
        marginTop: '1.25rem',
        padding: '1rem 1.25rem',
        borderRadius: 10,
        border: `1px solid ${accent}`,
        background: 'var(--bg-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          color: accent,
          marginBottom: '0.75rem',
          fontSize: '1.05rem',
        }}
      >
        {correct ? '✓ 정답' : '✕ 오답'}
        <span style={{ color: 'var(--fg-muted)', fontWeight: 400, fontSize: '0.9rem' }}>
          (+{result.score}점)
        </span>
      </div>

      <dl style={{ margin: 0, color: 'var(--fg)', fontSize: '0.95rem' }}>
        <Row label="내 답">{submittedAnswer || <em style={{ color: 'var(--fg-muted)' }}>(빈 답)</em>}</Row>
        <Row label="정답">
          {result.correctAnswer.length === 0
            ? '-'
            : result.correctAnswer.join(' / ')}
        </Row>
        {result.explanation && <Row label="해설">{result.explanation}</Row>}
        {rationale && <Row label="💡 왜?">{rationale}</Row>}
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.4rem' }}>
      <dt
        style={{
          flex: '0 0 3.5rem',
          color: 'var(--fg-muted)',
          fontSize: '0.85rem',
          paddingTop: '0.15rem',
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, flex: 1 }}>{children}</dd>
    </div>
  );
}

/**
 * UX #2 (ux-redesign-brief-v1.md §2.2, 2026-04-23) — 문맥 결여 해소.
 * `scenario` (상황) + `rationale` (왜 이 문법) 을 문제 쿼리/설명 위에 표시.
 * 둘 다 optional — 하나라도 있으면 패널 표시.
 */
function ContextPanel({ scenario }: { scenario: string }) {
  return (
    <section
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--brand)',
        borderRadius: 8,
        padding: '0.9rem 1.1rem',
        marginBottom: '1rem',
        fontSize: '0.95rem',
        lineHeight: 1.55,
      }}
    >
      <ContextRow label="상황" emoji="📋" body={scenario} />
    </section>
  );
}

function ContextRow({
  label,
  emoji,
  body,
}: {
  label: string;
  emoji: string;
  body: string;
}) {
  return (
    <div style={{ marginBottom: '0.45rem' }}>
      <strong
        style={{
          color: 'var(--fg-muted)',
          fontSize: '0.8rem',
          marginRight: '0.4rem',
        }}
      >
        {emoji} {label}
      </strong>
      <span style={{ color: 'var(--fg)' }}>{body}</span>
    </div>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '3rem 1.5rem',
      }}
    >
      {children}
    </main>
  );
}

/**
 * 시안 ε §13.2 — config phase 용 wider 컨테이너 (`max-w-5xl`).
 * Hero anchor + split form 이 720px 에서는 답답함.
 */
function ConfigContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">{children}</main>
  );
}

