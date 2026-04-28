# Consensus-011 — PR-10c CSRF Origin guard 위협 모델 재합의

| 항목 | 값 |
|------|-----|
| 일자 | 2026-04-28 (Session 13) |
| 결정 대상 | ADR-020 §4.2.1 E 절 OriginGuard 명세 + PR-10c 진행 방식 |
| 트리거 | ADR-020 §4.2.1 E 절 "유보": PR-10c 머지 전 reviewer 재합의 (위협 모델 변화 시) |
| 환경 변화 | PR-10a 머지 (SameSite=Lax 채택) + PR-10b 머지 (R4 discussion 11 endpoint + sanitize-html OWASP 50종 + write 5/min throttle) |
| 참여 에이전트 | Agent A 구현 / Agent B 품질 / Agent C 대안 / Reviewer |
| 합의율 | **~73%** — 만장일치 5 / 부분 일치 2 / 불일치 1 / 누락 채택 6 (Phase 2 산출 §2) |
| 사용자 결정 | 6건 (Q-S1 ~ Q-S6) — Reviewer 추천값 명시 |
| CRITICAL 차단 | **3건** (B C1, B C2, A·B 운영 회귀) — 머지 전 해소 필수 |
| 결과물 | 본 합의 보고서 + ADR-020 §4.2.1 E 절 갱신 권고 (별도 docs PR) |

---

## 1. 교차 비교 매트릭스

### 1.1 핵심 항목 8개 분류

| # | 항목 | Agent A | Agent B | Agent C | 분류 | Reviewer 판정 |
|---|------|---------|---------|---------|------|--------------|
| 1 | startsWith prefix-match 결함 | CRITICAL (Tailscale 시나리오) | CRITICAL (a) `example.com.attacker.com` / `@attacker.com` | 명세 자체 결함 (4/5 → URL exact match 패치 시 수용) | **만장일치 (Consensus)** | **CRITICAL — 머지 전 차단. URL 객체 파싱 + protocol/host exact match 로 교체** |
| 2 | CORS_ORIGIN 미설정 fail-OPEN | env validation 권장 (간접) | CRITICAL (c) `''.split(',')` = `['']`, `'http://x'.startsWith('')` = true | (간접 — Q1 명세 사각지대 4건에 포함) | **부분 일치** (B 가 명시적, A·C 는 간접) | **CRITICAL — B 단독이지만 명백한 계산적 결함 (`'x'.startsWith('') === true`). 머지 전 차단 + env.validation refine 필수** |
| 3 | CSRF token 폐기 결정 유지 | 코드 0건 (grep 결과). 폐기 명목상 작업 0 — ADR I 갱신 권장 | defense-in-depth 위반 우려, decorator + git tag 보존 권장 | 폐기 금지. 명세 그대로 (단 startsWith 패치) 또는 hybrid 강화 | **불일치 (Divergence)** | **유지 (consensus-010 Q-R2 결정 존속). 단 "폐기 e2e" → "skip (구현 이력 없음)" 으로 ADR I 갱신** |
| 4 | 추천 진행 방식 | 명세 그대로 + 보완 6건 (~210 LOC, 3 Phase, 0.5~1d) | 명세 그대로 (보안 45/100 → 보완 후 82/100) + 9건 선결 조건 | **Sec-Fetch-Site + Origin/Referer hybrid** (~30 LOC + ~50 tests) | **부분 일치** (A·B: 명세+보완 / C: hybrid) | **A·B 안 채택 — 단 C 의 hybrid 핵심 통찰(Tailscale HTTP 환경에서 Sec-Fetch-Site 미전송)을 미래 트리거로 보존**. 근거: §3 Q-S1 |
| 5 | SkipOriginCheck decorator | 권장 (~10 LOC escape hatch) | 권장 (instructor 옵션 / token 폐기 reversibility) | 명시 없음 (글로벌 가드 단일 채택만) | **부분 일치 (A·B 동의, C 미언급)** | **채택 — PR-10c 에 포함. 부트캠프 학생 curl/Postman 학습 차단 회피 (A CRITICAL-운영회귀 + B Q8 학습 경험 저해)** |
| 6 | Report-Only mode + kill-switch | 권장 (롤아웃 안전장치 — env / kill-switch / 구조화 로그) | 권장 (Q7 머지 전 추가 선결 조건 9건 중 "Report-Only 1주 운영" 포함) | 명시 없음 | **부분 일치 (A·B 동의)** | **채택 — Report-Only mode env (`ORIGIN_GUARD_MODE=report\|enforce`) + kill-switch + 구조화 로그. 1주 관측 후 enforce 전환** |
| 7 | 글로벌 등록 vs 모듈별 | 글로벌 등록 권장 + SkipOriginCheck escape hatch | 명시 없음 (Q7 에 ThrottlerGuard/JwtAuthGuard/OriginGuard 순서 결정 포함) | NestJS 글로벌 가드 단일 채택 권장 (apps/web/src/middleware.ts 부재 확인) | **만장일치 (Consensus)** | **글로벌 등록 (APP_GUARD) — 단 가드 순서 명시: ThrottlerGuard → OriginGuard → JwtAuthGuard (가벼운 순)** |
| 8 | 추가 위협 헤더 (XFO / CORP / CSP frame-ancestors) | helmet 기본 충분 + 충돌 무 | helmet `Referrer-Policy: no-referrer` 충돌 (HIGH b) | 권장 — XFO DENY 명시 / CORP same-origin / CSP frame-ancestors 'none' (~+5 LOC) | **부분 일치 (C 단독 신규 권장, A·B 충돌만 지적)** | **별도 PR 분리 — PR-3b 또는 후속. PR-10c 범위는 OriginGuard 단일에 집중. 단 C 의 Referrer-Policy 충돌 (HIGH b) 은 PR-10c 에서 동시 해소 (Origin 우선, Referer fallback 시 보강)** |

