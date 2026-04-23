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

/**
 * UX #2 (ux-redesign-brief-v1.md §2.2, 2026-04-23) — 모든 seed 에 scenario + rationale
 * 필수. "이 쿼리가 해결하는 상황" + "왜 이 문법을 쓰는가" 를 제공해 빈칸만 보여주는
 * 난잡함을 해소.
 */
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
    '사원 명부를 보면서 각 사원의 이름(ENAME)과 급여(SAL)가 얼마인지 확인하고 싶습니다.',
    '테이블 전체를 다 보는 대신 필요한 컬럼만 명시하면 결과가 깔끔해지고 네트워크 부담도 줄어듭니다. 그래서 두 컬럼을 콕 집어 고르는 키워드 SELECT 을 씁니다.',
  ),
  blank(
    'SELECT ENAME ___ EMP;',
    [{ position: 0, answer: 'FROM', hint: '어느 테이블에서 가져올지 지정' }],
    ['FROM'],
    'FROM 절은 조회 대상 테이블을 지정합니다.',
    '사원 이름 목록을 조회하려는데, 데이터가 어느 테이블에 저장돼 있는지 DB 에 알려줘야 합니다.',
    'SELECT 뒤에 컬럼을 적어도, 그 컬럼이 어느 테이블의 것인지 모르면 DB 가 찾을 수 없습니다. FROM 절로 "EMP 테이블에서 가져와라" 를 명시해야 쿼리가 완성됩니다.',
  ),
  blank(
    'SELECT * FROM EMP ___ SAL > 3000;',
    [{ position: 0, answer: 'WHERE', hint: '조건절 키워드' }],
    ['WHERE'],
    'WHERE 절은 행을 필터링하는 조건을 지정합니다.',
    '전체 사원 중 급여가 3000 을 넘는 고액 연봉자만 뽑아서 확인하고 싶습니다.',
    '모든 사원을 보면 화면이 길어지고 원하는 사람 찾기 어렵습니다. WHERE 로 조건(SAL > 3000)에 맞는 행만 남기면 결과가 간결해져 바로 원하는 정보를 얻습니다.',
  ),
  blank(
    'SELECT * FROM EMP ORDER ___ SAL DESC;',
    [{ position: 0, answer: 'BY', hint: 'ORDER 다음에 오는 키워드' }],
    ['BY'],
    'ORDER BY는 결과를 정렬할 때 사용합니다. DESC는 내림차순입니다.',
    '사원 명부를 연봉 높은 사람부터 내려오는 순서로 정렬해서 상위권을 한눈에 보고 싶습니다.',
    'DB 는 기본적으로 결과 순서를 보장하지 않습니다. 보기 좋게 정리하려면 정렬 기준 컬럼을 ORDER BY 뒤에 지정해야 합니다. DESC 는 내림차순(큰 값부터) 을 의미합니다.',
  ),
  blank(
    'SELECT DEPTNO, COUNT(*) FROM EMP GROUP ___ DEPTNO;',
    [{ position: 0, answer: 'BY', hint: 'GROUP 다음에 오는 키워드' }],
    ['BY'],
    'GROUP BY는 특정 컬럼 값으로 행을 그룹화합니다.',
    '부서별로 사원이 몇 명씩 있는지 집계 보고서를 만들고 싶습니다.',
    '전체 사원을 한꺼번에 COUNT 하면 총 인원 한 줄만 나옵니다. 부서(DEPTNO) 단위로 묶어서 세려면 GROUP BY 로 기준 컬럼을 지정해야 부서별 집계가 나옵니다.',
  ),
  blank(
    'SELECT DEPTNO FROM EMP GROUP BY DEPTNO ___ COUNT(*) > 3;',
    [{ position: 0, answer: 'HAVING', hint: '그룹에 대한 조건절' }],
    ['HAVING'],
    'HAVING은 GROUP BY 결과에 조건을 거는 절입니다 (WHERE는 그룹화 전 필터).',
    '부서별 인원을 집계한 뒤, 인원이 3명을 초과하는 큰 부서만 골라서 보고 싶습니다.',
    'WHERE 는 그룹화 전 개별 행을 걸러내지만 "부서별 인원 수" 는 집계 후에만 알 수 있습니다. 집계 결과에 조건을 걸려면 HAVING 절이 필요합니다.',
  ),
  blank(
    'SELECT ___ JOB FROM EMP;',
    [{ position: 0, answer: 'DISTINCT', hint: '중복 제거 키워드' }],
    ['DISTINCT'],
    'DISTINCT는 SELECT 결과에서 중복된 행을 한 번만 보여줍니다.',
    '회사에 어떤 직책(JOB) 들이 있는지 종류만 파악하고 싶습니다. 같은 직책이 여러 번 나오지 않게 해야 합니다.',
    'SELECT JOB 만 쓰면 사원마다 한 줄씩 중복되게 나옵니다. DISTINCT 를 붙이면 동일한 JOB 값은 한 번만 나타나 직책 종류를 깔끔히 확인할 수 있습니다.',
  ),
  blank(
    'SELECT ENAME ___ "직원이름" FROM EMP;',
    [{ position: 0, answer: 'AS', hint: '별칭 지정 키워드 (생략 가능)' }],
    ['AS'],
    'AS는 컬럼이나 테이블에 별칭(alias)을 부여할 때 사용합니다. 생략 가능합니다.',
    '결과의 컬럼 헤더가 원어 그대로(ENAME) 나오는데, 한글 리포트로 쓰려면 "직원이름" 으로 표시하고 싶습니다.',
    '컬럼 뒤에 AS 를 쓰고 별칭을 지정하면 결과의 헤더명이 바뀝니다. 리포트/프론트 UI 노출용으로 유용합니다. AS 는 생략 가능하지만 명시적으로 쓰면 가독성이 좋습니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE SAL > 1000 ___ SAL < 3000;',
    [{ position: 0, answer: 'AND', hint: '논리곱 연산자' }],
    ['AND'],
    'AND는 두 조건이 모두 참일 때만 행을 선택합니다.',
    '중간 연봉대(1000 초과 3000 미만) 사원만 조회해야 합니다. 두 가지 조건을 동시에 만족해야 합니다.',
    'WHERE 절에 조건 두 개를 붙이려면 논리 연산자가 필요합니다. AND 는 두 조건 모두 참인 행만 통과시켜 "범위 내" 같은 교집합 필터에 적합합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE DEPTNO = 10 ___ DEPTNO = 20;',
    [{ position: 0, answer: 'OR', hint: '논리합 연산자' }],
    ['OR'],
    'OR는 두 조건 중 하나라도 참이면 행을 선택합니다.',
    '10번 부서 또는 20번 부서 사원만 같이 조회하고 싶습니다(두 부서 어느 쪽이든 포함).',
    '"둘 중 하나라도 만족" 은 OR 로 연결합니다. AND 로 쓰면 같은 행이 동시에 두 부서일 수 없어 결과가 0건이 되므로 반드시 OR 입니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE SAL ___ 1000 AND 3000;',
    [{ position: 0, answer: 'BETWEEN', hint: '범위 조건 연산자 (AND와 함께)' }],
    ['BETWEEN'],
    'BETWEEN A AND B는 A 이상 B 이하 (양 끝 포함) 범위를 조회합니다.',
    '연봉이 1000 이상 3000 이하인 사원을 한 줄로 간결하게 표현하고 싶습니다.',
    '"SAL >= 1000 AND SAL <= 3000" 을 써도 되지만, BETWEEN 은 같은 의미를 더 짧고 가독성 좋게 표현합니다. 양 끝 값(1000, 3000) 을 모두 포함한다는 점이 AND 조합과 동일합니다.',
  ),
  blank(
    "SELECT * FROM EMP WHERE ENAME ___ 'S%';",
    [{ position: 0, answer: 'LIKE', hint: '패턴 매칭 연산자' }],
    ['LIKE'],
    'LIKE는 와일드카드(%, _)를 이용한 패턴 매칭 연산자입니다.',
    '이름이 S 로 시작하는 모든 사원을 찾고 싶습니다(SMITH, SCOTT 등).',
    '정확 일치(=) 로는 "S 로 시작" 을 표현할 수 없습니다. LIKE 는 와일드카드 % (0개 이상의 임의 문자) 로 패턴 매칭이 가능해 "S%" 로 S 시작 모든 값을 조회합니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE COMM ___ NULL;',
    [{ position: 0, answer: 'IS', hint: 'NULL 비교 시 = 대신 사용' }],
    ['IS'],
    'NULL은 = 로 비교할 수 없으므로 IS NULL / IS NOT NULL을 사용합니다.',
    '수당(COMM) 이 지급되지 않은 사원(값이 NULL) 만 조회하고 싶습니다.',
    'NULL 은 "알 수 없음" 을 나타내 = 로는 비교가 불가능합니다(결과가 UNKNOWN 으로 평가). 반드시 IS NULL / IS NOT NULL 로만 검사해야 정확한 결과를 얻습니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE DEPTNO ___ (10, 20);',
    [{ position: 0, answer: 'IN', hint: '여러 값 중 하나와 일치하는지' }],
    ['IN'],
    'IN은 값이 괄호 안 목록에 포함되는지 확인합니다.',
    '여러 부서(10, 20) 중 하나에라도 속한 사원을 간결하게 조회하고 싶습니다.',
    '"DEPTNO = 10 OR DEPTNO = 20" 을 써도 되지만 값이 늘면 장황해집니다. IN (10, 20) 은 같은 의미를 한 표현으로 요약해 가독성과 유지보수성을 높입니다.',
  ),
  blank(
    'SELECT * FROM EMP WHERE ___ (SAL > 3000);',
    [{ position: 0, answer: 'NOT', hint: '부정 연산자' }],
    ['NOT'],
    'NOT은 조건을 부정합니다. NOT (SAL > 3000)은 SAL이 3000 이하인 행을 의미합니다.',
    '"연봉 3000 초과" 가 아닌 사원(즉 3000 이하) 을 뽑아야 합니다.',
    'SAL <= 3000 으로 직접 써도 되지만, 복잡한 조건을 통째로 뒤집을 때 NOT 이 편리합니다. 예: NOT (SAL > 3000 AND COMM IS NULL) 처럼 묶음 부정에 유용합니다.',
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
    '회사의 직책(JOB) 종류만 궁금한데 SELECT JOB 하면 사원마다 반복돼 길게 나옵니다. 한 번씩만 보려면 중복 제거 문법이 필요합니다.',
    'GROUP BY 없이도 중복을 제거하려면 DISTINCT 가 가장 간단합니다. 집계가 필요 없는 "유니크 값 목록" 에 최적입니다.',
  ),
  term(
    'WHERE 절에서 특정 범위(예: 1000 ~ 3000) 안의 값을 조회할 때 AND와 함께 쓰는 연산자는?',
    ['BETWEEN'],
    'SQL 연산자',
    'BETWEEN A AND B는 양 끝 값을 포함한 범위 조회입니다.',
    '급여가 1000 이상 3000 이하인 사원을 조회할 때 "SAL >= 1000 AND SAL <= 3000" 보다 짧게 쓰고 싶습니다.',
    '범위 조건은 두 비교식을 AND 로 잇는 것보다 단일 연산자로 표현하는 편이 가독성이 좋습니다. BETWEEN ~ AND ~ 이 그 역할입니다.',
  ),
  term(
    'NULL 값을 비교할 때 = 대신 사용하는 두 글자 키워드는?',
    ['IS'],
    'SQL 연산자',
    'NULL은 등가 비교 불가. IS NULL / IS NOT NULL로 비교합니다.',
    '커미션(COMM) 이 NULL 인 사원을 찾는데 "COMM = NULL" 로 쓰면 아무 결과도 안 나옵니다.',
    'NULL 은 "알 수 없음" 이라 = 로 비교하면 UNKNOWN 이 되어 WHERE 필터를 통과하지 못합니다. IS NULL / IS NOT NULL 만이 유효한 검사법입니다.',
  ),
  term(
    '와일드카드(%, _)를 사용해 문자열 패턴을 매칭하는 연산자는?',
    ['LIKE'],
    'SQL 연산자',
    'LIKE는 % (0개 이상 임의 문자), _ (1개 임의 문자) 와일드카드를 지원합니다.',
    '이름이 "S 로 시작" 하거나 "A 로 끝" 같은 부분 일치 검색이 필요합니다.',
    '정확 일치(=) 는 부분 일치 조회가 불가능합니다. LIKE 는 % 와 _ 와일드카드로 유연한 패턴 매칭을 제공하여 텍스트 검색의 기본입니다.',
  ),
  term(
    '결과를 정렬할 때 사용하는 두 단어 키워드 중 첫 번째 단어는?',
    ['ORDER'],
    'SQL 키워드',
    'ORDER BY가 정렬 절입니다. 첫 단어가 ORDER입니다.',
    '연봉 높은 순으로 사원 명부를 정렬해서 상위권을 바로 확인하고 싶습니다.',
    'DB 의 결과는 기본 순서가 보장되지 않아 매 번 뒤섞일 수 있습니다. ORDER BY 를 써야 동일한 순서가 보장되어 사람이 읽기 쉬운 리스트가 됩니다.',
  ),
  term(
    'ORDER BY 다음에 붙여서 내림차순 정렬을 지정하는 키워드는?',
    ['DESC'],
    'SQL 키워드',
    'DESC는 descending(내림차순). 생략 시 기본은 ASC입니다.',
    '연봉 랭킹 1위부터 보고 싶다면 큰 값 → 작은 값 순으로 정렬해야 합니다.',
    'ORDER BY 는 생략 시 오름차순(ASC) 이라 "큰 값부터" 를 원하면 DESC 를 명시해야 합니다. 리더보드/랭킹 쿼리의 기본 패턴입니다.',
  ),
  term(
    'ORDER BY 다음에 붙여서 오름차순을 명시할 때 쓰는 키워드는? (생략 가능)',
    ['ASC'],
    'SQL 키워드',
    'ASC는 ascending(오름차순). ORDER BY의 기본값입니다.',
    '사원을 입사일 빠른 순(오래된 사람 먼저) 으로 보고 싶습니다.',
    'ASC 는 작은 값 → 큰 값 순으로 정렬. ORDER BY 의 기본값이라 생략해도 되지만 명시하면 의도가 분명해 팀 리뷰 시 혼동이 줄어듭니다.',
  ),
  term(
    '계산용으로 사용하는 1행 1열짜리 가상 테이블의 이름은? (Oracle 전용)',
    ['DUAL'],
    'Oracle 특수',
    'DUAL은 SELECT만 하고 싶을 때 사용하는 Oracle 전용 1행 1열 가상 테이블입니다.',
    'SYSDATE 같은 함수 결과 한 줄만 확인하고 싶은데 조회할 실제 테이블이 없습니다.',
    'Oracle 의 SELECT 문은 반드시 FROM 절을 요구합니다. 함수 결과만 보고 싶을 때 마땅한 테이블이 없어서, Oracle 이 기본 제공하는 1행 1열 가상 테이블 DUAL 을 씁니다.',
  ),
  term(
    '두 SELECT 결과를 합치되 중복 행을 제거하는 집합 연산자는?',
    ['UNION'],
    '집합 연산자',
    'UNION은 두 결과의 합집합 (중복 제거). UNION ALL은 중복까지 보존합니다.',
    '활성 사원 목록과 퇴사자 명부를 합쳐서 "지금까지 재직했던 모든 사람" 을 한 리스트로 만들고 싶습니다.',
    '같은 사람이 양쪽에 있으면 한 번만 보여야 자연스럽습니다. UNION 은 자동으로 중복 행을 제거해 깔끔한 합집합을 만들어 줍니다.',
  ),
  term(
    'UNION에 무엇을 붙이면 중복 행도 모두 보존하나요?',
    ['ALL'],
    '집합 연산자',
    'UNION ALL은 두 결과를 단순 연결 (중복 제거 없음). 성능이 더 좋습니다.',
    '올해 1월과 2월 매출 로그를 순서대로 이어 붙이려는데, 같은 거래가 중복돼 있지 않다는 걸 이미 알고 있어 중복 제거로 시간 낭비하고 싶지 않습니다.',
    'UNION 은 중복 제거 때문에 내부적으로 정렬/해시 작업이 추가됩니다. 중복이 없다고 보장된다면 UNION ALL 로 바로 이어 붙이면 훨씬 빠릅니다.',
  ),
  term(
    '두 SELECT 결과의 차집합을 구하는 Oracle 전용 키워드는?',
    ['MINUS'],
    '집합 연산자',
    'MINUS는 첫 SELECT 결과에서 두 번째 결과에 있는 행을 뺍니다 (Oracle 방언).',
    '전체 사원 중 "이번 달 결재를 한 번도 안 올린 사원" 만 뽑고 싶습니다(전체 − 결재자).',
    'MINUS 는 "A 에는 있고 B 에는 없는" 행을 돌려주는 집합 차 연산자. Oracle 방언입니다(표준은 EXCEPT). "A 에서 B 제외" 유형의 조회에 직관적입니다.',
  ),
  term(
    '두 SELECT 결과의 교집합을 구하는 키워드는?',
    ['INTERSECT'],
    '집합 연산자',
    'INTERSECT는 두 결과 모두에 존재하는 행만 반환합니다.',
    '이번 달 출근한 사원 목록과 프로젝트 참여자 목록을 비교해, "출근도 했고 프로젝트에도 참여한" 사원만 보려 합니다.',
    'INTERSECT 는 두 집합 모두에 존재하는 행만 남겨 "양쪽 동시 만족" 을 선언적으로 표현합니다. JOIN 으로도 가능하지만 집합 의미가 분명한 경우 INTERSECT 가 가독성이 좋습니다.',
  ),
  term(
    '특정 컬럼 값을 기준으로 행을 묶어 집계할 때 쓰는 두 단어 중 첫 단어는?',
    ['GROUP'],
    'SQL 키워드',
    'GROUP BY는 그룹화의 기준 컬럼을 지정하는 절입니다.',
    '부서별 평균 연봉처럼 "기준 컬럼 별 집계값" 을 뽑아야 할 때 단순 SELECT 로는 안 됩니다.',
    '집계 함수(SUM, AVG 등) 를 그룹 단위로 쓰려면 DB 에게 "무엇을 기준으로 묶을지" 알려야 합니다. GROUP BY 가 그 기준 컬럼을 선언합니다.',
  ),
  term(
    'GROUP BY 결과에 조건을 걸 때 사용하는 키워드는? (WHERE는 그룹화 전 필터)',
    ['HAVING'],
    'SQL 키워드',
    'HAVING은 집계 결과에 조건을 거는 절. WHERE는 그룹화 전, HAVING은 그룹화 후입니다.',
    '부서별 평균 연봉을 구한 뒤 "평균이 2000 이상인 부서" 만 표시하려 합니다.',
    '평균 연봉은 그룹화 후에만 알 수 있습니다. 그룹화 이전의 개별 행 조건은 WHERE 로, 그룹화 이후 집계 결과 조건은 HAVING 으로 분리해야 올바른 결과가 나옵니다.',
  ),
  term(
    '컬럼이나 테이블에 별칭(alias)을 부여할 때 쓰는 키워드는? (생략 가능)',
    ['AS'],
    'SQL 키워드',
    'AS는 별칭 부여 키워드. SELECT ENAME AS 이름 또는 SELECT ENAME 이름 모두 가능합니다.',
    '리포트 헤더를 한글 "이름/급여" 등으로 노출하고 싶거나, 긴 테이블 이름을 짧게 줄여 JOIN 시 가독성을 높이고 싶습니다.',
    '별칭은 결과 헤더 표현과 JOIN 시 테이블 참조를 간결하게 만들어 가독성을 크게 개선합니다. AS 는 생략 가능하지만 명시하면 "별칭임" 이 분명해져 가독성이 더 좋습니다.',
  ),
];

export const WEEK1_SQL_BASICS_QUESTIONS: QuestionSeed[] = [
  ...BLANK_TYPING_QUESTIONS,
  ...TERM_MATCH_QUESTIONS,
];
