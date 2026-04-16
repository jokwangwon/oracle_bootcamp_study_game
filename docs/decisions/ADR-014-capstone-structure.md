# ADR-014: 주차별 독립 미니 캡스톤 + 최종 캡스톤 2트랙 (SQL / PL-SQL)

**상태**: Accepted
**날짜**: 2026-04-16
**의사결정자**: 3+1 에이전트 합의 + 사용자 최종 결정
**관련 합의**: `docs/review/consensus-004-problem-format-redesign.md`
**관련 ADR**: ADR-012 (answerFormat), ADR-013 (채점), ADR-018 (SR, P2)

---

## 맥락 (Context)

사용자 요청: **"최종적으로 해당 게임에서 얻어갈 수 있는 부분은 간단한 프로젝트 만들기까지 유도"**. 완결 조건은 **챌린지 형태**(게임 내 완결, 외부 공유 없음).

3+1 합의(consensus-004) 결과:
- **Agent A**: 3-entity 스키마(`capstone_templates` / `capstone_steps` / `capstone_sessions`) + `depends_on_step_ids` DAG 검증
- **Agent B**: 재플레이성 안전장치 필수 — 주제 팩 ≥ 4종 + `userId × 주차` 시드 변형
- **Agent C**: 14주 누적 1개 프로젝트 + 주차별 체크포인트 하이브리드

Reviewer 1차 권고는 C의 누적 구조였으나, 사용자 최종 결정:

> "주차별 독립 캡스톤, 최종 캡스톤 (유형별 (SQL, PL-SQL))"

→ 14주 누적 구조 거부. 주차별 독립 + 최종 2트랙.

## 결정 (Decision)

**캡스톤을 2계층 구조로 정의한다.**

### 계층 1: 주차별 미니 캡스톤 (Weekly Mini Capstone)

- 각 주차마다 독립 실행 가능. 주차 간 의존성 없음.
- 해당 주차 주제 + 누적 키워드 화이트리스트 내에서 단일 프로젝트 형태로 출제
- 예:
  - 1주차 sql-basics: "사원 정보 조회 미니 시스템" (SELECT/WHERE/ORDER BY 종합)
  - 2주차 transactions: "주문 정산 트랜잭션" (COMMIT/ROLLBACK/SAVEPOINT)
  - 3주차 joins: "부서-사원 조직도 리포트" (INNER/OUTER/SELF JOIN)
- 구성: **3~7 step** (적게 유지하여 주차 내 완료 가능)
- step 단위는 `answerFormat` 자유 혼합 (객관식 + 빈칸 + 작성형 혼합)
- 완료 시 주차 배지 지급, `user_progress`에 weekly_capstone_completed 기록

### 계층 2: 최종 캡스톤 — 2트랙 분리

코스 종료 시점(14주차 이후) 학생이 **하나 이상 선택**하여 수행:

#### 트랙 A: SQL 트랙
- 범위: DDL + DML + 조인 + 서브쿼리 + 집계/분석 함수 + 튜닝 기초
- 주제 팩(≥ 4종): 도서관 / 쇼핑몰 / 병원 / 물류
- step 수: 10~15
- answerFormat 혼합: 객관식(20%) + 빈칸(20%) + 작성형(50%) + 출력 테이블 선택(10%)

#### 트랙 B: PL/SQL 트랙
- 범위: 프로시저 + 함수 + 트리거 + 패키지 + 예외처리 + 커서 + 벌크 처리
- 주제 팩(≥ 4종): SQL 트랙과 동일 주제군 유지 + PL/SQL 블록 요구
- step 수: 10~15
- answerFormat 혼합: 작성형 비중 ↑ (60%), 객관식 20%, 빈칸 20%

### 물리 스키마 (Agent A 3-entity, 사용자 결정 반영하여 축소)

```typescript
// capstone_templates — 템플릿 정의 (주차별 미니 + 최종 2트랙 공용)
{
  id: UUID,
  slug: string,                         // e.g. 'week3-joins-library' / 'final-sql-library'
  kind: 'weekly' | 'final',
  track: 'sql' | 'plsql' | null,        // weekly는 null, final만 'sql'|'plsql'
  week: number | null,                  // weekly는 해당 주차, final은 null
  title: string,
  description: string,
  schema_ddl: string,                   // 템플릿 DB 스키마
  topic_pack: string,                   // 'library' | 'shopping' | 'hospital' | 'logistics'
  total_steps: number,
  status: 'draft' | 'approved'
}

// capstone_steps — 각 단계 문제
{
  id: UUID,
  template_id: UUID (FK),
  step_order: number,
  prompt: string,
  answer_format: AnswerFormat,          // ADR-012 축
  question_content: jsonb,              // QuestionContent discriminated union 재사용
  correct_answer: string[],
  depends_on_step_ids: UUID[]           // DAG (현재는 선형만 허용, 순환 금지)
}

// capstone_sessions — 사용자별 실행 상태
{
  id: UUID,
  user_id: UUID (FK),
  template_id: UUID (FK),
  seed: string,                         // hash(userId, week, templateId)
  started_at: timestamp,
  completed_at: timestamp | null,
  status: 'in_progress' | 'completed' | 'abandoned',
  step_progress: jsonb                  // [{step_id, is_correct, partial_score, submitted_at}]
}
```

