# consensus-013 — ADR-021 (Community Hub) + PR-13 (통합 e2e 하네스) 3+1 합의 보고서

> **합의 ID**: consensus-013
> **합의 일자**: 2026-04-29
> **세션**: Session 15
> **합의 대상**: ADR-021 (Community Hub) 결정 6건 + PR-13 (통합 e2e 하네스) 우선순위 + PR-13 도구 선택 = 8건
> **합의 단계**: docs PR (ADR-021 + SDD 6종 + ADR-020 §6 행 + 시안 D §3.4 패치 사전 합의). 코드 PR 은 후속.
> **참여자**: Agent A (구현 분석가) / Agent B (품질·안전성 검증가) / Agent C (대안 탐색가) / Reviewer (검토 에이전트)
> **사용자 사전 결정**: 3건 (ADR-021 0순위 / 시안 D 일관 + sanitize-html + sanitize-schema + SWR + VoteButton 재사용 / consensus-012 §2.4 옵션 A + C 후속 분리)

---

## 0. Executive Summary

ADR-021 (Community Hub) 결정 6건 + PR-13 우선순위 + PR-13 도구 = 8건에 대해 3 에이전트 병렬 분석 후 Reviewer 종합. **합의율 만장일치 12.5% (1/8) / 유효 합의율 100% (8/8)**. CRITICAL 식별 3건 — (1) middleware PUBLIC_PATHS 모순 (B 단독, Q-R5-11 번복 확정), (2) PR-13 우선순위 (3-way 불일치, B+A 부분 채택), (3) audit log 부재 (B 단독, ADR-016 §7 D3 Hybrid 재사용). Agent C 가 신규 옵션 F (Q&A 모음 materialized view) / G (virtual root question 시드) 제안 — consensus-012 의 옵션 매트릭스 5개 (A/B/C/D/E) Gap 메우기로 채택.

**사용자 결정 12건 (Q-R6-01 ~ Q-R6-12)** — Reviewer 권장 대비 4건 변경 (Q-R6-02 격상 / Q-R6-09 격상 / Q-R6-10 종속 격상 / Q-R6-12 변경). **외부 채널 부재** (Slack 미사용, Zoom 만, 학생 정보 공유 커뮤니티 부재) 컨텍스트가 카테고리 1기 도입을 강제 트리거.

**핵심 결정**: 옵션 G (virtual root "FREE-TALK" question 시드) 1기 + 옵션 F/C 2기 트리거 / 카테고리 4종 (notice/free/study/resource) 1기 도입 / 라우트 path segment / read 인증 필수 (Q-R5-11 번복) + 이중 방어 / 1기 3-tier RBAC (강사 = operator, 학생 글 수정 코드 강제) / 강사 read-only 모더레이션 + audit log / Hero 비대칭 4번째 카드 / PR-13 1주 선행 머지 / NestJS testing + supertest + Playwright smoke + MSW + B 5종 안전장치.

---

## 1. 사용자 사전 결정 3건 (확인, 도전 금지)

| # | 결정 | 합의 범위에서의 처리 |
|---|------|-----------------|
| D-#1 | 다음 세션 0순위 = ADR-021 합의 가동 (Session 14 D5) | 본 합의 가동 근거 |
| D-#2 | 디자인 톤 = 시안 D 글라스 일관 + sanitize-html + sanitize-schema + SWR + VoteButton 패턴 재사용 | SDD 의존성 명시 |
| D-#3 | consensus-012 §2.4 옵션 A 채택 + 옵션 C 후속 분리 | Agent C 가 옵션 F/G 신규 제안 — **옵션 공간 재오픈** (도전이 아닌 Gap 메우기) |

---

## 2. 옵션 매트릭스 재오픈 — A/B/C/D/E + F (신규) + G (신규)

### 2.1 정량 비교

