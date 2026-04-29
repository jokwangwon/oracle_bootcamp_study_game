# 세션 로그 — 2026-04-29 Session 15

## 한줄 요약

**ADR-021 (Community Hub) + PR-13 (통합 e2e 하네스) 3+1 합의 + docs PR (consensus-013)** — 결정 8건 (도메인/카테고리/라우트/권한/Header/모더레이션 + PR-13 우선순위 + PR-13 도구). 만장일치 12.5% (1/8) / 유효 100% (8/8). 사용자 결정 12건 (Q-R6-01~12) — Reviewer 권장 대비 변경 4건 (외부 채널 부재 컨텍스트). 옵션 공간 재오픈 (옵션 F/G 신규). 산출 9개 docs (consensus-013 + ADR-021 + SDD 5종 + tdd-plan + impact + ADR-020 §11 행 + 시안 D §3.4 패치).

---

## 1. 세션 개요

| 항목 | 값 |
|---|---|
| 트리거 | Session 14 D5 (다음 세션 0순위 = ADR-021) + PR #60 / #61 머지 후 |
| 합의 가동 | 1회 (consensus-013) |
| 사용자 결정 | 12건 (Q-R6-01~12, 항목별 검토) |
| 신규 docs | 9개 (consensus-013 + ADR-021 + SDD 5종 + tdd-plan + impact) |
| 패치 docs | 2개 (ADR-020 §11+§12 + 시안 D §1+§3.4) |
| 코드 변화 | 0 (docs PR) |
| 외부 노트북 검증 | 0 (docs only) |

---

## 2. 트랙 1 — PR #60 / #61 머지 확인

세션 시작 시 사용자 요구: PR #60 + PR #61 둘 다 머지되었으면 ADR-021 합의 가동.

| PR | 상태 |
|---|---|
| #60 (PR-12 코드) | MERGED 2026-04-29 04:11 UTC |
| #61 (Session 14 docs) | OPEN → 사용자 머지 06:51 UTC |

PR #61 머지 사유 미달성 (CLEAN/MERGEABLE 상태였으나 사용자 머지 버튼 누락) — 사용자 보고 후 머지.

---

## 3. 트랙 2 — 3+1 합의 (consensus-013)

### 3.1 입력 자료

- consensus-012 §2.3 옵션 매트릭스 5개 (A/B/C/D/E)
- 결정 항목 6건 (도메인 모델 / 카테고리 / 라우트 / 권한 / Header / 모더레이션)
- + PR-13 우선순위 + PR-13 도구 = 8건
- Session 14 §3.1 hotfix 11건 패턴 (PR-13 가동 근거)
- 디자인 톤: 시안 D 일관 + sanitize-html + sanitize-schema + SWR + VoteButton 재사용

### 3.2 Phase 2 — Agent A/B/C 병렬 분석

3 에이전트 병렬 가동 (편향 방지). 각 에이전트는 자체 docs 읽기.

| 에이전트 | 핵심 출력 |
|---------|---------|
| **Agent A (구현)** | 도메인 = 옵션 D (NULL ALTER, expression index 무력화 위험 자가 지적) / 카테고리 = enum 3종 + tags 후속 / 라우트 = `/community/threads/[threadId]` 통합 / 권한 = 4-tier RBAC / Header = Hero 칩 + 비대칭 4번째 카드 / 모더레이션 = lock/pin/신고 1차 / **PR-13 = 즉시 분리, 병렬 머지** / 도구 = NestJS testing + supertest + Playwright |
| **Agent B (품질)** | 도메인 = 옵션 C (view, read-only) / 카테고리 = MVP 미도입 (slug XSS 위험) / 라우트 = `/community` 단일 / 권한 = **read 인증 필수 (Q-R5-11 번복) + audit log + 이중 방어** / Header = 시안 D §3.1 유지 + Hero 칩 / 모더레이션 = **audit log 우선 (CWE-778)** / **PR-13 = 선행 분리 (CWE-1059+CWE-754+CWE-770)** / 도구 = 동일 + DB schema 격리 + secret scanner + Langfuse no-op + GB10 ulimit + 환경변수 격리 |
| **Agent C (대안)** | 도메인 = **신규 옵션 F (Q&A 모음 mview, 50 LOC) + 옵션 G (virtual root question, 10 LOC)** / 카테고리 = 1기 미도입 / 라우트 = `/community/*` 또는 `/learn/board` / 권한 = owner+admin + 강사 read-only / Header = 시안 D §3.1 + Hero 우측 "주간 핫토론 3선" / 모더레이션 = 1기 신고+강사 queue, 2기 LLM-judge D3 Hybrid (ADR-016 §7) / **PR-13 = 분리 금지, ADR-021 첫 코드 PR 동봉** / 도구 = NestJS + supertest + Playwright smoke + MSW |

