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
} as const;

export type SanitizeFlag = (typeof SANITIZE_FLAG)[keyof typeof SANITIZE_FLAG];

export interface SanitizeResult {
  clean: string;
  flags: SanitizeFlag[];
  truncated: boolean;
}

/**
 * Instruction 인젝션 의심 패턴. 대소문자 무시.
 * 한 줄 안에서 "명령처럼 보이는" 텍스트를 탐지하기 위한 보수적 리스트.
 */
const SUSPICIOUS_PATTERNS: readonly RegExp[] = [
  /ignore\s+previous/i,
  /you\s+are\s+(a|an|the)\s+/i,
  /(^|\s)system\s*:/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\/?s>/i,
];

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

    // 2. 제어 문자 제거
    let clean = raw.replace(CONTROL_CHAR_PATTERN, '');

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
