import type {
  BlankTypingContent,
  GameModeId,
  TermMatchContent,
  Topic,
} from '@oracle-game/shared';

import type { QuestionSeed } from './week1-sql-basics.questions';

/**
 * 2주차 transactions 시드 30문제 (빈칸 15 + 용어 15)
 *
 * 학습 영역:
 *   1. 트랜잭션 제어    : COMMIT, ROLLBACK, SAVEPOINT, TRANSACTION
 *   2. 격리 수준        : ISOLATION, LEVEL, READ, COMMITTED, SERIALIZABLE
 *   3. 락               : LOCK, SHARE, EXCLUSIVE, MODE, NOWAIT, ROW
 *   4. 읽기 일관성      : CONSISTENT, SCN, READ ONLY/WRITE
 *
 * SQL 식별자(테이블/컬럼) 표기:
 *   - 1주차 sql-basics 화이트리스트(EMP/DEPT 등)와 cross-topic이 되지 않도록
 *     소문자 한 글자 식별자(`t`)를 사용한다. 정규식 `\b[A-Z][A-Z_0-9]{1,}\b`는
 *     소문자/단일 대문자를 잡지 않으므로 ScopeValidator가 무시한다.
 *   - 학습 자료로는 다소 추상적이지만, 트랜잭션 학습의 핵심은 명령어 자체에
 *     있으므로 문제 의도에는 영향이 없다.
 */

const TOPIC: Topic = 'transactions';
const WEEK = 2;
const STATUS = 'active' as const;
const SOURCE = 'pre-generated' as const;

function blank(
  sql: string,
  blanks: BlankTypingContent['blanks'],
  answers: string[],
  explanation: string,
): QuestionSeed {
  return {
    topic: TOPIC,
    week: WEEK,
    gameMode: 'blank-typing' satisfies GameModeId,
    difficulty: 'EASY',
    content: { type: 'blank-typing', sql, blanks },
    answer: answers,
    explanation,
    status: STATUS,
    source: SOURCE,
  };
}

function term(
  description: string,
  answers: string[],
  category: TermMatchContent['category'],
  explanation: string,
): QuestionSeed {
  return {
    topic: TOPIC,
    week: WEEK,
    gameMode: 'term-match' satisfies GameModeId,
    difficulty: 'EASY',
    content: { type: 'term-match', description, category },
    answer: answers,
    explanation,
    status: STATUS,
    source: SOURCE,
  };
}

/**
 * 빈칸 타이핑 15문제 (트랜잭션 + 격리 수준 + 락)
 *
 * 모든 SQL 토큰은 WEEK2_TRANSACTIONS_SCOPE.keywords 안에 있어야 한다.
 * (테스트로 검증됨 — seed.data.test.ts)
 */