### 3.3 Phase 3-4 — Reviewer 종합

| 항목 | Reviewer 결정 |
|------|------------|
| 도메인 모델 | **옵션 G 1기 + 옵션 F/C 2기 트리거** — 옵션 공간 재오픈 (C 단독 제안) |
| 카테고리 | B+C (1기 미도입) — 사용자 응답 후 격상 변경 |
| 라우트 | A+B path segment + C 의 `/learn/board` 2기 트리거 |
| **권한** | B 골격 (read 인증 필수 + audit log 이중 방어) + A RolesGuard 형식 + C 강사 read-only |
| Header | **만장일치** (시안 D §3.1 + Hero 칩, 형태 사용자 결정) |
| 모더레이션 | C 단계 (1기/2기/3기) + B audit log 우선 (Reviewer 격상 CRITICAL) |
| **PR-13 우선순위** | **B 채택 + A 정량화 차용** — Phase 1 병렬, Phase 2 1주 선행 머지, Phase 3 검증 게이트 |
| PR-13 도구 | C 범위 (smoke 1~2개) + B 5종 안전장치 |

**합의율 만장일치 12.5% (1/8) / 유효 100% (8/8)** — consensus-012 (6.7%) 대비 만장일치 ↑, 표면적 (3배) 으로 불일치 3-way 2건 발생.

### 3.4 CRITICAL 격상 (Reviewer 권한)

- **C-1** middleware PUBLIC_PATHS 모순 / Q-R5-11 번복 (B 단독 → CRITICAL)
- **C-2** PR-13 우선순위 (3-way → CRITICAL, 위험 누적 차단)
- **C-3** audit log 부재 / CWE-778 (B 단독 → CRITICAL, ADR-016 §7 D3 Hybrid 재사용 비용 ≈ 0)

---

## 4. 트랙 3 — 사용자 결정 12건 (항목별 검토)

사용자가 "항목별 검토" 패턴 선택 (consensus-012 의 "전부 권장" 일괄 패턴과 다름).

| ID | 항목 | 채택값 | Reviewer 대비 | 등급 |
|----|------|------|---------------|------|
| Q-R6-04 | community read 인증 (Q-R5-11 번복) | 옵션 1 (번복 확정) | ✓ 일치 | CRITICAL |
| Q-R6-06 | audit log 1기 도입 | 옵션 1 (도입) | ✓ 일치 | CRITICAL |
| Q-R6-11 | PR-13 1주 선행 머지 | 옵션 1 (동의) | ✓ 일치 | HIGH |
| Q-R6-01 | 도메인 모델 | 옵션 G | ✓ 일치 | HIGH |
| **Q-R6-02** | 카테고리 1기 도입 | **후보 2 (4종)** | **✗ 격상** | HIGH |
| Q-R6-03 | 라우트 | 옵션 2 (path segment) | ✓ 일치 | HIGH |
| Q-R6-05 | read 인증 적용 범위 | 옵션 1 (이중 방어) | ✓ 일치 | HIGH |
| Q-R6-07 | Throttler IP fallback | 옵션 1 (NestJS 기본 + CI) | ✓ 일치 | HIGH |
| **Q-R6-09** | 강사 모더레이션 | **옵션 2 (operator role)** | **✗ 격상** | MED |
| **Q-R6-10** | role 컬럼 | **3-tier (자동 종속)** | **✗ 격상** | MED |
| **Q-R6-12** | Hero 칩 형태 | **옵션 3 (비대칭 4번째 카드)** | **✗ 변경** | MED |
| Q-R6-08 | 마이그레이션 CONCURRENTLY | N/A (옵션 G) | — | — |

### 4.1 변경 4건 동인

- **Q-R6-02 격상** — 외부 채널 부재 (Slack 미사용, Zoom 만, 학생 정보 공유 커뮤니티 없음) → 자유게시판이 부트캠프 정보 공유 메인 채널 → 카테고리 분리 필수 (notice/free/study/resource)
- **Q-R6-09 격상** — 부트캠프 운영자 권한 분리 의도 (강사 = operator, 학생 글 수정 코드 강제) → admin 단순 분기 회피
- **Q-R6-10 종속 격상** — Q-R6-09 의 자동 결과
- **Q-R6-12 변경** — Hero 발견성 우선 → 시안 D §3.4 비대칭 3-카드 → 4-카드 (Community 카드 추가)

