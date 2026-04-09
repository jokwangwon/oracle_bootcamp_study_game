import type { Topic } from '@oracle-game/shared';

import type { WeeklyScopeSeed } from './week1-sql-basics.scope';

/**
 * 2주차 transactions 학습 범위 (키워드 화이트리스트)
 *
 * SDD §4.2 + 헌법 §3: 이 화이트리스트에 없는 Oracle 식별자가 문제에
 * 등장하면 ScopeValidator가 폐기한다 (계산적 검증).
 *
 * 본 주차는 트랜잭션 제어 + 격리 수준 + 락 + 읽기 일관성을 다루며,
 * 1주차 sql-basics(SELECT/WHERE/GROUP BY 등)와는 키워드가 겹치지 않는다.
 *
 * 학습 영역:
 *   1. 트랜잭션 제어    : COMMIT, ROLLBACK, SAVEPOINT, TRANSACTION
 *   2. 격리 수준        : ISOLATION, LEVEL, READ, COMMITTED, SERIALIZABLE
 *   3. 락               : LOCK, SHARE, EXCLUSIVE, MODE, NOWAIT
 *   4. 읽기 일관성      : CONSISTENT, ONLY, WRITE
 *   5. 트랜잭션 시작/SET: SET, BEGIN, END
 *
 * 검증 정규식: `\b[A-Z][A-Z_0-9]{1,}\b` (대문자 시작, 2글자 이상)
 *
 * 따라서 여기에는 **2글자 이상의 대문자 토큰**만 등록한다. 한국어 텍스트나
 * 소문자, 단일 대문자(A, I 등)는 검증 대상이 아니므로 등록 불필요.
 */

const KEYWORDS_WEEK2_TRANSACTIONS: string[] = [
  // --- 트랜잭션 제어 ---
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'TRANSACTION',
  'TO',

  // --- 트랜잭션 시작/SET ---
  'SET',
  'BEGIN',
  'END',

  // --- 격리 수준 (ISOLATION LEVEL) ---
  'ISOLATION',
  'LEVEL',
  'READ',
  'COMMITTED',
  'SERIALIZABLE',
  'WRITE',
  'ONLY',

  // --- 읽기 일관성 ---
  'CONSISTENT',
  'SCN',

  // --- 락 (LOCK) ---
  'LOCK',
  'TABLE',
  'IN',
  'SHARE',
  'EXCLUSIVE',
  'MODE',
  'NOWAIT',
  'ROW',

  // --- 1주차에서 재사용 ---
  // (없음 — 1주차 화이트리스트는 별도 주차에서 import해서 사용)
];

export const WEEK2_TRANSACTIONS_SCOPE: WeeklyScopeSeed = {
  week: 2,
  topic: 'transactions' as Topic,
  keywords: KEYWORDS_WEEK2_TRANSACTIONS,
  sourceUrl: null,
};
