import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';
import type { EvalDatasetEntry } from './gold-set-a';

/**
 * Gold Set MC — 객관식 평가셋 (ADR-012 §구현 범위 7 + consensus-004 Agent C).
 *
 * 평가 정의:
 *   - `gameMode='multiple-choice'` 전용 트랙.
 *   - build-eval-prompt가 `multiple-choice` 분기로 MC 프롬프트 + 출력 스키마를
 *     사용하도록 한다. 평가 지시: **정답 옵션 text에 seedFocusKeyword 포함 강제**.
 *   - assertion: json-parse / zod-schema / scope-whitelist / latency / sanitization
 *     / korean-features / **mc-option-consistency** 적용. blank-consistency는
 *     자동 skip(gameMode !== 'blank-typing').
 *
 * 분포 (MVP-A):
 *   - 15 entries 초안 (EASY 5 / MEDIUM 7 / HARD 3)
 *   - 남은 15건은 후속 세션에서 확대 (ADR-012 §구현 범위 7 목표 = 30건)
 *
 * seedFocusKeyword 선정 원칙:
 *   - WEEK1_SQL_BASICS_SCOPE 화이트리스트 안에서만 선택
 *   - 정답(correct option)에 자연스럽게 들어가는 고정 키워드
 *   - 주차 내 균등 커버: DML 기본 / 정렬 / 집계 / NULL / 집합연산까지 분포
 *
 * **TODO (후속)**:
 *   - 나머지 15건 확장 (gold-mc-16 ~ gold-mc-30)
 *   - distractor 품질 assertion(mc-distractor-plausibility) 도입 시 각 entry에
 *     명시적 오답 유형(close-but-wrong / unrelated / partial) 메타 추가 검토
 */

const KEYWORDS = WEEK1_SQL_BASICS_SCOPE.keywords;

export const goldSetMc: readonly EvalDatasetEntry[] = Object.freeze([
  // --- EASY 5 — DML 기본 키워드 식별 ---
  {
    id: 'gold-mc-01',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'EASY',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'SELECT',
    },
  },
  {
    id: 'gold-mc-02',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'EASY',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'FROM',
    },
  },
  {
    id: 'gold-mc-03',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'EASY',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'WHERE',
    },
  },
  {
    id: 'gold-mc-04',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'EASY',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'IS',
    },
  },
  {
    id: 'gold-mc-05',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'EASY',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'EASY',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'NULL',
    },
  },

  // --- MEDIUM 7 — 정렬 / 그룹화 / 필터링 조합 ---
  {
    id: 'gold-mc-06',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'ORDER',
    },
  },
  {
    id: 'gold-mc-07',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'BY',
    },
  },
  {
    id: 'gold-mc-08',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'GROUP',
    },
  },
  {
    id: 'gold-mc-09',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'HAVING',
    },
  },
  {
    id: 'gold-mc-10',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'DISTINCT',
    },
  },
  {
    id: 'gold-mc-11',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'BETWEEN',
    },
  },
  {
    id: 'gold-mc-12',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'MEDIUM',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'MEDIUM',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'LIKE',
    },
  },

  // --- HARD 3 — 집합 연산 ---
  {
    id: 'gold-mc-13',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'HARD',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'HARD',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'UNION',
    },
  },
  {
    id: 'gold-mc-14',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'HARD',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'HARD',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'MINUS',
    },
  },
  {
    id: 'gold-mc-15',
    gameMode: 'multiple-choice',
    topic: 'sql-basics',
    week: 1,
    difficulty: 'HARD',
    vars: {
      topic: 'sql-basics',
      week: 1,
      difficulty: 'HARD',
      allowedKeywords: KEYWORDS,
      seedFocusKeyword: 'INTERSECT',
    },
  },
]);
