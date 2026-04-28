# Consensus-010 — PR-10 보안 (httpOnly + refresh + CSRF + R4)

| 항목 | 값 |
|------|-----|
| 일자 | 2026-04-28 (Session 12) |
| 결정 대상 | ADR-020 §4.2 PR-10 — httpOnly 쿠키 + JWT refresh + CSRF + sanitize-html + R4 토론 번들 |
| 트리거 | 사용자 페인 "토큰이 자꾸 날라간다" (15분마다 재로그인) |
| 참여 에이전트 | Agent A 구현 / Agent B 품질 / Agent C 대안 / Reviewer |
| 합의율 | **70%** — 만장일치 7건 / 부분 일치 4건 / 불일치 3건 / 누락 채택 5건 |
| 사용자 결정 | 5건 (a/a/b/b/a) — Reviewer 추천 그대로 채택 |
| 결과물 | ADR-020 §4.2.1 부속서 + §6 PR 분할표 + §11 변경 이력 + .env.example |

---

## 1. Phase 1 — 분배

메인 컨텍스트가 결정 대상을 분석하고 3개 Agent 에게 관점별 지시.

| Agent | 관점 | 핵심 질문 |
|-------|------|----------|
| Agent A (구현 분석가) | "실제로 동작하는가?" | NestJS 통합 / Refresh rotation / Next.js 14 cookie / dev/prod 분기 / CSRF middleware / 임시 완화 / 테스트 / ADR-018 상호작용 |
| Agent B (품질·안전성 검증가) | "안전하고 견고한가?" | Threat model / CSRF 한계 / Refresh race / Logout revoke / Token replay / R4 보안 / 부트캠프 risk profile / SDD 정합성 / 테스트 커버리지 |
| Agent C (대안 탐색가) | "더 나은 방법이 있는가?" | 자체 vs 라이브러리 (NextAuth/Clerk/Lucia/iron-session) / JWT vs Session / CSRF 방식 / SameSite / PR 분할 / 임시 완화 / BFF / 만료 조합 |

---

## 2. Phase 2 — 독립 분석 결과 요약

### Agent A (구현 분석가)

**핵심 판단**: 부분 가능. 명세는 구현 가능하나 분할 + 임시 완화 병행 권장.

- 단일 PR LOC 추정 ~2000, 영향 파일 30+, 실제 6.0d (3d 과소)
- 분할 권장: PR-10a (보안 4.3d) + PR-10b (R4+sanitize 1.8d)
- 임시 완화 (`JWT_EXPIRES_IN=7d`) 5분 적용, 위험 0 — 즉시 적용 권장
- tailscale 환경 SameSite=Strict 검증 필수 (사전 spike 30분)
- Refresh rotation race → Redis SETNX mutex (ioredis 이미 deps)
- env.validation.ts 에 4개 secret refine 추가
- JwtAuthGuard 영향 컨트롤러 9개 — strategy 만 cookie extractor 로 교체
- 마이그레이션 dual support (cookie + Bearer)
- web 6 페이지 마이그레이션

**위험 5건**: tailscale Strict 미검증 (CRITICAL), refresh race UX (CRITICAL), CSP+CSRF 상호작용 (WARNING), 단일 PR 리뷰 누락 (WARNING), web transition window (WARNING)

### Agent B (품질·안전성 검증가)

**핵심 판단**: 명세 그대로 머지 시 보안 점수 **58/100**. 5도메인 단일 PR 의 인지 부하가 보안 위험.

**SDD 갭**:
- ADR-020 §4.2 refresh rotation reuse detection 명세 부재 (CRITICAL)
- ADR-020 §4.2 logout revoke 메커니즘 부재 (CRITICAL)
- ADR-018 epoch 와 logout/revoke 통합 미정 (HIGH)
- ADR-006 신규 secret refine 미정 (HIGH)

**엣지케이스 10건**: refresh race / dev secure / NAT throttler FP / Markdown raw HTML / logout 잔존 / 노트북 도난 / subdomain hijack / CSRF+Strict 중복 / R4 IDOR / vote race ✓

**테스트 갭**: 신규 60+ tests 추정. 70% + negative 100% 동시 달성 의문.

