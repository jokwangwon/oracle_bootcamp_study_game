# 세션 로그 — 2026-04-28 Session 12

## 한줄 요약

**CTA 즉시 시작 패치 (PR #47) + 정식 PR-10 3+1 합의 가동 (PR #48 — consensus-010, 70% 합의율, 5결정 채택, CRITICAL 4건 해소) + 임시 완화 (`JWT_EXPIRES_IN=24h`) + ADR-020 §4.2.1 부속서 신설 + §6 PR-10 → 10a/10b/10c 3분할 + §11 변경 이력 갱신**. 사용자 페인 "토큰 자꾸 날라감" 즉시 + 정식 양 트랙 진입.

---

## 1. 세션 개요

| 항목 | 값 |
|---|---|
| 머지된 PR 수 | 0 (3 PR open — #47 / #48 / 본 docs PR 예정) |
| 새 commit 수 | 본 세션 3 (PR #47: 1 / PR #48: 1 / docs PR: 1 예정) |
| 새 web 파일 | 0 (코드 변경은 page.tsx 1 파일만) |
| 변경된 web 파일 | 1 (page.tsx — startGame 시그니처 확장) |
| 변경된 docs 파일 | 4 (concept-epsilon §3.1.4 / §7.3 / §13.1 / §16 + ADR-020 §2 / §4.2 / §4.2.1 / §6 / §11 + .env.example + consensus-010 신규) |
| LOC 변화 | PR #47: +45 / −33 (2 파일) / PR #48: +493 / −16 (3 파일) |
| ADR-020 §11 변경 기록 | +2 행 (CTA 즉시 시작 + Session 12 합의 한 행) |
| 빌드 변화 | `/play/solo` 15.3 → 15.4 kB (변화 없음 사실상) |
| 테스트 변화 | 976+1s 그대로 (web only — typecheck/build 게이트 + turbo cached) |
| 사용자 결정 | **6건** (CTA 즉시 시작 1 + Q-R1~Q-R5 5건) |
| 3+1 합의 가동 | **1회** (consensus-010, 보안 변경 — CLAUDE.md §3 적용) |
| 외부 노트북 검증 | 0회 (PR #47 / PR #48 / 본 docs PR 모두 외부 검증 항목 미체크 상태) |

---

## 2. 트랙 1 — CTA 즉시 시작 (PR #47)

### 2.1 트리거

Session 11 PR #45 가 채택했던 **명시적 confirm 패턴** (`추천으로 시작` 클릭 → 주차 자동 채움 → 사용자가 다시 `시작하기` 클릭) 을 사용자가 "1 클릭이 redundant" 라고 피드백.

### 2.2 변경

**spec (concept-epsilon.md)** 3곳:
- §3.1.4 — "즉시 시작은 안 함 ... 명시적 confirm 패턴" → "즉시 게임 시작 (`startGame({ week: currentDay })` 동시 호출)"
- §7.3 — "주차 input focus 자동 이동" → "즉시 `startGame()` 호출"
- §13.1 acceptance — "즉시 시작 안 함" → "즉시 `startGame()` 호출"
- §16 변경 이력 — Session 12 결정 한 행

**code (page.tsx)** 단일 변경:
```ts
const startGame = useCallback(
  async (overrides?: Partial<SoloConfigSelection>) => {
    const effective = overrides ? { ...config, ...overrides } : config;
    if (overrides) setConfig(effective);
    // ... apiClient.solo.start({ topic: effective.topic, ... })
  },
  [token, config],
);

onRecommendedStart={() => void startGame({ week: MOCK_CURRENT_BOOTCAMP_DAY })}
onResumeSession={() => void startGame({ topic: last.topic, week: last.day })}
onClick={() => { void startGame(); }}  // 메인 CTA — MouseEvent 타입 충돌 회피
```

**근거**: setState 비동기성 회피. `effective = { ...config, ...overrides }` 로 즉시 호출 + 시각 동기화는 setConfig 별도. `onClick={startGame}` 직접 바인딩은 React MouseEvent 와 `Partial<SoloConfigSelection>` 타입 충돌 → wrapping.

### 2.3 검증

- `npm run typecheck --workspace=apps/web` PASS
- `npm run build --workspace=apps/web` PASS — `/play/solo` 15.3 → 15.4 kB
- pre-commit Layer 2/3 PASS

---

## 3. 트랙 2 — 정식 PR-10 3+1 합의 (PR #48 — consensus-010)

### 3.1 트리거

**사용자 피드백**: "토큰이 자꾸 날라간다" — 15분마다 재로그인 발생 (현재 `JWT_EXPIRES_IN=15m`, refresh endpoint 없음).

CLAUDE.md §3 (보안 변경 → 3+1 합의 필수) 적용. ADR-020 §6 PR-10 가 정확히 이 영역을 다룸 → 명세 검증 + 분할 결정 + 임시 완화 결정 등 6 결정 영역.

### 3.2 Phase 1 — 분배

3 에이전트 병렬 호출, 각각 self-contained 컨텍스트 (현재 코드 + ADR-020 §4.2 명세 + 부트캠프 환경 + Q11=a 의 의미):

| Agent | 관점 | 분석 영역 |
|-------|------|----------|
| Agent A (구현 분석가) | 실제로 동작? | NestJS 통합 / Refresh rotation / Next.js 14 cookie / dev/prod 분기 / CSRF middleware / 임시 완화 / 테스트 / ADR-018 상호작용 |
| Agent B (품질·안전성) | 안전·견고? | OWASP 매트릭스 / CSRF 한계 / Refresh race / Logout revoke / Token replay / R4 보안 / 부트캠프 risk profile / SDD 정합성 / 테스트 커버리지 |
| Agent C (대안 탐색가) | 더 나은 방법? | 자체 vs 라이브러리 / JWT vs Session / CSRF 방식 / SameSite / PR 분할 / 임시 완화 / BFF / 만료 조합 |

### 3.3 Phase 2 — 독립 분석 핵심

**Agent A** — 부분 가능. LOC 추정 ~2000, 실제 6.0d (3d 과소). 분할 권장. 임시 완화 5분 적용. tailscale Strict 검증 필수. Redis SETNX mutex (ioredis 이미 deps).

**Agent B** — 명세 그대로 머지 시 보안 점수 **58/100**. CRITICAL 3건:
- Refresh rotation reuse detection 알고리즘 미정 (placeholder만)
- Logout 후 access token 1~14분 유효 (revoke 메커니즘 부재)
- 5도메인 단일 PR 1500~2000 LOC 인지 부하

**임시 완화 7d 평가**: **매우 위험** — 24h 가 상한 권장. 노트북 도난 + tailscale 자동 인증 7일 풀 액세스 시나리오.

**부트캠프 환경 우선순위**: vote 무결성 > refresh+revoke > CSRF.

**Agent C** — §4.2 는 "공개 SaaS 멘탈 모델로 사적 mesh 환경을 해결" 시도. 6 가정 중 3건 도전:
- JWT vs Server Session (Redis 이미 docker-compose 존재 — JWT stateless 이점 무의미)
- SameSite=Strict (Discord/슬랙 링크 UX 페인) → Lax 권장
- 단일 PR (Q11=a 재검토)

가장 강한 대안: **iron-session + Lax + Origin 검증** (1.5~2d, vs 자체 3d). 단 마이그레이션 비용 reviewer 판단.

### 3.4 Phase 3 — 교차 비교

- **만장일치 7건**: 3d 추정 과소 / 분할 / 임시 완화 적용 / refresh race / dev secure 분기 / CSRF token 가치 제한적 / ADR-018 epoch 통합 미정
- **부분 일치 4건**: 임시 완화 7d 안전성 (B 단독 위험) / SameSite (C: Lax) / 자체 vs 라이브러리 (C: iron-session) / 만료 (C: 30m/14d)
- **불일치 3건**: 임시 완화 상한 (A: 머지까지 / B: 24h / C: 7d) / 우선순위 (B: vote 우선) / 보안 점수 (B: 58/100)
- **누락 채택 5건**: B G1 logout revoke (CRITICAL) / B G2 subdomain hijack / B G3 R4 IDOR / B G5 Markdown raw HTML / A G7 web transition window

**합의율 70%**.

### 3.5 Phase 4 — Reviewer 합의 결정 (10건)

| # | 결정 | 채택 |
|---|------|------|
| 1 | PR 분할 vs 단일 | 분할 (만장일치) |
| 2 | 임시 완화 적용/상한 | **즉시 24h, PR-10a 머지까지 (B 안)** — A·C 7d 안전성 주장 vs B 노트북 도난 시나리오 |
| 3 | SameSite | **Lax + Origin (C 안)** — 부트캠프 Discord/슬랙 UX |
| 4 | 만료 | **30m/14d (C 안)** — 학습 세션 1~2h 기반 |
| 5 | 자체 vs 라이브러리 | 자체 JWT 유지 (마이그레이션 비용) + C BFF 부분 채택 |
| 6 | CSRF | **double-submit 폐기 → Origin/Referer (C 안)** — PR-10c 단계 재합의 |
| 7 | Refresh reuse detection | ADR-020 §4.2.1 부속서 (Redis SETNX + family revoke + grace 5초) |
| 8 | Logout revoke | ADR-018 epoch 통합 (B G1 채택) |
| 9 | dev secure 분기 | NODE_ENV !== 'production' 시 secure:false + Lax (만장일치) |
| 10 | 추가 보안 | vote UNIQUE / R4 IDOR / Domain / sanitize 화이트리스트 (B 누락 채택) |

### 3.6 사용자 결정 (5건, Reviewer 추천 채택)

| # | 항목 | 선택 |
|---|------|------|
| Q-R1 | 임시 완화 적용 | **(a) 즉시 24h, PR-10a 머지(~2d)까지** |
| Q-R2 | SameSite | **(a) Lax + Origin (CSRF token 폐기 검토)** |
| Q-R3 | 만료 | **(b) 30m / 14d** |
| Q-R4 | PR 분할 단위 | **(b) 3분할 (10a / 10b / 10c)** |
| Q-R5 | ADR 작성 위치 | **(a) ADR-020 §4.2.1 부속서** |

### 3.7 결과물 (PR #48)

- **`.env.example`** — `JWT_EXPIRES_IN=24h` (임시 완화) + `JWT_REFRESH_EXPIRES_IN=14d`
- **`docs/decisions/ADR-020-ux-redesign.md`**:
  - §2 결정 표 — R4 배포 게이트 분할 명시
  - §4.2 — Q11=a 분할 결정 명시
  - **§4.2.1 부속서 신설** (A~J 9 sub-section) — Refresh 알고리즘 / Logout epoch / sanitize 화이트리스트 / dev 분기 / Origin 가드 / 30m·14d 정식 / env refine / PR 분할 / 머지 전 선결 조건 / 합의 메타
  - §6 PR 분할표 — 12 PR → **14 PR** (PR-10 → 10a/10b/10c, 구 PR-11 흡수)
  - §11 변경 이력 — 2 행 추가
- **`docs/review/consensus-010-pr-10-security.md`** — 신규 합의 보고서

### 3.8 머지 전 선결 조건 (PR-10a 작업 직전)

- [ ] Tailscale spike (~30분) — Lax + Origin + secure 분기 + http://api.local 검증
- [ ] ADR-007 변경 영향 분석 — JwtAuthGuard 9 컨트롤러 + web 6 페이지
- [ ] refresh_tokens migration TDD (11+ cases)
- [ ] token_epoch ALTER TABLE migration TDD
- [ ] OriginGuard 글로벌 등록 + CSRF token 폐기 e2e
- [ ] 임시 완화 24h → 정식 30m 회귀

---

## 4. 사용자 즉시 작업

```bash
# .env (git ignored) 갱신:
JWT_EXPIRES_IN=24h

# API 컨테이너 재기동:
sudo docker compose restart api
```

이후 24시간 동안 재로그인 없이 사용 가능. PR-10a 머지 시 30m 으로 회귀.

---

## 5. 안 한 것

- **0순위 (PR #45 외부 노트북 axe DevTools / 키보드 풀 플로우 / 라이트·다크 시각 일치 검증)** — 본 세션은 사용자 새 트랙 우선. PR #45 acceptance 미체크 항목으로 잔존.
- **노션 베이스 자동 증가 검증** — 사용자가 후속 처리로 결정. Notion Stage 2/3 (LLM 정리 + 자동 범위 추론) 미구현 — `notion_documents` 만 갱신 (`weekly_scope`/`questions` 별경로). 이후 ADR-021 가능성.
- **PR-10a/10b/10c 코드 작업** — 본 세션은 합의 + ADR + 임시 완화까지. 코드는 별도 세션.
- **ADR-007 변경 영향 분석** — PR-10a 작업 직전 더 효율 (현재 task pending 유지).
- **Tailscale spike** — 사용자 환경 의존, PR-10a 작업 직전.

---

## 6. 패턴 관찰

**3+1 합의 — Session 12 사례**:
- 본 합의는 multi-agent-system-design §3 가 정의한 적용 기준 ("보안 관련 변경") 정확 부합
- 합의율 70% — 적정. Agent B 단독 CRITICAL 1건 (logout revoke) 채택 — 다수결이 아닌 근거 기반 (§7.3/7.4 패턴)
- Reviewer 비표결 판정 3건 (결정 2 / 3 / 5) — 부트캠프 환경 특수성 가중 적용
- C 의 가장 강한 대안 (iron-session) 미채택 — 마이그레이션 비용. 기술적 우위 부정 아님 (ADR §J 명시)

**디자인 사이클 — 본 세션 사례 추가**:
- Session 11 PR #45 이 채택한 명시적 confirm 패턴 — 사용자 1 클릭 피드백 → Session 12 즉시 시작 회귀
- spec 변경 (concept-epsilon §16) + 코드 변경 (page.tsx) + 변경 이력 (ADR-020 §11) 의 3축 동시
- Spec 가 의도적으로 정한 것을 사용자 피드백으로 회귀시키는 패턴 — 합의 가동 없이 직접 결정 (UX 변경, 보안/아키텍처 영역 외)

**임시 완화 패턴**:
- 큰 PR (PR-10a 4.3d 추정) 머지까지 시간 걸림 → 사용자 페인 임시 해소
- 트레이드오프 명시 (.env.example 코멘트) + 정식 회귀 시점 (PR-10a 머지) 명시
- ADR-020 §4.2.1 F 절 (만료 정식) + I 절 (선결 조건) 에 회귀 단계 등록 → 잊지 않음

---

## 7. 본 세션 요약 메트릭

| 항목 | 값 |
|---|---|
| PR open | 3 (#47 CTA / #48 PR-10 합의 / docs PR 예정) |
| PR 머지 | 0 (모두 외부 검증 항목 잔존) |
| 새 commit | 3 |
| 변경 docs LOC | +538 / −49 (concept-epsilon 8 줄 + ADR-020 200+ 줄 + consensus-010 380 줄 + .env.example 5 줄) |
| 변경 코드 LOC | +37 / −24 (page.tsx 단일) |
| 신규 토큰 추가 | 0 |
| 신규 컴포넌트 | 0 |
| 신규 의존성 | 0 |
| 빌드 변화 | `/play/solo` 15.3 → 15.4 kB |
| 테스트 변화 | 976+1s 그대로 |
| 사용자 결정 | 6 (CTA 1 + Q-R1~Q-R5 5) |
| 3+1 합의 가동 | 1 (consensus-010, 합의율 70%) |
| ADR 변경 | ADR-020 § 2 / 4.2 / 4.2.1 신설 / 6 / 11 |
| 신규 합의 보고서 | 1 (consensus-010-pr-10-security.md) |

---

## 8. 다음 세션 첫 행동 권장

**0순위** — PR #47 + #48 + (docs PR) 머지

**1순위 — PR-10a 작업 직전 선결 조건 3건**:
1. Tailscale spike (~30분) — 사용자 환경 (Lax + Origin + secure 분기 + http://api.local 검증)
2. ADR-007 변경 영향 분석 — JwtAuthGuard 9 컨트롤러 + web 6 페이지 호출처 추적
3. PR-10a 작업 plan (TDD 단계 분해)

**2순위 — PR-10a 본 작업** (cookie + refresh rotation + revoke epoch, 2d 추정):
- refresh_tokens entity + migration 1714000010000
- token_epoch ALTER + ADR-018 epoch 통합
- Redis SETNX mutex + family revocation
- JwtAuthGuard cookie extractor (dual support: cookie + Bearer)
- web 6 페이지 마이그레이션 (api-client `credentials:'include'`)
- env.validation refine 4건 (`JWT_REFRESH_SECRET` / `COOKIE_DOMAIN` 등)
- 11+ TDD cases

**3순위 — 0순위 (PR #45) 외부 검증** — Session 12 도 미체크. PR-10a 작업과 병렬 가능.

**4순위 — 후속 트랙**:
- PR-10b (R4 + sanitize + vote 무결성, 2d)
- PR-10c (CSRF Origin-only 또는 폐기, 1d) — 위협 모델 재합의 필수
- 노션 자동 증가 (Stage 2/3 — 별도 ADR 가능)
- 백엔드 endpoint 5종 (시안 ε mock → 실 API)
- `useUser()` 훅 (page.tsx mock 상수 7종 swap)

---

## 9. 본 세션 마무리 PR

본 세션 docs (이 파일 + CONTEXT.md + INDEX.md) 는 별도 PR — `docs/session-2026-04-28-session-12`.
