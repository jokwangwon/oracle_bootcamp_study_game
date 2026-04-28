# 세션 로그 — 2026-04-28 Session 10

## 한줄 요약

**보안 게이트 2건 클로즈 (PR-7 CRITICAL-B5 / PR-3a CRITICAL-B1) + UX 디자인 시스템 4 PR 정착 (`/play/solo` config phase 시안 β 코드 + 시안 ε polish 명세)**. 7 PR 머지. 메인 시안 D 톤이 메인 페이지 → `/play/solo` config phase 까지 자연 확장되는 통합 디자인 시스템 phase 1 형성.

---

## 1. 세션 개요

| 항목 | 값 |
|---|---|
| 머지된 PR 수 | **7** (#37 / #38 / #39 / #40 / #41 / #42 / #43) |
| 새 commit 수 | 7 (각 PR 1 commit, PR #40 의 충돌 해결 머지 commit 1 추가) |
| 새 docs 파일 수 | 4 (brief 2 + concept 2) |
| 새 web 파일 수 | 5 (TrackSelector / ModeMultiSelect / ConfigForm + lib/play/types + mock) |
| 새 api 파일 수 | 2 (security-middleware + 그 .test) |
| ADR-020 §11 변경 기록 | 4 행 추가 (PR-7 / PR-3a / 시안 β / PR-9a / 시안 ε — 실제 5건이지만 일부 통합) |
| 테스트 변화 | 955 → **976 + 1 skipped** (+18 helmet e2e, +3 PII helper) |
| 외부 노트북 검증 | 3+1 합의 1회 (PR-3 분할 결정), PR-9a 검증 미진행 (다음 세션) |
| 사용자 결정 | 옵션 A/B/C 5건 — PR-7 우선 / PR-3 분할 권장 채택 / 옵션 C 통합 디자인 시스템 / 시안 β 채택 / 시안 ε 채택 |
| 합의 프로토콜 가동 | 1회 (PR-3 helmet+CSP, 3-Agent 합의율 87% 가중) |

---

## 2. 보안 게이트 트랙

### 2.1 PR #37 — PR-7 (CRITICAL-B5) `.githooks/pre-commit` Layer 3-a3 재귀

**브랜치**: `feature/adr-020-pr7-pii-regression`. 커밋 `f6fecdb`.

**Why**: 기존 평면 glob `apps/api/src/modules/ai/prompts/*.prompt.ts` 는 신규 모듈 (예: `discussion/prompts/`) 신설 시 LLM prompt PII 회귀 가드가 자동 커버되지 않음. ADR-016 §7 / ADR-018 §8 금지 6 의 영구 가드를 미래 모듈에도 적용 필요.

**변경**:
- `.githooks/pre-commit` Layer 3-a3 — `apps/api/src/**/*.prompt.ts` 재귀 + `*.test.ts` exclude
- `pii-regression.test.ts` — `findPromptFilesRecursively(root)` helper 분리 + 단위 테스트 3종 (tmp fs fixture: 평면 + 중첩 + 비대상 + node_modules/dist 스킵). 회귀 스캔 root → `apps/api/src` 전체 재귀
- ADR-020 §11 변경 기록 1행

**TDD 흐름**:
- RED: helper 미존재 → import fail
- GREEN: helper 구현 → 8/8 PASS (3 helper unit + 1 directory existence + 4 prompt files)
- REFACTOR: 기존 회귀 스캔도 helper 사용으로 통합

**게이트**: typecheck OK / 955+1s → **958+1s** (+3) / pre-commit 통과 / pathspec 재귀 매칭 직접 검증 (nested + 평면 + PII detect)

### 2.2 PR #38 — PR-3a (CRITICAL-B1) helmet + production-only HSTS

**브랜치**: `feature/adr-020-pr3a-helmet`. 커밋 `fe41bec`.

**3+1 합의 가동** (보안 변경 — CLAUDE.md §3 필수):

| Agent | 핵심 판단 |
|---|---|
| A (구현) | helmet 단독 0.5d 가능. ADR §4.1 nonce-CSP 는 81 inline style + Next 14 정적 headers 한계로 한 번 enforce 불가. PR 분할 강력 권장 |
| B (품질) | `'unsafe-inline'` 정적 약화 = ADR 명세 위반 + XSS 무력화 CRITICAL. HSTS default → tailscale HTTP 영구 차단 CRITICAL. Report-Only 1주 관측 필수 |
| C (대안) | OWASP `Always start with Report-Only`. middleware nonce / strict-dynamic / Trusted Types 모두 부적합. 단계 분할 + report endpoint |

**Reviewer 결론**: 3-Agent 합의율 **87% 가중 / 40% 순수**, CRITICAL 단독 0건. PR-3 → PR-3a / PR-3b / PR-3c 분할 권장. 사용자 confirm.

**PR-3a 범위**:
- `helmet@^7.2` 설치 + `applySecurityMiddleware` 도입 (`security-middleware.ts`)
- `contentSecurityPolicy: false` (Next.js 단독 관리) / `crossOriginEmbedderPolicy: false` (외부 자원 호환) / `hsts: NODE_ENV==='production' ? {...} : false` (CRITICAL-1 가드)
- `supertest` 인프라 신규 도입 + e2e 테스트 18 cases (Express duck-type 통합)
- ADR-020 §4.1 분할 명세 (3a/3b/3c) + Q2/Q3 결정 + `next.config.js → next.config.mjs` 사실 오류 수정
- `multi-agent-system-design.md` §7.3 합의 패턴 1행 신규 사례 (PR 범위 vs ADR 명세 충돌, 87% 가중)

**게이트**: typecheck OK / 958+1s → **976+1s** (+18) / pre-commit 통과

**후속**: PR-3b (CSP Report-Only + `/api/csp-report` + 1주 관측), PR-3c (middleware nonce + inline 81곳 className 화 — PR-10 동시 또는 직전)

---

## 3. UX 디자인 시스템 트랙 — 4 PR

본 세션의 가장 큰 작업. 메인 시안 D 톤이 `/play/solo` config phase 까지 자연 확장되는 통합 디자인 시스템 phase 1.

### 3.1 옵션 결정 흐름

PR-3a 머지 후 사용자 평가 — "디자인부터 완성을 하자 플레이 설정부터 인게임 플레이도 디자인 변경". `/play/solo` 638 LOC + `/review/mistakes` 678 LOC 의 단조 inline-style 을 시안 D 톤으로 확장 결정.

**옵션 C 채택** (대규모 통합 디자인 시스템) + 단계 분할 — 사용자 결정.

### 3.2 PR #39 — `/play/solo` + `/review/mistakes` 통합 brief

**브랜치**: `docs/play-and-mistakes-design-brief`. 커밋 `7b9a046`.

`docs/rationale/play-and-mistakes-design-brief.md` 신규 (624 LOC, 15 섹션) — 외부 도구 / 디자이너 핸드오프용. 4 화면 ASCII 와이어프레임 (config / playing / finished / mistakes) + 시안 D 톤 확장 강조 + 인게임 코드 블록 = Hero 3-layer 의 자연 확장 + 외부 도구 prompt 3종 (v0.dev / ChatGPT / Figma).

INDEX.md rationale 1행 + CONTEXT.md Session 10 헤더 갱신.

### 3.3 PR #40 — 시안 β (Flow Glass) 명세

**브랜치**: `docs/play-and-mistakes-concept-beta`. 커밋 `6322528` + 머지 commit `73afdae` (충돌 해결).

사용자가 외부 도구로 도출한 시안 β 명세를 본 세션에 등록. 시안 D 와 동일 핸드오프 패턴.

**핵심 결정** (사용자 confirm):
1. **옵션 1** — config 의 게임 모드 다중 선택 (한 세션 안에 모드 mix)
2. **신규 트랙 분기** — 랭킹 도전 (기존, 점수 랭킹) vs 개인 공부 (신규, 적응형 난이도, 점수 랭킹 비반영, 약점 분석)
3. 시안 D 톤 4 화면 일관 적용
4. FeedbackCard immersive (1px 보더 → 색 wash + 모션)

`docs/rationale/play-and-mistakes-redesign-concept-beta.md` 신규 (963 LOC, 16 섹션) + ADR-020 §11 1행.

**충돌 사고**: PR #39 의 INDEX.md 머지 후 PR #40 의 INDEX.md 가 같은 라인 영역에 다른 행 추가로 conflict. `git merge origin/main --no-ff` 로 두 행 모두 보존 (brief → concept-beta 논리 순서) → 머지 commit `73afdae` push.

### 3.4 PR #41 — PR-9a (시안 β §3.1 코드)

**브랜치**: `feature/adr-020-pr9a-config-track-split`. 커밋 `80bfc71`.

시안 β §3.1 의 **구조** (Layer 1 트랙 + Layer 2 주제·주차 + Layer 3 모드 다중 + Layer 4 난이도) 를 코드로 옮긴 첫 단계.

**변경 9 파일, +690 / -104**:
- 신규: `lib/play/{types,mock}.ts` + `components/play/{track-selector,mode-multi-select,config-form}.tsx`
- 수정: `globals.css` (토큰 2종) / `tailwind.config.js` (매핑) / `app/play/solo/page.tsx` (config phase 교체)
- ADR-020 §11 1행

**핵심**:
- Layer 1 글라스 트랙 타일 2개 — 4중 인코딩 (색 + 보더 + 좌상단 체크 + `aria-checked`)
- Layer 3 옵션 1 모드 다중 chip — 최소 1개 강제
- Layer 4 트랙별 분기 (ranked: difficulty chip / practice: AUTO 안내)
- URL 쿼리 `?track=practice` 진입
- API 시그니처 호환 — 클라이언트가 `modes[0]` / `difficulty ?? 'EASY'` 변환
- Suspense 경계 추가 (Next 14 `useSearchParams` prerender 호환)

**playing/finished phase 는 PR-8 톤 일시 유지** (시각적 부조화 OK, PR-9b/9c 후속).

**게이트**: typecheck OK / next build 8/8 (`/play/solo` 5.6 kB → **10.3 kB**) / 976+1s 그대로 (web 변경 only).

### 3.5 PR #42 — solo-play-config 시각 풍부함 brief

**브랜치**: `docs/solo-play-config-design-brief`. 커밋 `6aa5240`.

PR #41 결과를 외부 노트북 검증 시도 — 사용자 평가 "솔로 플레이 설정 부분도 디자인 개선이 필요". 옵션 A (시안 D 패턴) 채택 — 외부 도구 핸드오프 brief 작성.

**자체 분석 — 8가지 시각 약점** (외부 시안 평가 기준):
1. 페이지 헤더 단조 (HIGH)
2. 트랙 타일 시각 풍부함 부족 (HIGH)
3. 글라스 폼 카드 단조 (HIGH)
4. 모드 chip 단조 (MEDIUM)
5. 난이도 chip 시각 무게 동일 (MEDIUM)
6. 빈 공간 큼 (HIGH)
7. 콘텐츠 anchor 부재 — 라이브 정보 0 (HIGH)
8. 선택 미리보기 부재 (HIGH)

`docs/rationale/solo-play-config-design-brief.md` 신규 (455 LOC, 14 섹션). 시안 β §3.1 **구조 보존** + **시각만 풍부화** 입장 명시. PR-9a 인프라 (토큰 + 컴포넌트 + lib/play) 재사용 의무.

### 3.6 PR #43 — 시안 ε (Hero Mirror) 명세

**브랜치**: `docs/solo-play-config-concept-epsilon`. 커밋 `16f970e`.

사용자가 외부 도구로 도출한 시안 ε 명세 등록. 시안 D / 시안 β 와 동일 핸드오프 패턴.

**핵심 결정**: **메인 시안 D Hero idiom (좌 개인화 카피 + 우 코드 패널) 직접 미러링** — 페이지의 시각 anchor 부재 + 빈 공간 + 라이브 정보 ZERO 라는 3대 약점을 Hero anchor 한 영역으로 동시 해결.

**7가지 시각 결정**:
1. Hero anchor 신규 (좌 인사 + 진도 pill + stats + CTA / 우 추천 문제 코드 패널)
2. 트랙 타일 36px 아이콘 + stats row 2~3 행
3. Split 폼 (좌 주제+주차 / 우 모드+난이도)
4. 주차 input → `<WeekDayPicker>` (input + 20-dot strip — 시안 D Journey strip 미니 재사용)
5. 모드 chip 메타 (`~7분 · 정답률 80%`, < 50% red 분기)
6. 난이도 chip 강도 인코딩 (색 + dot `●●○○○~●●●●●` + 라벨 3중)
7. 라이브 통계 4-metric strip (`풀이 / 정답률 / 연속 / 일평균`)

`docs/rationale/solo-play-config-redesign-concept-epsilon.md` 신규 (793 LOC, 16 섹션) + ADR-020 §11 1행.

**단일 PR (PR-9a') polish 권장** — 시각 풍부함은 한 번에 머지되어야 일관됨. 백엔드 endpoint 5종 (weekly-stats / recommended-preview / mode-stats / recommended-week / last-session) 은 별도 트랙 — mock 으로 PR-9a' 단독 검증 가능.

---

## 4. 이번 세션의 패턴 관찰

### 4.1 디자인 시안 핸드오프 패턴 정착

**3 사이클 흐름 검증**:
1. brief 작성 (입력)
2. 사용자 외부 도구로 시안 도출 → claude 가 명세 등록 (출력)
3. 단계 분할 PR 진행

| 사이클 | 입력 brief | 시안 명세 | 코드 PR |
|---|---|---|---|
| 메인 페이지 | `main-page-design-brief` (PR #34 시점) | `main-page-redesign-concept-d` (PR #35) | PR #35 (PR-8b 통합) |
| 4 화면 통합 | `play-and-mistakes-design-brief` (#39) | `play-and-mistakes-redesign-concept-beta` (#40) | PR-9a~9d (#41 시작) |
| solo config polish | `solo-play-config-design-brief` (#42) | `solo-play-config-redesign-concept-epsilon` (#43) | PR-9a' (다음 세션) |

**관찰**: brief → 시안 → 코드 분할 사이클이 매 페이지마다 같은 패턴으로 작동. 시안 D / β / ε 모두 사용자가 외부 도구 (v0.dev / ChatGPT / Figma) 로 시안 도출 → claude 가 명세 등록. 외부 도구 + claude + 사용자 3자가 자연스럽게 분업.

### 4.2 3+1 합의 — 새 패턴 사례

PR-3 (helmet+CSP) 합의에서 새 패턴 관찰: **PR 범위 vs ADR 명세 충돌**. ADR §4.1 본문이 nonce-CSP 명시했으나 본 PR 범위가 좁아 불일치. Reviewer 가 "ADR 동시 갱신을 동반 권고" → "보안 위협 (XSS) 자체" vs "ADR 명세 정합성" 두 우려를 분리해 해소. multi-agent-system-design.md §7.3 신규 사례 1행 추가됨.

합의율 패턴 표:

| 검증 대상 | 합의율 | CRITICAL 단독 |
|---|---|---|
| 설계 결정 (consensus-005~008) | 40~70% | ~1건/세션 |
| 구현 세부 (consensus-007 사후) | 25% | 1건/4건 |
| **PR 범위 vs ADR 명세 충돌 (consensus-PR-3)** | **87% 가중** / 40% 순수 | **0건** |

### 4.3 머지 충돌 사고 (PR #40)

**원인**: PR #39 (brief) 의 INDEX.md line 120 추가 + PR #40 (concept-beta) 도 같은 위치에 다른 행 추가. PR #39 머지 후 PR #40 의 머지 시 conflict.

**해결**: `git merge origin/main --no-ff` (rebase 회피로 force push 불요) → 두 행 모두 보존 (brief → concept-beta 논리 순서) → 머지 commit `73afdae` push → CLEAN / MERGEABLE 전환.

**교훈**: 같은 디렉토리 / 같은 라인 영역 변경 시 PR 머지 순서를 미리 고정하거나, 의존 PR 머지 후 후속 PR rebase 권장. brief → concept 의 시각적 의존성을 INDEX 행 순서로도 표현하면 자연스럽다.

---

## 5. 누적 통계 — 전체 세션

### 5.1 머지 PR

| # | 제목 | 트랙 | 머지 시각 |
|---|---|---|---|
| 37 | PR-7 CRITICAL-B5 pre-commit Layer 3-a3 재귀 | 보안 | 03:20Z |
| 38 | PR-3a CRITICAL-B1 helmet + production-only HSTS | 보안 + 3+1 | 03:45Z |
| 39 | play+mistakes 통합 brief | UX | 04:56Z |
| 40 | 시안 β (Flow Glass) concept | UX | 05:14Z |
| 41 | PR-9a 시안 β §3.1 코드 | UX | 05:14Z |
| 42 | solo-play-config 시각 풍부함 brief | UX | 05:41Z |
| 43 | 시안 ε (Hero Mirror) concept | UX | (사용자 머지 직후) |

### 5.2 신규 파일 / 토큰 / 의존성

**신규 파일 (web)**:
- `apps/web/src/lib/play/{types,mock}.ts`
- `apps/web/src/components/play/{track-selector,mode-multi-select,config-form}.tsx`

**신규 파일 (api)**:
- `apps/api/src/security/security-middleware{,.test}.ts`

**신규 파일 (docs/rationale)**:
- `play-and-mistakes-design-brief.md` (624 LOC)
- `play-and-mistakes-redesign-concept-beta.md` (963 LOC)
- `solo-play-config-design-brief.md` (455 LOC)
- `solo-play-config-redesign-concept-epsilon.md` (793 LOC)

**신규 토큰 (이번 세션 PR-9a 적용)**: `--feedback-correct` / `--feedback-incorrect` (2 종)

**예약 토큰 (PR-9a' 시 적용 예정)**: `--difficulty-{easy,medium,hard}` foreground + bg (6 종)

**신규 의존성**:
- `helmet@^7.2` (api, deps)
- `supertest@^7.2` + `@types/supertest@^6.0` (api, devDeps)

### 5.3 ADR-020 §11 변경 기록 추가

5 행:
1. PR-7 (CRITICAL-B5)
2. PR-3a (CRITICAL-B1, 분할 1/3)
3. 시안 β 채택 (Flow Glass)
4. PR-9a (시안 β 분할 1/4)
5. 시안 ε 채택 (Hero Mirror)

---

## 6. 다음 세션 우선순위

### 6.1 0순위 — PR-9a' (시안 ε Hero Mirror polish)

`solo-play-config-redesign-concept-epsilon.md` §11 작업 순서:

1. 토큰 6종 (`--difficulty-{easy,medium,hard}` foreground + bg) + Tailwind 매핑 + ADR-020 §3.3 패치
2. mock 데이터 (`weeklyStats` / `recommendedPreview` / `modeStats` / `lastSession`)
3. `<CodePreviewPanel>` 추출 — 시안 D `<HeroLivePanel>` 코드 영역 컴포넌트화
4. `<ConfigHero>` 신규 (좌측 카피 + 우측 코드 패널)
5. `<WeekDayPicker>` 신규 (input + 20-dot strip)
6. `<WeeklyStatsStrip>` 신규 (4-metric)
7. PR-9a 컴포넌트 시각 upgrade (TrackSelector / ModeMultiSelect / ConfigForm)
8. `page.tsx` 재구성 (Hero 추가, 섹션 라벨 이동, strip 추가)
9. axe + WebAIM 라이트/다크 검증
10. PR open + 외부 노트북 평가

**framer-motion 도입 가능** (PR-9b 트랙 선반영 OK).

### 6.2 1순위 — playing / finished phase

시안 β §3.2~§3.3 적용:
- **PR-9b** — playing phase + immersive FeedbackCard + framer-motion + Code/Term Block
- **PR-9c** — finished phase + 도넛/적응형/약점 차트 + recharts

각 PR 도 외부 시안 도출 → 명세 → 코드 분할 사이클 가능.

### 6.3 2순위 — `/review/mistakes` (시안 β §3.4)

**PR-9d** — 사이드바 + diff 코드 카드 + 토글 motion. framer-motion 재사용.

### 6.4 3순위 — 보안 게이트 PR-3b (CSP Report-Only)

`docs/decisions/ADR-020-ux-redesign.md` §4.1.2 명세대로:
- `apps/web/next.config.mjs` 정적 CSP `Content-Security-Policy-Report-Only`
- `/api/csp-report` (NestJS) endpoint + 로그 파일 + 7일 회전 (Q2 결정)
- dev/prod 분기 + 누락 directive 4종 (`frame-ancestors 'none'` / `form-action 'self'` / `base-uri 'self'` / `object-src 'none'`)
- 1주 관측 시계 시작

### 6.5 4순위 — 백엔드 endpoint 5종 (시안 ε 의존)

`/api/users/me/weekly-stats` / `/api/cohort/active` 또는 합쳐서 / `/api/questions/recommended-preview` / `/api/users/me/recommended-week` / `/api/users/me/mode-stats` / `/api/users/me/last-session`. 별도 트랙 — 프론트 mock → 1:1 swap.

### 6.6 5순위 — 시안 D mock → 실 API 연결

메인 페이지 `lib/home/data.ts` mock 반환을 실 데이터로:
- `todayQuestion` — 챕터 시드 + AI 생성
- `ticker` — Phase B 운영 모니터링 또는 별도 endpoint
- `journey` — `user_progress` 집계
- `cards.primary.chapterProgress` — 동일
- `cards.ranking` — `/rankings` endpoint (현재 미구현)
- `streak` — 별도 ADR + 백엔드 PR

PR-10 (httpOnly 쿠키) 머지 후 `lib/home/data.ts` RSC 환원 가능.

### 6.7 이월 (CONTEXT.md 그대로)

- ADR-019 24h 관측 결과 / SR 혼합 편성 실사용 피드백
- Round.startedAt 기술 부채 (ADR-019 §8.1)
- MVP-C 주차별 미니 캡스톤 / MVP-C' 최종 캡스톤 / MVP-D 주간 릴리스 cron
- 실시간 대전 (ADR-015) — 후순위
- Notion Stage 2/3 / 2주차+ 시드 확장

---

## 7. 환경 / 운영 메모

- **API 컨테이너 rebuild 권장**: PR-3a 머지 후 `helmet` 의존성 추가 + `applySecurityMiddleware` 등록. `sudo docker compose build api && up -d api`.
- **Web 컨테이너 rebuild**: PR-9a 적용 (`/play/solo` config phase 교체) 외부 노트북 검증 시 필요.
- **chown 권장**: Claude root 실행 → `sudo chown -R delangi:delangi apps docs scripts packages .gitignore` (CONTEXT.md §환경 메모 패턴).
- **`apps/web/next-env.d.ts`** untracked 1건 — Next.js 자동 생성, 매 build untracked. .gitignore 처리 시점 미정 (Session 8+ 이월).
- **gh PR projects classic warning** — `gh pr create` 시 1건 경고. PR 본문은 commit 메시지 자동 반영되어 review 영향 없음.

---

## 8. 본 세션 요약 메트릭

| 항목 | 값 |
|---|---|
| PR 머지 | 7 (#37 / #38 / #39 / #40 / #41 / #42 / #43) |
| 새 commit | 7 + 머지 commit 1 (PR #40 충돌 해결) |
| 새 docs (rationale) | 4 |
| 새 web 파일 | 5 |
| 새 api 파일 | 2 |
| ADR-020 §11 변경 기록 | +5 행 |
| 토큰 추가 (현재 enforce) | 2 (`--feedback-correct/incorrect`) |
| 토큰 예약 (PR-9a' 시) | 6 (`--difficulty-{easy,medium,hard}` foreground + bg) |
| 신규 의존성 (api) | 3 (helmet / supertest / @types/supertest) |
| 테스트 변화 | 955+1s → **976+1s** (+21) |
| 사용자 결정 | 5건 (PR-7 우선 / PR-3 분할 / 옵션 C 통합 / 시안 β / 시안 ε) |
| 3+1 합의 가동 | 1회 (PR-3 helmet+CSP, 87% 가중) |
| 외부 노트북 검증 | 0회 (PR-9a 외부 검증 미진행 — 사용자가 시안 ε 로 즉시 진행 결정) |

---

## 9. 다음 세션 첫 행동 권장

1. main 동기화 + PR #44 (본 세션 마무리 docs PR) 머지 확인
2. `feature/adr-020-pr9a-prime-config-polish` 브랜치 생성
3. 시안 ε 명세 §11 작업 순서대로 진행
4. 본 세션의 7 PR 흐름과 무관하게 단일 polish PR 로 진행 (시각 풍부함은 한 번에 머지)
