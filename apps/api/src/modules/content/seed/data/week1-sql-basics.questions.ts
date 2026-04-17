import type {
  BlankTypingContent,
  GameModeId,
  Question,
  TermMatchContent,
} from '@oracle-game/shared';

/**
 * 시드 문제 생성용 입력 (id/createdAt은 DB가 채움).
 */
export type QuestionSeed = Omit<Question, 'id' | 'createdAt'>;

const TOPIC = 'sql-basics' as const;
const WEEK = 1;
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
 * 빈칸 타이핑 15문제 (1주차 SQL 기초)
 *
 * 모든 SQL 토큰은 WEEK1_SQL_BASICS_SCOPE.keywords 안에 있어야 한다.
 * (테스트로 검증됨 — seed.service.test.ts)
 */
const BLANK_TYPING_QUESTIONS: QuestionSeed[] = [
  blank(
    '___ ENAME, SAL FROM EMP;',
    [{ position: 0, answer: 'SELECT', hint: '컬럼을 조회하는 키워드' }],
    ['SELECT'],
    'SELECT은 테이블에서 컬럼을 조회할 때 사용하는 가장 기본적인 키워드입니다.',
  ),
  blank(
    'SELECT ENAME ___ EMP;',
    [{ position: 0, answer: 'FROM', hint: '어느 테이블에서 가져올지 지정' }],
    ['FROM'],
    'FROM 절은 조회 대상 테이블을 지정합니다.',
  ),
  blank(
    'SELECT * FROM EMP ___ SAL > 3000;',
    [{ position: 0, answer: 'WHERE', hint: '조건절 키워드' }],
    ['WHERE'],
    'WHERE 절은 행을 필터링하는 조건을 지정합니다.',
  ),
  blank(
    'SELECT * FROM EMP ORDER ___ SAL DESC;',
    [{ position: 0, answer: 'BY', hint: 'ORDER 다음에 오는 키워드' }],
    ['BY'],
    'ORDER BY는 결과를 정렬할 때 사용합니다. DESC는 내림차순입니다.',
  ),
  blank(
    'SELECT DEPTNO, COUNT(*) FROM EMP GROUP ___ DEPTNO;',
    [{ position: 0, answer: 'BY', hint: 'GROUP 다음에 오는 키워드' }],
    ['BY'],
    'GROUP BY는 특정 컬럼 값으로 행을 그룹화합니다.',
  ),
  blank(
    'SELECT DEPTNO FROM EMP GROUP BY DEPTNO ___ COUNT(*) > 3;',
    [{ position: 0, answer: 'HAVING', hint: '그룹에 대한 조건절' }],
    ['HAVING'],
    'HAVING은 GROUP BY 결과에 조건을 거는 절입니다 (WHERE는 그룹화 전 필터).',
  ),
  blank(
    'SELECT ___ JOB FROM EMP;',
    [{ position: 0, answer: 'DISTINCT', hint: '중복 제거 키워드' }],
    ['DISTINCT'],
    'DISTINCT는 SELECT 결과에서 중복된 행을 한 번만 보여줍니다.',
  ),
  blank(
    'SELECT ENAME ___ "직원이름" FROM EMP;',
    [{ position: 0, answer: 'AS', hint: '별칭 지정 키워드 (생략 가능)' }],
    ['AS'],
    'AS는 컬럼이나 테이블에 별칭(alias)을 부여할 때 사용합니다. 생략 가능합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE SAL > 1000 ___ SAL < 3000;',
    [{ position: 0, answer: 'AND', hint: '논리곱 연산자' }],
    ['AND'],
    'AND는 두 조건이 모두 참일 때만 행을 선택합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE DEPTNO = 10 ___ DEPTNO = 20;',
    [{ position: 0, answer: 'OR', hint: '논리합 연산자' }],
    ['OR'],
    'OR는 두 조건 중 하나라도 참이면 행을 선택합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE SAL ___ 1000 AND 3000;',
    [{ position: 0, answer: 'BETWEEN', hint: '범위 조건 연산자 (AND와 함께)' }],
    ['BETWEEN'],
    'BETWEEN A AND B는 A 이상 B 이하 (양 끝 포함) 범위를 조회합니다.',
  ),
  blank(
    "SELECT * FROM EMP WHERE ENAME ___ 'S%';",
    [{ position: 0, answer: 'LIKE', hint: '패턴 매칭 연산자' }],
    ['LIKE'],
    'LIKE는 와일드카드(%, _)를 이용한 패턴 매칭 연산자입니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE COMM ___ NULL;',
    [{ position: 0, answer: 'IS', hint: 'NULL 비교 시 = 대신 사용' }],
    ['IS'],
    'NULL은 = 로 비교할 수 없으므로 IS NULL / IS NOT NULL을 사용합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE DEPTNO ___ (10, 20);',
    [{ position: 0, answer: 'IN', hint: '여러 값 중 하나와 일치하는지' }],
    ['IN'],
    'IN은 값이 괄호 안 목록에 포함되는지 확인합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE ___ (SAL > 3000);',
    [{ position: 0, answer: 'NOT', hint: '부정 연산자' }],
    ['NOT'],
    'NOT은 조건을 부정합니다. NOT (SAL > 3000)은 SAL이 3000 이하인 행을 의미합니다.',
  ),
];