### 4.2 Q-R6-04 / Q-R6-05 검토 흐름

사용자가 옵션 3 (부분 공개) 검토 → 부트캠프 운영자 시야 풀이 → "Slack 사용 안함, Zoom 만, 외부 채널 부재" 컨텍스트 응답 → 옵션 1 (번복 확정) 회귀.

이 흐름이 Q-R6-02 격상 트리거 (자유게시판 카테고리 분리 필요).

---

## 5. 트랙 4 — docs PR 산출물

### 5.1 신규 9개

| # | 파일 | 핵심 절 | LOC |
|---|------|--------|-----|
| 1 | `docs/review/consensus-013-adr-021-community-hub.md` | A/B/C + Reviewer + 사용자 결정 12건 | ~430 |
| 2 | `docs/decisions/ADR-021-community-hub.md` | 결정 12건 + 1기/2기/3기 트리거 + PR-13 우선순위 | ~280 |
| 3 | `docs/architecture/community-hub-design.md` | 옵션 G 도메인 + 카테고리 + 라우트 + 마이그레이션 | ~330 |
| 4 | `docs/architecture/community-rbac-design.md` | 1기 3-tier RBAC + RolesGuard + 이중 방어 + 학생 글 수정 코드 강제 | ~290 |
| 5 | `docs/architecture/community-moderation-design.md` | 1기/2기/3기 단계 + 신고 + queue + audit log | ~270 |
| 6 | `docs/architecture/audit-log-design.md` | CWE-778 + WORM 트리거 + ADR-016 §7 D3 Hybrid 재사용 | ~290 |
| 7 | `docs/architecture/integrated-e2e-harness-design.md` | PR-13 NestJS testing + supertest + Playwright smoke + MSW + 5종 안전장치 + Session 14 hotfix 회귀 매트릭스 | ~370 |
| 8 | `docs/review/tdd-plan-adr-021-community-hub.md` | 7 phase RED→GREEN + LOC + 일정 | ~260 |
| 9 | `docs/review/impact-adr-021-community-hub.md` | ADR-007 4차원 (의존성 / 마이그레이션 / API / 운영) | ~200 |

### 5.2 패치 2개

| # | 파일 | 변경 |
|---|------|-----|
| 1 | `docs/decisions/ADR-020-ux-redesign.md` | §11 변경 이력 행 추가 + §12 참조 ADR-021 추가 |
| 2 | `docs/rationale/main-page-redesign-concept-d.md` | §1 (4영역 비대칭 4-카드) + §3.4 (비대칭 3-카드 → 4-카드, Community 카드 §3.4.4 신규) |

### 5.3 합계

- **신규 LOC**: ~2720
- **패치 LOC**: ~120
- **사용자 결정**: 12건
- **3+1 합의 가동**: 1회

---

## 6. 안 한 것

- **PR-13 코드 PR** — Phase 2 (1주 선행 머지) — 다음 세션 이후
- **ADR-021 코드 PR 4분할** — Phase 3 (PR-13 + 1주 안정화 후)
- **virtual root question 시드 SQL 실행** — 마이그레이션 1714000020000 (Phase 3)
- **role 컬럼 backfill** — admin 사용자 role 부여 (Phase 3 머지 후 사용자 작업)
- **시안 D §3.4 4-카드 디자인 시각** — Community 카드의 Tailwind 디테일 (코드 PR 시점에 결정)
- **PR #45 외부 검증** — 5번째 세션 잔존
- **Notion Stage 2/3** — Session 12 사용자 피드백 후속

---

## 7. 패턴 관찰

### 7.1 사용자 결정 패턴 변화

- consensus-010 (PR-10): 사용자 5결정 (a/a/b/b/a) — 일부 권장 거부
- consensus-011 (PR-10c): 사용자 6결정 모두 권장 채택 (a/a/a/b/a/a)
- consensus-012 (PR-12): 사용자 15결정 모두 권장 채택 ("전부 권장" 일괄)
- **consensus-013 (ADR-021): 12건 항목별 검토 + 변경 4건** ← 새 패턴

**원인**: 옵션 공간이 풍부 (5개 → 7개 with F/G) + 외부 컨텍스트 (Slack 미사용 등) 가 Reviewer 시점에 미지였음.

### 7.2 옵션 공간 재오픈 — Agent C 가치 입증

consensus-012 §2.3 옵션 매트릭스 5개 (A/B/C/D/E) 가 닫힌 채로 Reviewer 가 채택. Agent C 가 본 합의에서 옵션 F (mview) / G (virtual root) 신규 제안 → 사용자 채택.

