# Gold Set B candidates

> 합성 시각: 2026-04-09
> 합성 모델: claude-opus-4-6 (1M context)
> 합성 방식: API 호출 대신 본 Claude Code 세션에서 직접 작성 (Anthropic API 크레딧 잔액 부족 우회, 동등 품질, 동일 모델)
> 합성 batch: 6 (mode × difficulty)
> 총 후보 수: 80 (목표)

## 검수 안내 (사용자 작업)

1. 각 후보 항목의 `- [ ] **채택**`을 `- [x] **채택**`으로 변경하면 채택됩니다.
2. 부적합/중복은 그대로 두면 거절됩니다. 거절 사유를 메모하려면 항목 아래에 한국어로 적어주세요 (감사 로그용).
3. 최종 30개 채택 시 **분포 권장**: easy 10 / medium 12 / hard 8 (SDD v2 §4.2).
4. 작성/검수 분리 원칙: 본 후보는 Claude가 합성했으므로 Claude는 본 검수에 관여하지 않습니다 (검수자 = 사용자).
5. 검수 완료 후 `compile-gold-set-b.ts` 후속 스크립트(task #20)를 실행하면 채택 항목이 `gold-set-b.ts`로 컴파일됩니다.

---

## blank-typing / EASY (14/14)

#### bt-easy-01

- [ ] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ENAME, SAL FROM EMP ___ BY SAL;`
- **blanks**: pos 0 → `ORDER` (hint: 정렬 절의 첫 단어)
- **answer**: `ORDER`
- **explanation**: ORDER BY는 결과를 정렬할 때 사용하는 두 단어 절이며, ORDER가 첫 단어입니다.
- **noteVsSeeds**: 시드는 BY 빈칸을 묻지만 본 후보는 ORDER 키워드 자체를 묻습니다.
grop by로 사용할수도 있고 의도가 명확하지 않아 난해함

#### bt-easy-02

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT * FROM EMP ORDER BY HIREDATE ___;`
- **blanks**: pos 0 → `ASC` (hint: 오름차순 정렬 키워드)
- **answer**: `ASC`
- **explanation**: ASC는 오름차순 정렬을 명시합니다 (생략 시 기본값).
- **noteVsSeeds**: 시드의 ORDER BY 패턴은 DESC를 사용하지만 본 후보는 ASC를 명시하는 입사일 정렬입니다.
나쁘진 않다만 DESC도 쓸수 있고 이런 혼란을 주는 문제는 글로 어떤걸 의도하는지 설명후 문제가 나오면 좋다
예를 들면 emp 중에서 입사일 기준으로 오름차순으로 정렬해서 출력하는 코드입니다 이렇게 작성하면 좋다

#### bt-easy-03

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ENAME FROM EMP ORDER BY SAL ___;`
- **blanks**: pos 0 → `DESC` (hint: 내림차순 정렬 키워드)
- **answer**: `DESC`
- **explanation**: DESC는 내림차순 정렬을 지정합니다.
- **noteVsSeeds**: 시드는 DESC가 이미 작성된 SQL에서 BY를 묻지만, 본 후보는 DESC 자체를 묻습니다.
위의 메모와 거의 동일한 이유 
#### bt-easy-04

- [ ] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT JOB, COUNT(*) FROM EMP ___ BY JOB;`
- **blanks**: pos 0 → `GROUP` (hint: 그룹화 절의 첫 단어)
- **answer**: `GROUP`
- **explanation**: GROUP BY는 컬럼 값으로 행을 그룹화합니다. GROUP이 첫 단어입니다.
- **noteVsSeeds**: 시드는 BY 빈칸을 묻지만 본 후보는 GROUP 키워드 자체를 묻고 컬럼도 JOB(시드는 DEPTNO)으로 다릅니다.
이것도 마찬가지로 order by를 사용할수도 있으므로 애매하다 이런 문제를 출제할것이면 무엇을 어떻게 할것인지 명시되어야 할듯 하다
#### bt-easy-05

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ___(*) FROM EMP;`
- **blanks**: pos 0 → `COUNT` (hint: 행의 개수를 세는 집계 함수)
- **answer**: `COUNT`
- **explanation**: COUNT(*)는 테이블의 전체 행 수를 반환하는 집계 함수입니다.
- **noteVsSeeds**: 시드는 COUNT(*)가 이미 작성된 SQL에서 다른 키워드를 묻지만, 본 후보는 COUNT 함수 자체를 묻습니다.
나쁘진 않다 
#### bt-easy-06

- [ ] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT * FROM EMP WHERE COMM IS NOT ___;`
- **blanks**: pos 0 → `NULL` (hint: 값이 없음을 나타내는 SQL 특수값)
- **answer**: `NULL`
- **explanation**: IS NOT NULL은 NULL이 아닌 행을 필터링하는 조건입니다.
- **noteVsSeeds**: 시드는 IS 키워드를 묻지만 본 후보는 NULL 자체를 묻습니다.
흐름상 나오는건 적절하지만 너무 쉬워서 애매하다
#### bt-easy-07

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT 1 + 1 FROM ___;`
- **blanks**: pos 0 → `DUAL` (hint: Oracle 전용 1행 1열 가상 테이블)
- **answer**: `DUAL`
- **explanation**: DUAL은 Oracle 전용 1행 1열 가상 테이블로, 단순 계산 결과만 조회할 때 FROM 절에 사용합니다.
- **noteVsSeeds**: 시드는 DUAL을 용어로만 묻지만 본 후보는 SQL 빈칸으로 묻습니다.
이건 좋다  알고 있어야 할 정보이다 
#### bt-easy-08

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ___(SAL) FROM EMP;`
- **blanks**: pos 0 → `AVG` (hint: 평균값을 반환하는 집계 함수)
- **answer**: `AVG`
- **explanation**: AVG는 숫자 컬럼의 평균값을 반환하는 집계 함수입니다.
- **noteVsSeeds**: 시드는 집계 함수를 빈칸으로 묻지 않으며, AVG 자체가 시드에 등장하지 않습니다.

#### bt-easy-09

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ___(SAL) FROM EMP WHERE DEPTNO = 10;`
- **blanks**: pos 0 → `MAX` (hint: 최댓값을 반환하는 집계 함수)
- **answer**: `MAX`
- **explanation**: MAX는 컬럼의 최댓값을 반환하는 집계 함수입니다. 부서별 최고 급여 조회에 사용합니다.
- **noteVsSeeds**: 시드에는 MAX 관련 문제가 전혀 없습니다.

#### bt-easy-10

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ___(HIREDATE) FROM EMP;`
- **blanks**: pos 0 → `MIN` (hint: 최솟값을 반환하는 집계 함수)
- **answer**: `MIN`
- **explanation**: MIN은 컬럼의 최솟값(가장 작은 숫자, 가장 이른 날짜 등)을 반환합니다.
- **noteVsSeeds**: 시드에는 MIN 관련 문제가 전혀 없습니다.

#### bt-easy-11

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT DEPTNO, ___(SAL) FROM EMP GROUP BY DEPTNO;`
- **blanks**: pos 0 → `SUM` (hint: 총합을 반환하는 집계 함수)
- **answer**: `SUM`
- **explanation**: SUM은 숫자 컬럼의 총합을 반환합니다. 부서별 급여 합계 등에 사용합니다.
- **noteVsSeeds**: 시드에는 SUM이 전혀 등장하지 않습니다.

#### bt-easy-12

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT ENAME FROM EMP ___ SELECT DNAME FROM DEPT;`
- **blanks**: pos 0 → `UNION` (hint: 두 SELECT 결과를 합치는 집합 연산자)
- **answer**: `UNION`
- **explanation**: UNION은 두 SELECT 결과를 합치며 중복 행을 제거합니다.
- **noteVsSeeds**: 시드는 UNION을 용어로 묻지만 본 후보는 실제 두 SELECT를 잇는 SQL 빈칸으로 묻습니다.

#### bt-easy-13

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT JOB FROM EMP UNION ___ SELECT DNAME FROM DEPT;`
- **blanks**: pos 0 → `ALL` (hint: UNION 뒤에 붙여 중복 보존)
- **answer**: `ALL`
- **explanation**: UNION ALL은 두 결과를 합치되 중복 행을 보존합니다 (성능이 더 좋음).
- **noteVsSeeds**: 시드는 ALL을 용어로만 묻지만 본 후보는 SQL에서 직접 묻습니다.

#### bt-easy-14

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: EASY
- **sql**: `SELECT DEPTNO FROM EMP ___ SELECT DEPTNO FROM DEPT;`
- **blanks**: pos 0 → `INTERSECT` (hint: 두 결과의 교집합)
- **answer**: `INTERSECT`
- **explanation**: INTERSECT는 두 SELECT 결과 모두에 존재하는 행만 반환합니다 (교집합).
- **noteVsSeeds**: 시드는 INTERSECT를 용어로만 묻지만 본 후보는 SQL 빈칸으로 묻습니다.
이런건 매우 좋다 힌트나 해당값을 요구하는 설명만 좀더 있으면 굉장히 좋을거 같다
---

## blank-typing / MEDIUM (14/14)

#### bt-medium-01

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT ENAME, SAL FROM EMP ___ ___ SAL DESC;`
- **blanks**: pos 0 → `ORDER` (hint: 정렬 절의 첫 단어); pos 1 → `BY` (hint: 정렬 절의 두 번째 단어)
- **answer**: `ORDER, BY`
- **explanation**: ORDER BY는 결과를 정렬하는 두 단어 키워드입니다. DESC는 내림차순.
- **noteVsSeeds**: 시드는 BY만 단독으로 묻지만 본 후보는 ORDER BY 두 단어를 모두 묻습니다.
좋긴 한데 쉬움과 난이도가 비슷하다 
#### bt-medium-02

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT JOB, AVG(SAL) FROM EMP ___ ___ JOB;`
- **blanks**: pos 0 → `GROUP` (hint: 그룹화 절의 첫 단어); pos 1 → `BY` (hint: 그룹화 절의 두 번째 단어)
- **answer**: `GROUP, BY`
- **explanation**: GROUP BY는 컬럼별로 행을 묶어 집계하는 두 단어 키워드입니다. AVG로 직무별 평균 급여를 구합니다.
- **noteVsSeeds**: 시드는 BY만 묻지만 본 후보는 GROUP BY 두 단어를 한 번에 묻고 집계 함수도 AVG로 변형합니다.
동일하게 쉬움과 난이도가 비슷하다
#### bt-medium-03

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT * FROM EMP WHERE MGR ___ ___;`
- **blanks**: pos 0 → `IS` (hint: NULL 비교 키워드); pos 1 → `NULL` (hint: 값 없음을 나타내는 특수값)
- **answer**: `IS, NULL`
- **explanation**: IS NULL은 NULL 값을 가진 행을 찾는 조건입니다. = NULL은 동작하지 않습니다. MGR이 NULL인 직원은 상사가 없는 최고 경영자입니다.
- **noteVsSeeds**: 시드는 COMM IS NULL에서 IS만 묻지만, 본 후보는 MGR 컬럼에서 IS NULL 두 단어를 한 번에 묻습니다.

#### bt-medium-04

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT * FROM EMP WHERE COMM IS ___ ___;`
- **blanks**: pos 0 → `NOT` (hint: 부정 키워드); pos 1 → `NULL` (hint: 값 없음을 나타내는 특수값)
- **answer**: `NOT, NULL`
- **explanation**: IS NOT NULL은 NULL이 아닌 행을 찾는 조건입니다. 커미션을 받는 직원만 조회.
- **noteVsSeeds**: 시드는 NOT을 단독으로 묻지만 본 후보는 NOT NULL의 조합을 묻습니다.

#### bt-medium-05

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT * FROM EMP WHERE DEPTNO ___ ___ (10, 20);`
- **blanks**: pos 0 → `NOT` (hint: 부정 키워드); pos 1 → `IN` (hint: 목록 포함 연산자)
- **answer**: `NOT, IN`
- **explanation**: NOT IN은 괄호 안 목록에 포함되지 않는 행을 선택합니다.
- **noteVsSeeds**: 시드는 IN과 NOT을 따로 묻지만 본 후보는 NOT IN 조합으로 묻습니다.

#### bt-medium-06

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT * FROM EMP WHERE ENAME ___ ___ 'S%';`
- **blanks**: pos 0 → `NOT` (hint: 부정 키워드); pos 1 → `LIKE` (hint: 패턴 매칭 연산자)
- **answer**: `NOT, LIKE`
- **explanation**: NOT LIKE는 패턴과 일치하지 않는 행을 선택합니다. S로 시작하지 않는 이름을 조회.
- **noteVsSeeds**: 시드는 LIKE와 NOT을 따로 묻지만 본 후보는 NOT LIKE 조합으로 묻습니다.

#### bt-medium-07

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT * FROM EMP WHERE SAL ___ ___ 1000 AND 3000;`
- **blanks**: pos 0 → `NOT` (hint: 부정 키워드); pos 1 → `BETWEEN` (hint: 범위 연산자)
- **answer**: `NOT, BETWEEN`
- **explanation**: NOT BETWEEN A AND B는 범위 밖의 값을 선택합니다.
- **noteVsSeeds**: 시드는 BETWEEN과 NOT을 따로 묻지만 본 후보는 NOT BETWEEN 조합을 묻습니다.

#### bt-medium-08

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT JOB, MAX(SAL) FROM EMP GROUP BY JOB ORDER ___ MAX(SAL) ___;`
- **blanks**: pos 0 → `BY` (hint: ORDER 다음에 오는 키워드); pos 1 → `DESC` (hint: 내림차순 정렬)
- **answer**: `BY, DESC`
- **explanation**: ORDER BY 절에 집계 결과를 사용해 정렬할 수 있고, DESC로 내림차순 정렬합니다.
- **noteVsSeeds**: 시드는 ORDER BY 단순 형태만 묻지만 본 후보는 집계 결과 기준 정렬과 DESC 조합입니다.

#### bt-medium-09

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT DEPTNO, AVG(SAL) FROM EMP ___ BY DEPTNO ___ AVG(SAL) > 2000;`
- **blanks**: pos 0 → `GROUP` (hint: 그룹화 절의 첫 단어); pos 1 → `HAVING` (hint: 집계 결과 조건절)
- **answer**: `GROUP, HAVING`
- **explanation**: GROUP BY로 묶고 HAVING으로 집계 결과(AVG)에 조건을 답니다.
- **noteVsSeeds**: 시드는 GROUP BY와 HAVING을 따로 묻지만 본 후보는 한 SQL에서 두 키워드를 동시에 묻습니다.

#### bt-medium-10

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT AVG(SAL) ___ "평균급여" FROM EMP;`
- **blanks**: pos 0 → `AS` (hint: 별칭 부여 키워드)
- **answer**: `AS`
- **explanation**: AS는 컬럼/표현식에 별칭을 부여합니다. 집계 함수 결과에도 사용 가능합니다.
- **noteVsSeeds**: 시드는 ENAME 컬럼에 AS를 사용하지만 본 후보는 집계 함수(AVG) 결과에 AS를 사용합니다.

#### bt-medium-11

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT COUNT(___ DEPTNO) FROM EMP;`
- **blanks**: pos 0 → `DISTINCT` (hint: 중복 제거 키워드)
- **answer**: `DISTINCT`
- **explanation**: COUNT(DISTINCT col)은 컬럼의 서로 다른 값의 개수를 셉니다.
- **noteVsSeeds**: 시드는 단순 SELECT DISTINCT만 묻지만 본 후보는 COUNT 안에 DISTINCT를 사용하는 응용형입니다.

#### bt-medium-12

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT ___(SAL), ___(SAL) FROM EMP;`
- **blanks**: pos 0 → `MAX` (hint: 최댓값 집계 함수); pos 1 → `MIN` (hint: 최솟값 집계 함수)
- **answer**: `MAX, MIN`
- **explanation**: MAX와 MIN은 각각 컬럼의 최댓값과 최솟값을 반환합니다. 한 SELECT에서 두 함수를 동시 호출.
- **noteVsSeeds**: 시드에는 MAX, MIN 자체가 등장하지 않습니다.

#### bt-medium-13

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT * FROM EMP WHERE HIREDATE BETWEEN '1981-01-01' ___ '1982-12-31';`
- **blanks**: pos 0 → `AND` (hint: BETWEEN 사이를 잇는 키워드)
- **answer**: `AND`
- **explanation**: BETWEEN A AND B 형식에서 AND는 범위의 두 끝값을 잇는 키워드입니다.
- **noteVsSeeds**: 시드는 AND를 논리곱으로만 묻지만 본 후보는 BETWEEN과 결합한 AND를 묻습니다.

#### bt-medium-14

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: MEDIUM
- **sql**: `SELECT JOB FROM EMP GROUP BY JOB ___ COUNT(*) >= 3;`
- **blanks**: pos 0 → `HAVING` (hint: 집계 결과 조건절)
- **answer**: `HAVING`
- **explanation**: HAVING은 GROUP BY 결과에 집계 함수 조건을 거는 절입니다. 직무별 인원이 3명 이상인 직무 조회.
- **noteVsSeeds**: 시드는 DEPTNO 그룹의 HAVING이지만 본 후보는 JOB 컬럼과 다른 임계값을 사용합니다.

---

## blank-typing / HARD (12/12)

#### bt-hard-01

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `___ ENAME ___ EMP ___ SAL > 2000;`
- **blanks**: pos 0 → `SELECT` (hint: 조회 키워드); pos 1 → `FROM` (hint: 테이블 지정 키워드); pos 2 → `WHERE` (hint: 조건절 키워드)
- **answer**: `SELECT, FROM, WHERE`
- **explanation**: SELECT, FROM, WHERE는 가장 기본적인 SQL 조회 절의 세 키워드입니다.
- **noteVsSeeds**: 시드는 각 키워드를 따로 묻지만 본 후보는 한 SQL에서 세 키워드를 동시에 묻는 종합형입니다.

#### bt-hard-02

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `___ ___ JOB FROM EMP ___ BY JOB;`
- **blanks**: pos 0 → `SELECT` (hint: 조회 키워드); pos 1 → `DISTINCT` (hint: 중복 제거 키워드); pos 2 → `ORDER` (hint: 정렬 절의 첫 단어)
- **answer**: `SELECT, DISTINCT, ORDER`
- **explanation**: SELECT DISTINCT로 중복 제거 후 ORDER BY로 정렬하는 응용 SQL입니다.
- **noteVsSeeds**: 시드는 DISTINCT 단독, ORDER 단독으로 묻지만 본 후보는 한 SQL에서 SELECT, DISTINCT, ORDER 세 키워드를 동시에 묻습니다.

#### bt-hard-03

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT DEPTNO, AVG(SAL) FROM EMP ___ BY DEPTNO ___ AVG(SAL) > 2000 ORDER ___ AVG(SAL) DESC;`
- **blanks**: pos 0 → `GROUP` (hint: 그룹화 절); pos 1 → `HAVING` (hint: 집계 결과 조건절); pos 2 → `BY` (hint: ORDER 다음 키워드)
- **answer**: `GROUP, HAVING, BY`
- **explanation**: GROUP BY로 그룹화하고 HAVING으로 필터링한 후 ORDER BY로 정렬하는 응용 SQL입니다.
- **noteVsSeeds**: 시드는 각각 따로 묻지만 본 후보는 한 SQL에서 GROUP/HAVING/BY 세 빈칸과 집계 함수 ORDER BY 응용을 묻습니다.

#### bt-hard-04

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT * FROM EMP WHERE DEPTNO ___ ___ (SELECT DEPTNO FROM DEPT);`
- **blanks**: pos 0 → `NOT` (hint: 부정 키워드); pos 1 → `IN` (hint: 목록 포함 연산자)
- **answer**: `NOT, IN`
- **explanation**: NOT IN과 서브쿼리를 결합한 응용 형태입니다. 부서 정보가 없는 직원을 찾을 때 사용할 수 있습니다.
- **noteVsSeeds**: 시드는 IN을 단순 리터럴 목록으로 묻지만 본 후보는 서브쿼리와 결합한 NOT IN을 묻습니다.

#### bt-hard-05

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT ENAME FROM EMP WHERE DEPTNO = 10 ___ ___ SELECT ENAME FROM EMP WHERE DEPTNO = 20;`
- **blanks**: pos 0 → `UNION` (hint: 두 결과를 합치는 집합 연산자); pos 1 → `ALL` (hint: 중복 보존)
- **answer**: `UNION, ALL`
- **explanation**: UNION ALL은 두 결과를 합치되 중복을 보존하므로 다른 부서의 직원 목록을 단순 결합합니다.
- **noteVsSeeds**: 시드는 UNION과 ALL을 용어로만 묻지만 본 후보는 SQL에서 두 빈칸으로 동시에 묻습니다.

#### bt-hard-06

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT JOB, COUNT(*) FROM EMP GROUP BY JOB ___ COUNT(*) > 1 ORDER BY COUNT(*) ___;`
- **blanks**: pos 0 → `HAVING` (hint: 집계 결과 조건절); pos 1 → `DESC` (hint: 내림차순 정렬)
- **answer**: `HAVING, DESC`
- **explanation**: HAVING으로 그룹 필터링 후 COUNT 결과 기준 내림차순 정렬하는 응용입니다.
- **noteVsSeeds**: 시드는 HAVING과 DESC를 따로 묻지만 본 후보는 한 SQL에서 결합합니다.

#### bt-hard-07

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT * FROM EMP WHERE SAL ___ 1000 ___ 3000 ___ BY SAL ASC;`
- **blanks**: pos 0 → `BETWEEN` (hint: 범위 연산자); pos 1 → `AND` (hint: BETWEEN 사이 키워드); pos 2 → `ORDER` (hint: 정렬 절의 첫 단어)
- **answer**: `BETWEEN, AND, ORDER`
- **explanation**: BETWEEN A AND B로 범위 필터링하고 ORDER BY로 정렬합니다.
- **noteVsSeeds**: 시드는 BETWEEN과 AND를 각각 묻지만 본 후보는 BETWEEN/AND/ORDER 세 빈칸을 결합합니다.

#### bt-hard-08

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT DEPTNO, ___(SAL) ___ "총급여" FROM EMP GROUP ___ DEPTNO;`
- **blanks**: pos 0 → `SUM` (hint: 총합 집계 함수); pos 1 → `AS` (hint: 별칭 부여 키워드); pos 2 → `BY` (hint: GROUP 다음 키워드)
- **answer**: `SUM, AS, BY`
- **explanation**: SUM 집계, AS 별칭 부여, GROUP BY 그룹화를 한 SQL에서 모두 사용하는 응용입니다.
- **noteVsSeeds**: 시드는 SUM, AS, BY를 각각 묻지 않거나 단독으로만 묻지만 본 후보는 세 빈칸을 결합합니다.

#### bt-hard-09

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT * FROM EMP WHERE COMM ___ NOT ___ ___ JOB IS NOT NULL;`
- **blanks**: pos 0 → `IS` (hint: NULL 비교 키워드); pos 1 → `NULL` (hint: 값 없음); pos 2 → `AND` (hint: 논리곱 연산자)
- **answer**: `IS, NULL, AND`
- **explanation**: IS NOT NULL과 AND를 조합해 두 조건을 모두 만족하는 행을 조회합니다.
- **noteVsSeeds**: 시드는 IS, NULL, AND를 각각 묻지만 본 후보는 한 SQL에서 세 빈칸을 결합합니다.

#### bt-hard-10

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT DEPTNO FROM DEPT ___ SELECT DEPTNO FROM EMP;`
- **blanks**: pos 0 → `MINUS` (hint: 차집합 연산자)
- **answer**: `MINUS`
- **explanation**: MINUS는 첫 결과에서 두 번째 결과를 뺀 차집합으로, 직원이 없는 부서를 찾을 때 사용합니다.
- **noteVsSeeds**: 시드는 MINUS를 용어로만 묻지만 본 후보는 의미 있는 SQL 컨텍스트(직원 없는 부서)에서 묻습니다.

#### bt-hard-11

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT * FROM EMP WHERE ENAME ___ '_A%';`
- **blanks**: pos 0 → `LIKE` (hint: 패턴 매칭 연산자)
- **answer**: `LIKE`
- **explanation**: LIKE의 _ 와일드카드는 정확히 1글자를, %는 0개 이상 임의 문자를 의미합니다. '_A%'는 두 번째 글자가 A인 이름을 찾습니다.
- **noteVsSeeds**: 시드는 LIKE를 'S%' 단순 패턴으로 묻지만 본 후보는 '_A%'의 _ 와일드카드까지 학습할 수 있습니다.

#### bt-hard-12

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: blank-typing
- **difficulty**: HARD
- **sql**: `SELECT * FROM EMP WHERE DEPTNO ___ (10, 20) ___ JOB IS NOT NULL;`
- **blanks**: pos 0 → `IN` (hint: 목록 포함 연산자); pos 1 → `OR` (hint: 논리합 연산자)
- **answer**: `IN, OR`
- **explanation**: IN으로 부서 목록을 필터링하거나 OR로 직무가 등록된 직원을 모두 선택하는 복합 조건입니다.
- **noteVsSeeds**: 시드는 IN과 OR을 각각 단순 컨텍스트에서 묻지만 본 후보는 IN, OR, IS NOT NULL의 복합형입니다.

---

## term-match / EASY (14/14)

#### tm-easy-01

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 컬럼이나 표현식을 조회하는 구문의 가장 첫 키워드는 무엇인가요?
- **category**: SQL 키워드
- **answer**: `SELECT`
- **explanation**: SELECT은 SQL 조회의 시작 키워드로, 어떤 컬럼/표현식을 가져올지 명시합니다.
- **noteVsSeeds**: 시드 빈칸은 SELECT가 답이지만 시드 용어에는 SELECT를 직접 묻는 항목이 없습니다.

#### tm-easy-02

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 어느 테이블에서 데이터를 가져올지 지정하는 키워드는?
- **category**: SQL 키워드
- **answer**: `FROM`
- **explanation**: FROM은 SELECT 다음에 오며, 조회 대상 테이블을 지정합니다.
- **noteVsSeeds**: 시드 용어에는 FROM을 직접 묻는 항목이 없습니다.

#### tm-easy-03

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 행을 필터링하는 조건절의 시작 키워드는?
- **category**: SQL 키워드
- **answer**: `WHERE`
- **explanation**: WHERE는 행 단위 필터링 조건을 시작하는 키워드입니다.
- **noteVsSeeds**: 시드 용어에 WHERE 자체를 묻는 항목이 없습니다.

#### tm-easy-04

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 두 조건이 동시에 참일 때만 행을 선택하는 논리 연산자는?
- **category**: SQL 연산자
- **answer**: `AND`
- **explanation**: AND는 논리곱 연산자로, 양쪽 조건이 모두 참일 때 행을 선택합니다.
- **noteVsSeeds**: 시드 용어에는 AND가 없습니다.

#### tm-easy-05

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 두 조건 중 하나라도 참이면 행을 선택하는 논리 연산자는?
- **category**: SQL 연산자
- **answer**: `OR`
- **explanation**: OR는 논리합 연산자로, 둘 중 하나만 참이어도 행을 선택합니다.
- **noteVsSeeds**: 시드 용어에는 OR가 없습니다.

#### tm-easy-06

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 조건을 부정하는 단일 키워드 논리 연산자는?
- **category**: SQL 연산자
- **answer**: `NOT`
- **explanation**: NOT은 조건의 결과를 반대로 뒤집습니다 (참이면 거짓, 거짓이면 참).
- **noteVsSeeds**: 시드 용어에는 NOT 단독 항목이 없습니다.

#### tm-easy-07

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 컬럼 값이 괄호 안 목록 중 하나와 일치하는지 확인하는 두 글자 연산자는?
- **category**: SQL 연산자
- **answer**: `IN`
- **explanation**: IN은 값 목록과의 일치 여부를 검사하는 연산자로, 여러 OR 조건을 간결히 표현합니다.
- **noteVsSeeds**: 시드 용어에는 IN이 없습니다.

#### tm-easy-08

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 행의 개수를 세는 집계 함수 이름은?
- **category**: 집계 함수
- **answer**: `COUNT`
- **explanation**: COUNT(*)는 전체 행 수를 반환하고, COUNT(컬럼)은 NULL이 아닌 행 수를 반환합니다.
- **noteVsSeeds**: 시드 용어에는 COUNT가 없습니다.

#### tm-easy-09

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 숫자 컬럼의 총합을 반환하는 집계 함수는?
- **category**: 집계 함수
- **answer**: `SUM`
- **explanation**: SUM은 숫자 컬럼 값의 총합을 계산합니다 (NULL은 무시).
- **noteVsSeeds**: 시드 용어에는 SUM이 없습니다.

#### tm-easy-10

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 숫자 컬럼의 평균값을 반환하는 집계 함수는?
- **category**: 집계 함수
- **answer**: `AVG`
- **explanation**: AVG는 숫자 컬럼 값의 평균을 계산합니다 (NULL은 제외).
- **noteVsSeeds**: 시드 용어에는 AVG가 없습니다.

#### tm-easy-11

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 컬럼 값 중 가장 큰 값을 반환하는 집계 함수는?
- **category**: 집계 함수
- **answer**: `MAX`
- **explanation**: MAX는 컬럼의 최댓값을 반환합니다. 숫자, 날짜, 문자 모두 가능합니다.
- **noteVsSeeds**: 시드 용어에는 MAX가 없습니다.

#### tm-easy-12

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 컬럼 값 중 가장 작은 값을 반환하는 집계 함수는?
- **category**: 집계 함수
- **answer**: `MIN`
- **explanation**: MIN은 컬럼의 최솟값(가장 작은 숫자, 가장 이른 날짜 등)을 반환합니다.
- **noteVsSeeds**: 시드 용어에는 MIN이 없습니다.

#### tm-easy-13

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: 값이 없거나 알 수 없음을 나타내는 특수 값의 이름은?
- **category**: SQL 특수값
- **answer**: `NULL`
- **explanation**: NULL은 값의 부재를 의미하며, =로 비교할 수 없고 IS NULL 또는 IS NOT NULL을 사용해야 합니다.
- **noteVsSeeds**: 시드 용어에는 NULL 자체를 묻는 항목이 없습니다 (IS만 묻습니다).

#### tm-easy-14

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: EASY
- **description**: Oracle 학습용 전통 스키마에서 직원 정보를 담는 짧은 테이블 이름은?
- **category**: 예시 테이블
- **answer**: `EMP`
- **explanation**: EMP는 Oracle 교재의 전통적인 직원 테이블이며, ENAME, SAL, JOB, DEPTNO 등의 컬럼을 가집니다.
- **noteVsSeeds**: 시드 용어에는 예시 테이블/컬럼을 묻는 항목이 없습니다.

---

## term-match / MEDIUM (14/14)

#### tm-medium-01

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 결과를 정렬하는 ORDER BY 절의 두 번째 단어는?
- **category**: SQL 키워드
- **answer**: `BY`
- **explanation**: ORDER BY가 정렬 절이며, 두 번째 단어는 BY입니다. ORDER 단독은 동작하지 않습니다.
- **noteVsSeeds**: 시드는 ORDER 첫 단어를 묻지만 본 후보는 두 번째 단어 BY를 묻습니다.

#### tm-medium-02

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 행을 묶어 집계할 때 사용하는 GROUP BY 절의 두 번째 단어는?
- **category**: SQL 키워드
- **answer**: `BY`
- **explanation**: GROUP BY가 그룹화 절이며, 두 번째 단어는 BY입니다.
- **noteVsSeeds**: 시드는 GROUP 첫 단어를 묻지만 본 후보는 두 번째 단어 BY를 묻습니다.

#### tm-medium-03

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: NULL이 아닌 값을 찾을 때 IS 다음에 붙이는 단일 단어 키워드는?
- **category**: SQL 연산자
- **answer**: `NOT`
- **explanation**: IS NOT NULL은 NULL이 아닌 행을 선택합니다. IS와 NULL 사이에 NOT을 끼워 부정합니다.
- **noteVsSeeds**: 시드는 IS만 묻지만 본 후보는 IS 뒤의 NOT을 묻습니다.

#### tm-medium-04

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: WHERE는 그룹화 전 필터인데, 그룹화 후 집계 결과(COUNT, SUM 등)에 조건을 거는 키워드는?
- **category**: SQL 키워드
- **answer**: `HAVING`
- **explanation**: HAVING은 GROUP BY 이후 집계 결과(COUNT, SUM, AVG 등)에 조건을 거는 절입니다.
- **noteVsSeeds**: 시드도 HAVING을 묻지만 본 후보는 WHERE와의 차이를 강조하는 다른 description입니다.

#### tm-medium-05

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 컬럼 별칭 부여 시 사용하지만 생략해도 동일하게 동작하는 두 글자 키워드는?
- **category**: SQL 키워드
- **answer**: `AS`
- **explanation**: AS는 별칭 부여 키워드이며 생략 가능합니다 (SELECT ENAME 이름 == SELECT ENAME AS 이름).
- **noteVsSeeds**: 시드도 AS를 묻지만 본 후보는 "생략 가능"이라는 다른 측면을 강조합니다.

#### tm-medium-06

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 두 값 사이 범위를 조회할 때 두 끝값을 모두 포함하는 연산자는?
- **category**: SQL 연산자
- **answer**: `BETWEEN`
- **explanation**: BETWEEN A AND B는 양 끝값(A와 B)을 모두 포함하는 범위 조건입니다.
- **noteVsSeeds**: 시드는 "AND와 함께 쓰는 연산자"라는 description이지만 본 후보는 "양 끝값 포함"이라는 다른 측면입니다.

#### tm-medium-07

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 같은 컬럼에서 서로 다른 값의 개수만 알고 싶을 때 COUNT 안에 함께 쓰는 키워드는?
- **category**: SQL 키워드
- **answer**: `DISTINCT`
- **explanation**: COUNT(DISTINCT col)은 컬럼의 unique value 개수를 셉니다.
- **noteVsSeeds**: 시드는 단순 SELECT DISTINCT만 묻지만 본 후보는 COUNT(DISTINCT) 응용 컨텍스트입니다.

#### tm-medium-08

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: ORDER BY에서 정렬 방향을 명시하지 않으면 자동 적용되는 방향 키워드는?
- **category**: SQL 키워드
- **answer**: `ASC`
- **explanation**: ASC(오름차순)는 ORDER BY의 기본값으로, 명시하지 않아도 자동 적용됩니다.
- **noteVsSeeds**: 시드도 ASC를 묻지만 본 후보는 "기본값"이라는 다른 각도에서 묻습니다.

#### tm-medium-09

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 결과를 큰 값부터 작은 값 순서로 정렬할 때 사용하는 키워드는?
- **category**: SQL 키워드
- **answer**: `DESC`
- **explanation**: DESC(descending)는 내림차순 정렬을 명시합니다.
- **noteVsSeeds**: 시드는 "ORDER BY 다음에 붙이는 내림차순 키워드"이지만 본 후보는 "큰 값에서 작은 값"으로 풀어서 묻습니다.

#### tm-medium-10

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 두 SELECT 결과를 합치되 중복 행도 모두 보존하는 UNION ALL 절의 두 번째 단어는?
- **category**: 집합 연산자
- **answer**: `ALL`
- **explanation**: UNION ALL은 합집합이지만 중복 제거 없이 단순 연결합니다 (성능이 더 좋음).
- **noteVsSeeds**: 시드는 ALL을 단독으로 묻지만 본 후보는 UNION ALL 컨텍스트의 두 번째 단어로 묻습니다.

#### tm-medium-11

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: 표준 차집합 키워드와 별도로, Oracle에서 두 SELECT 결과의 차집합을 구하는 전용 키워드는?
- **category**: 집합 연산자
- **answer**: `MINUS`
- **explanation**: MINUS는 Oracle의 차집합 연산자입니다 (ANSI 표준은 다른 키워드를 사용).
- **noteVsSeeds**: 시드도 MINUS를 묻지만 본 후보는 ANSI 표준과 비교하는 다른 컨텍스트입니다.

#### tm-medium-12

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: Oracle 전통 EMP 테이블에서 직원의 커미션을 저장하는 짧은 컬럼 이름은?
- **category**: 예시 컬럼
- **answer**: `COMM`
- **explanation**: COMM은 EMP 테이블의 commission 컬럼이며, NULL일 수 있습니다 (모든 직원이 받는 건 아님).
- **noteVsSeeds**: 시드 용어에 컬럼명을 묻는 항목이 없습니다.

#### tm-medium-13

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: Oracle 학습용 전통 스키마에서 부서 정보를 담는 짧은 테이블 이름은?
- **category**: 예시 테이블
- **answer**: `DEPT`
- **explanation**: DEPT는 부서 테이블이며, DEPTNO, DNAME, LOC 컬럼을 가집니다.
- **noteVsSeeds**: 시드 용어에 DEPT를 묻는 항목이 없습니다.

#### tm-medium-14

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: MEDIUM
- **description**: EMP 테이블에서 직원의 입사일을 기록하는 컬럼 이름은?
- **category**: 예시 컬럼
- **answer**: `HIREDATE`
- **explanation**: HIREDATE는 EMP 테이블의 입사일 컬럼이며 DATE 타입입니다.
- **noteVsSeeds**: 시드 용어에 컬럼명을 묻는 항목이 없습니다.

---

## term-match / HARD (12/12)

#### tm-hard-01

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: COUNT(*) 대신 컬럼의 서로 다른 값 개수만 세고 싶을 때 컬럼 앞에 붙이는 키워드는?
- **category**: SQL 키워드
- **answer**: `DISTINCT`
- **explanation**: COUNT(DISTINCT col)은 NULL을 제외한 unique 값 개수를 반환합니다.
- **noteVsSeeds**: 시드는 SELECT DISTINCT 단순형이지만 본 후보는 COUNT 안의 응용형을 묻습니다.

#### tm-hard-02

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: 컬럼 값이 괄호 안 목록에 포함되지 *않는* 행을 찾을 때 IN 앞에 붙이는 키워드는?
- **category**: SQL 연산자
- **answer**: `NOT`
- **explanation**: NOT IN은 IN의 부정형으로, 목록에 포함되지 않는 행을 선택합니다.
- **noteVsSeeds**: 시드는 NOT을 단순 부정으로만 묻지만 본 후보는 NOT IN 컨텍스트를 묻습니다.

#### tm-hard-03

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: BETWEEN A AND B 형식에서 두 끝값을 잇는 키워드는? 같은 키워드가 논리곱으로도 사용됩니다.
- **category**: SQL 연산자
- **answer**: `AND`
- **explanation**: BETWEEN A AND B의 AND는 범위의 두 끝값을 잇는 역할이며, 일반 논리곱 AND와 같은 키워드입니다.
- **noteVsSeeds**: 시드는 단순 AND 논리곱을 묻지만 본 후보는 BETWEEN 풀이 컨텍스트로 묻습니다.

#### tm-hard-04

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: 단독으로 사용하면 두 SELECT 결과를 합칠 때 자동으로 중복 행을 제거하는 집합 연산자는?
- **category**: 집합 연산자
- **answer**: `UNION`
- **explanation**: UNION은 기본적으로 중복 행을 제거합니다 (UNION ALL은 보존).
- **noteVsSeeds**: 시드는 UNION을 "합집합" 정의로 묻지만 본 후보는 "중복 처리 동작"이라는 다른 측면을 묻습니다.

#### tm-hard-05

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: COUNT(컬럼명)은 어떤 값을 가진 행을 세지 않습니다. 그 값을 나타내는 특수값의 이름은?
- **category**: SQL 특수값
- **answer**: `NULL`
- **explanation**: COUNT(컬럼명)은 NULL이 아닌 행만 셉니다. COUNT(*)는 NULL과 무관하게 전체 행 수를 반환합니다.
- **noteVsSeeds**: 시드 용어에 NULL 자체를 묻는 항목이 없으며 COUNT 동작과 결합한 응용 컨텍스트입니다.

#### tm-hard-06

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: SELECT AVG(SAL) 결과 컬럼에 한국어 별칭을 부여하려면 어떤 키워드를 사용하나요?
- **category**: SQL 키워드
- **answer**: `AS`
- **explanation**: AS는 컬럼/표현식/집계 결과에 별칭을 부여합니다 (생략 가능).
- **noteVsSeeds**: 시드는 ENAME 별칭 컨텍스트지만 본 후보는 집계 함수(AVG) 결과 별칭을 묻습니다.

#### tm-hard-07

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: GROUP BY 절을 사용하면 SELECT 절에는 그룹화 컬럼과 어떤 함수의 결과만 사용할 수 있습니다. 행 개수를 세는 가장 흔한 그 함수의 이름은?
- **category**: 집계 함수
- **answer**: `COUNT`
- **explanation**: GROUP BY 시 SELECT 절에는 그룹화 컬럼과 집계 함수(COUNT, SUM, AVG, MAX, MIN) 결과만 가능합니다. COUNT는 가장 흔한 예입니다.
- **noteVsSeeds**: 시드 용어에 COUNT가 없으며 본 후보는 GROUP BY 규칙의 핵심을 묻습니다.

#### tm-hard-08

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: 정렬 절은 컬럼명 대신 SELECT 절에서의 컬럼 위치 번호로도 정렬할 수 있습니다. 이 정렬 절의 첫 단어는?
- **category**: SQL 키워드
- **answer**: `ORDER`
- **explanation**: ORDER BY 1은 SELECT 첫 번째 컬럼으로 정렬합니다. 위치 번호 정렬은 임시 디버깅에 유용합니다.
- **noteVsSeeds**: 시드도 ORDER를 묻지만 본 후보는 "위치 번호 정렬"이라는 응용 컨텍스트입니다.

#### tm-hard-09

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: WHERE SAL > 3000 조건에서 SAL이 가리키는 컬럼은 EMP 테이블의 어떤 컬럼인가요?
- **category**: 예시 컬럼
- **answer**: `SAL`
- **explanation**: SAL은 EMP 테이블의 salary(급여) 컬럼입니다.
- **noteVsSeeds**: 시드 용어에 컬럼명을 묻는 항목이 없습니다.

#### tm-hard-10

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: 단순 산술 계산을 SELECT만 하고 싶을 때 FROM 절에 사용하는 Oracle 전용 가상 테이블 이름은?
- **category**: Oracle 특수
- **answer**: `DUAL`
- **explanation**: DUAL은 1행 1열 가상 테이블이며, SELECT만 하고 싶을 때 FROM 절에 사용합니다.
- **noteVsSeeds**: 시드도 DUAL을 묻지만 본 후보는 "산술 계산"이라는 다른 컨텍스트입니다.

#### tm-hard-11

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: IS NOT NULL 조건에서 값이 없음을 나타내는 핵심 특수값의 이름은?
- **category**: SQL 특수값
- **answer**: `NULL`
- **explanation**: IS NOT NULL은 컬럼 값이 NULL이 아닌 행을 선택합니다. NULL은 SQL의 특수값 이름입니다.
- **noteVsSeeds**: 시드 용어에 NULL 자체를 묻는 항목이 없습니다.

#### tm-hard-12

- [x] **채택** — 채택하려면 `[ ]`를 `[x]`로 변경
- **mode**: term-match
- **difficulty**: HARD
- **description**: DEPT 테이블에서 부서 이름을 담는 컬럼의 짧은 이름은?
- **category**: 예시 컬럼
- **answer**: `DNAME`
- **explanation**: DNAME은 DEPT 테이블의 department name 컬럼입니다.
- **noteVsSeeds**: 시드 용어에 컬럼명을 묻는 항목이 없습니다.

---