**위험**: CRITICAL 3 / HIGH 4 / MEDIUM 3 / LOW 1

**임시 완화 7d 평가**: **매우 위험** — 24h 가 상한 권장. localStorage XSS 시 7일 풀 액세스 (15분의 672배). 동시에 helmet CSP 강화 + sanitize-html 선행 전제.

**부트캠프 우선순위**: vote 무결성 (학습) > refresh+revoke > CSRF

### Agent C (대안 탐색가)

**핵심 판단**: §4.2 는 "공개 SaaS 멘탈 모델로 사적 mesh 환경을 해결" 시도. 6가지 가정 중 최소 3건 도전 가능.

**대안 6개**:
1. (기준) 자체 JWT + httpOnly + CSRF + Strict (3d)
2. **Redis 세션** — Redis 이미 docker-compose
3. **iron-session** — 1.5d, BFF 통합
4. Lucia Auth — TS-native
5. **임시 완화 + PR 분할**
6. **SameSite=Lax + Origin** (CSRF token 폐기)

**부트캠프 환경 적합도** (§4.2 가정에 대한 도전):
- 20명 신뢰 → CSRF 위협 약함, token 과잉
- tailscale → SameSite=Strict 과잉
- Redis 존재 → JWT stateless 이점 무의미
- 단일 호스트 → distributed 가정 무의미
- 학습 세션 1~2h → 15m access 너무 짧음
- Discord/슬랙 링크 → Strict UX 페인
- R4 미배포 → XSS 진입점 0 → 임시 완화 보안 비용 미미

**최종 권고**: 가장 강한 대안 iron-session + Lax + Origin (1.5~2d). 단 마이그레이션 비용 때문에 reviewer 판단. 30m/14d 만료, PR 분할은 채택 권장.

---

## 3. Phase 3 — 교차 비교 (Reviewer)

### 3.1 일치 (Consensus, 3개 동의 7건)

| # | 항목 | 근거 |
|---|------|------|
| C1 | 3d 추정 과소 | A: 6d / B: 분할 후 합 5d / C: iron-session 도 1.5~2d |
| C2 | 단일 PR 분할 권장 | 만장일치 |
| C3 | 임시 완화 효과적 | 적용 자체 동의, 상한 불일치 |
| C4 | Refresh race 방어 필요 | A: SETNX / B: reuse detection / C: Redis session |
| C5 | dev secure 분기 필요 | 만장일치 |
| C6 | CSRF token 가치 제한적 | A·B·C 모두 SameSite/Strict/Lax 로 대체 가능 시사 |
| C7 | ADR-018 epoch 통합 미정 | 만장일치 |

### 3.2 부분 일치 (Partial 4건)

| # | 항목 | 다수 / 소수 |
|---|------|------------|
| P1 | 임시 완화 7d 안전성 | A·C: 안전 / **B: 위험 (24h 상한)** |
| P2 | SameSite 정책 | C: Lax / A: 검증 후 / B: Strict 면역이라 Lax 도 충분 |
| P3 | 자체 JWT vs 라이브러리 | A·B: 자체 / **C: iron-session** |
| P4 | 만료 조합 | A: 15m/7d / B: 24h / **C: 30m/14d** |

### 3.3 불일치 (Divergence 3건)

| # | 항목 | A | B | C |
|---|------|---|---|---|
| D1 | 임시 완화 상한 | 정식 머지까지 | **24h** | 7d |
| D2 | 우선순위 | 보안 4.3d 우선 | **vote 무결성 우선** | 임시+분할+iron-session |
| D3 | 보안 점수 | 명시 안 함 | **58/100** | "최선 아님" |

### 3.4 누락 (Gap, 1 Agent 만 언급)

| # | 항목 | 출처 | 채택 |
|---|------|------|------|
| G1 | Logout access revoke 부재 | B | **CRITICAL — 채택** |
| G2 | Subdomain hijack | B | HIGH — 채택 |
| G3 | R4 IDOR | B | HIGH — 채택 |
| G4 | NAT throttler FP | B | MEDIUM — 모니터링 |
| G5 | Markdown raw HTML | B | HIGH — 채택 |
| G6 | iron-session 대안 | C | HIGH — 부분 채택 (BFF 패턴만) |
| G7 | Web transition window | A | MEDIUM — 채택 |
| G8 | JwtAuthGuard 9 컨트롤러 | A | MEDIUM — ADR-007 |
| G9 | CSP + CSRF httpOnly=false | A | HIGH — Origin-only 로 우회 |
| G10 | 학습 세션 기반 만료 | C | MEDIUM — 채택 |