**다관점 시스템 효과**: 합의 이후에도 옵션 공간을 재검토할 수 있음.

### 7.3 외부 컨텍스트 발견 패턴

**합의 시점에 미지였던 사용자 컨텍스트** (Slack 미사용 + Zoom 만 + 정보 공유 커뮤니티 없음) 가 사용자 결정 단계에서 명시 → Reviewer 권장 격상 변경 (Q-R6-02 / Q-R6-09 / Q-R6-10).

**향후 합의 가동 시**: 사용자 컨텍스트 (외부 도구 사용, 부트캠프 운영 환경, 강사·학생 인적 구성 등) 를 Phase 1 입력에 포함 권장.

### 7.4 Header 만장일치 + 디자인 변경

3 에이전트 모두 "Header 변경 없음 + Hero 칩" 동의 (만장일치 1건). 그러나 Hero 칩의 **구체 형태**는 사용자가 옵션 3 (비대칭 4번째 카드) 채택 → 시안 D §3.4 변경 트리거.

**합의 ≠ 구체 디자인 결정** — 만장일치도 사용자 결정 단계에서 정밀화 필요.

---

## 8. 본 세션 요약 메트릭

| 항목 | 값 |
|---|---|
| 합의 가동 | 1 (consensus-013) |
| 만장일치 | 12.5% (1/8) |
| 유효 합의 | 100% (8/8) |
| Reviewer CRITICAL 격상 | 3건 (middleware PUBLIC_PATHS / PR-13 우선순위 / audit log) |
| 옵션 공간 재오픈 | 2건 (옵션 F / G — Agent C 단독) |
| 사용자 결정 | 12건 (항목별 검토) |
| Reviewer 권장 대비 변경 | 4건 (Q-R6-02 / Q-R6-09 / Q-R6-10 / Q-R6-12) |
| 신규 docs | 9 |
| 패치 docs | 2 |
| 신규 LOC (docs) | ~2720 |
| 코드 변화 | 0 |

---

## 9. 다음 세션 첫 행동 권장

**0순위 — PR-13 코드 PR (Phase 2, 1주 선행 머지)** — 약 4d:
- NestJS Test.createTestingModule 부트스트랩 + helpers
- api e2e (auth + discussion + migration) ~800 LOC
- apps/e2e 패키지 + Playwright + docker-compose.test.yml + smoke 1~2개 ~900 LOC
- 5종 안전장치 (DB 격리 / secret scanner / Langfuse no-op / GB10 ulimit / 환경변수)
- Session 14 hotfix 11건 회귀 매트릭스 박기
- CI 통합 (.github/workflows/e2e.yml)

**1순위 — ADR-021 코드 PR-A (마이그레이션, Phase 3)** — PR-13 머지 + 1주 안정화 후, 약 1d:
- 1714000020000-AddIsVirtualToQuestions (virtual root 시드)
- 1714000021000-AddCategoryToDiscussionThreads
- 1714000022000-AddRoleToUsers (3-tier)
- 1714000023000-AddAuditLog (WORM 트리거)
- 1714000024000-AddDiscussionReports
- 1714000025000-AddModerationColumns

**2순위 — ADR-021 코드 PR-B (API + RBAC)** — 약 2d:
- RolesGuard + @Roles 데코레이터
- backend `@Public()` 제거 (community read endpoint 3종)
- community endpoint 23종 신규
- 학생 글 수정 코드 강제 (operator → ForbiddenException)

**3순위 — ADR-021 코드 PR-C (UI)** — 약 2d:
- `/community/*` 라우트 트리
- 비대칭 4-카드 (Community 카드 신규)
- 카테고리 dropdown (글 작성)

**4순위 — ADR-021 코드 PR-D (모더레이션)** — 약 1.5d:
- 신고 endpoint + UI
- 모더레이션 queue (`/admin/moderation`)
- lock/pin/hide/restore + audit log INSERT (트랜잭션)

**5순위 — PR #45 외부 검증** (5번째 세션 잔존)

---

## 10. 본 세션 마무리 docs PR

본 §1~9 + CONTEXT.md (Session 15 진입 기록) + INDEX.md (ADR-021 + SDD 행) — `docs/adr-021-community-hub` 브랜치.

**머지 순서 (사용자 작업)**:
1. 본 docs PR 머지 — main 에 ADR-021 + SDD 6종 + tdd-plan + impact + Session 15 합류
2. 다음 세션 (Session 16) → PR-13 코드 PR (Phase 2) 진입 — 1주 선행 머지
3. PR-13 머지 + 1주 안정화 후 → ADR-021 코드 PR 4분할 (Phase 3) 진입