| 옵션 | 출처 | 마이그레이션 LOC | 신규 테이블 | 글로벌 정렬 비용 | 1기 부채 | 2기 확장성 |
|------|------|----------------|-----------|---------------|---------|---------|
| A (질문 종속 only) | consensus-012 채택 | 0 | 0 | N/A (자유 thread 불가) | 0 | 별도 테이블 필요 |
| B (free_threads 신규) | consensus-012 | ~200 | 1 | O(log N) UNION | 200 LOC | UNION 분기 영구화 |
| C (view + endpoint) | consensus-012 후속 | ~150 | 0 (view) | O(log N) | 150 LOC | 자연스러움 |
| D (question_id NULL ALTER) | A 채택 안 | ~150 | 0 | **expression index 무력화 (1만 thread → 100ms+, A 자가 지적 HIGH)** | 150 LOC | 자연스러움 |
| E (다형 thread_type) | consensus-012 | ~250 | 0 | O(log N) | 250 LOC | 다형 분기 영구화 |
| **F (Q&A 모음 mview + 5분 cron)** | **C 신규** | ~50 | 0 (mview) | **O(1) (refresh 시점만)** | 50 LOC | refresh 정책 부담 |
| **G (virtual root "FREE-TALK" question 시드)** | **C 신규** | ~10 | 0 | O(log N) (기존 인덱스 재사용) | 10 LOC + 의미 hack | 2기 분리 시 데이터 마이그레이션 |

### 2.2 Reviewer 판정 + 사용자 채택

**1기 = 옵션 G (virtual root question 시드)** + **2기 트리거 = 옵션 F (mview) 또는 옵션 C (view) 마이그레이션**

근거:
1. Agent C 의 "1기 = 카테고리 없음, 2기 트리거" 패턴과 일관 (ADR-019 SM2 단계적 적용 패턴 재사용)
2. 옵션 D (NULL ALTER) 는 expression index 무력화 위험 (HIGH, A 자가 지적) — 채택 불가
3. 옵션 G 가 가장 가벼움 (10 LOC) + 기존 인덱스 100% 재사용

**사용자 채택** (Q-R6-01 = 옵션 G).

---

## 3. Phase 3 — 교차 비교 표 (8개 항목)

| # | 항목 | Agent A | Agent B | Agent C | 분류 |
|---|------|---------|---------|---------|------|
| 1 | 도메인 모델 | 옵션 D (NULL ALTER, 150 LOC) | 옵션 C (view, read-only) | **옵션 F/G 신규** | **부분일치 (B+C view 계열)** + 옵션 공간 재오픈 |
| 2 | 카테고리 | MVP enum 3종 + tags 후속 | MVP 미도입 | 1기 없음, 2기 enum | **부분일치 (B+C 미도입)** — **사용자가 격상 (1기 도입)** |
| 3 | 라우트 | `/community/threads/[threadId]` 통합 | `/community` 단일 | `/community/*` 또는 `/learn/board` | **일치 (모두 /community)** + C 의 `/learn/board` 신규 |
| 4 | **권한 모델** | 4-tier RBAC + role 컬럼 | **read 인증 필수 (Q-R5-11 번복)** + audit log | owner+admin + 강사 read-only | **불일치 3-way ★ CRITICAL** |
| 5 | Header | Hero 칩 + 비대칭 4번째 카드 | 시안 D §3.1 + Hero 칩 | 시안 D §3.1 + Hero 우측 "주간 핫토론 3선" | **일치 (Hero 칩, 형태만 다름)** |
| 6 | 모더레이션 | lock/pin/신고 1차 | **audit log 우선 (CWE-778)** | 1기 신고 + 강사 queue, 2기 LLM-judge D3 Hybrid | **부분일치 (단순 시작 + 점진)**, B 가 audit log 우선 |
| 7 | **PR-13 우선순위** | **즉시 분리, 병렬 머지** | **선행 분리 (보안 우선)** | **ADR-021 첫 코드 PR 동봉** | **불일치 3-way ★★ CRITICAL** |
| 8 | PR-13 도구 | NestJS testing + supertest + Playwright | 동일 + DB schema 격리 + secret scanner + Langfuse no-op + GB10 ulimit | NestJS + supertest + **Playwright smoke + MSW** | **일치 (도구) + 부분일치 (격리 정책)** |

### 3.1 Gap (단독 지적) 분류