---

## 4. Phase 4 — 합의 결정 (Reviewer)

### 결정 1 — PR 분할 vs 단일

**결정**: **분할 채택** — PR-10a (cookie+refresh+revoke 2d) / PR-10b (R4+sanitize+vote 2d) / PR-10c (CSRF 1d)

**근거**: 만장일치 (C2). B 보안 점수 58/100 핵심 원인이 5도메인 단일 PR (CRITICAL-4). Q11=a 당시 LOC 추정 부재 — 새 정보로 재결정 정당.

### 결정 2 — 임시 완화 (`JWT_EXPIRES_IN`)

**결정**: **즉시 24h 적용 (B 안)**, PR-10a 머지(~2d)까지

**근거**: A·C 의 7d 안전성 주장은 "R4 미배포 → XSS 진입점 0" 에 기반하나, B 의 반례 (노트북 도난 + tailscale 자동 인증 7일 풀 액세스, 부트캠프 외부 노트북 환경) 가 더 강하다. 24h 만으로도 사용자 페인 90% 해소 (1일 1회 로그인 = 부트캠프 세션 1회).

### 결정 3 — SameSite 정책

**결정**: **Lax + Origin 헤더 검증 (C 안)**

**근거**: C 의 Discord/슬랙 링크 UX 페인 부트캠프 운영 현실 부합. B 의 "Strict 거의 면역" 도 Lax + Origin 으로 99% 달성. PR-10c 단계에서 위협 모델 변화 시 Strict 승격 재합의.

### 결정 4 — 만료 조합

**결정**: **access 30m / refresh 14d (C 안)**

**근거**: C 의 학습 세션 1~2h 근거 가장 구체적. 15m 은 부트캠프 한 강의 중에도 갱신 발생. refresh 14d 는 부트캠프 수료 주기(8주) 중간값.

### 결정 5 — 자체 구현 vs 라이브러리

**결정**: **자체 JWT + Redis 기반 refresh + revoke 유지 (A·B 다수)**, iron-session 미채택

**근거**: (a) NestJS @nestjs/jwt 이미 통합·테스트, (b) Redis SETNX + epoch 통합 경로 명확, (c) 마이그레이션 비용 (C 인정) 이 라이브러리 단축 시간을 상쇄. **단 C 의 BFF 패턴은 web transition window (G7) 해법으로 채택**.

### 결정 6 — CSRF 방식

**결정**: **double-submit token 폐기 — Origin/Referer 검증 + SameSite=Lax 로 대체 (C 안)**

**근거**: 부트캠프 환경 CSRF 위협 모델 빈약 (C). A 의 CSP nonce + CSRF token 상호작용 복잡성 (G9) 회피. PR-10c 머지 전 위협 모델 재합의 필수.

### 결정 7 — Refresh rotation reuse detection

**결정**: **ADR-020 §4.2.1 부속서 신설 필수 (PR-10a 선행 조건)**

알고리즘:
- Redis `refresh:{userId}:{familyId}` 키로 패밀리 추적
- reuse 감지 시 패밀리 전체 폐기 → 강제 로그아웃
- Race 방어 SETNX mutex TTL 5초

### 결정 8 — Logout revoke 메커니즘

**결정**: **ADR-018 epoch 통합 (B G1)**. Logout 시 user.token_epoch 증가 → access JWT 검증 시 epoch 비교

**근거**: B 단독 지적이지만 CRITICAL. ADR-018 epoch 패턴 재사용 → 신규 인프라 0.

### 결정 9 — dev 환경 secure 분기

**결정**: `NODE_ENV !== 'production'` 시 secure:false, sameSite:'lax' (만장일치 C5). env.validation.ts 분기 명시.

### 결정 10 — 추가 보안 항목 (B 누락 채택)