### 1.2 만장일치 (Consensus, 3개 동의 5건)

| # | 항목 | 근거 |
|---|------|------|
| C1 | startsWith 결함 — CRITICAL | A: Tailscale port prefix bypass / B: subdomain bypass `example.com.attacker.com` / C: 명세 합의 시 코드 리뷰 부재 사각지대 |
| C2 | 글로벌 등록 (NestJS) | A: APP_GUARD 사용 0건 → 신설 권장 / B: 가드 순서 결정 필요 / C: NestJS 단일 채택 |
| C3 | CSRF token 코드 0건 (csurf/xsrf grep 무) | A: grep 직접 확인 / B: defense-in-depth 차원 / C: reversibility 비용 거의 0 |
| C4 | 부트캠프 학습 환경 영향 고려 | A: curl/Postman 차단 CRITICAL / B: 학생 학습 경험 저해 / C: (간접) 위협 모델 vs 운영 비용 trade-off |
| C5 | helmet/CORS 와의 상호작용 검토 필요 | A: 충돌 무 / B: Referrer-Policy 충돌 HIGH / C: 보강 권장 |

### 1.3 부분 일치 (Partial 2건)

| # | 항목 | 다수 | 소수 |
|---|------|------|------|
| P1 | 추천 진행 방식 | A·B: 명세 그대로 + 보완 | **C: Sec-Fetch-Site + Origin/Referer hybrid** |
| P2 | Report-Only / kill-switch | A·B: 채택 권장 | C: 미언급 |

### 1.4 불일치 (Divergence 1건)

| # | 항목 | A | B | C |
|---|------|---|---|---|
| D1 | CSRF token 폐기 결정 처리 | "skip (이력 없음)" 으로 ADR 갱신 | decorator + git tag 보존 | 폐기 금지 (consensus-010 결정 자체 사각지대 4건 식별) |

### 1.5 누락 (Gap, 1 Agent 만 언급, 6건)

| # | 항목 | 출처 | 중요도 | 채택 |
|---|------|------|--------|------|
| G1 | CORS_ORIGIN 미설정 fail-OPEN (`''.split(',')` → `['']`) | B (CRITICAL c) | **CRITICAL** | **채택 — 차단 항목** |
| G2 | helmet `Referrer-Policy: no-referrer` 충돌 (Origin/Referer fallback HIGH) | B (HIGH b) | HIGH | 채택 — Origin 우선 + Referer fallback 명시 |
| G3 | 대소문자 정규화 (양쪽 lowercase) | B (MEDIUM d) | MEDIUM | 채택 — URL 객체 파싱 시 자동 처리 |
| G4 | IPv6/IDN (Tailscale magicDNS) | B (MEDIUM f) | MEDIUM | 채택 — URL 객체 파싱 + IPv6 spike |
| G5 | Sec-Fetch-Site Tailscale HTTP 미전송 통찰 | C (Q4) | HIGH (미래 가치) | **부분 채택 — 미래 재검토 트리거 (TR-CSRF-1 production HTTPS) 신설** |
| G6 | 미래 재검토 트리거 4건 (TR-CSRF-1~3, TR-iron-session) | C (Q3, Q7) | HIGH | **채택 — ADR-020 §4.2.1 E 절에 트리거 표 신설** |

