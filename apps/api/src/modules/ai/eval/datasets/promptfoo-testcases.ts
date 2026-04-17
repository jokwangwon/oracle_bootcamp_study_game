import { goldSetA, type EvalDatasetEntry } from './gold-set-a';
import { goldSetB } from './gold-set-b';
import { goldSetMc } from './gold-set-mc';

/**
 * Gold Set A + B → promptfoo testCase 변환 (SDD v2 §5.3).
 *
 * promptfoo testCase 계약:
 *   {
 *     description: string,
 *     vars: Record<string, unknown>     // prompt template + assertion에 전달
 *   }
 *
 * `vars`는 두 곳에서 사용된다:
 *   1. `prompts/build-eval-prompt.ts` — system+user 메시지를 렌더링
 *   2. `assertions/*.ts` — `AssertionContext.vars`로 받아 화이트리스트/모드 분기
 *
 * **본 모듈은 promptfoo 런타임이 `file://` 참조로 직접 import한다.**
 * 따라서 default export는 `PromptfooTestCase[]` 배열 그대로.
 */

export type PromptfooGameMode = 'blank-typing' | 'term-match' | 'multiple-choice';
export type PromptfooGoldSet = 'A' | 'B' | 'MC';

export interface PromptfooTestCase {
  description: string;
  vars: {
    topic: string;
    week: number;
    difficulty: string;
    allowedKeywords: string[];
    seedFocusKeyword: string;
    gameMode: PromptfooGameMode;
    /** 감사 trace에 표시되는 entry id (gold-a-*, gold-b-*, gold-mc-*) */
    entryId: string;
    /**
     * 'A' (Recall) / 'B' (Generalization) / 'MC' (ADR-012 Mode 6) —
     * report-generator stratification key
     */
    goldSet: PromptfooGoldSet;
  };
}

function toTestCase(goldSet: PromptfooGoldSet) {
  return (entry: EvalDatasetEntry): PromptfooTestCase => {
    if (
      entry.gameMode !== 'blank-typing' &&
      entry.gameMode !== 'term-match' &&
      entry.gameMode !== 'multiple-choice'
    ) {
      throw new Error(
        `promptfoo-testcases: 지원하지 않는 gameMode '${entry.gameMode}' (entry id=${entry.id}). blank-typing/term-match/multiple-choice만 허용`,
      );
    }
    return {
      description: `[Gold ${goldSet}] ${entry.id} (${entry.gameMode}, ${entry.difficulty})`,
      vars: {
        topic: entry.vars.topic,
        week: entry.vars.week,
        difficulty: entry.vars.difficulty,
        // readonly → mutable copy (promptfoo가 vars를 mutate할 가능성 차단용)
        allowedKeywords: [...entry.vars.allowedKeywords],
        seedFocusKeyword: entry.vars.seedFocusKeyword,
        gameMode: entry.gameMode,
        entryId: entry.id,
        goldSet,
      },
    };
  };
}

/**
 * Gold Set A 30 + B 30 + MC 15 = 총 75 testCase.
 * promptfoo는 각 testCase × providers × repeat 만큼 호출을 발생시킨다.
 *
 * SDD v2 §3.3 표본 산정은 기존 60 케이스 기준 1,500 호출/라운드. MC 15 추가 시
 * 75 × 5 × 5 = 1,875 호출/라운드로 증가 (약 +25%). MC 30건 완성 후 재측정.
 */
export function buildPromptfooTestCases(): PromptfooTestCase[] {
  return [
    ...goldSetA.map(toTestCase('A')),
    ...goldSetB.map(toTestCase('B')),
    ...goldSetMc.map(toTestCase('MC')),
  ];
}

const testCases = buildPromptfooTestCases();

export default testCases;
