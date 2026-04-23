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
 *
 * UX #2 (ux-redesign-brief-v1.md §2.2, 2026-04-23) — 모든 seed 에 scenario + rationale
 * 필수. 트랜잭션 개념은 추상적이라 "언제 이 명령을 쓰는가 + 왜" 설명이 특히 중요.
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
  scenario: string,
  rationale: string,
): QuestionSeed {
  return {
    topic: TOPIC,
    week: WEEK,
    gameMode: 'blank-typing' satisfies GameModeId,
    difficulty: 'EASY',
    content: { type: 'blank-typing', sql, blanks },
    answer: answers,
    explanation,
    scenario,
    rationale,
    status: STATUS,
    source: SOURCE,
  };
}

function term(
  description: string,
  answers: string[],
  category: TermMatchContent['category'],
  explanation: string,
  scenario: string,
  rationale: string,
): QuestionSeed {
  return {
    topic: TOPIC,
    week: WEEK,
    gameMode: 'term-match' satisfies GameModeId,
    difficulty: 'EASY',
    content: { type: 'term-match', description, category },
    answer: answers,
    explanation,
    scenario,
    rationale,
    status: STATUS,
    source: SOURCE,
  };
}

/**
 * 빈칸 타이핑 15문제 (트랜잭션 + 격리 수준 + 락)
 */
