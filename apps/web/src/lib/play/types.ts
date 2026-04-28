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