### 재플레이성 안전장치 (Agent B 필수)

- **주제 팩 ≥ 4종** — 단일 템플릿 운영 금지. SQL/PL-SQL 트랙 각각 4종 이상.
- **시드 변형** — `seed = hash(userId, week, templateId)` → 테이블명/컬럼명/제약조건 permutation.
- **답안 공유 탐지** — `answer_history` 이상 유사도(edit distance < 10%) 자동 플래그 → 관리자 이벤트.
- **WORM** — `capstone_sessions.step_progress`는 append-only (ADR-016).

## 선택지 (Options Considered)

### 선택지 A: 주차별 독립 + 최종 2트랙 (채택, 사용자 결정)
- 장점: 주차별 완결 보장. SQL/PL-SQL 커리큘럼 구분 명확. 중도 이탈 시 손실 최소.
- 단점: 14주 장기 동기 약함 → SM-2(ADR-018) + 주간 릴리스로 보완.

### 선택지 B: 14주 누적 단일 프로젝트 (Reviewer 1차 원안)
- 장점: 동기 지속성 최고. 프로젝트 애착 형성.
- 단점: **사용자 거부**. 중도 이탈 시 손실 큼. 1주차 오답이 이후 전체 채점 무의미화 위험.

### 선택지 C: 고정 주제 1~3개 (단일 팩)
- 장점: 관리 단순.
- 단점: 답안 공유 보장(20명 단톡방). 재플레이 가치 없음.

### 선택지 D: 사용자 선택 풀 5~10개
- 장점: 다양성.
- 단점: 시드/프롬프트 관리 비용. 트랙 분리(SQL/PL-SQL) 원칙과 충돌.

## 근거 (Rationale)

**채택: 선택지 A**

- **사용자 최종 결정 직접 반영**.
- **Oracle DBA 부트캠프 커리큘럼 정합** — 실제 수업이 SQL(전반부) → PL/SQL(후반부) 구조이므로 최종 캡스톤 2트랙이 자연스럽다.
- **주차 독립성이 중도 이탈 리스크 완화** — Agent B 지적(14주 누적의 "1주차 오답 연쇄" 문제) 해소.
- **Agent A 3-entity 스키마 재사용** — 주차별 미니와 최종 2트랙이 동일 물리 구조 공유.
- **Agent B 재플레이성 안전장치 필수 포함** — 주제 팩 4종 + 시드 변형 + WORM.
- **SM-2(ADR-018)와 결합** — 주차별 완결 후 학습 내용을 SR 큐로 이전해 장기 기억 강화.

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 3-entity 스키마 제시 | `depends_on_step_ids` DAG 검증 + `capstone_sessions` 영속화. `GameSessionService.activeRounds` Map은 캡스톤 부적합 → DB 영속 |
| Agent B (품질) | 재플레이성 안전장치 필수 | 주제 팩 ≥ 4종 + 시드 변형 + WORM. 단일 템플릿 = 답안 공유 보장 |
| Agent C (대안) | 누적형 선호, 주차 독립형도 허용 | 14주 누적이 동기 우위지만 중도 이탈 손실 고려 시 주차 독립이 합리적 대안 |
| **Reviewer** | **선택지 A 채택 (사용자 최종 결정)** | 사용자 결정 + 커리큘럼 정합 + 중도 이탈 리스크 완화 |

## 결과 (Consequences)

### 긍정적
- 주차별 완결 → 매주 성취감 획득
- SQL/PL-SQL 커리큘럼 구분 명확 — 부트캠프 수업 구조 정합
- 중도 이탈 리스크 최소화
- 3-entity 스키마로 주차별 미니 + 최종 2트랙 공용 운영 가능

### 부정적
- 14주 장기 프로젝트 애착 형성 불가 → SM-2 + 주간 릴리스로 보완 필요
- 주차 × 트랙 × 주제 팩 = 템플릿 수 증가 (weekly 14 + final 2 × 4 = 22+ 템플릿)
- 시드 제작 비용 상 (수동 디자인 + AI 보조)

### 주의사항
- **주차별 미니 캡스톤 템플릿 시드 정책**: 14주 + 트랙 최종 2 × 4주제 = 22+ 템플릿. 관리자 review UI 우선순위 ↑.
- **DAG 순환 검사 CI**: `capstone_steps` seed 추가 시 `depends_on_step_ids` 위상 정렬 통과 테스트 필수.
- **`GameSessionService` 리팩터** — 기존 Map 기반 단일 라운드와 분리. 캡스톤은 `capstone_sessions` DB 영속.
- **최종 캡스톤 개시 조건** — `user_progress.weekly_capstone_completed ≥ 10주차` 권장(모든 주차 강제 아님, 학생 자율).
- **답안 공유 탐지 운영** — `answer_history` edit distance < 10% 플래그 → ops_event_log(`kind='capstone_similarity_alert'`).
- **트랙 전환** — 학생이 최종 캡스톤 둘 다 수행 가능. `capstone_sessions.template_id` 구분.

---

**관련 문서**:
- `docs/review/consensus-004-problem-format-redesign.md`
- `docs/architecture/oracle-dba-learning-game-design.md` §3.2/§5.1 (v2.9 개정 예정)
- ADR-012 (answerFormat 축), ADR-013 (채점), ADR-016 (WORM), ADR-018 (SM-2)
