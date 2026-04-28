/**
 * 시안 β mock 데이터 (PR-9a~9d 시각 검증용).
 *
 * 백엔드 `track` / `modes[]` / `adaptiveHistory` / `weakAreas` 변경이 별도 트랙으로
 * 진행되는 동안, 프론트만 mock 으로 모든 화면을 단독 검증할 수 있게 한다.
 * 백엔드 준비 후 mock → 실 API 1:1 swap.
 *
 * 본 PR-9a 는 config phase 만 — 라이브 사용자 카운트 (랭킹 타일 LIVE 배지) 정도만
 * 사용. playing/finished mock 은 PR-9b/9c 에서 확장.
 */

import type { Difficulty, GameModeId, Topic } from '@oracle-game/shared';

import type {
  AdaptiveHistoryEntry,
  CodeQuestion,
  LastSessionSummary,
  ModeStat,
  PracticeStats,
  PracticeTrackStats,
  RankedTrackStats,
  SoloConfigSelection,
  WeakArea,
  WeeklyStats,
} from './types';

/**
 * config phase 기본값. 시안 β §3.1.2 — 랭킹 도전 선택 + 빈칸 1개 모드.
 */
export const DEFAULT_CONFIG: SoloConfigSelection = {
  track: 'ranked',
  topic: 'sql-basics',
  week: 1,
  modes: ['blank-typing'],
  difficulty: 'EASY',
};

/**
 * URL 쿼리 ?track=practice 진입 시 초기값.
 */
export const PRACTICE_INITIAL_CONFIG: SoloConfigSelection = {
  track: 'practice',
  topic: 'sql-basics',
  week: 1,
  modes: ['blank-typing'],
  difficulty: null,
};

/**
 * 적응형 난이도 흐름 mock — PR-9c 에서 finished 화면에 사용. 본 PR-9a 미사용.
 */
export const MOCK_ADAPTIVE_HISTORY: AdaptiveHistoryEntry[] = [
  { round: 1, difficulty: 'EASY' },
  { round: 2, difficulty: 'EASY' },
  { round: 3, difficulty: 'MEDIUM' },
  { round: 4, difficulty: 'MEDIUM' },
  { round: 5, difficulty: 'HARD' },
  { round: 6, difficulty: 'MEDIUM' },
  { round: 7, difficulty: 'MEDIUM' },
  { round: 8, difficulty: 'MEDIUM' },
  { round: 9, difficulty: 'HARD' },
  { round: 10, difficulty: 'HARD' },
];

/**
 * 약점 분야 mock — PR-9c finished 화면용. 본 PR-9a 미사용.
 */
export const MOCK_WEAK_AREAS: WeakArea[] = [
  { mode: 'blank-typing', topic: 'sql-basics', accuracyPct: 80 },
  { mode: 'term-match', topic: 'sql-basics', accuracyPct: 60 },
  { mode: 'multiple-choice', topic: 'sql-basics', accuracyPct: 90 },
];

/**
 * 개인 공부 누적 통계 mock — PR-9c 에서 사용.
 */
export const MOCK_PRACTICE_STATS: PracticeStats = {
  practiceSessions: 8,
  practiceQuestions: 80,
  practiceAccuracy: 0.73,
  strongMode: 'multiple-choice',
  weakMode: 'term-match',
};

/**
 * 난이도 후보 — Layer 4 라디오 그룹용.
 */
export const DIFFICULTY_OPTIONS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

/**
 * config phase 에 노출되는 모드 후보. shared 의 GAME_MODE_IDS 6종 중 MVP-A/B 에서
 * 실제 출제 가능한 것만 우선 노출. 캡스톤·시뮬레이션은 MVP-C 후 확장.
 */
export const CONFIG_AVAILABLE_MODES: GameModeId[] = [
  'blank-typing',
  'term-match',
  'multiple-choice',
  'result-predict',
  'category-sort',
];