/**
 * 용어 맞추기 15문제 (1주차 SQL 기초)
 *
 * description의 모든 영문 대문자 토큰도 화이트리스트 안에 있어야 한다.
 */
const TERM_MATCH_QUESTIONS: QuestionSeed[] = [
  term(
    'SELECT 문에서 중복 행을 한 번만 보여주도록 제거하는 키워드는?',
    ['DISTINCT'],
    'SQL 키워드',
    'DISTINCT는 SELECT 결과에서 중복된 행을 제거합니다.',
  ),
  term(
    'WHERE 절에서 특정 범위(예: 1000 ~ 3000) 안의 값을 조회할 때 AND와 함께 쓰는 연산자는?',
    ['BETWEEN'],
    'SQL 연산자',
    'BETWEEN A AND B는 양 끝 값을 포함한 범위 조회입니다.',
  ),
  term(
    'NULL 값을 비교할 때 = 대신 사용하는 두 글자 키워드는?',
    ['IS'],
    'SQL 연산자',
    'NULL은 등가 비교 불가. IS NULL / IS NOT NULL로 비교합니다.',
  ),
  term(
    '와일드카드(%, _)를 사용해 문자열 패턴을 매칭하는 연산자는?',
    ['LIKE'],
    'SQL 연산자',
    'LIKE는 % (0개 이상 임의 문자), _ (1개 임의 문자) 와일드카드를 지원합니다.',
  ),
  term(
    '결과를 정렬할 때 사용하는 두 단어 키워드 중 첫 번째 단어는?',
    ['ORDER'],
    'SQL 키워드',
    'ORDER BY가 정렬 절입니다. 첫 단어가 ORDER입니다.',
  ),
  term(
    'ORDER BY 다음에 붙여서 내림차순 정렬을 지정하는 키워드는?',
    ['DESC'],
    'SQL 키워드',
    'DESC는 descending(내림차순). 생략 시 기본은 ASC입니다.',
  ),
  term(
    'ORDER BY 다음에 붙여서 오름차순을 명시할 때 쓰는 키워드는? (생략 가능)',
    ['ASC'],
    'SQL 키워드',
    'ASC는 ascending(오름차순). ORDER BY의 기본값입니다.',
  ),
  term(
    '계산용으로 사용하는 1행 1열짜리 가상 테이블의 이름은? (Oracle 전용)',
    ['DUAL'],
    'Oracle 특수',
    'DUAL은 SELECT만 하고 싶을 때 사용하는 Oracle 전용 1행 1열 가상 테이블입니다.',
  ),
  term(
    '두 SELECT 결과를 합치되 중복 행을 제거하는 집합 연산자는?',
    ['UNION'],
    '집합 연산자',
    'UNION은 두 결과의 합집합 (중복 제거). UNION ALL은 중복까지 보존합니다.',
  ),
  term(
    'UNION에 무엇을 붙이면 중복 행도 모두 보존하나요?',
    ['ALL'],
    '집합 연산자',
    'UNION ALL은 두 결과를 단순 연결 (중복 제거 없음). 성능이 더 좋습니다.',
  ),
  term(
    '두 SELECT 결과의 차집합을 구하는 Oracle 전용 키워드는?',
    ['MINUS'],
    '집합 연산자',
    'MINUS는 첫 SELECT 결과에서 두 번째 결과에 있는 행을 뺍니다 (Oracle 방언).',
  ),
  term(
    '두 SELECT 결과의 교집합을 구하는 키워드는?',
    ['INTERSECT'],
    '집합 연산자',
    'INTERSECT는 두 결과 모두에 존재하는 행만 반환합니다.',
  ),
  term(
    '특정 컬럼 값을 기준으로 행을 묶어 집계할 때 쓰는 두 단어 중 첫 단어는?',
    ['GROUP'],
    'SQL 키워드',
    'GROUP BY는 그룹화의 기준 컬럼을 지정하는 절입니다.',
  ),
  term(
    'GROUP BY 결과에 조건을 걸 때 사용하는 키워드는? (WHERE는 그룹화 전 필터)',
    ['HAVING'],
    'SQL 키워드',
    'HAVING은 집계 결과에 조건을 거는 절. WHERE는 그룹화 전, HAVING은 그룹화 후입니다.',
  ),
  term(
    '컬럼이나 테이블에 별칭(alias)을 부여할 때 쓰는 키워드는? (생략 가능)',
    ['AS'],
    'SQL 키워드',
    'AS는 별칭 부여 키워드. SELECT ENAME AS 이름 또는 SELECT ENAME 이름 모두 가능합니다.',
  ),
];

export const WEEK1_SQL_BASICS_QUESTIONS: QuestionSeed[] = [
  ...BLANK_TYPING_QUESTIONS,
  ...TERM_MATCH_QUESTIONS,
];
