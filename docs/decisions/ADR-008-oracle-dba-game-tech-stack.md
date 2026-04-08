# ADR-008: Oracle DBA 학습 게임 기술 스택 결정

**상태**: 확정
**날짜**: 2026-04-08
**의사결정자**: 3+1 에이전트 합의

---

## 맥락 (Context)

Oracle DBA 부트캠프 수강생 ~20명을 위한 학습 게임을 개발한다. 솔로/랭킹/실시간 멀티플레이어를 지원하며, AI가 노션 수업 자료 기반으로 문제를 자동 생성한다. 5가지 게임 모드(빈칸 타이핑, 용어 맞추기, 결과 예측, 카테고리 분류, 시나리오 시뮬레이션)를 지원한다.

## 결정 (Decision)

**Modular Monolith + TypeScript Full-Stack** 기반으로 구축한다.

| 차원 | 결정 |
|------|------|
| 아키텍처 | Modular Monolith + WebSocket Gateway |
| 언어 | TypeScript (Full-Stack) |
| 프론트엔드 | Next.js (App Router) |
| 백엔드 | NestJS |
| 실시간 통신 | Socket.IO |
| Job Queue | BullMQ (Redis 기반) |
| 데이터베이스 | PostgreSQL |
| 캐시/실시간 상태 | Redis |
| AI 연동 | Claude API / OpenAI API |
| 배포 | Docker Compose (단일 VPS) |

## 선택지 (Options Considered)

### 선택지 A: Next.js API Routes + Socket.IO + BullMQ (Agent A)
- 장점: 배포 단순, 한 프레임워크로 통합
- 단점: 횡단 관심사(인증, 검증) 구조적 강제 어려움

### 선택지 B: Next.js + NestJS + Socket.IO (Agent B)
- 장점: Guard/Interceptor/Pipe로 보안 로직 계층적 강제, 모듈 분리 명확
- 단점: 프레임워크 2개 사용으로 초기 설정 복잡도 증가

### 선택지 C: Next.js + tRPC + PartyKit/Supabase (Agent C)
- 장점: BaaS로 2주 MVP 가능, tRPC 타입 안전
- 단점: 벤더 종속, WebSocket 통합 미성숙, 커스텀 게임 로직 제약

## 근거 (Rationale)

1. **NestJS 채택 (B안)**: 하네스 엔지니어링 철학("잘못하는 것이 불가능하게") 에 부합. Guard/Pipe로 인증·검증을 구조적으로 강제
2. **PostgreSQL 채택**: Oracle DBA 학습 맥락에서 관계형 DB 경험 일관성. SQLite는 동시성 제약
3. **BaaS 기각**: 벤더 종속 위험. 20명 규모에서 직접 구현의 복잡도가 수용 가능
4. **MVP 3단계**: 실시간 대전을 1단계부터 넣으면 가치 검증 지연

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 동의 (NestJS 제외 전부 일치) | TypeScript 풀스택 + Modular Monolith가 개발 속도 최적 |
| Agent B (품질) | 동의 (NestJS 강력 추천) | 구조적 보안 강제, AI 출력 검증 체계 |
| Agent C (대안) | 조건부 동의 (BaaS 대안 제시했으나 합의 수용) | 3단계 MVP + Spaced Repetition 후속 도입 제안 |
| **Reviewer** | **확정** | **4핵심차원 모두 합의 도출. NestJS는 B 근거 우세** |

## 결과 (Consequences)

- 긍정적: 단일 언어로 개발 인지 부하 최소화, 모듈 간 타입 공유로 버그 감소
- 긍정적: NestJS 모듈 구조가 5개 게임 모드 확장에 적합
- 부정적: NestJS 학습 곡선 (데코레이터 패턴에 익숙해져야 함)
- 주의사항: AI API 비용 관리 필요 (문제 생성 시 토큰 사용량 모니터링)

---

**관련 문서**: `docs/architecture/oracle-dba-learning-game-design.md`, `docs/review/consensus-001-oracle-dba-game.md`
