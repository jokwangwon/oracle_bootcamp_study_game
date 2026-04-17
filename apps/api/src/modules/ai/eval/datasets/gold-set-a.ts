import type { Difficulty, GameModeId, Topic } from '@oracle-game/shared';

import { WEEK1_SQL_BASICS_QUESTIONS } from '../../../content/seed/data/week1-sql-basics.questions';
import { WEEK1_SQL_BASICS_SCOPE } from '../../../content/seed/data/week1-sql-basics.scope';

/**
 * Gold Set A — 기존 시드 30문제(빈칸 15 + 용어 15)를 평가용 entry로 변환 (SDD v2 §4.1).
 *
 * 평가 정의:
 *   - 정답 비교가 아니다. 시드 question의 핵심 keyword(answer[0])를 입력으로
 *     주고 모델이 같은 영역의 문제를 재생성하는지 계산적 메트릭(MT1~5, MT8)으로
 *     측정한다 (Recall 트랙).
 *   - prompt template은 운영의 PromptManager가 fetch하는 것과 동일 → 평가 결과가
 *     운영 동작을 그대로 예측 가능 (단계 3 §7.2 v2.3 결정 ‘운영 일관성’과 동일 원칙).
 *
 * EvalDatasetEntry 형태:
 *   - id: 'gold-a-{seq}-{mode}' — promptfoo testCase id
 *   - gameMode/topic/week/difficulty: 시드 그대로 반영
 *   - vars: promptfoo가 prompt template에 채울 변수
 *     - topic, week, difficulty, allowedKeywords: 운영 prompt와 동일
 *     - seedFocusKeyword: 시드 question.answer[0]에서 추출. 평가 prompt가
 *       이 keyword를 중심 토큰으로 사용하도록 단계 5 promptfoo 단계에서 주입한다.
 *
 * 단계 5에서 결정해야 하는 부분:
 *   - 평가 prompt template이 seedFocusKeyword를 어떻게 활용할지 (현 prompt를
 *     확장 vs 평가 전용 prompt 분리). 본 모듈은 양쪽 모두에 데이터를 공급할 수 있는
 *     형태로 설계 — vars에 raw 데이터만 담고 prompt 결정은 단계 5로 이연.
 */

export interface EvalDatasetEntryVars {
  topic: Topic;
  week: number;
  difficulty: Difficulty;
  /** 1주차 화이트리스트 전체 (운영 PromptManager가 받는 것과 동일) */
  allowedKeywords: string[];
  /** 시드 question.answer[0]. 평가 prompt가 이 keyword를 중심 토큰으로 사용 */
  seedFocusKeyword: string;
}

export interface EvalDatasetEntry {
  id: string;
  gameMode: GameModeId;
  topic: Topic;
  week: number;
  difficulty: Difficulty;
  vars: EvalDatasetEntryVars;
}

/**
 * 시드 question에서 평가용 EvalDatasetEntry를 만든다.
 *
 * 시드 → entry 매핑은 1:1로 유지하고, id는 모드별로 순번을 매겨
 * Langfuse trace + 보고서에서 식별 가능하게 한다.
 */
function buildGoldSetA(): readonly EvalDatasetEntry[] {
  const allowedKeywords = WEEK1_SQL_BASICS_SCOPE.keywords;
  const blankCounter = { n: 0 };
  const termCounter = { n: 0 };

  return WEEK1_SQL_BASICS_QUESTIONS.map((seed) => {
    const counter = seed.gameMode === 'blank-typing' ? blankCounter : termCounter;
    counter.n += 1;
    // 시드 question.answer[0]가 단일 핵심 토큰 — Gold Set A의 seedFocusKeyword
    // 시드는 zod로 answer.min(1) 검증되지만 TS noUncheckedIndexedAccess 대응
    const seedFocusKeyword = seed.answer[0];
    if (!seedFocusKeyword) {
      throw new Error(
        `Gold Set A 변환 실패: 시드 question.answer가 비어있음 (gameMode=${seed.gameMode}, n=${counter.n})`,
      );
    }

    return {
      id: `gold-a-${seed.gameMode}-${String(counter.n).padStart(2, '0')}`,
      gameMode: seed.gameMode,
      topic: seed.topic,
      week: seed.week,
      difficulty: seed.difficulty,
      vars: {
        topic: seed.topic,
        week: seed.week,
        difficulty: seed.difficulty,
        allowedKeywords,
        seedFocusKeyword,
      },
    };
  });
}

/**
 * Gold Set A — 평가 dataset entry 30개 (immutable).
 *
 * 빌드 시점에 1회 계산되며, 본 모듈을 import하는 promptfoo provider/스크립트는
 * 이 배열을 그대로 사용한다.
 */
export const goldSetA: readonly EvalDatasetEntry[] = Object.freeze(buildGoldSetA());
