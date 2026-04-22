import { Injectable } from '@nestjs/common';

/**
 * ADR-016 §2 — 입력 검증 (Sanitization).
 *
 * Layer 3(LLM-judge)에 넘어가기 전 학생 답안을 정제한다.
 * 자동 차단이 아닌 **경고 수집** 원칙 (pass-through with flags):
 *  - 제어 문자/HTML 태그/코드 블록 구분자는 **내용에서 제거** (noise)
 *  - Instruction 인젝션 의심 패턴은 **flag만 기록하고 내용은 유지** → Layer 3
 *    프롬프트에 `[SUSPICIOUS_INPUT]` 헤더를 붙여 모델이 경계하도록 유도
 *  - 2048자 초과는 truncate + 플래그
 *
 * 비목적:
 *  - 화이트리스트 검증(ScopeValidator의 책임)
 *  - 구조적 SQL 파싱(Layer 1 AST)
 *  - 의미 동치 판정(Layer 3 LLM)
 *
 * 헌법 §3 — 계산적 검증 레이어. 결정적, 재현 가능.
 */

export const MAX_ANSWER_LENGTH = 2048;

export const SANITIZE_FLAG = {
  SUSPICIOUS_INPUT: 'SUSPICIOUS_INPUT',
  TRUNCATED: 'TRUNCATED',
  /**
   * consensus-005 §커밋1 안전장치 1 — 학생 답안에 `<student_answer>` 류
   * 경계 태그가 포함됨. LLM-judge 에 그대로 전달 시 경계 혼동 유발 가능.
   * 탐지 시 `[[ANSWER_TAG_STRIPPED]]` 로 치환하고 flag 기록.
   */
  BOUNDARY_ESCAPE: 'BOUNDARY_ESCAPE',
} as const;

export const ANSWER_TAG_PLACEHOLDER = '[[ANSWER_TAG_STRIPPED]]';

export type SanitizeFlag = (typeof SANITIZE_FLAG)[keyof typeof SANITIZE_FLAG];

export interface SanitizeResult {
  clean: string;
  flags: SanitizeFlag[];
  truncated: boolean;
}

/**
 * Instruction 인젝션 의심 패턴. 대소문자 무시.
 * 한 줄 안에서 "명령처럼 보이는" 텍스트를 탐지하기 위한 보수적 리스트.
 *
 * consensus-005 §커밋1 안전장치 1 — 한국어 6종 확장 (B Agent 단독 지적 채택).
 */
const SUSPICIOUS_PATTERNS: readonly RegExp[] = [
  // 영어 패턴 (기존)
  /ignore\s+previous/i,
  /you\s+are\s+(a|an|the)\s+/i,
  /(^|\s)system\s*:/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\/?s>/i,
  // 한국어 패턴 (consensus-005 추가)
  /이전\s*지시/,
  /시스템\s*메시지/,
  /너는\s*이제/,
  /평가자로서/,
  /정답으로\s*(판정|인정)/,
  /시스템\s*:/,
];

/**
 * 경계 태그 탈출 시도 탐지. `<student_answer>` / `</student_answer>` (속성 포함).
 * 학생 답안 내부에 포함되면 LLM-judge 의 경계 혼동을 유발할 수 있어
 * flag 기록 후 placeholder 로 치환한다.
 */
const BOUNDARY_TAG_PATTERN = /<\/?student_answer[^>]*>/gi;

/**
 * 제어 문자: \x00-\x08 + \x0B-\x0C + \x0E-\x1F + \x7F.
 * 보존 대상: \x09(TAB), \x0A(LF), \x0D(CR).
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** XML/HTML 태그: <word ...> 또는 </word> 형식. 연산자 <, > 단독은 미탐지. */
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/g;

/** 코드 블록 구분자 ``` (0개 이상) */
const TRIPLE_BACKTICK_PATTERN = /```/g;

@Injectable()
export class AnswerSanitizer {
  sanitize(raw: string): SanitizeResult {
    const flags = new Set<SanitizeFlag>();

    // 1. 의심 키워드 스캔은 **원본**에 대해 수행 (제거 전 detection이 더 정확)
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(raw)) {
        flags.add(SANITIZE_FLAG.SUSPICIOUS_INPUT);
        break;
      }
    }

    // 1.5. 경계 태그 탈출 탐지 (원본 기준). HTML 제거 전에 flag 결정.
    let clean = raw;
    if (/<\/?student_answer[^>]*>/i.test(clean)) {
      flags.add(SANITIZE_FLAG.BOUNDARY_ESCAPE);
      clean = clean.replace(BOUNDARY_TAG_PATTERN, ANSWER_TAG_PLACEHOLDER);
    }

    // 2. 제어 문자 제거
    clean = clean.replace(CONTROL_CHAR_PATTERN, '');

    // 3. HTML 태그 제거 (SQL 비교 연산자 < > 는 태그 패턴이 아니라 유지됨)
    clean = clean.replace(HTML_TAG_PATTERN, '');

    // 4. 코드 블록 구분자 제거
    clean = clean.replace(TRIPLE_BACKTICK_PATTERN, '');

    // 5. 길이 제한 (모든 제거 후 측정)
    let truncated = false;
    if (clean.length > MAX_ANSWER_LENGTH) {
      clean = clean.slice(0, MAX_ANSWER_LENGTH);
      truncated = true;
      flags.add(SANITIZE_FLAG.TRUNCATED);
    }

    return {
      clean,
      flags: [...flags],
      truncated,
    };
  }
}