const BLANK_TYPING_QUESTIONS: QuestionSeed[] = [
  blank(
    '___ TRANSACTION READ ONLY;',
    [{ position: 0, answer: 'SET', hint: '트랜잭션 속성 변경의 시작 키워드' }],
    ['SET'],
    'SET TRANSACTION 명령으로 현재 트랜잭션의 속성(격리 수준, 읽기 모드 등)을 지정합니다.',
    '월말 보고서를 만들기 위해 "이 트랜잭션 동안 데이터가 바뀌지 않은 상태" 로 고정하고 싶습니다. 트랜잭션 속성을 지정하는 명령의 시작이 필요합니다.',
    'DB 세션의 트랜잭션 속성은 디폴트 대신 명시적으로 바꿀 수 있습니다. "트랜잭션 속성을 지금부터 이렇게 다루겠다" 를 선언하는 명령의 시작 키워드가 SET 입니다.',
  ),
  blank(
    'SET ___ READ ONLY;',
    [{ position: 0, answer: 'TRANSACTION', hint: 'SET 다음에 오는 키워드' }],
    ['TRANSACTION'],
    'SET TRANSACTION 명령은 현재 트랜잭션의 속성을 변경합니다. 다음 트랜잭션부터 적용되는 게 아니라 현재 트랜잭션에만 영향을 줍니다.',
    '지금 이 트랜잭션만 읽기 전용으로 바꾸고 싶은 상황(다음 트랜잭션은 다시 기본으로). 어떤 "단위" 의 속성을 바꾸는지 명시해야 합니다.',
    'SET 만으로는 대상이 모호합니다. TRANSACTION 을 붙여야 "현재 트랜잭션" 한 단위의 속성만 바꾼다는 의미가 분명해져 DB 가 정확히 한 트랜잭션에만 적용합니다.',
  ),
  blank(
    'SET TRANSACTION ___ ONLY;',
    [{ position: 0, answer: 'READ', hint: '읽기 전용 모드 키워드 (두 단어 중 첫 단어)' }],
    ['READ'],
    'READ ONLY 트랜잭션은 SELECT만 허용하고 INSERT/UPDATE/DELETE는 차단합니다. 일관된 시점의 데이터를 조회할 때 사용합니다.',
    '복잡한 분석 보고서를 만드는 동안 실수로 UPDATE 를 날려 원본 데이터를 건드릴까 걱정됩니다. 아예 변경을 차단해버리고 싶습니다.',
    '사람의 실수로부터 데이터를 지키는 방법은 "변경 자체를 못 하게" 만드는 것. READ ONLY 모드는 이 트랜잭션 동안 DML 을 DB 레벨에서 거부해 안전성을 보장합니다.',
  ),
  blank(
    'SET TRANSACTION READ ___;',
    [{ position: 0, answer: 'ONLY', hint: '읽기 전용을 명시하는 두 단어 중 두 번째' }],
    ['ONLY'],
    'READ ONLY는 트랜잭션 동안 데이터 변경을 막고 조회만 허용합니다. 보고서 생성처럼 일관된 스냅샷이 필요할 때 유용합니다.',
    '분석 스크립트가 돌아가는 동안 데이터가 변하지 않도록 조회만 허용 모드로 잠그려 합니다.',
    'READ 뒤에 ONLY 를 붙여야 "오직 읽기만" 이라는 제약이 완성됩니다. READ WRITE 와 대비되는 명시적 제약 모드로 사고 방지의 핵심입니다.',
  ),
  blank(
    'SET TRANSACTION ___ LEVEL READ COMMITTED;',
    [{ position: 0, answer: 'ISOLATION', hint: '격리 수준 키워드의 첫 단어' }],
    ['ISOLATION'],
    'ISOLATION LEVEL은 트랜잭션 격리 수준을 지정합니다. Oracle의 기본은 READ COMMITTED입니다.',
    '여러 사용자가 동시에 같은 데이터를 건드릴 때 내 트랜잭션이 남의 미완료 변경을 보지 않게 하려 합니다.',
    '트랜잭션 간 서로의 변경을 어떻게 노출할지는 "격리 수준" 으로 제어합니다. SET TRANSACTION 절에서 이 속성을 지칭하는 키워드가 ISOLATION 입니다.',
  ),
  blank(
    'SET TRANSACTION ISOLATION ___ READ COMMITTED;',
    [{ position: 0, answer: 'LEVEL', hint: 'ISOLATION 다음에 오는 단어' }],
    ['LEVEL'],
    'ISOLATION LEVEL의 두 번째 단어는 LEVEL입니다. SET TRANSACTION ISOLATION LEVEL ... 형식으로 사용합니다.',
    '격리 수준을 지정하려는데, ISOLATION 한 단어로는 문법이 미완성이라 DB 가 에러를 낼 것입니다.',
    'SQL 문법은 ISOLATION LEVEL 두 단어를 한 덩어리로 취급합니다. LEVEL 까지 써야 "격리 수준" 이라는 복합 키워드가 완성되어 뒤에 오는 격리 등급을 받아들일 수 있습니다.',
  ),
  blank(
    'SET TRANSACTION ISOLATION LEVEL READ ___;',
    [{ position: 0, answer: 'COMMITTED', hint: '영구 저장된 데이터만 보이는 격리 수준' }],
    ['COMMITTED'],
    'READ COMMITTED는 다른 트랜잭션의 변경 중 영구 저장된 것만 보여주는 격리 수준입니다. Oracle의 기본 격리 수준입니다.',
    '다른 사용자가 중간에 UPDATE 하다 아직 COMMIT 안 한 불확실한 값은 내 쪽에 안 보이도록 설정하고 싶습니다.',
    'READ COMMITTED 는 "커밋된 값만 보여라" 를 의미해 dirty read 를 차단합니다. Oracle 기본값이라 대부분 상황에서 합리적이며, 더 엄격하면 성능이 떨어집니다.',
  ),
  blank(
    'SET TRANSACTION ISOLATION LEVEL ___;',
    [{ position: 0, answer: 'SERIALIZABLE', hint: '가장 엄격한 격리 수준' }],
    ['SERIALIZABLE'],
    'SERIALIZABLE은 가장 엄격한 격리 수준으로, 트랜잭션이 마치 직렬로 실행된 것처럼 동작합니다. phantom read까지 차단합니다.',
    '회계 마감처럼 중간에 어떤 변경도 끼어들면 안 되는 트랜잭션을 실행해야 합니다. phantom read 조차 허용할 수 없습니다.',
    'SERIALIZABLE 은 가장 강한 격리 수준으로 트랜잭션들을 순차 실행한 것처럼 보장합니다. 대신 충돌 시 ORA-08177 로 실패할 수 있어 엄격함이 꼭 필요한 경우에만 씁니다.',
  ),
  blank(
    '___ sp1;',
    [{ position: 0, answer: 'SAVEPOINT', hint: '트랜잭션 중간에 표시점을 만드는 명령' }],
    ['SAVEPOINT'],
    'SAVEPOINT sp1은 트랜잭션 안에서 sp1이라는 이름의 표시점을 만듭니다. 나중에 ROLLBACK TO sp1으로 부분 롤백 가능합니다.',
    '긴 트랜잭션 안에서 "1단계는 확정하고, 2단계만 다시 시도" 같은 부분 롤백이 필요합니다. 중간에 되돌릴 표시점을 남기려 합니다.',
    'COMMIT 없이 트랜잭션 중간 지점으로 돌아가는 유일한 방법은 SAVEPOINT 를 미리 선언해 두는 것. 이름으로 여러 개 만들어 단계별 복구 지점을 설계할 수 있습니다.',
  ),
  blank(
    'ROLLBACK ___ sp1;',
    [{ position: 0, answer: 'TO', hint: 'ROLLBACK 뒤에 SAVEPOINT를 가리키는 키워드' }],
    ['TO'],
    'ROLLBACK TO sp1은 sp1 이후의 변경만 되돌리고 sp1 이전의 작업은 그대로 유지합니다 (부분 롤백).',
    '방금 2단계에서 에러가 났습니다. 트랜잭션 전체는 유지하고 싶지만 방금 작업만 취소하여 다시 시도하려 합니다.',
    '단순 ROLLBACK 은 트랜잭션 전체를 되돌립니다. SAVEPOINT 지점으로만 부분 복귀하려면 ROLLBACK TO <이름> 구문이 필요합니다. TO 가 "어디까지" 를 가리키는 키워드입니다.',
  ),
  blank(
    '___ TABLE t IN EXCLUSIVE MODE;',
    [{ position: 0, answer: 'LOCK', hint: '테이블에 락을 거는 명령의 첫 단어' }],
    ['LOCK'],
    'LOCK TABLE 명령으로 테이블 전체에 락을 명시적으로 설정합니다. 락 모드와 NOWAIT 옵션을 지정할 수 있습니다.',
    '민감 테이블에 일괄 작업을 하려는데, 다른 트랜잭션이 끼어들어 데이터가 꼬이지 않도록 테이블을 아예 잠가놓고 싶습니다.',
    '기본 DML 은 행 단위 락만 걸지만, 테이블 전체 작업에는 명시적 테이블 락이 안전합니다. LOCK TABLE 명령으로 수동 제어할 수 있습니다.',
  ),
  blank(
    'LOCK TABLE t ___ EXCLUSIVE MODE;',
    [{ position: 0, answer: 'IN', hint: '락 모드를 명시할 때 LOCK TABLE 다음에 오는 키워드' }],
    ['IN'],
    'LOCK TABLE t IN ... MODE 형식에서 IN은 락 모드를 도입하는 키워드입니다.',
    '테이블에 락을 걸되 어떤 모드(SHARE vs EXCLUSIVE) 로 잠글지 정해야 합니다.',
    'LOCK TABLE 문법은 "어떤 모드로 잠글 것인지" 를 명시해야 합니다. IN ... MODE 는 그 모드 지정 절의 연결 키워드로, 여러 락 모드를 일관된 문법으로 표현할 수 있게 합니다.',
  ),
  blank(
    'LOCK TABLE t IN ___ MODE;',
    [{ position: 0, answer: 'EXCLUSIVE', hint: '다른 트랜잭션의 모든 접근을 막는 가장 강한 락 모드' }],
    ['EXCLUSIVE'],
    'EXCLUSIVE MODE는 가장 강한 락 모드로, 다른 트랜잭션의 모든 접근(읽기 포함)을 차단합니다.',
    '테이블 구조 변경이나 대량 데이터 재구성을 할 때 다른 트랜잭션이 절대 못 들어오게 해야 합니다.',
    '읽기까지 전부 차단해야 안전한 작업에는 SHARE 가 아닌 EXCLUSIVE 락이 필요합니다. 가장 엄격한 만큼 오래 유지하면 동시성이 크게 떨어져 짧게 마무리해야 합니다.',
  ),
  blank(
    'LOCK TABLE t IN ___ SHARE MODE;',
    [{ position: 0, answer: 'ROW', hint: '행 단위 공유 락의 첫 단어' }],
    ['ROW'],
    'ROW SHARE MODE는 행 단위 공유 락으로, 다른 트랜잭션의 동시 읽기와 행 단위 접근은 허용합니다.',
    '내가 작업 중인 테이블을 다른 사람도 SELECT 하고 행 단위로는 수정할 수 있도록 허용하면서, 테이블 레벨 DDL 은 막고 싶습니다.',
    '테이블 전체 EXCLUSIVE 는 동시성을 너무 많이 희생합니다. ROW SHARE 는 훨씬 느슨한 락으로 동시 읽기와 행 단위 충돌 없는 DML 을 허용해 실사용 동시성을 유지합니다.',
  ),
  blank(
    'LOCK TABLE t IN EXCLUSIVE MODE ___;',
    [{ position: 0, answer: 'NOWAIT', hint: '락 대기 없이 즉시 에러 반환' }],
    ['NOWAIT'],
    'NOWAIT 옵션은 락이 다른 트랜잭션에 의해 점유 중이면 대기하지 않고 즉시 에러를 반환합니다.',
    '야간 배치가 아닌 대화형 세션에서 락 대기 때문에 화면이 멈추는 걸 피하고 싶습니다. 락 못 잡으면 즉시 에러로 다른 경로를 선택하려 합니다.',
    '기본 LOCK 은 무한 대기라 사용자 경험에 치명적입니다. NOWAIT 옵션은 즉시 ORA-00054 에러를 돌려주어 애플리케이션이 빠르게 fallback 처리하도록 해 줍니다.',
  ),
];