### 1.6 Reviewer 추가 발견 (Phase 4 — 위 누락 외)

| # | 항목 | 근거 | 등급 |
|---|------|------|------|
| R1 | **운영 회귀 — 부트캠프 학생 curl/Postman 차단** | A CRITICAL + B Q8 — 양쪽 모두 식별. 만장일치 가까움. SkipOriginCheck decorator + Report-Only 1주 + 학습 힌트 메시지 동시 적용 필수 | **CRITICAL (운영)** |

---

## 2. 합의율 산출

| 분류 | 건수 | 백분율 |
|------|------|--------|
| 만장일치 (Consensus) | 5 | 35.7% |
| 부분 일치 (Partial) | 2 | 14.3% |
| 불일치 (Divergence) | 1 | 7.1% |
| 누락 채택 (Gap accepted) | 6 | 42.9% |
| **합계** | **14** | **100%** |

**합의율 (만장일치 + 부분 일치)** = (5 + 2) / 14 = **50%**

**유효 합의율 (위 + 누락 채택, Reviewer 판정 일관성)** = (5 + 2 + 6) / 14 = **92.9%**

(불일치 1건도 Reviewer 가 명확히 판정 — D1 "유지 + ADR I skip 갱신" 으로 A 안에 가까운 절충)

### 2.1 과거 합의와 비교

| 합의 | 만장일치율 | 유효 합의율 | 특징 |
|------|-----------|------------|------|
| consensus-008 (SM-2) | 36.8% | — | 3개 Agent 큰 이견 |
| consensus-009 (UX) | 63% | — | 다관점 폭넓음 |
| consensus-010 (PR-10) | 70% | — | 5도메인 단일 PR 분할 합의 |
| **consensus-011 (PR-10c)** | **35.7%** | **92.9%** | **만장일치율 낮으나 누락 채택율 높음 — 좁은 보안 명세 검토에서 다관점 누락 식별 우세** |

**해석**: consensus-011 은 좁은 단일 명세 (17 LOC OriginGuard) 를 검토하는 회의 성격상 만장일치율 낮음. 그러나 누락 채택 6건 중 4건이 B 단독 보안 결함 (CRITICAL/HIGH) — multi-agent-system-design §7.3 "다수결이 아닌 근거 기반 채택" 패턴 부합.

---

## 3. 사용자 결정 사항 (Q-S1 ~ Q-S6)

### Q-S1. PR-10c 진행 방식

| 옵션 | 설명 | LOC | 일정 | 보안 점수 | 근거 |
|------|------|-----|------|----------|------|
| **(a) 명세 그대로 + 패치** | URL exact match + CORS fail-closed + Referrer 보강 | ~210 LOC + 33 tests | 0.5~1d | **82/100 (B)** | A·B 다수, ~210 LOC 신규 + 학습 영향 명확 |
| (b) Sec-Fetch-Site hybrid | 헤더 우선 + Origin/Referer fallback | ~30 LOC + ~50 tests | 0.5d | 4.5/5 (C) | C 단독, **Tailscale HTTP 환경에서 Sec-Fetch-Site 미전송 → 단독 채택 불가, fallback 로직 결국 (a) 와 동일** |
| (c) 폐기 | OriginGuard 미도입 | 0 | 0 | 명세 미반영 | C 도 폐기 금지 — consensus-010 Q-R2 충돌 |

**Reviewer 추천**: **(a) 명세 그대로 + 패치 (CRITICAL 2건 해소 필수)**

**근거**:
- C 의 hybrid 안의 핵심 가치인 Sec-Fetch-Site 헤더가 **현 Tailscale HTTP 환경에서 브라우저 미전송** (C Q4 본인 인정). 따라서 fallback 로직이 결국 Origin/Referer 검증과 동일 → 코드량만 늘어남.
- C 의 진짜 통찰은 "**미래 HTTPS 전환 시 자동 강화**" 인데, 이것은 **ADR 트리거 (TR-CSRF-1)** 로 보존 가능 (G6 채택).
- A·B 의 보안 점수 정량 평가 (45 → 82/100) 가 구체적이며, B 의 33 cases 테스트 매트릭스가 부트캠프 검증 환경에 적합.
- (c) 폐기는 consensus-010 Q-R2 결정 (Lax + Origin) 의 후반부를 무력화 → ADR 일관성 위반.