| 항목 | PR | 결정 |
|------|-----|------|
| Vote UNIQUE + self-vote + rate limit | 10b | 필수 |
| R4 IDOR (PATCH/DELETE author 검증) | 10b | 필수 |
| Subdomain hijack | 10a | Domain 명시 |
| Markdown raw HTML | 10b | sanitize 화이트리스트 |
| NAT throttler FP | 별도 | 모니터링 |

---

## 5. 사용자 결정 (5건, Reviewer 추천 채택)

| # | 항목 | 채택 옵션 |
|---|------|----------|
| Q-R1 | 임시 완화 적용 시점/상한 | **(a) 즉시 24h, PR-10a 머지(~2d)까지** |
| Q-R2 | SameSite 정책 | **(a) Lax + Origin 검증 (CSRF token 폐기 검토)** |
| Q-R3 | 만료 조합 | **(b) 30m/14d** |
| Q-R4 | PR 분할 단위 | **(b) 3분할 (10a/10b/10c)** |
| Q-R5 | ADR 작성 위치 | **(a) ADR-020 §4.2.1 부속서** |

---

## 6. 본 합의 결과물 (Session 12)

1. **임시 완화 즉시 적용** — `.env.example JWT_EXPIRES_IN=24h` (1 commit)
2. **ADR-020 §4.2.1 부속서 작성** — refresh 알고리즘 + epoch + sanitize-html 화이트리스트 + dev 분기 + Domain + Origin + 만료 정식 + env refine + PR 분할 + 머지 전 선결 조건
3. **ADR-020 §6 PR 분할표 갱신** — PR-10 → PR-10a/10b/10c (12 PR → 14 PR)
4. **ADR-020 §11 변경 이력 갱신** — Session 12 합의 한 행 + CTA 즉시 시작 한 행
5. **본 합의 보고서 작성** — `docs/review/consensus-010-pr-10-security.md`

---

## 7. 다음 단계

| 단계 | 작업 | 담당 | 시점 |
|-----|------|------|------|
| 1 | 사용자 `.env JWT_EXPIRES_IN=24h` 갱신 + 재기동 | 사용자 | 즉시 |
| 2 | Tailscale spike (~30분) — Lax + Origin + secure 분기 + http://api.local 검증 | 사용자 + Claude | PR-10a 작업 직전 |
| 3 | ADR-007 변경 영향 분석 — JwtAuthGuard 9 컨트롤러 + web 6 페이지 | Claude | PR-10a 작업 직전 |
| 4 | PR-10a (cookie+refresh+revoke epoch) 2d | Claude (TDD) | 다음 세션 |
| 5 | PR-10b (R4+sanitize+vote 무결성) 2d | Claude (TDD) | PR-10a 머지 후 |
| 6 | PR-10c (CSRF Origin-only 또는 폐기) 1d + 위협 모델 재합의 | Claude + 3+1 합의 | PR-10b 머지 후 |
| 7 | 임시 완화 → 정식 30m 회귀 | Claude | PR-10a 머지 시 |

---

## 8. 메타

- **합의 패턴 관찰**: B 단독 CRITICAL 지적 1건 (logout revoke) — 다수결이 아닌 근거 기반 채택. multi-agent-system-design §7.3/7.4 패턴 부합.
- **C 의 가장 강한 대안 (iron-session) 미채택**: 마이그레이션 비용 때문이지 기술적 우위 부정 아님. ADR 부속서 §J 에 미채택 사유 명시.
- **Reviewer 비표결 판정 3건**: 결정 2 (B 보수 안), 결정 3 (C 안), 결정 5 (다수+C 부분 채택). 모두 근거 비교 기반.
- **반증 가능성 명시**: 결정 6 (CSRF 폐기) 은 부트캠프 환경 가정에 강하게 의존 — PR-10c 단계 재합의 필수.

---

## 9. 참조

- `docs/decisions/ADR-020-ux-redesign.md` — §4.2.1 부속서 (본 합의의 결과물)
- `docs/decisions/ADR-018-user-token-hash-salt-rotation.md` — epoch 패턴 재사용 근거
- `docs/architecture/multi-agent-system-design.md` — 본 합의가 따른 프로토콜
- `CLAUDE.md` §3 — 보안 변경 시 3+1 합의 필수 규정
