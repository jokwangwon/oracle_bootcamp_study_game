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

import type { AdaptiveHistoryEntry, PracticeStats, SoloConfigSelection, WeakArea } from './types';

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
 * 시안 β §3.1.2 — 랭킹 도전 타일의 라이브 동기 카운트.
 *
 * 본 PR-9a 는 mock 고정. 백엔드 `/api/users/active` 같은 endpoint 가 별도 트랙으로
 * 추가되면 1:1 swap.
 */
export function getMockLiveUserCount(): number {
  return 12;
}

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