**영향**: ~210 LOC, 3 Phase (Phase 5 §5 참조), 0.5~1d, 운영 부담 = Report-Only 1주 관측 + kill-switch (Q-S3 채택 시)

---

### Q-S2. SkipOriginCheck decorator 도입 시점

| 옵션 | 설명 |
|------|------|
| **(a) PR-10c 에 포함** | escape hatch 동시 도입 (~10 LOC + 3 tests) |
| (b) 미래 PR 로 deferred | 부트캠프 학생 curl/Postman 차단 발생 후 대응 |
| (c) 도입 안 함 | 글로벌 가드만 |

**Reviewer 추천**: **(a) PR-10c 에 포함**

**근거**:
- A CRITICAL (운영 회귀) + B Q8 (학습 경험 저해) — 양쪽 모두 부트캠프 학생 영향을 CRITICAL/HIGH 로 식별.
- (b) deferred 는 학생이 첫 차단 경험 시 학습 흐름 방해 + 즉시 hotfix 부담.
- decorator 자체 ~10 LOC + tests 3 cases — 추가 부담 미미.
- ADR-020 §4.2.1 E 절 갱신과 동시 진행 시 (a) 가 가장 일관성 높음.

**영향**: +~10 LOC + 3 tests (controller 별 `@SkipOriginCheck()` 옵션 — instructor 도구 / public webhook 용)

---

### Q-S3. Report-Only mode + kill-switch 도입

| 옵션 | 설명 |
|------|------|
| **(a) 둘 다 도입** | `ORIGIN_GUARD_MODE=report\|enforce` + kill-switch env + 구조화 로그 |
| (b) kill-switch 만 | enforce 즉시, 차단 시 env 한 줄로 비활성화 |
| (c) 도입 안 함 | enforce 즉시 |

**Reviewer 추천**: **(a) 둘 다 도입 + 1주 관측 후 enforce 전환**

**근거**:
- A·B 부분 일치 — Q-S2 와 같은 운영 회귀 우려를 다른 layer 에서 보완.
- `ORIGIN_GUARD_MODE=report` 로 1주 운영 → 학생 환경에서 false positive 패턴 수집 → enforce 전환 시 차단 0 보장.
- kill-switch 는 enforce 후 사고 발생 시 30초 대응.
- 구조화 로그 (Pino 기반, 이미 통합) → 차단 사유 추적 가능.

**영향**: +~20 LOC (mode env + log 호출) + 1주 운영 관측 + 1 commit (enforce 전환 시)

---

### Q-S4. 추가 위협 헤더 (XFO 명시 / CORP / CSP frame-ancestors)

| 옵션 | 설명 |
|------|------|
| (a) PR-10c 에 포함 | OriginGuard + helmet 강화 동시 |
| **(b) 별도 PR (PR-3b/3c 후속)** | PR-10c 는 OriginGuard 단일에 집중 |

**Reviewer 추천**: **(b) 별도 PR**

**근거**:
- C 단독 신규 권장 (G6 일부) — A·B 미언급.
- 각 헤더 동작이 독립적 (XFO ≠ Origin 검증) → PR 단위 분리가 검토 가능성/롤백 용이성 우월.
- 단 C 의 Referrer-Policy 충돌 (HIGH b, B 도 식별) 은 OriginGuard 동작에 직접 영향 → **PR-10c 에서 동시 해소** (Origin 우선 + Referer fallback 명시).
- multi-agent-system-design §7.4 "단일 책임 PR" 원칙 부합.

**영향**: +5 LOC 정도 (별도 PR), PR-10c 범위 외

---

### Q-S5. ADR-020 §4.2.1 E 절 명세 코드 갱신 시점

| 옵션 | 설명 |
|------|------|
| **(a) PR-10c 머지 전 docs PR** | 명세 먼저 갱신 → 구현 PR 이 명세 추종 (SDD) |
| (b) 코드 PR 머지와 동시 | 한 PR 에 docs + code |
| (c) 머지 후 follow-up | 코드 먼저, 문서 나중 |

**Reviewer 추천**: **(a) PR-10c 머지 전 docs PR**