const BLANK_TYPING_QUESTIONS: QuestionSeed[] = [
  blank(
    '___ TRANSACTION READ ONLY;',
    [{ position: 0, answer: 'SET', hint: '트랜잭션 속성 변경의 시작 키워드' }],
    ['SET'],
    'SET TRANSACTION 명령으로 현재 트랜잭션의 속성(격리 수준, 읽기 모드 등)을 지정합니다.',
  ),
  blank(
    'SET ___ READ ONLY;',
    [{ position: 0, answer: 'TRANSACTION', hint: 'SET 다음에 오는 키워드' }],
    ['TRANSACTION'],
    'SET TRANSACTION 명령은 현재 트랜잭션의 속성을 변경합니다. 다음 트랜잭션부터 적용되는 게 아니라 현재 트랜잭션에만 영향을 줍니다.',
  ),
  blank(
    'SET TRANSACTION ___ ONLY;',
    [{ position: 0, answer: 'READ', hint: '읽기 전용 모드 키워드 (두 단어 중 첫 단어)' }],
    ['READ'],
    'READ ONLY 트랜잭션은 SELECT만 허용하고 INSERT/UPDATE/DELETE는 차단합니다. 일관된 시점의 데이터를 조회할 때 사용합니다.',
  ),
  blank(
    'SET TRANSACTION READ ___;',
    [{ position: 0, answer: 'ONLY', hint: '읽기 전용을 명시하는 두 단어 중 두 번째' }],
    ['ONLY'],
    'READ ONLY는 트랜잭션 동안 데이터 변경을 막고 조회만 허용합니다. 보고서 생성처럼 일관된 스냅샷이 필요할 때 유용합니다.',
  ),
  blank(
    'SET TRANSACTION ___ LEVEL READ COMMITTED;',
    [{ position: 0, answer: 'ISOLATION', hint: '격리 수준 키워드의 첫 단어' }],
    ['ISOLATION'],
    'ISOLATION LEVEL은 트랜잭션 격리 수준을 지정합니다. Oracle의 기본은 READ COMMITTED입니다.',
  ),
  blank(
    'SET TRANSACTION ISOLATION ___ READ COMMITTED;',
    [{ position: 0, answer: 'LEVEL', hint: 'ISOLATION 다음에 오는 단어' }],
    ['LEVEL'],
    'ISOLATION LEVEL의 두 번째 단어는 LEVEL입니다. SET TRANSACTION ISOLATION LEVEL ... 형식으로 사용합니다.',
  ),
  blank(
    'SET TRANSACTION ISOLATION LEVEL READ ___;',
    [{ position: 0, answer: 'COMMITTED', hint: '영구 저장된 데이터만 보이는 격리 수준' }],
    ['COMMITTED'],
    'READ COMMITTED는 다른 트랜잭션의 변경 중 영구 저장된 것만 보여주는 격리 수준입니다. Oracle의 기본 격리 수준입니다.',
  ),
  blank(
    'SET TRANSACTION ISOLATION LEVEL ___;',
    [{ position: 0, answer: 'SERIALIZABLE', hint: '가장 엄격한 격리 수준' }],
    ['SERIALIZABLE'],
    'SERIALIZABLE은 가장 엄격한 격리 수준으로, 트랜잭션이 마치 직렬로 실행된 것처럼 동작합니다. phantom read까지 차단합니다.',
  ),
  blank(
    '___ sp1;',
    [{ position: 0, answer: 'SAVEPOINT', hint: '트랜잭션 중간에 표시점을 만드는 명령' }],
    ['SAVEPOINT'],
    'SAVEPOINT sp1은 트랜잭션 안에서 sp1이라는 이름의 표시점을 만듭니다. 나중에 ROLLBACK TO sp1으로 부분 롤백 가능합니다.',
  ),
  blank(
    'ROLLBACK ___ sp1;',
    [{ position: 0, answer: 'TO', hint: 'ROLLBACK 뒤에 SAVEPOINT를 가리키는 키워드' }],
    ['TO'],
    'ROLLBACK TO sp1은 sp1 이후의 변경만 되돌리고 sp1 이전의 작업은 그대로 유지합니다 (부분 롤백).',
  ),
  blank(
    '___ TABLE t IN EXCLUSIVE MODE;',
    [{ position: 0, answer: 'LOCK', hint: '테이블에 락을 거는 명령의 첫 단어' }],
    ['LOCK'],
    'LOCK TABLE 명령으로 테이블 전체에 락을 명시적으로 설정합니다. 락 모드와 NOWAIT 옵션을 지정할 수 있습니다.',
  ),
  blank(
    'LOCK TABLE t ___ EXCLUSIVE MODE;',
    [{ position: 0, answer: 'IN', hint: '락 모드를 명시할 때 LOCK TABLE 다음에 오는 키워드' }],
    ['IN'],
    'LOCK TABLE t IN ... MODE 형식에서 IN은 락 모드를 도입하는 키워드입니다.',
  ),
  blank(
    'LOCK TABLE t IN ___ MODE;',
    [{ position: 0, answer: 'EXCLUSIVE', hint: '다른 트랜잭션의 모든 접근을 막는 가장 강한 락 모드' }],
    ['EXCLUSIVE'],
    'EXCLUSIVE MODE는 가장 강한 락 모드로, 다른 트랜잭션의 모든 접근(읽기 포함)을 차단합니다.',
  ),
  blank(
    'LOCK TABLE t IN ___ SHARE MODE;',
    [{ position: 0, answer: 'ROW', hint: '행 단위 공유 락의 첫 단어' }],
    ['ROW'],
    'ROW SHARE MODE는 행 단위 공유 락으로, 다른 트랜잭션의 동시 읽기와 행 단위 접근은 허용합니다.',
  ),
  blank(
    'LOCK TABLE t IN EXCLUSIVE MODE ___;',
    [{ position: 0, answer: 'NOWAIT', hint: '락 대기 없이 즉시 에러 반환' }],
    ['NOWAIT'],
    'NOWAIT 옵션은 락이 다른 트랜잭션에 의해 점유 중이면 대기하지 않고 즉시 에러를 반환합니다.',
  ),
];

/**
 * 용어 맞추기 15문제 (트랜잭션 + 일관성 이론)
 *
 * description의 모든 영문 대문자 토큰도 화이트리스트 안에 있어야 한다.
 */
