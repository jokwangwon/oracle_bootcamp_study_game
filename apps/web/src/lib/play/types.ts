/**
 * 시안 β (Flow Glass) — 솔로 플레이 ViewModel.
 *
 * 명세: `docs/rationale/play-and-mistakes-redesign-concept-beta.md`
 *  - §0: 적용 범위
 *  - §4.1: 데이터 contract — 두 트랙 (랭킹 도전 / 개인 공부)
 *  - §4.2: 신규 / 변경 필드
 *
 * 본 PR-9a 는 config phase 만 도입. playing/finished 추가 필드 (adaptiveHistory /
 * weakAreas / practiceStats) 는 PR-9b/9c 에서 확장.
 */

import type { Difficulty, GameModeId, Topic } from '@oracle-game/shared';

import type { CodeLine } from '@/lib/code/types';

/**
 * 솔로 플레이 트랙. 시안 β §0 신규 결정.
 *
 * - `ranked`: 기존 흐름. 고정 난이도, 점수 랭킹 반영.
 * - `practice`: 신규. 적응형 난이도, 점수 랭킹 비반영, 약점 분석.
 */
export type SoloTrack = 'ranked' | 'practice';

/**
 * config phase 사용자 선택 상태.
 *
 * 시안 β §3.1 영역별 스펙:
 *  - `track` — Layer 1 트랙 타일
 *  - `topic` / `week` — Layer 2 기본 옵션
 *  - `modes` — Layer 3 다중 선택 (옵션 1, 최소 1개 강제)
 *  - `difficulty` — Layer 4. ranked 면 EASY/MEDIUM/HARD 중 하나, practice 면 null
 *    (백엔드가 적응형으로 결정).
 */
export interface SoloConfigSelection {
  track: SoloTrack;
  topic: Topic;
  week: number;
  modes: GameModeId[];
  difficulty: Difficulty | null;
}

/**
 * SoloStartRequest — apiClient.solo.start 의 신규 시그니처 (시안 β §4.2).
 *
 * 본 PR-9a 단계는 mock 으로 검증 — 백엔드는 별도 트랙으로 진행, mock 단계에서
 * 클라이언트만 보내면 백엔드는 무시 가능 (역호환).
 */
export interface SoloStartRequest {
  track: SoloTrack;
  topic: Topic;
  week: number;
  modes: GameModeId[];
  difficulty: Difficulty | null;
  rounds: number;
}

/**
 * 적응형 난이도 흐름 1행 — 라운드별 난이도 기록. PR-9b/9c 에서 사용.
 */
export interface AdaptiveHistoryEntry {
  round: number;
  difficulty: Difficulty;
}

/**
 * 약점 분야 분석 1행 — 모드별 정답률. PR-9c 에서 사용.
 */
export interface WeakArea {
  mode: GameModeId;
  topic: Topic;
  accuracyPct: number;
}

/**
 * 개인 공부 누적 통계 — 랭킹 통계와 분리. PR-9c 에서 사용.
 */
export interface PracticeStats {
  practiceSessions: number;
  practiceQuestions: number;
  practiceAccuracy: number;
  strongMode: GameModeId | null;
  weakMode: GameModeId | null;
}

/**
 * 시안 ε §3.6 / §10.3 — 라이브 통계 strip 4-metric.
 *
 * 백엔드 `GET /api/users/me/weekly-stats` 응답 shape (시안 ε §4.2).
 * mock 단계는 `MOCK_WEEKLY_STATS` 사용. 신규 사용자는 null.
 */
export interface WeeklyStats {
  /** 이번 주 풀이 문항 수 */
  solved: number;
  /** 정답률 0~1 */
  accuracy: number;
  /** 연속 풀이 일수 */
  streak: number;
  /** 일평균 문항 수 */
  dailyAvg: number;
}

/**
 * 시안 ε §10.6 / §6.2 — 모드 chip 메타.
 *
 * 백엔드 `GET /api/users/me/mode-stats` 응답 shape (시안 ε §4.2).
 * 데이터 없는 사용자는 `accuracyPct` 누락 — 시간만 노출.
 */
export interface ModeStat {
  /** 예상 풀이 시간 (분) */
  estimatedMinutes: number;
  /** 사용자의 모드별 정답률 0~100 (선택) */
  accuracyPct?: number;
}

/**
 * 시안 ε §10.1 — Hero `이어서 학습` CTA tooltip.
 *
 * 백엔드 `GET /api/users/me/last-session` 응답 shape. 첫 진입 사용자는 null.
 */
export interface LastSessionSummary {
  topic: Topic;
  /** 부트캠프 day 1~20 */
  day: number;
  /** ISO 8601 — 클라이언트가 "n일 전" 변환 */
  lastPlayedAt: string;
}

/**
 * 시안 ε §3.3 / §10.2 — Hero 우측 코드 패널 데이터.
 *
 * 시안 D `TodayQuestion` 과 동일한 shape — `<CodePreviewPanel>` 이 두 페이지에서
 * 같은 라인 모델을 받는다. PR-9a' 에서는 정적 mock, 후속 PR 에서 endpoint
 * (`GET /api/questions/recommended-preview`) 로 동적 갱신.
 */
export interface CodeQuestion {
  filename: string;
  modeLabel: string;
  code: CodeLine[];
}

/**
 * 시안 ε §3.2 / §10.5 — 트랙 타일 stats row.
 *
 * 두 트랙이 다른 stat 라인 노출:
 *  - ranked: 동기 풀이중 인원, 사용자 랭킹 (있으면)
 *  - practice: 누적 학습 일수, 약점 모드 (있으면)
 */
export interface RankedTrackStats {
  /** 현재 풀이 중인 동기 인원 */
  liveUserCount?: number;
  /** 사용자 랭킹 (예: 23) */
  myRank?: number;
}

export interface PracticeTrackStats {
  /** 누적 학습 일수 */
  studyDays?: number;
  /** 약점 모드 */
  weakMode?: GameModeId;
}