**근거**:
- CLAUDE.md §1 SDD: "코드 변경 전 관련 SDD 문서 확인 필수, 문서가 없으면 설계 문서를 먼저 작성하고 사용자 검토를 받음".
- 명세 코드 (17 LOC) 자체에 CRITICAL 2건 (startsWith bypass + fail-OPEN) — 코드 PR 이 잘못된 명세 추종 위험.
- (a) 는 docs PR 검토 시 CRITICAL 2건 + Q-S1~S4 결정 모두 ADR 에 반영 → 구현 PR 은 단순 추종 (TDD 적용).
- (b) 는 한 PR 인지 부하 (consensus-010 5도메인 단일 PR 의 교훈).
- (c) 는 SDD 위반.

**영향**: +1 docs PR (ADR-020 §4.2.1 E 절 갱신 + §I 머지 전 선결 조건 갱신 + §4.2.1 E 절 트리거 표 신설), 0.5d

---

### Q-S6 (Reviewer 추가 발견). 가드 순서 명시

| 옵션 | 설명 |
|------|------|
| **(a) ThrottlerGuard → OriginGuard → JwtAuthGuard** | 가벼운 순 (rate limit → origin → auth) |
| (b) JwtAuthGuard → OriginGuard | auth 우선 (UX 친화) |
| (c) 명시 안 함 | NestJS 기본 순서 |

**Reviewer 추천**: **(a) ThrottlerGuard → OriginGuard → JwtAuthGuard**

**근거**:
- B Q7 9건 선결 조건 중 "ThrottlerGuard/JwtAuthGuard/OriginGuard 순서 결정" 명시.
- 가벼운 검증 (rate limit, origin) 을 무거운 검증 (JWT 검증 + DB 조회) 앞에 배치 → DDoS 방어.
- OriginGuard 는 GET/HEAD/OPTIONS 통과 → SSR/health check UX 영향 0.
- JwtAuthGuard 가 마지막 → 401 vs 403 구분 명확.

**영향**: APP_GUARD 등록 순서 명시 (코드 0~2 LOC + ADR 1 줄)

---

## 4. CRITICAL 차단 권고

머지 전 반드시 해소해야 할 항목 — **3건**:

### CRITICAL-1 (B C2, A 동의): startsWith prefix-match bypass

**위협**:
- B 시나리오 1: `allowed = ['http://example.com']`, attacker = `http://example.com.attacker.com` → `startsWith` true → 통과
- B 시나리오 2: `attacker = http://example.com@attacker.com` → URL 파싱상 host 는 `attacker.com` 이지만 `startsWith` 는 true → 통과
- A 시나리오 (Tailscale): `allowed = ['http://100.102.41.122:3002']`, attacker = `http://100.102.41.122:30022` → startsWith true → 통과

**해소**: URL 객체 파싱 + `protocol + host` exact match. 예시:
```ts
const reqUrl = new URL(origin);
const ok = allowed.some((a) => {
  try {
    const allowedUrl = new URL(a);
    return (
      reqUrl.protocol === allowedUrl.protocol &&
      reqUrl.host.toLowerCase() === allowedUrl.host.toLowerCase()
    );
  } catch {
    return false;
  }
});
```

**테스트**: B 매트릭스 "startsWith bypass 4 cases" + "정규화 3 cases"

---

### CRITICAL-2 (B C1): CORS_ORIGIN 미설정 fail-OPEN

**위협**:
- 명세: `(process.env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim())` → `['']`
- `'http://attacker.com'.startsWith('')` === `true` → **모든 origin 통과**
- 운영 사고 (.env 누락 / 배포 실수) 시 CSRF 방어 완전 무력화

**해소** (2단계):
1. **env.validation.ts refine**: `CORS_ORIGIN` 필수 (min 1 origin) + URL 형식 검증 → 부팅 실패로 운영 사고 차단
2. **Guard 자체 fail-closed**: `if (!allowed.length) throw new ForbiddenException('cors_origin_unconfigured')`

**테스트**: B 매트릭스 "CORS_ORIGIN env 6 cases"

---

### CRITICAL-3 (Reviewer 발견 R1, A·B 합의): 운영 회귀 — 학생 학습 차단

**위협**:
- 부트캠프 학생 curl/Postman 학습 시 Origin 헤더 부재 → 즉시 403 차단
- A: "롤아웃 안전 장치 권장 — Report-Only mode env / kill-switch / 구조화 로그"
- B Q8: "한국어 + 학습 힌트 메시지 / SkipOriginCheck instructor 옵션 / README 보강"