/**
 * 용어 맞추기 15문제 (트랜잭션 + 일관성 이론)
 */
const TERM_MATCH_QUESTIONS: QuestionSeed[] = [
  term(
    '트랜잭션의 모든 변경을 영구적으로 저장하는 단일 명령은?',
    ['COMMIT'],
    '트랜잭션 제어',
    'COMMIT은 트랜잭션의 모든 변경을 영구적으로 저장하는 명령입니다. COMMIT 이후에는 ROLLBACK으로 되돌릴 수 없습니다.',
    '여러 INSERT/UPDATE 를 하나의 작업 단위로 묶어 실행 완료 후 "이제 이 변경을 확정해" 하고 DB 에 알리려 합니다.',
    'DML 은 기본적으로 세션 단위 미확정 상태로만 남습니다. COMMIT 을 호출해야 모든 변경이 공식적으로 반영되어 다른 트랜잭션에서도 관찰 가능한 상태가 됩니다.',
  ),
  term(
    '트랜잭션의 변경을 취소하고 시작 시점으로 되돌리는 명령은?',
    ['ROLLBACK'],
    '트랜잭션 제어',
    'ROLLBACK은 현재 트랜잭션의 모든 변경을 취소합니다. SAVEPOINT를 지정하면 부분 롤백도 가능합니다.',
    '작업 도중 예상 못한 에러가 발생했거나 사용자가 취소 버튼을 눌렀습니다. 변경을 없던 일로 되돌려야 합니다.',
    'COMMIT 이전 상태라면 ROLLBACK 으로 트랜잭션 내 모든 변경을 원상복구할 수 있습니다. 데이터 일관성을 보장하는 가장 기본적인 안전장치입니다.',
  ),
  term(
    '한 트랜잭션 안에서 부분 롤백 지점을 만드는 명령은?',
    ['SAVEPOINT'],
    '트랜잭션 제어',
    'SAVEPOINT는 트랜잭션 안에 표시점을 만들어 ROLLBACK TO 명령으로 부분 롤백을 가능하게 합니다.',
    '긴 트랜잭션에서 10단계 중 5단계까지는 확정하되 6~10단계만 되돌릴 가능성이 필요합니다.',
    '전체 ROLLBACK 은 과격합니다. SAVEPOINT 로 중간 표시점을 남기면 특정 구간만 되돌릴 수 있어 복잡한 비즈니스 로직을 안전하게 다룰 수 있습니다.',
  ),
  term(
    '여러 트랜잭션 사이에서 서로의 변경을 어떻게 보는지 결정하는 격리 수준 두 단어 중 첫 단어는?',
    ['ISOLATION'],
    '격리 수준',
    'ISOLATION LEVEL이 격리 수준을 정의하는 두 단어입니다. SET TRANSACTION ISOLATION LEVEL ... 형식으로 지정합니다.',
    '동시 실행 트랜잭션이 서로의 중간 상태를 볼지 결정하는 수준을 명시해야 합니다.',
    '동시성과 일관성은 트레이드오프 관계. DB 는 이를 "격리 수준" 이라는 개념으로 파라미터화했고, 그 중심 용어가 ISOLATION 입니다.',
  ),
  term(
    '격리 수준을 변경할 때 SET TRANSACTION ISOLATION ___ 의 빈자리에 들어가는 단어는?',
    ['LEVEL'],
    '격리 수준',
    'ISOLATION LEVEL이 격리 수준 절의 두 단어입니다. LEVEL이 두 번째 단어입니다.',
    'ISOLATION 만 쓰면 문법이 미완성입니다. 올바른 문법을 완성해야 파서가 받아들입니다.',
    'SQL 표준은 ISOLATION LEVEL 두 단어를 한 구문 단위로 규정합니다. LEVEL 로 복합 키워드가 완성되어야 뒤에 오는 등급(READ COMMITTED, SERIALIZABLE 등) 을 연결할 수 있습니다.',
  ),
  term(
    'READ COMMITTED, READ ONLY 같은 트랜잭션 모드/격리 키워드의 공통 첫 단어는?',
    ['READ'],
    '격리 수준',
    'READ는 트랜잭션의 읽기 동작과 관련된 키워드들의 공통 첫 단어입니다 (READ COMMITTED, READ ONLY, READ WRITE).',
    'Oracle 의 격리/모드 관련 키워드 다수가 공통 단어로 시작한다는 점을 기억하면 문법 암기가 쉬워집니다.',
    '읽기 동작의 어떤 측면을 제어하든 접두어가 READ 로 통일됩니다. 이 일관성을 이해하면 READ COMMITTED / READ ONLY / READ WRITE 를 체계적으로 기억할 수 있습니다.',
  ),
  term(
    'Oracle의 기본 격리 수준 READ ___ 의 빈자리는? (다른 트랜잭션이 영구 저장한 변경만 보여줍니다.)',
    ['COMMITTED'],
    '격리 수준',
    'READ COMMITTED는 Oracle의 기본 격리 수준이며, 다른 트랜잭션의 변경 중 commit된 것만 조회 시점에 보여줍니다.',
    '대부분의 OLTP 애플리케이션에서 권장되는 기본 모드로, dirty read 는 막되 동시성은 유지하려 합니다.',
    'dirty read(다른 트랜잭션의 미확정 변경을 보는 것) 만 차단하면 충분한 대부분의 상황에서는 가장 가벼운 격리 수준인 READ COMMITTED 가 효율적입니다. 그래서 Oracle 기본값입니다.',
  ),
  term(
    'Oracle에서 가장 엄격한 격리 수준으로, 트랜잭션이 직렬로 실행된 것처럼 동작하게 하는 단일 단어는?',
    ['SERIALIZABLE'],
    '격리 수준',
    'SERIALIZABLE은 가장 강한 격리 수준입니다. phantom read까지 차단하며, 충돌 시 ORA-08177 에러로 트랜잭션이 실패할 수 있습니다.',
    '회계 마감이나 정산처럼 phantom read 까지 허용해선 안 되는 엄격한 정합성이 필요한 경우입니다.',
    '가장 강한 격리를 쓰면 시스템이 "트랜잭션들을 한 줄로 순차 실행한 것처럼" 보장합니다. 충돌 시 실패(롤백) 비용이 크므로 꼭 필요한 경우에만 선택합니다.',
  ),
  term(
    '트랜잭션 동안 데이터 변경 없이 조회만 허용하는 두 단어 모드 READ ___ 의 빈자리는?',
    ['ONLY'],
    '격리 수준',
    'READ ONLY 트랜잭션은 SELECT만 허용하고 INSERT/UPDATE/DELETE를 차단합니다. 일관된 스냅샷이 필요한 보고서 작업에 적합합니다.',
    '장기간 실행되는 분석 스크립트 도중 실수로 UPDATE 를 치지 않도록 방어 장치가 필요합니다.',
    'READ ONLY 트랜잭션은 조회 동안 일관된 스냅샷을 보장하면서 DML 을 아예 차단합니다. 실수 방지 + 일관성 두 마리를 동시에 잡는 모드입니다.',
  ),
  term(
    'READ ONLY와 반대로 데이터 변경을 허용하는 두 단어 모드 READ ___ 의 빈자리는?',
    ['WRITE'],
    '격리 수준',
    'READ WRITE는 일반 트랜잭션의 기본 모드로, 조회와 변경을 모두 허용합니다. 명시하지 않으면 기본값입니다.',
    '일반적인 업무 트랜잭션으로 조회와 변경을 모두 수행할 예정입니다. 기본이지만 의도를 명시적으로 선언하고 싶습니다.',
    'READ WRITE 는 Oracle 트랜잭션의 기본 모드. 명시적으로 선언하면 코드 리뷰 시 "의도적으로 쓰기 권한이 열려 있음" 을 분명히 알 수 있어 의도 전달에 유용합니다.',
  ),
  term(
    '데이터를 검색하는 사용자와 변경하는 사용자 간에 일관된 관점을 제공하는 Oracle 메커니즘의 핵심 단어는? (___ READ)',
    ['CONSISTENT'],
    '읽기 일관성',
    'CONSISTENT READ는 Oracle 읽기 일관성의 핵심 개념으로, 조회 시작 시점의 데이터를 보장합니다. UNDO 세그먼트를 활용해 다른 트랜잭션의 변경에 영향받지 않습니다.',
    '긴 조회 쿼리가 돌아가는 동안 다른 사용자가 같은 데이터를 UPDATE 해도 내 결과가 뒤섞이지 않아야 합니다.',
    'Oracle 은 UNDO 세그먼트로 "조회 시작 시점" 의 데이터를 재구성해 일관된 읽기를 제공합니다. 이 메커니즘의 핵심 개념이 CONSISTENT READ 이며, 락 없이도 일관성을 보장합니다.',
  ),
  term(
    '다른 트랜잭션의 동시 읽기는 허용하지만 수정은 막는 락 모드의 단일 단어는?',
    ['SHARE'],
    '락',
    'SHARE 모드는 공유 락으로, 다른 트랜잭션의 SELECT는 허용하지만 변경(UPDATE/DELETE)은 차단합니다.',
    '참고용 마스터 데이터를 검토하는 동안 다른 사람도 조회는 할 수 있되 변경은 못 하게 막고 싶습니다.',
    'SHARE 모드는 읽기는 공유(여럿이 동시에 가능) 하되 쓰기는 차단하는 락입니다. 완전 배타(EXCLUSIVE) 는 과하고, 읽기 동시성은 유지하고 싶을 때 최적의 선택입니다.',
  ),
  term(
    '다른 트랜잭션의 모든 접근(읽기 포함)을 막는 가장 강한 락 모드의 단일 단어는?',
    ['EXCLUSIVE'],
    '락',
    'EXCLUSIVE 모드는 배타 락으로, 다른 트랜잭션의 모든 접근을 차단합니다. 가장 강한 락 모드입니다.',
    '테이블 구조 변경(DDL) 같은 치명적 작업 동안 다른 모든 트랜잭션의 접근(심지어 읽기) 조차 차단해야 합니다.',
    'EXCLUSIVE 는 읽기까지 차단하는 가장 강한 락. 동시성을 최대한 희생하는 대신 절대적 안전을 보장해 스키마 변경/대규모 재구성 같은 작업에 적합합니다.',
  ),
  term(
    '락이 다른 트랜잭션에 의해 점유 중일 때 대기하지 않고 즉시 에러를 반환하는 옵션 키워드는?',
    ['NOWAIT'],
    '락',
    'NOWAIT 옵션을 LOCK TABLE 또는 SELECT FOR UPDATE에 붙이면 락 점유 시 ORA-00054 에러를 즉시 반환합니다.',
    '사용자 화면에서 락을 기다리다 영원히 멈추는 일을 피해야 합니다. 락 못 잡으면 즉시 실패로 대체 경로를 타고 싶습니다.',
    'NOWAIT 는 락 실패를 즉각적인 ORA-00054 로 변환합니다. 애플리케이션이 "다른 사람이 작업 중입니다" 같은 메시지를 빠르게 보여주어 UX 를 크게 개선합니다.',
  ),
  term(
    'Oracle 읽기 일관성을 식별하는 시스템 변경 번호(System Change Number)의 약어는?',
    ['SCN'],
    '읽기 일관성',
    'SCN은 Oracle이 모든 변경에 부여하는 단조 증가 번호입니다. 읽기 일관성, recovery, flashback 모두 SCN을 기반으로 동작합니다.',
    '특정 시점의 데이터 상태로 돌아가보거나 장애 복구 시점을 지정하는 등 시간 축 기반 동작이 필요합니다.',
    'Oracle 은 시간 기반 대신 자체적으로 단조 증가하는 번호 SCN 을 사용합니다. 읽기 일관성/ flashback/ recovery 등 시점 관리의 공통 축으로 모든 Oracle 기능이 SCN 에 의존합니다.',
  ),
];

export const WEEK2_TRANSACTIONS_QUESTIONS: QuestionSeed[] = [
  ...BLANK_TYPING_QUESTIONS,
  ...TERM_MATCH_QUESTIONS,
];