const TERM_MATCH_QUESTIONS: QuestionSeed[] = [
  term(
    '트랜잭션의 모든 변경을 영구적으로 저장하는 단일 명령은?',
    ['COMMIT'],
    '트랜잭션 제어',
    'COMMIT은 트랜잭션의 모든 변경을 영구적으로 저장하는 명령입니다. COMMIT 이후에는 ROLLBACK으로 되돌릴 수 없습니다.',
  ),
  term(
    '트랜잭션의 변경을 취소하고 시작 시점으로 되돌리는 명령은?',
    ['ROLLBACK'],
    '트랜잭션 제어',
    'ROLLBACK은 현재 트랜잭션의 모든 변경을 취소합니다. SAVEPOINT를 지정하면 부분 롤백도 가능합니다.',
  ),
  term(
    '한 트랜잭션 안에서 부분 롤백 지점을 만드는 명령은?',
    ['SAVEPOINT'],
    '트랜잭션 제어',
    'SAVEPOINT는 트랜잭션 안에 표시점을 만들어 ROLLBACK TO 명령으로 부분 롤백을 가능하게 합니다.',
  ),
  term(
    '여러 트랜잭션 사이에서 서로의 변경을 어떻게 보는지 결정하는 격리 수준 두 단어 중 첫 단어는?',
    ['ISOLATION'],
    '격리 수준',
    'ISOLATION LEVEL이 격리 수준을 정의하는 두 단어입니다. SET TRANSACTION ISOLATION LEVEL ... 형식으로 지정합니다.',
  ),
  term(
    '격리 수준을 변경할 때 SET TRANSACTION ISOLATION ___ 의 빈자리에 들어가는 단어는?',
    ['LEVEL'],
    '격리 수준',
    'ISOLATION LEVEL이 격리 수준 절의 두 단어입니다. LEVEL이 두 번째 단어입니다.',
  ),
  term(
    'READ COMMITTED, READ ONLY 같은 트랜잭션 모드/격리 키워드의 공통 첫 단어는?',
    ['READ'],
    '격리 수준',
    'READ는 트랜잭션의 읽기 동작과 관련된 키워드들의 공통 첫 단어입니다 (READ COMMITTED, READ ONLY, READ WRITE).',
  ),
  term(
    'Oracle의 기본 격리 수준 READ ___ 의 빈자리는? (다른 트랜잭션이 영구 저장한 변경만 보여줍니다.)',
    ['COMMITTED'],
    '격리 수준',
    'READ COMMITTED는 Oracle의 기본 격리 수준이며, 다른 트랜잭션의 변경 중 commit된 것만 조회 시점에 보여줍니다.',
  ),
  term(
    'Oracle에서 가장 엄격한 격리 수준으로, 트랜잭션이 직렬로 실행된 것처럼 동작하게 하는 단일 단어는?',
    ['SERIALIZABLE'],
    '격리 수준',
    'SERIALIZABLE은 가장 강한 격리 수준입니다. phantom read까지 차단하며, 충돌 시 ORA-08177 에러로 트랜잭션이 실패할 수 있습니다.',
  ),
  term(
    '트랜잭션 동안 데이터 변경 없이 조회만 허용하는 두 단어 모드 READ ___ 의 빈자리는?',
    ['ONLY'],
    '격리 수준',
    'READ ONLY 트랜잭션은 SELECT만 허용하고 INSERT/UPDATE/DELETE를 차단합니다. 일관된 스냅샷이 필요한 보고서 작업에 적합합니다.',
  ),
  term(
    'READ ONLY와 반대로 데이터 변경을 허용하는 두 단어 모드 READ ___ 의 빈자리는?',
    ['WRITE'],
    '격리 수준',
    'READ WRITE는 일반 트랜잭션의 기본 모드로, 조회와 변경을 모두 허용합니다. 명시하지 않으면 기본값입니다.',
  ),
  term(
    '데이터를 검색하는 사용자와 변경하는 사용자 간에 일관된 관점을 제공하는 Oracle 메커니즘의 핵심 단어는? (___ READ)',
    ['CONSISTENT'],
    '읽기 일관성',
    'CONSISTENT READ는 Oracle 읽기 일관성의 핵심 개념으로, 조회 시작 시점의 데이터를 보장합니다. UNDO 세그먼트를 활용해 다른 트랜잭션의 변경에 영향받지 않습니다.',
  ),
  term(
    '다른 트랜잭션의 동시 읽기는 허용하지만 수정은 막는 락 모드의 단일 단어는?',
    ['SHARE'],
    '락',
    'SHARE 모드는 공유 락으로, 다른 트랜잭션의 SELECT는 허용하지만 변경(UPDATE/DELETE)은 차단합니다.',
  ),
  term(
    '다른 트랜잭션의 모든 접근(읽기 포함)을 막는 가장 강한 락 모드의 단일 단어는?',
    ['EXCLUSIVE'],
    '락',
    'EXCLUSIVE 모드는 배타 락으로, 다른 트랜잭션의 모든 접근을 차단합니다. 가장 강한 락 모드입니다.',
  ),
  term(
    '락이 다른 트랜잭션에 의해 점유 중일 때 대기하지 않고 즉시 에러를 반환하는 옵션 키워드는?',
    ['NOWAIT'],
    '락',
    'NOWAIT 옵션을 LOCK TABLE 또는 SELECT FOR UPDATE에 붙이면 락 점유 시 ORA-00054 에러를 즉시 반환합니다.',
  ),
  term(
    'Oracle 읽기 일관성을 식별하는 시스템 변경 번호(System Change Number)의 약어는?',
    ['SCN'],
    '읽기 일관성',
    'SCN은 Oracle이 모든 변경에 부여하는 단조 증가 번호입니다. 읽기 일관성, recovery, flashback 모두 SCN을 기반으로 동작합니다.',
  ),
];

export const WEEK2_TRANSACTIONS_QUESTIONS: QuestionSeed[] = [
  ...BLANK_TYPING_QUESTIONS,
  ...TERM_MATCH_QUESTIONS,
];