**해소** (3단계):
1. SkipOriginCheck decorator (Q-S2 채택)
2. Report-Only mode + kill-switch + 1주 관측 (Q-S3 채택)
3. 한국어 학습 힌트 에러 메시지 (B Q-Q5 e LOW 유지) — 예: `{ error: 'origin_missing', hint: 'curl/Postman 사용 시 강사에게 instructor 토큰 요청 또는 -H "Origin: http://localhost:3000" 추가' }`

**테스트**: SkipOriginCheck 3 cases + Report-Only mode 별도 e2e (mode=report 시 차단 X + 로그 O)

---

## 5. 최종 결정 + Phase 분해

### 5.1 최종 진행 방향

**ADR-020 §4.2.1 E 절 OriginGuard 명세 그대로 진행** (Q-S1 a) — **단 CRITICAL 3건 필수 해소**:
1. URL exact match 패치 (CRITICAL-1)
2. CORS_ORIGIN env validation refine + fail-closed (CRITICAL-2)
3. SkipOriginCheck decorator + Report-Only mode + kill-switch + 학습 힌트 메시지 (CRITICAL-3)

**총 Phase 분해**:

| Phase | 작업 | LOC (추정) | Tests | 일정 |
|-------|------|-----------|-------|------|
| **0 (docs PR, Q-S5)** | ADR-020 §4.2.1 E 절 갱신 (명세 코드 17 LOC → 30 LOC) + §I 머지 전 선결 조건 갱신 + 트리거 표 신설 (TR-CSRF-1~3) | 0 코드 / +60 docs | 0 | 0.5d |
| **1** | OriginGuard 글로벌 가드 + URL exact match + fail-closed + env.validation refine | ~80 LOC | **22 cases** (CORS env 6 + bypass 4 + 정규화 3 + Method 5 + Origin/Referer 4) | 0.5d |
| **2** | SkipOriginCheck decorator + Report-Only mode + kill-switch + 구조화 로그 + 학습 힌트 에러 메시지 | ~50 LOC | **8 cases** (decorator 3 + Report-Only 3 + kill-switch 2) | 0.25d |
| **3** | APP_GUARD 등록 + 가드 순서 (Q-S6 a) + Tailscale spike 회귀 + e2e 검증 | ~10 LOC + 1 module wire | **3 cases** (e2e 통합) | 0.25d |
| **합계** | | **~140 LOC + 60 docs** | **33 cases** | **1.5d** |

(B 매트릭스 33 cases 와 일치)

**1주 관측** (Phase 2 이후): Report-Only mode → 차단 패턴 0 확인 → enforce 전환 (1 commit, 5분)

### 5.2 e2e 컨벤션

PR-3a 패턴 적용 — supertest + Express duck-type:
- `OriginGuard` 단위 테스트: NestJS `Test.createTestingModule` + `ExecutionContext` mock
- e2e: 실제 NestApplication 부팅 → supertest POST 요청 + Origin 헤더 변형 5종

### 5.3 Phase 의존

- Phase 0 (docs PR) 머지 → Phase 1 (코드 PR) 시작
- Phase 1~3 단일 PR (PR-10c) 통합
- 1주 관측 → enforce 전환 commit (별도, PR 아님)

### 5.4 머지 전 선결 조건 갱신 (ADR-020 §4.2.1 I)

기존 1건 → 6건으로 갱신:

| 기존 | 갱신 |
|------|------|
| OriginGuard 글로벌 등록 + CSRF token 폐기 e2e | (1) URL exact match 패치 (CRITICAL-1) + (2) CORS_ORIGIN env validation refine + fail-closed (CRITICAL-2) + (3) SkipOriginCheck decorator + Report-Only 1주 관측 (CRITICAL-3) + (4) 가드 순서 명시 (Q-S6) + (5) 33 cases 통과 + (6) ~~CSRF token 폐기 e2e~~ → **skip (구현 이력 없음, grep csurf/xsrf/csrf 0건)** |

---

## 6. ADR-020 갱신 권고

### 6.1 §4.2.1 E 절 — 명세 코드 갱신 (17 LOC → ~30 LOC)