/**
 * 시안 ε §4.2 / §3.6 — 라이브 통계 strip mock.
 *
 * 백엔드 `GET /api/users/me/weekly-stats` 가 준비되면 1:1 swap. 신규 사용자는 null.
 */
export const MOCK_WEEKLY_STATS: WeeklyStats = {
  solved: 24,
  accuracy: 0.78,
  streak: 8,
  dailyAvg: 3.4,
};

/**
 * 시안 ε §3.3 / §6.1 — Hero 우측 추천 문제 미리보기 mock.
 *
 * 시안 D Day 16 CURSOR 예제와 톤 일치 — 두 페이지 코드 영역이 같은 디자인 시스템임을 보여줌.
 * 백엔드 `GET /api/questions/recommended-preview` swap 시 `code: CodeLine[]` 만 동적 변경,
 * `<CodePreviewPanel>` 호출부는 변경 없음.
 */
export const MOCK_RECOMMENDED_PREVIEW: CodeQuestion = {
  filename: 'day16-cursor.sql',
  modeLabel: '추천 문제 · 빈칸 1개',
  code: [
    [
      { text: 'DECLARE', kind: 'keyword' },
    ],
    [
      { text: '  ' },
      { text: 'CURSOR', kind: 'keyword' },
      { text: ' c_emp ' },
      { text: 'IS', kind: 'keyword' },
    ],
    [
      { text: '    ' },
      { text: 'SELECT', kind: 'keyword' },
      { text: ' empno, ename ' },
      { text: 'FROM', kind: 'keyword' },
      { text: ' emp;' },
    ],
    [
      { text: 'BEGIN', kind: 'keyword' },
    ],
    [
      { text: '  ' },
      { text: 'FOR', kind: 'keyword' },
      { text: ' rec ' },
      { text: 'IN', kind: 'keyword' },
      { text: ' c_emp ' },
      { text: 'LOOP', kind: 'keyword' },
    ],
    [
      { text: '    DBMS_OUTPUT.PUT_LINE(' },
      { text: 'rec.ename', kind: 'highlight' },
      { text: ');' },
    ],
    [
      { text: '  ' },
      { text: 'END LOOP', kind: 'keyword' },
      { text: ';' },
    ],
    [
      { text: 'END', kind: 'keyword' },
      { text: ';' },
    ],
  ],
};

/**
 * 시안 ε §4.2 / §10.6 — 모드 chip 메타 (예상 시간 + 정답률) mock.
 *
 * 백엔드 `GET /api/users/me/mode-stats` swap 대상. 신규 사용자는 `accuracyPct` 미포함
 * (시간만 노출 — 시안 ε §4.4 신규 사용자 분기).
 */
export const MOCK_MODE_STATS: Record<GameModeId, ModeStat> = {
  'blank-typing': { estimatedMinutes: 8, accuracyPct: 78 },
  'term-match': { estimatedMinutes: 5, accuracyPct: 65 },
  'multiple-choice': { estimatedMinutes: 6, accuracyPct: 82 },
  'result-predict': { estimatedMinutes: 7, accuracyPct: 71 },
  'category-sort': { estimatedMinutes: 6, accuracyPct: 60 },
  scenario: { estimatedMinutes: 12, accuracyPct: 55 },
};

/**
 * 시안 ε §4.2 / §10.1 — Hero `이어서 학습` CTA tooltip mock. 첫 진입 사용자는 null.
 */
export const MOCK_LAST_SESSION: LastSessionSummary | null = {
  topic: 'sql-basics',
  day: 5,
  lastPlayedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * 시안 ε §3.2 / §10.5 — 트랙 타일 stats row mock.
 *
 * 두 트랙이 다른 stat 라인 노출. ranked 의 liveUserCount 는 기존 PR-9a 의 단일
 * `liveUserCount` prop 을 흡수.
 */
export const MOCK_RANKED_TRACK_STATS: RankedTrackStats = {
  liveUserCount: 12,
  myRank: 23,
};

export const MOCK_PRACTICE_TRACK_STATS: PracticeTrackStats = {
  studyDays: 14,
  weakMode: 'term-match',
};

