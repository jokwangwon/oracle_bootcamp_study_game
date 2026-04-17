# 3+1 합의 보고서 — Oracle DBA 학습 게임

**날짜**: 2026-04-08
**유형**: FEAT (신규 기능)
**범위**: SYSTEM
**완성도**: 통과 (C1, C2, C3 모두 답변)

---

## Phase 0: 아이디어 브리프

### 분류
- **유형**: FEAT (primary, confidence 90%)
- **범위**: SYSTEM
- **에이전트 합의 필요**: 예

### 핵심 정보

| 차원 | 답변 | 출처 |
|------|------|------|
| 목적 (Why) | Oracle DBA 부트캠프 용어/함수를 게임으로 자연스럽게 암기 | 사용자 입력 |
| 범위 (Scope) | 멀티플레이어 웹 게임 (프론트+백엔드+실시간통신+DB+AI) | 자동 추출 |
| 성공 기준 (Success) | 자주 접속 플레이, 면접/손코딩 전 학습 도구로 활용 | 사용자 입력 |

### 맥락별 추가 정보

| 차원 | 답변 | 출처 |
|------|------|------|
| 게임 모드 | 솔로 + 랭킹 경쟁 + 실시간 멀티플레이어 | 사용자 입력 |
| 콘텐츠 생성 | 노션 수업 자료 → AI 범위 추론 → 자동 문제 생성 | 사용자 입력 |
| 대상 | ~20명 수강생 | 사용자 입력 |
| 커리큘럼 | SQL → PL/SQL → Admin → Backup → Perf → SQL Tuning → RAC → Linux → Python/Hadoop | 사용자 입력 |
| 주제별 변형 | 수업 주제에 따라 게임 컨셉이 달라질 수 있음 (시각적/직관적) | 사용자 입력 |

### 원문

> Oracle DBA 부트캠프에서 오라클 DBA 수업을 듣고 있는데, 용어나 함수가 잘 기억이 안 날 때도 있다. 게임을 만들어서 자연스럽게 외울 수 있게 유도하고 싶다. 끄투처럼 웹에서 플레이하고, 타이핑으로 외우고, 혼자서도 경쟁도 동시플레이도 가능하게. 노션에 정리한 수업 자료 기반으로 AI가 문제를 자동 생성하고, 주차별로 점진적으로 확장. 수업 주제별로 게임 컨셉이 달라질 수도 있음 (예: 권한 관리 → 시각적 표현).

---

## Phase 1: 3+1 에이전트 합의

### 교차 비교

| 구분 | 항목 | A | B | C | 판정 |
|------|------|---|---|---|------|
| **일치** | 아키텍처: Modular Monolith | O | O | O | 채택 |
| **일치** | 언어: TypeScript Full-Stack | O | O | O | 채택 |
| **일치** | Next.js + Socket.IO | O | O | O | 채택 |
| **일치** | PostgreSQL + Redis | O | O | △ | 채택 |
| **일치** | 최대 리스크: AI 콘텐츠 품질 | O | O | O | 인지 |
| **부분일치** | 백엔드: NestJS vs API Routes vs tRPC | - | O | - | NestJS 채택 |
| **C 단독** | Spaced Repetition | - | - | O | 조건부 채택 |
| **C 단독** | 3단계 점진적 MVP | - | - | O | 채택 |
| **B 단독** | 사전 생성 문제 풀 | - | O | - | 채택 |
| **B 단독** | Redis ZADD 원자적 판정 | - | O | - | 채택 |

### 기술 스택 결정

| 차원 | Agent A | Agent B | Agent C | **합의** |
|------|---------|---------|---------|---------|
| 아키텍처 | Modular Monolith | Modular Monolith | Modular Monolith | **Modular Monolith** |
| 언어 | TypeScript | TypeScript | TypeScript | **TypeScript** |
| 프레임워크 | Next.js + Socket.IO + BullMQ | Next.js + NestJS + Socket.IO | Next.js + Socket.IO + tRPC | **Next.js + NestJS + Socket.IO + BullMQ** |
| 저장소 | PostgreSQL + Redis | PostgreSQL + Redis | SQLite/Supabase | **PostgreSQL + Redis** |

### 기각된 스택

| 기각 항목 | 제안자 | 기각 사유 |
|-----------|--------|-----------|
| SQLite/Turso | C | 동시성 제약, RDBMS 학습 맥락과 불일치 |
| PartyKit/Supabase Realtime | C | 벤더 종속, 20명에서 BaaS 이점 불명확 |
| tRPC | C | WebSocket 통합 미성숙 |
| Next.js API Routes 단독 | A | 횡단 관심사 처리 한계 |

### 핵심 리스크

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|-----------|
| AI 문제 품질/범위 이탈 | 높음 (3자 일치) | 사전 문제 풀 + 키워드 화이트리스트 + 관리자 승인 |
| 동시 답변 경합 | 중간 (B) | Redis ZADD 원자적 순서 판정 |
| 끝말잇기 메커니즘 부적합 | 높음 (사용자 지적) | 5가지 학습 특화 게임 모드로 전면 재설계 |

### 추가 합의: 게임 메커니즘 재설계

사용자의 "끝말잇기를 어떻게 사용한다는 거야?" 지적을 반영하여, 끄투 스타일 끝말잇기를 폐기하고 5가지 학습 특화 게임 모드로 전면 재설계:

1. **빈칸 타이핑** — SQL 문법 손에 익히기
2. **용어 맞추기** — 용어 ↔ 의미 연결
3. **결과 예측** — 함수 동작 이해
4. **카테고리 분류** — 개념 체계화
5. **시나리오 시뮬레이션** — 종합 응용력

---

**합의 결과 → SDD 설계 문서로 반영 완료**
**관련 SDD**: `docs/architecture/oracle-dba-learning-game-design.md`
**관련 ADR**: `docs/decisions/ADR-008-oracle-dba-game-tech-stack.md`