```ts
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // SkipOriginCheck decorator (Q-S2)
    if (this.reflector.get<boolean>('skipOriginCheck', ctx.getHandler())) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    const origin = req.headers.origin ?? req.headers.referer;
    if (!origin) {
      this.logBlocked(req, 'origin_missing');
      if (process.env.ORIGIN_GUARD_MODE === 'report') return true;
      throw new ForbiddenException({
        error: 'origin_missing',
        hint: 'curl/Postman 사용 시 -H "Origin: http://localhost:3000" 추가 또는 강사에게 instructor 토큰 요청',
      });
    }

    const allowed = (process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // CRITICAL-2: fail-closed
    if (!allowed.length) throw new ForbiddenException('cors_origin_unconfigured');

    // CRITICAL-1: URL exact match (host + protocol)
    let ok = false;
    try {
      const reqUrl = new URL(origin);
      ok = allowed.some((a) => {
        try {
          const aUrl = new URL(a);
          return reqUrl.protocol === aUrl.protocol && reqUrl.host.toLowerCase() === aUrl.host.toLowerCase();
        } catch {
          return false;
        }
      });
    } catch {
      ok = false;
    }

    if (!ok) {
      this.logBlocked(req, 'origin_mismatch');
      if (process.env.ORIGIN_GUARD_MODE === 'report') return true;
      throw new ForbiddenException('origin_mismatch');
    }
    return true;
  }
}

// SkipOriginCheck decorator (별도 파일)
export const SkipOriginCheck = () => SetMetadata('skipOriginCheck', true);
```

### 6.2 §4.2.1 E 절 — 트리거 표 신설 (C G6 채택)

| Trigger | 조건 | 재합의 항목 |
|---------|------|------------|
| TR-CSRF-1 | production HTTPS 전환 | Sec-Fetch-Site hybrid 도입 검토 (C 권고) |
| TR-CSRF-2 | 동시 사용자 100명+ | double-submit token 도입 검토 (defense-in-depth) |
| TR-CSRF-3 | endpoint 12+ 또는 외부 통합 추가 | iron-session/Lucia 등 라이브러리 재고 |
| TR-iron-session | refresh race 사고 발생 | Redis SETNX → iron-session 마이그레이션 검토 |

### 6.3 §4.2.1 I 절 — 머지 전 선결 조건 갱신 (§5.4 참조)

기존 "OriginGuard 글로벌 등록 + CSRF token 폐기 e2e" → 6건으로 분해 + "CSRF token 폐기 e2e" → skip 명시.

---

## 7. 메타

- **합의 패턴 관찰**: B 단독 CRITICAL 지적 2건 (C1 fail-OPEN, C2 startsWith — 후자는 A 도 식별) — multi-agent-system-design §7.3 "다수결이 아닌 근거 기반 채택" 부합. Reviewer 단독 발견 1건 (R1 운영 회귀) — A·B 합의 관찰에서 도출.
- **C 의 가장 강한 대안 (Sec-Fetch-Site hybrid) 미채택**: 본인이 식별한 "Tailscale HTTP 환경에서 헤더 미전송" 결함이 결정적. 단 미래 가치는 ADR 트리거 (TR-CSRF-1) 로 보존.
- **Reviewer 비표결 판정 4건**: Q-S1 (A·B 다수+C 통찰 보존), Q-S4 (C 단독→별도 PR), Q-S5 (SDD 원칙), Q-S6 (보안 best practice). 모두 근거 비교 기반.
- **반증 가능성 명시**: TR-CSRF-1 (production HTTPS) 발생 시 본 합의 Q-S1 결정 (Sec-Fetch-Site hybrid 미채택) 재검토 필수. C 의 통찰이 옳을 수 있는 환경 변화를 명시적으로 트리거化.
- **합의율 산출 방식**: 만장일치 35.7% / 유효 합의율 92.9% — 좁은 명세 검토 회의 특성. consensus-010 70% 와 직접 비교는 부적절.

---

## 8. 참조

- `docs/decisions/ADR-020-ux-redesign.md` §4.2.1 E 절 (본 합의의 갱신 대상) / §6 PR 분할표 (PR-10c 행)
- `docs/review/consensus-010-pr-10-security.md` Q-R2 (b) 결정 (본 합의의 트리거)
- `docs/architecture/multi-agent-system-design.md` §7.3/7.4 (B 단독 CRITICAL 채택 패턴)
- `CLAUDE.md` §3 (보안 변경 시 3+1 합의 필수)
- `apps/api/src/main.ts:28` (현 CORS_ORIGIN 사용처 — env.validation refine 영향 확인 필수)