| Gap | 출처 | 등급 (Reviewer 격상/하향) |
|-----|------|---------------------|
| middleware PUBLIC_PATHS 모순 / Q-R5-11 번복 확정 | B 단독 | **CRITICAL** (Reviewer 격상 — ADR-021 진입 자체를 차단) |
| audit log CWE-778 우선 도입 | B 단독 | **CRITICAL** (Reviewer 격상 — community 가 user-generated content 첫 영역, ADR-016 §7 D3 Hybrid 재사용 비용 ≈ 0) |
| Throttler IP fallback (CWE-770) | B 단독 | HIGH |
| 카테고리 slug validator (CWE-22+CWE-79) | B 단독 | MED (옵션 G 채택 시 미적용) |
| 옵션 F (mview) / G (virtual root) | C 단독 | **HIGH** (Reviewer 권장 — 옵션 공간 Gap 메우기) |
| ADR-019 SM2 단계적 적용 패턴 재사용 | C 단독 | MED (1기/2기/3기 트리거 명세 반영) |
| 마이그레이션 lock 회피 (CONCURRENTLY) | A 단독 | HIGH (옵션 G 채택 시 N/A) |
| expression index 무력화 (NULL leading column) | A 단독 | HIGH (계산적 사실, 옵션 D 단독 위험) |
| ThreadDetailClient backLink 통합 라우트 referer 보존 | A 단독 | HIGH (라우트 항목 #3 종속) |

---

## 4. Phase 4 — 합의 도출 상세 (CRITICAL/주요 항목)

### 4.1 항목 1 — 도메인 모델 (부분일치 + 옵션 공간 재오픈)

- **B 근거**: view (read-only) 채택 시 스키마 변경 최소.
- **C 근거**: 옵션 G (virtual root) = 10 LOC, 옵션 F (mview) = 50 LOC. 둘 다 옵션 C (150 LOC) 보다 가벼움.
- **A 근거**: 옵션 D (NULL ALTER) 는 expression index 무력화 위험 — A 자신이 HIGH 로 짚음.
- **Reviewer 판정**: **옵션 G 1기 + 옵션 F/C 2기 트리거** — Agent C 단독 제안의 옵션 공간 Gap 메우기 채택. ADR-019 SM2 패턴 일관.
- **Q-R6-01 → 사용자 채택 (옵션 G)**.

### 4.2 항목 2 — 카테고리 (부분일치, 사용자가 격상)

- **A 근거**: MVP enum 3종 + tags 후속.
- **B 근거**: MVP 미도입 (slug XSS / IDOR / reserved word 위험).
- **C 근거**: 1기 = 카테고리 없음, 2기 트리거.
- **Reviewer 판정**: B+C 안 (1기 미도입).
- **사용자 응답** (2026-04-29): "Slack 사용 안 함, 수업 Zoom, 그 외 정보 공유 커뮤니티 부재 → 자유게시판 필요 + 카테고리 분리 + 공지 카테고리 필요".
- **Reviewer 격상 변경**: 외부 채널 부재 컨텍스트 → **1기 카테고리 도입 (4종 enum: notice/free/study/resource)**.
- **Q-R6-02 → 사용자 채택 (후보 2: 4종)**.

### 4.3 항목 3 — 라우트 (일치)

- **A**: `/community/threads/[threadId]` 통합 + 질문 종속 redirect.
- **B**: `/community` 단일 (path traversal 회피).
- **C**: `/community/*` 또는 `/learn/board`.
- **Reviewer 판정**: A+B 안 (path segment 라우트). C 의 `/learn/board` 는 1기 미도입, 2기 학습 trail 정렬 도입 시 검토.
- **세부 결정**: `/community` (전체) + `/community/[category]` (필터) + `/community/threads/[threadId]` (상세, 카테고리 무관) + `/play/solo/[qId]/discussion/*` (질문 종속, PR-12 유지).
- **Q-R6-03 → 사용자 채택 (옵션 2 path segment)**.

### 4.4 항목 4 — **권한 모델 (3-way 불일치 ★ CRITICAL)**

- **A 근거**: 4-tier RBAC (guest/user/operator/admin) + role 컬럼 + RolesGuard + middleware PUBLIC_PATHS `/community/*` 추가.
- **B 근거**: read 인증 필수 (Q-R5-11 번복 확정) + write 인증 + admin 모더레이션 분리 + audit log.
- **C 근거**: 단순 owner+admin + 강사 read-only 모더레이션.
- **Reviewer 판정**: B 안 골격 + A 의 RolesGuard 형식 + C 의 강사 read-only.
- **CRITICAL 격상 사유**: middleware PUBLIC_PATHS 모순 (B 단독) 이 ADR-021 진입 자체를 차단. Q-R5-11 번복이 미결이면 옵션 매트릭스 평가 자체가 무의미.
- **Q-R6-04 → 사용자 채택 (옵션 1: 번복 확정)**.
- **Q-R6-05 → 사용자 채택 (옵션 1: 이중 방어 — middleware + backend `@Public()` 제거)**.
- **Q-R6-09 → 사용자 채택 (옵션 2: 강사 = operator, 1기 3-tier)** — Reviewer 권장 (옵션 1 강사 = admin) 대비 격상.
- **Q-R6-10 → 사용자 자동 채택 (3-tier user/operator/admin)** — Q-R6-09 종속 격상.

### 4.5 항목 5 — Header (일치)

- **A**: Hero 칩 + 비대칭 4번째 카드.
- **B**: 시안 D §3.1 유지 + Hero 칩.
- **C**: 시안 D §3.1 유지 + Hero 우측 "주간 핫토론 3선".
- **Reviewer 판정**: 시안 D §3.1 유지 + Hero 칩 (형태는 사용자 결정).
- **사용자 응답**: 옵션 3 — **비대칭 4번째 카드** 채택. 시안 D §3.4 비대칭 3-카드 → 4-카드 변경 (rationale 패치).
- **Q-R6-12 → 사용자 채택 (옵션 3 비대칭 4번째 카드)**.

### 4.6 항목 6 — 모더레이션 (부분일치)

- **A 근거**: lock/pin/신고 1차 동봉, shadow_ban/노트 후속.
- **B 근거**: audit log 우선 도입 (ADR-016 §7 D3 Hybrid 재사용 + WORM, CWE-778 차단).
- **C 근거**: 1기 = 사용자 신고 + 강사 queue, 2기 = LLM-judge D3 Hybrid (ADR-016).
- **Reviewer 판정**: C 의 1기/2기 단계 + B 의 audit log 우선 (CRITICAL).
- **Q-R6-06 → 사용자 채택 (옵션 1: audit log 1기 도입)**.

### 4.7 항목 7 — **PR-13 우선순위 (3-way 불일치 ★★ CRITICAL)**

- **A 근거**: 즉시 분리, 병렬 머지 (일정 손실 0).
- **B 근거**: 선행 분리 가동 — CWE-1059 + CWE-754 + CWE-770 동시 누적 회피.
- **C 근거**: 분리 금지, ADR-021 첫 코드 PR 동봉.
- **Reviewer 판정**: **B 안 + A 정량화 차용**.
  - Phase 1: ADR-021 docs PR 와 PR-13 병렬 가동 (일정 손실 0)
  - Phase 2: ADR-021 첫 코드 PR 보다 PR-13 1주 선행 머지
  - Phase 3: ADR-021 코드 PR 진입 시 PR-13 검증 게이트 통과 필수
- **C 의 "axe-core 동봉 패턴 일관" 논리 평가**: axe-core = 단일 페이지 검증, PR-13 = 전 도메인 검증 → 표면적 차이로 분리 정당화.
- **Q-R6-11 → 사용자 채택 (옵션 1: 1주 선행 머지)**.

### 4.8 항목 8 — PR-13 도구 (일치 + 부분일치)

- **A**: NestJS testing + supertest + Playwright.
- **B**: 동일 + DB schema 격리 + secret scanner + Langfuse no-op fallback + GB10 ulimit + 환경변수 격리.
- **C**: NestJS + supertest + Playwright smoke 1~2개 + MSW.
- **Reviewer 판정**: C 의 도구 범위 (smoke 1~2개) + B 의 5종 안전장치.
- **Q-R6-07 → 사용자 채택 (옵션 1: NestJS 기본 IP fallback + CI 회귀)** (Throttler 별도 명시).

---

## 5. Phase 5 — 합의율

| 분류 | 항목 수 | 비율 |
|------|--------|------|
| ① 만장일치 (3/3) | **1** (항목 5 Header) | 12.5% |
| ② 부분일치 (2/3 채택) | **4** (항목 1, 2, 3, 6) | 50.0% |
| ③ 부분일치 (소수 의견 채택) | **1** (항목 8 — C 안 채택) | 12.5% |
| ④ 불일치 3-way (Reviewer 판정) | **2** (항목 4, 7) | 25.0% |
| **유효 합의율** | **8/8** | **100%** |
| 사용자 변경 (Reviewer 권장 대비) | **4건** (Q-R6-02 격상 / Q-R6-09 격상 / Q-R6-10 종속 / Q-R6-12 변경) | 33.3% |

### 5.1 consensus-012 와 비교

| 합의 | 만장일치 | 유효 | CRITICAL 격상 | 사용자 변경 | 항목 수 |
|------|---------|------|---------------|----------|--------|
| consensus-012 (PR-12) | 6.7% | 100% | 1건 | 0건 | 15 |
| **consensus-013 (ADR-021)** | **12.5%** | **100%** | **3건** | **4건** | **12** |

- **분석**: ADR-021 표면적 (community CRUD + 권한 + 모더레이션 + audit log + PR-13) > PR-12 표면적 → 불일치 3-way 가 2건 발생 (consensus-012 = 0건).
- **사용자 변경 4건** = 외부 채널 부재 컨텍스트 (consensus-012 시점에 미지) + 부트캠프 운영자 권한 분리 의도 + 시안 D 디자인 변경 의도.
- **만장일치 비율 증가** (6.7% → 12.5%) 는 시안 D 안정성 + Hero 칩 일치.

---

## 6. CRITICAL/HIGH/MED 통합 표

| 등급 | 식별자 | 항목 | 출처 Agent | 사용자 결정 ID | 대응 계층 |
|------|--------|------|----------|---------------|---------|
| **CRITICAL** | C-1 | middleware PUBLIC_PATHS 모순 / Q-R5-11 번복 | B 단독 (격상) | Q-R6-04 | 즉시 사용자 결정 ✓ |
| **CRITICAL** | C-2 | PR-13 선행 분리 가동 (CWE-1059+CWE-754+CWE-770) | A+B 부분 | Q-R6-11 | 하네스 게이트 (Layer 2) |
| **CRITICAL** | C-3 | audit log 우선 도입 (CWE-778) | B 단독 (격상) | Q-R6-06 | 코드 (ADR-016 §7 D3 Hybrid 재사용) |
| HIGH | H-1 | 옵션 G (virtual root) 1기 도입 | C 단독 | Q-R6-01 | 마이그레이션 |
| HIGH | H-2 | read 인증 적용 범위 (이중 방어) | B 단독 | Q-R6-05 | 코드 (middleware + backend) |
| HIGH | H-3 | Throttler IP fallback (CWE-770) | B 단독 | Q-R6-07 | 코드 (Layer 4 CI 검증) |
| HIGH | H-4 | 마이그레이션 lock 회피 (CONCURRENTLY) | A 단독 | (옵션 G N/A) | — |
| HIGH | H-5 | expression index 무력화 | A 단독 | (옵션 G N/A) | — |
| HIGH | H-6 | backLink referer 보존 (통합 라우트) | A 단독 | Q-R6-03 | 코드 |
| HIGH | H-7 | 1기 카테고리 도입 (외부 채널 부재) | (사용자 격상) | Q-R6-02 | 코드 + DB CHECK |
| HIGH | H-8 | 1기 3-tier RBAC (강사 = operator) | (사용자 격상) | Q-R6-09, Q-R6-10 | 코드 + RolesGuard |
| HIGH | H-9 | 비대칭 4번째 카드 (시안 D §3.4 변경) | (사용자 변경) | Q-R6-12 | 시안 D rationale 패치 |
| MED | M-1 | slug validator (CWE-22+CWE-79) | B 단독 | (옵션 G N/A) | — |
| MED | M-2 | ADR-019 SM2 단계적 적용 패턴 재사용 | C 단독 | (Reviewer 채택) | ADR-021 §재검토 트리거 |
| MED | M-3 | 강사 read-only 모더레이션 1기 도입 | C 단독 | Q-R6-09 | RolesGuard + 코드 강제 |

---

## 7. 사용자 결정 항목 (Q-R6 시리즈) — 12건 모두 결정 완료

| # | ID | 결정 항목 | 사용자 채택 | Reviewer 권장 대비 | 등급 |
|---|------|---------|------------|-------------------|--------|
| 1 | **Q-R6-04** | community read 인증 필수 (Q-R5-11 번복) | **옵션 1 (번복 확정)** | ✓ 일치 | **CRITICAL** |
| 2 | **Q-R6-06** | audit log 1기 도입 | **옵션 1 (도입)** | ✓ 일치 | **CRITICAL** |
| 3 | **Q-R6-11** | PR-13 1주 선행 머지 동의 | **옵션 1 (동의)** | ✓ 일치 | HIGH |
| 4 | **Q-R6-01** | 도메인 모델 | **옵션 G (virtual root)** | ✓ 일치 | HIGH |
| 5 | **Q-R6-02** | 카테고리 1기 도입 + enum | **후보 2 (4종: notice/free/study/resource)** | **✗ 격상** (미도입 → 도입) | HIGH |
| 6 | **Q-R6-03** | 라우트 구조 | **옵션 2 (path segment)** | ✓ 일치 | HIGH |
| 7 | **Q-R6-05** | read 인증 적용 범위 | **옵션 1 (이중 방어)** | ✓ 일치 | HIGH |
| 8 | **Q-R6-07** | Throttler IP fallback | **옵션 1 (NestJS 기본 + CI 회귀)** | ✓ 일치 | HIGH |
| 9 | **Q-R6-09** | 강사 모더레이션 권한 | **옵션 2 (operator role, 1기 3-tier)** | **✗ 격상** (admin → operator) | MED |
| 10 | **Q-R6-10** | role 컬럼 (자동, Q-R6-09 종속) | **3-tier (user/operator/admin)** | **✗ 종속 격상** | MED |
| 11 | **Q-R6-12** | Hero 칩 형태 | **옵션 3 (비대칭 4번째 카드)** | **✗ 변경** (단순 유지 → 4번째 카드) | MED |
| 12 | **Q-R6-08** | 마이그레이션 CONCURRENTLY | **N/A** (옵션 G 채택) | — | HIGH |

**사용자 응답 패턴**: 항목별 검토 (consensus-012 의 "전부 권장" 일괄 패턴과 다름). 외부 채널 부재 컨텍스트 (Q-R6-02 격상 트리거) + 부트캠프 운영자 권한 분리 의도 (Q-R6-09 격상) + 시안 D 디자인 변경 의도 (Q-R6-12 변경) 가 4건 변경 동인.

---

## 8. PR-13 우선순위 — 결정 트리

```
선택지 A (즉시 분리 가동, 병렬 머지)
  + 일정 손실 0
  - "병렬" 의 정의 모호 — ADR-021 docs PR 와 병렬 vs 코드 PR 와 병렬?
  - 병렬 머지 시 PR-13 안전장치 (B 의 5종) 검증 부재

선택지 B (선행 분리 가동) ← Reviewer 채택
  + CWE-1059 + CWE-754 + CWE-770 동시 누적 회피
  + ADR-021 표면적 > PR-12 → 검증 게이트 필수
  + 일정 손실 0 (A 의 논리 차용)
  - "선행" 의 정량화 부재 → Reviewer 가 정량화 (1주 선행)

선택지 C (ADR-021 첫 코드 PR 동봉)
  + 사용자 가치 0 PR 분리 회피
  - axe-core 동봉 (consensus-012) 패턴은 단일 페이지 검증 ≠ community 전체 도메인
  - hotfix 1건의 비용 > PR 분리 1회 비용
  - 동봉 시 PR 크기 폭발 (community CRUD + 권한 + 모더레이션 + e2e 하네스)
```

**Reviewer 결정 = 사용자 채택**: B 채택 + A 정량화 차용. Phase 1 (병렬 가동, 일정 손실 0) → Phase 2 (PR-13 1주 선행 머지) → Phase 3 (검증 게이트 활성).

---

## 9. ADR-021 docs PR + SDD 산출물 설계

### 9.1 산출물 7건

| # | 파일 | 핵심 절 | 추정 길이 |
|---|------|--------|--------|
| 1 | `docs/decisions/ADR-021-community-hub.md` | 사용자 결정 12건 + 1기/2기/3기 트리거 + 관련 ADR | 350~450줄 |
| 2 | `docs/architecture/community-hub-design.md` | 옵션 G 도메인 모델 + 카테고리 + 라우트 + 마이그레이션 | 400~500줄 |
| 3 | `docs/architecture/community-rbac-design.md` | 1기 3-tier RBAC + RolesGuard + middleware 이중 방어 | 250~350줄 |
| 4 | `docs/architecture/community-moderation-design.md` | 1기/2기/3기 모더레이션 단계 + 강사 read-only 코드 강제 | 200~300줄 |
| 5 | `docs/architecture/audit-log-design.md` | CWE-778 차단 + ADR-016 §7 D3 Hybrid 재사용 + WORM | 200~300줄 |
| 6 | `docs/architecture/integrated-e2e-harness-design.md` | PR-13 NestJS testing + supertest + Playwright smoke + MSW + 5종 안전장치 | 300~400줄 |
| 7 | `docs/review/tdd-plan-adr-021-community-hub.md` | 7 phase RED→GREEN | 300~400줄 |
| 8 | `docs/review/impact-adr-021-community-hub.md` (ADR-007 4차원) | 의존성 / 마이그레이션 / API / 운영 | 250~350줄 |
| 9 | ADR-020 §6 행 + 시안 D §3.4 패치 | 비대칭 3 → 4-카드 명세 | 100~150줄 패치 |
| 10 | 본 합의 보고서 (consensus-013) | A/B/C + Reviewer | 본 파일 |

### 9.2 PR 분할 계획

```
Phase 1 (병렬, 일정 손실 0)
├─ PR: ADR-021 docs (consensus-013 + ADR-021 + SDD 6종 + 시안 D 패치 + tdd-plan + impact)
└─ PR-13 docs: 통합 e2e 하네스 docs (별도 PR 또는 ADR-021 docs 와 합본)

Phase 2 (PR-13 머지 후 1주, 코드 진입)
└─ PR: PR-13 코드 (NestJS testing + supertest + Playwright smoke + MSW + 5종 안전장치)

Phase 3 (PR-13 안정화 1주 후, ADR-021 코드 진입)
├─ PR: ADR-021 1기 마이그레이션 (virtual root question 시드 + role + category 컬럼 + audit_log 테이블)
├─ PR: community read/write API + RBAC + 이중 방어
├─ PR: community UI (시안 D 4-카드 + 카테고리 segment 라우트 + 모더레이션 UI)
└─ PR: 모더레이션 1기 (사용자 신고 + admin queue + audit log INSERT)

Phase 4 (2기 트리거)
└─ PR: 옵션 F/C 마이그레이션 + LLM-judge D3 Hybrid 자동 모더레이션
```

---

## 10. Phase 9 — Reviewer 권고 + 다음 단계 + 위험 요소

### 10.1 권고 요약

1. **CRITICAL 3건 모두 사용자 결정 완료** (Q-R6-04 / Q-R6-06 / Q-R6-11) — docs PR 머지 게이트 해소.
2. **사용자 변경 4건은 외부 컨텍스트 반영** (Slack 미사용, Zoom 만, 운영자 권한 분리, 시안 D 변경) — Reviewer 의 단순 권장보다 정확한 결정.
3. **옵션 공간 재오픈** (옵션 F/G) 채택 — Agent C 단독 제안의 가치 입증. consensus-012 의 5개 매트릭스 Gap 메우기.
4. **PR-13 1주 선행 머지** = Session 14 hotfix 11건 패턴 차단 + ADR-021 표면적 (3배) 의 hotfix 산술 폭발 회피.
5. **ADR-016 §7 D3 Hybrid + ADR-019 SM2 단계적 적용 패턴 재사용** = 신규 설계 비용 ≈ 0.

### 10.2 다음 단계

| 단계 | 담당 | 산출물 |
|------|------|--------|
| 1. ADR-021 docs PR 작성 | 본 세션 | ADR-021 + SDD 6종 + tdd-plan + impact + 시안 D 패치 |
| 2. ADR-021 docs PR 머지 | 사용자 (외부 검토 후) | docs main 합류 |
| 3. PR-13 코드 PR (Phase 2, 1주 선행) | 다음 세션 (들) | NestJS testing + Playwright smoke + 5종 안전장치 |
| 4. PR-13 머지 + 1주 안정화 | 사용자 + 외부 검증 | 검증 게이트 활성 |
| 5. ADR-021 1기 마이그레이션 PR (Phase 3) | 후속 세션 | virtual root + role + category + audit_log |
| 6. ADR-021 코드 PR 4분할 | 후속 세션들 | API + RBAC + UI + 모더레이션 |
| 7. 2기 트리거 (PR-N) | 향후 | 옵션 F/C + LLM-judge D3 Hybrid |

### 10.3 위험 요소

| 위험 | 확률 | 영향 | 완화 |
|------|-----|------|-----|
| 옵션 G hack (FREE-TALK question 시드) 의 의미 오염 | 중간 | 2기 분리 시 데이터 마이그레이션 1~2일 | ADR-021 §재검토 트리거 명시 |
| 1기 3-tier RBAC (사용자 격상) 의 중복 코드 | 낮음 | RolesGuard + role 컬럼 ~80 LOC | 표준 NestJS RolesGuard 패턴 사용 |
| 시안 D §3.4 비대칭 4-카드 디자인 결정 | 낮음 | 디자인 톤 회귀 가능 | 기존 카드 패턴 재사용 (Primary/Ranking/Admin/Community) |
| audit log WORM PostgreSQL 트리거 회귀 | 낮음 | UPDATE/DELETE 차단 실패 시 CWE-778 누적 | PR-13 통합 e2e 회귀 테스트 |
| middleware PUBLIC_PATHS 정책 재변경 (Session 14 패턴) | 중간 | 사용자 결정 변경 시 ADR-021 재검토 | ADR-021 §재검토 트리거 명시 |
| PR-13 5종 안전장치 도입 비용 underestimate | 중간 | B 단독 추정 — 구현 단계 재평가 필요 | 1주 선행 머지 버퍼로 흡수 |

### 10.4 Reviewer 자기 평가

- **편향 경고**: B 안을 3개 항목 (권한, 모더레이션, PR-13 우선순위) 에서 채택 — B 편향 가능성. 단, 각 채택 근거가 **계산적 사실** (CWE 식별자) 또는 **사용자 자기 결정** (D-#1, #2, #3) 에 의해 외부 검증.
- **재분석 금지 원칙 준수**: 옵션 F/G 의 LOC 추정 (50/10) 은 C 의 원문 인용. 옵션 D 의 "expression index 무력화" 는 A 의 계산적 주장 그대로 채택.
- **다수결 회피**: 항목 4 (권한) 에서 단순 다수결이 아닌 **모자이크 합의** (B 골격 + A 형식 + C 보강).
- **사용자 변경 4건 수용**: 외부 컨텍스트 (Reviewer 시점에 미지) → 사용자 응답 후 합의 보고서에 통합.

### 10.5 메타

- **합의 만장일치**: 1 / 8 (12.5%)
- **유효 합의 (Reviewer 판정 채택)**: 8 / 8 (100%)
- **사용자 변경 (Reviewer 권장 대비)**: 4 / 12 (33.3%)
- **1 Agent 만 짚은 CRITICAL**: 2건 (B 단독 — middleware PUBLIC_PATHS, audit log)
- **옵션 공간 재오픈**: 2건 (옵션 F, G — C 단독)
- **사용자 사전 결정 도전**: 0건
- **본 보고서 작성 시점**: 2026-04-29 (Session 15)
- **다음 합의 ID**: consensus-014 (PR-13 코드 PR 또는 2기 트리거 시)

---

## 11. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | consensus-013 본 합의 보고서 작성. 3 에이전트 병렬 분석 + Reviewer 종합 + 사용자 결정 12건 (변경 4건). 옵션 F/G 신규 + 옵션 G 1기 채택 + 카테고리 1기 도입 격상 + 1기 3-tier RBAC 격상 + 비대칭 4번째 카드 변경 | A/B/C 출력 + 사용자 응답 (항목별 검토) |

---

## 12. 참조

- `docs/decisions/ADR-020-ux-redesign.md` — §3.1 / §6 PR-12 행 / §6 PR-13 + ADR-021 행 추가 대상
- `docs/decisions/ADR-016-llm-judge-safety.md` — §7 D3 Hybrid (audit log + 2기 자동 모더레이션 패턴 재사용)
- `docs/decisions/ADR-019-sm2-spaced-repetition.md` — Stage 1/2/3 단계적 적용 패턴 재사용
- `docs/decisions/ADR-021-community-hub.md` — 본 합의 결과 ADR (신규)
- `docs/architecture/community-hub-design.md` — 본 합의 결과 SDD 도메인 모델 (신규)
- `docs/architecture/community-rbac-design.md` — 본 합의 결과 SDD 권한 (신규)
- `docs/architecture/community-moderation-design.md` — 본 합의 결과 SDD 모더레이션 (신규)
- `docs/architecture/audit-log-design.md` — 본 합의 결과 SDD audit (신규)
- `docs/architecture/integrated-e2e-harness-design.md` — 본 합의 결과 SDD PR-13 (신규)
- `docs/review/tdd-plan-adr-021-community-hub.md` — 본 합의 결과 TDD plan
- `docs/review/impact-adr-021-community-hub.md` — 본 합의 결과 ADR-007 4차원 영향
- `docs/review/consensus-012-pr-12-discussion-page.md` — 옵션 매트릭스 5개 + 합의율 비교 기준
- `docs/architecture/multi-agent-system-design.md` §7.3 / §7.4 — 합의율 패턴 관찰
- `docs/architecture/harness-engineering-design.md` — PR-13 Layer 1-4 게이트
- `docs/architecture/environment-and-docker-design.md` — PR-13 5종 격리 (B 안)
- `docs/sessions/SESSION_2026-04-29-session-14.md` §3.1 — hotfix 11건 패턴 (PR-13 가동 근거)
- `docs/rationale/main-page-redesign-concept-d.md` §3.4 — 비대칭 3-카드 → 4-카드 패치 대상
- `apps/api/src/modules/discussion/` — 백엔드 base
- `apps/web/src/middleware.ts` — PUBLIC_PATHS 이중 방어 base
- `apps/web/src/components/home/feature-cards.tsx` — 비대칭 4-카드 변경 대상

---

**보고서 끝.** docs PR 작성 → 머지 → PR-13 코드 PR (1주 선행) → ADR-021 코드 PR 4분할 (Phase 3) 진입.
