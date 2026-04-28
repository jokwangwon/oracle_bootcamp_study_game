# 세션 로그 — 2026-04-28 Session 11

## 한줄 요약

**PR-9a' 시안 ε (Hero Mirror) polish 단일 PR 완주 — 11 commit 으로 §11 의 11단계 작업 순서 그대로 진행, 1 PR 머지 (#45)**. `/play/solo` config phase 가 메인 시안 D Hero idiom 을 미러링하는 통합 디자인 시스템 phase 2 형성. 신규 컴포넌트 4 + 시각 upgrade 3 + 토큰 6 + mock 6 + `lib/code/types.ts` 추출 (home↔play 코드 라인 모델 공유 시작).

---

## 1. 세션 개요

| 항목 | 값 |
|---|---|
| 머지된 PR 수 | **1** (#45) |
| 새 commit 수 | 11 (단일 polish PR 안에) |
| 새 web 파일 수 | 5 (`code/code-preview-panel` / `play/{config-hero,week-day-picker,weekly-stats-strip}` / `lib/code/types`) |
| 변경된 web 파일 수 | 8 (globals.css / tailwind.config.js / page.tsx / hero-live-panel / track-selector / mode-multi-select / config-form / lib/play/{types,mock} / lib/home/types) |
| LOC 변화 | +1391 / −312 (16 파일) |
| ADR-020 §11 변경 기록 | +1 행 (PR-9a' 항목) |
| 빌드 변화 | `/play/solo` 8.83 kB → **15.3 kB** (Hero / Strip / 4 신규 컴포넌트 기인) |
| 테스트 변화 | 976+1s 그대로 (web only 변경 — typecheck/build 게이트) |
| 사용자 결정 | 1건 (PR #44 머지 후 §11 진행 컨펌, PR #45 생성 컨펌) |
| 3+1 합의 가동 | 0회 (시각 polish — 명세 §11 가 작업 순서 명시 → 합의 불필요) |
| 외부 노트북 검증 | 0회 (본 세션 종료 후 외부 검증 예정 — PR description 의 미체크 항목) |

---

## 2. 시안 ε §11 — 11단계 polish PR

본 세션의 유일한 트랙. Session 10 의 PR #43 (시안 ε concept) 이 §11 작업 순서를 명시했고, 본 세션은 그 순서 그대로 진행.

### 2.1 작업 순서와 commit 매핑

| 단계 | § | commit | 핵심 |
|---|---|---|---|
| 1 | §5.1 / §5.2 | `28abc75` | 토큰 6종 (`--difficulty-easy/medium/hard` foreground + `-bg` background) + Tailwind `theme.extend.colors.difficulty.{easy,medium,hard}.{DEFAULT,bg}` |
| 2 | §4.3 | `afaafb4` | mock 4종 (`MOCK_WEEKLY_STATS` / `MOCK_RECOMMENDED_PREVIEW` / `MOCK_MODE_STATS` / `MOCK_LAST_SESSION`) + 트랙 stats mock 2종 + 신규 타입 5종 + `lib/code/types.ts` 신규 (코드 라인 모델 home↔play 공유) |
| 3 | §10.2 | `7ddce32` | `<CodePreviewPanel>` 추출 — `<HeroLivePanel>` 의 Layer 1+2+3 generic 화. props `code` / `filename` / `topLabel` / `bottomLeftLabel?` / `bottomRightLabel?` + `bottomSlot?` 확장 (home 의 풍부한 ticker 수용) |
| 4 | §10.1 | `a8d4805` | `<ConfigHero>` 신규 — 시간대별 인사 4분기 (06–11/11–17/17–22/22–06) + 신규 사용자 분기 (`currentDay <= 1 && !weeklyStats`) + 명시적 confirm 패턴 (`추천으로 시작` 자동 채움 후 사용자가 다시 시작) |
| 5 | §10.4 | `3bd06f3` | `<WeekDayPicker>` 신규 — input + 20-dot strip (`grid-cols-20` 기존 활용). 4 상태 (선택 > 오늘 > 완료 > 미진행) 우선순위 + 키보드 (좌/우 화살표 / Home / End) + 양방향 sync |
| 6 | §10.3 | `48be9bf` | `<WeeklyStatsStrip>` 신규 — 4 metric (풀이 / 정답률 / 연속 / 일평균) + 신규 사용자 strip silent + 모바일 grid-cols-2 분기 |
| 7a | §3.3 / §10.5 | `b56fbc5` | `<TrackSelector>` 시각 upgrade — 22 → 36px 아이콘, 우상단 18px 체크 마커, `border-2 border-brand` + `ring-2 ring-brand/15`. `liveUserCount` 단독 prop → `rankedStats` / `practiceStats` 2종 (트랙별 다른 stats 라인) |
| 7b | §3.5.2 / §10.6 | `09cde6e` | `<ModeMultiSelect>` 시각 upgrade — 가로 wrap → 세로 list (메타가 우측에 들어가야 가독성 ↑), lucide 아이콘 매핑 5종 (`<Pencil />`/`<AlignLeft />`/`<CheckCircle />`/`<TrendingUp />`/`<FolderTree />` + `<HelpCircle />` fallback). 메타 색 분기 (`accuracyPct < 50%` → `text-error` 약점 강조). 다중 선택 로직 / 최소 1개 강제 / `aria-pressed` 변경 없음 |
| 7c | §3.4 / §3.5 | `3fc57fb` | `<ConfigForm>` split layout (좌 주제+주차 / 우 모드+난이도) + 난이도 chip 3중 인코딩 (색 + 강도 dot `●●○○○`/`●●●○○`/`●●●●●` + 라벨). 미선택 시 dot `text-border` (layout shift 방지). Tailwind utility `text-difficulty-easy` / `bg-difficulty-easy-bg` 사용 |
| 8 | §11-8 | `7888379` | `page.tsx` 재구성 — 6 영역 통합 (Hero → 섹션 라벨 → Track → Form → Strip → CTA). 컨테이너 720 → `max-w-5xl` (config phase 한정, `ConfigContainer` 분리). mock 상수 7종 (`MOCK_NICKNAME` 등). `오늘의 챌린지` placeholder route + disabled. ReviewBadge 를 CTA 그룹 마지막으로 흡수. `getMockLiveUserCount()` 제거 |
| 9 | §3.3 (ADR) | `7899728` | ADR-020 §3.3 변경 이력 한 줄 (PR-9a' 항목) |

### 2.2 단일 PR 결정 근거 (시안 ε §11)

본 작업은 단일 polish PR 로 진행. 이유:
- 시각 풍부함은 한 번에 머지되어야 페이지가 일관됨 (단계 분할 시 어색한 중간 상태)
- 토큰 추가 / 컴포넌트 변경 / 데이터 mock 모두 서로 의존
- 백엔드 endpoint 미연결이어도 mock 만으로 모든 시각 검증 가능

본 세션은 그 결정에 따라 11 commit 을 한 PR (#45) 로 제출 + squash 머지.

### 2.3 변경 / 미변경 / 안 한 것 (§13)

**변경됨**:
- Hero anchor 신규 (`<ConfigHero>` 좌측 카피 + 우측 `<CodePreviewPanel>`)
- 페이지 h1 위치 이동 (Hero 아래로) + 시각 축소 (`text-base sm:text-lg`)
- 트랙 타일 22 → 36px 아이콘, stats row
- 폼 카드: 한 카드 → 좌우 split (`grid grid-cols-[1fr_1.1fr]`)
- 주차 input: native number → `<WeekDayPicker>` (input + 20-dot strip)
- 모드 chip: 텍스트만 → 아이콘 + 라벨 + 메타 + 마커 (가로 4 col, 세로 list)
- 난이도 chip: 같은 시각 무게 → 색 분기 + 강도 dot (3중 인코딩)
- 라이브 통계 strip 신규 (`<WeeklyStatsStrip>`)
- CTA 그룹: 보조 1개 → 2개 (`최근 오답` + `오늘의 챌린지` placeholder + ReviewBadge 흡수)
- 페이지 컨테이너 720 → `max-w-5xl` (config phase 한정)
- 신규 토큰 6종

**변경 없음**:
- PR-9a 의 시안 β §3.1 데이터 흐름 (Layer 1 트랙 + Layer 2 주제·주차 + Layer 3 모드 + Layer 4 난이도)
- 라우트 / 인증 흐름 / 게스트 redirect / shadcn/ui / Tailwind v3.4 / shared 데이터 모델
- `apiClient.solo.start` 시그니처 (PR-9a 확장한 것 그대로)
- 메인 시안 D 의 토큰 / 글라스 / brand-gradient
- playing / finished phase 의 720 컨테이너 (별도 `Container` 유지)

**안 한 것**:
- playing / finished phase 변경 (PR-9b / PR-9c 트랙)
- `/review/mistakes` 변경 (PR-9d 트랙)
- 추천 문제 미리보기 동적 갱신 (Day 16 정적 mock — endpoint + debounce 는 후속 PR)
- `오늘의 챌린지` CTA 백엔드 연결 (placeholder route, disabled)
- framer-motion 도입 (시안 ε §5.4 — 본 PR 에서 도입 가능했으나 시각 풍부화 검증 우선, PR-9b 와 함께)
- `useUser()` 훅 도입 (page.tsx 의 mock 상수 7종이 후속 PR 의 1:1 swap 지점)

---

## 3. 구조적 결정 — 의도적 사고

### 3.1 `<CodePreviewPanel>` 추출 시 `bottomSlot` 추가

시안 ε §10.2 spec 의 props 는 `bottomLeftLabel?` / `bottomRightLabel?` 두 라벨 슬롯만 명시. 그러나 메인 `<HeroLivePanel>` 의 Layer 3 ticker 는 4종 콘텐츠 (active users + 도트 + top player + 정답률) 로 라벨 두 개로는 표현 불가.

**결정**: `bottomSlot?: ReactNode` 확장 prop 추가, 제공 시 `bottomLeft`/`bottomRight` 라벨보다 우선. 시안 ε spec 의 호환은 라벨 props 그대로 유지하면서 home 의 풍부한 콘텐츠도 수용.

**근거**: 동일 컴포넌트 재사용이라는 spec 의도 (코드 영역 100% 호환) 를 깨지 않으면서 home 의 기존 ticker 구조를 보존. 별도 wrapper 만들면 두 페이지 시각 분리됨.

### 3.2 `lib/code/types.ts` 추출

`CodeSegment` / `CodeLine` / `CodeSegmentKind` 를 `lib/home/types.ts` → `lib/code/types.ts` 이동. `lib/home/types.ts` 는 re-export 로 호환 유지.

**근거**: play 모듈이 home 모듈을 import 하면 wrong-direction dependency. 두 페이지가 모두 의존하는 코드 라인 모델은 중립 위치에. 후속 PR 에서 다른 페이지 (예: `/review/mistakes` 의 코드 미리보기) 도 같은 모델 사용 가능.

### 3.3 `Container` vs `ConfigContainer` 분리

기존 `Container` 는 720px (playing/finished 의 input 중심 UX 에 적합). config phase 는 Hero + split form 으로 720px 에서 답답.

**결정**: 새 `ConfigContainer` 는 `max-w-5xl` (시안 ε §13.2 명시), `Container` 는 720 유지. 두 phase 의 시각 책임이 다름을 인정.

**근거**: `Container` 를 일괄 변경하면 playing 의 input 너비가 과도해짐. config phase 의 시각 풍부함은 wide 가 핵심 — 두 컨테이너 분리가 자연스러움.

### 3.4 `getMockLiveUserCount()` 제거

PR-9a 에서 `<TrackSelector>` 의 `liveUserCount?: number` prop 으로 사용. 시안 ε 에서는 트랙 타일 stats row 로 흡수 — `RankedTrackStats.liveUserCount` 의 일부.

**결정**: 함수 자체 제거. 호출부 (page.tsx) 가 `MOCK_RANKED_TRACK_STATS` 로 교체.

**근거**: 죽은 코드. CLAUDE.md 의 "If you are certain that something is unused, you can delete it completely" 와 일치. grep 으로 외부 사용 0건 확인.

---

## 4. 명세 → 코드 충실도

| 시안 ε § | 코드 반영 | 비고 |
|---|---|---|
| §5.1 토큰 6종 | ✅ globals.css :root + .dark | 라이트는 단색 배경, 다크는 alpha (글라스 위 자연스러움) |
| §5.2 Tailwind 매핑 | ✅ tailwind.config.js | `theme.extend.colors.difficulty.{easy,medium,hard}.{DEFAULT,bg}` |
| §3.1.1 시간대별 인사 4분기 | ✅ `pickTimeBasedGreeting()` | 06–11 / 11–17 / 17–22 / 22–06 |
| §3.1.1 신규 사용자 분기 | ✅ `isNewUser = currentDay <= 1 && !weeklyStats` | pill / stats 메타 / CTA 모두 silent or alt |
| §3.3.4 트랙 stats row 4 상태 | ⚠️ 부분 반영 | ranked 의 `현재 점수 1,240 XP` 행은 미반영 — 공간 따라 선택 (spec 도 옵셔널). 후속 사용자 프로필 endpoint 연결 시 추가 가능 |
| §3.4.3 dot 4 상태 우선순위 | ✅ selected > today > played > unreached | aria-label `Day N, 상태` |
| §3.4.3 키보드 | ✅ 좌/우 화살표 + Home + End | spec 은 좌우만, 본 구현은 Home/End 추가 — 접근성 ↑ |
| §3.5.2 모드 chip 가로 4 col | ✅ `[icon 13px] [라벨 flex-1] [메타] [선택 마커]` | 메타 색 분기 (정답률 < 50% → `text-error`) |
| §3.5.3 난이도 강도 dot 3중 인코딩 | ✅ 색 + dot + 라벨 | 미선택 시 dot `text-border` (layout shift 방지) |
| §3.6 strip 4 metric | ✅ 풀이 / 정답률 / 연속 / 일평균 | 신규 사용자 strip silent |
| §3.7 CTA 그룹 + ReviewBadge | ✅ 시작 + 최근 오답 + 오늘의 챌린지 + ReviewBadge | 오늘의 챌린지 disabled |
| §13.2 max-w-5xl | ✅ ConfigContainer 분리 | playing/finished 720 유지 |

---

## 5. 환경 / 운영 메모

- **Web 컨테이너 rebuild 권장**: PR #45 머지 후 `/play/solo` config phase 가 완전히 새 영역. 외부 노트북 검증 시 `sudo docker compose build web && up -d web` 필요.
- **`apps/web/next-env.d.ts`** 여전히 untracked. Session 8+ 부터 이월. .gitignore 처리 시점 미정.
- **본 세션 외부 검증 0회**: 사용자 컨펌 후 PR #45 즉시 생성. axe / 라이트·다크 / 키보드 풀 플로우 검증은 PR description 미체크 항목으로 남김 — 외부 노트북에서 처리 권장.

---

## 6. 패턴 관찰

**디자인 시안 핸드오프 사이클 — 본 세션 1 사례 추가**:
- 시안 ε concept (Session 10 PR #43) → 본 세션 단일 PR-9a' 코드 (PR #45)
- §11 작업 순서 11단계가 명세에 이미 분해돼 있어 본 세션 진행이 매끄러움
- Session 10 의 패턴 정착 (3 사례 — brief → 시안 → 코드) 의 4번째 사례

**3+1 합의 미가동의 이유**:
- 시각 polish 작업은 명세 §11 이 작업 순서를 명시함 → 의사결정 분기 없음
- 보안 / 아키텍처 / SDD 가 아닌 시각 풍부화는 합의 비대상 (CLAUDE.md §3 적용 기준)
- 단일 PR 결정 자체는 시안 ε §11 에서 이미 합의됨 (concept 작성 시점)

**페이지 size 증가 — 의도적 비용**:
- `/play/solo` 8.83 → 15.3 kB (+73%)
- 신규 컴포넌트 4 + 시각 풍부화 3 + lucide 아이콘 5종 + mock 데이터 기인
- 시각 풍부함의 비용 — 시안 ε 의 acceptance 안에 들어옴

---

## 7. 본 세션 요약 메트릭

| 항목 | 값 |
|---|---|
| PR 머지 | 1 (#45) |
| 새 commit | 11 |
| 새 web 파일 | 5 |
| 변경 파일 | 16 (+1391 / −312) |
| ADR-020 §11 변경 기록 | +1 행 |
| 토큰 추가 (enforce) | 6 (`--difficulty-{easy,medium,hard}` + bg) |
| 신규 컴포넌트 | 4 (`<CodePreviewPanel>` / `<ConfigHero>` / `<WeekDayPicker>` / `<WeeklyStatsStrip>`) |
| 시각 upgrade 컴포넌트 | 3 (`<TrackSelector>` / `<ModeMultiSelect>` / `<ConfigForm>`) |
| 신규 의존성 | 0 (lucide / shadcn 기존 활용) |
| 빌드 변화 | `/play/solo` 8.83 → 15.3 kB |
| 테스트 변화 | 976+1s 그대로 |
| 사용자 결정 | 1건 (§11 진행 컨펌 → 11 commit polish → PR #45 컨펌) |
| 3+1 합의 가동 | 0회 |

---

## 8. 다음 세션 첫 행동 권장

**0순위**: PR #45 외부 노트북 검증 (axe DevTools 라이트/다크 + 키보드 풀 플로우 + 시안 ε 라이트/다크 시각 일치). 본 세션 acceptance 의 미체크 항목.

**1순위 후보** (택 1):
- **PR-9b 트랙** — playing phase 시안 β + framer-motion 도입 (시안 β §3.2)
- **백엔드 endpoint 5종 트랙** — `weekly-stats` / `recommended-preview` / `mode-stats` / `recommended-week` / `last-session`. mock → 실 API 1:1 swap (컴포넌트 변경 없음)
- **`useUser()` 훅 도입** — page.tsx 의 mock 상수 7종 (`MOCK_NICKNAME` 등) 1:1 swap. 작은 PR

**2순위**:
- PR-3b — CSP Report-Only + `/api/csp-report` + 1주 관측 (Session 10 의 PR-3 분할 후속)
- PR-9c — finished phase 시안 β
- PR-9d — `/review/mistakes` 시안 β

---

## 9. 본 세션 마무리 PR

본 세션 docs (이 파일 + CONTEXT.md + INDEX.md) 는 별도 PR 로 머지 — `docs/session-2026-04-28-session-11`.
