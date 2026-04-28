# `/play/solo` config 재설계 — 시안 ε Hero Mirror 구현 핸드오프 v1 (2026-04-28)

> **이 문서의 용도**
> 또 다른 Claude 에이전트가 받아서 `/play/solo` config phase 를 시안 ε
> (Hero Mirror) 로 시각 풍부화할 수 있도록 **충분한 컨텍스트**를 한 곳에 정리한다.
>
> **시점**: PR #41 (PR-9a) 가 이미 머지되어 시안 β §3.1 의 구조 (트랙 분기 +
> 옵션 1 다중 모드 + 난이도 분기) 를 코드로 적용한 상태. 본 작업은 **그 위의
> polish PR (PR-9a')** 으로, 구조는 보존하고 시각 풍부함만 추가한다.
>
> **읽는 순서**:
> 1. `docs/rationale/main-page-design-brief.md`
> 2. `docs/rationale/main-page-redesign-concept-d.md` (메인 시안 D — 톤 기반선)
> 3. `docs/rationale/play-and-mistakes-design-brief.md`
> 4. `docs/rationale/play-and-mistakes-redesign-concept-beta.md` (시안 β 구조)
> 5. `docs/rationale/solo-play-config-design-brief.md` (본 작업의 입력 brief)
> 6. **본 문서** (시안 ε 구체 명세)
>
> **본 문서는 코드가 아니라 명세이다.** 받는 에이전트가 본 문서를 자기 판단으로
> 코드로 옮긴다.

---

## 0. 적용 범위 / 전제

| 항목 | 값 |
|---|---|
| 대상 | `/play/solo` config phase 만 (playing / finished 는 본 PR 범위 외) |
| 의존 PR | PR-9a (시안 β §3.1 구조) 머지 완료 — 본 작업의 출발점 |
| 신규 작업 ID | `feature/adr-020-pr9a-prime-config-polish` (단일 PR — PR-9a') |
| 변경 범위 | Hero anchor 신규 영역 + 트랙 타일·모드 chip·난이도 chip 시각 풍부화 + split 폼 레이아웃 + 라이브 통계 strip + 보조 CTA + 디자인 토큰 ~5종 추가 + 신규 컴포넌트 ~3개 |
| 변경 없음 | 시안 β 구조 (Layer 1/2/3/4 데이터 흐름) / 라우트 / 인증 / shadcn / Tailwind v3.4 / 메인 시안 D 톤 / shared 데이터 모델 |
| 제약 출처 | `solo-play-config-design-brief.md` §5, §7, §8, §9 |

본 문서의 모든 변경은 brief §8.1 자유 변경 범위 또는 §8.2 ADR 패치 후 변경 가능 범위 안에 있다. §8.3 (변경 불가) 는 단 하나도 건드리지 않는다.

---

## 1. 한 줄 요약

시안 ε = **"메인 시안 D Hero 의 idiom (좌 개인화 카피 + 우 코드 패널) 을
`/play/solo` config 페이지 최상단에 그대로 미러링하여, 페이지의 시각 anchor
부재 + 빈 공간 + 라이브 정보 ZERO 라는 3대 약점을 한 영역으로 동시에 해결"**.

핵심 시각 결정 7가지:
1. **Hero anchor 신규** — 좌(개인화 인사 + 진도) + 우(추천 문제 코드 패널, 시안 D `<HeroLivePanel>` 코드 영역 컴포넌트 재사용)
2. **트랙 타일 풍부화** — 36px 큰 아이콘 박스 + 컬러 톤 + stats row 2~3 행 (라이브 데이터)
3. **Split 폼 레이아웃** — 한 글라스 카드 → 좌(주제 + 주차) / 우(모드 + 난이도) 2 col
4. **주차 input → Day picker + 20-dot strip** — 시안 D Journey strip 의 20-day grid 미니버전을 폼 인풋으로 흡수
5. **모드 chip 메타 노출** — 좌측 lucide 아이콘 + 우측 메타 (`~7분 · 정답률 80%`). 약점 모드는 정답률 색상 분기 (red)
6. **난이도 chip 강도 인코딩** — EASY (●●○○○ + emerald) / MEDIUM (●●●○○ + slate) / HARD (●●●●● + slate). 색 + 강도 + 라벨 3중 인코딩
7. **라이브 통계 strip** — 폼 아래 4-metric (`풀이 / 정답률 / 연속 / 일평균`) 글라스 카드. 빈 공간 채움.

CTA 영역에 보조 2개 추가: `최근 오답` (기존) + `오늘의 챌린지` (신규).

---

## 2. 시각 레이아웃 (전체)

```
┌────────────────────────────────────────────────────────────────────┐
│ Header (변경 없음 — 메인과 동일)                                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌─ Hero anchor (NEW — 시안 D Hero 미러) ──────────────────────┐   │
│ │  ●  DAY 16 / 20 · 누적 정답률 78%                             │   │
│ │                                                              │   │
│ │  안녕하세요 김OO 님,           │ ┌─ Code preview ──────────┐  │   │
│ │  어떻게 학습할까요?            │ │ ● recommended.sql        │  │   │
│ │                              │ │   PL/SQL · CURSOR        │  │   │
│ │  ● 8일 연속 | 풀이 24 | +120│ │ 1│ CURSOR c IS            │  │   │
│ │                              │ │ 2│   SELECT empno FROM…  │  │   │
│ │  [추천으로 시작 →] [이어서]   │ │ 3│ DBMS.PUT([??]);       │  │   │
│ │                              │ │ DAY 16 · 평균 정답률 67% │  │   │
│ │                              │ └──────────────────────────┘  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ 솔로 플레이 설정    (작은 섹션 라벨 — 시각 분리)                     │
│                                                                    │
│ ┌─ Track tile (랭킹) ────────────┐ ┌─ Track tile (개인) ────────┐  │
│ │ ▣ 36px Trophy (amber 톤)        │ │ ▣ 36px Brain (purple 톤)   │  │
│ │ 랭킹 도전                        │ │ 개인 공부                  │  │
│ │ 고정 난이도 · 점수 랭킹 반영      │ │ 적응형 난이도 · 약점 분석  │  │
│ │ ── stats row ──                 │ │ ── stats row ──            │  │
│ │ 내 순위: 7위 / 20                │ │ 풀이 문제: 80              │  │
│ │ 동기 풀이중: ● 12명              │ │ 평균 / 강한 영역: 73% · MC │  │
│ └─────────────────────────────────┘ └────────────────────────────┘  │
│                                                                    │
│ ┌─ Subject + Week 카드 ────────┐ ┌─ Mode + Difficulty 카드 ────┐  │
│ │ 주제                          │ │ 게임 모드  · 2 선택 · 섞여 출제│  │
│ │ ● SQL 기본 ▼                  │ │ ┌─ chip + icon + meta ───┐ │  │
│ │                               │ │ │ ✎ 빈칸 타이핑 ~7분 80%✓│ │  │
│ │ 주차 · Day 16 진행 중          │ │ │ ☰ 용어 맞추기 ~5분 60%✓│ │  │  ← 정답률 60% red
│ │ ┌─ Day 5 input ────────┐     │ │ │ ⊙ MC          ~6분    ○│ │  │
│ │ │ Day 5         − +    │     │ │ └────────────────────────┘ │  │
│ │ └──────────────────────┘     │ │                              │  │
│ │ ▮▮▮▮▣░░░░░░░░░░░░░░░ (20)  │ │ 난이도                       │  │
│ │ done(4) + Day5(amber)+미진행  │ │ ◉EASY ●●○○○                  │  │
│ │                               │ │ ○MED  ●●●○○                  │  │
│ │                               │ │ ○HARD ●●●●●                  │  │
│ └───────────────────────────────┘ └──────────────────────────────┘  │
│                                                                    │
│ ┌─ 이번 주 학습 통계 (NEW — 라이브 strip) ──────────────────┐      │
│ │  풀이 24 │ 정답률 78% │ 연속 8일 ● │ 일평균 3.4문제         │      │
│ └────────────────────────────────────────────────────────────┘      │
│                                                                    │
│ [ 시작하기 → ]   [ 최근 오답 ]   [ 오늘의 챌린지 ]                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

전체 페이지 컨테이너: `max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12` (변경 없음).

---

## 3. 영역별 상세 스펙

### 3.1 Hero anchor (NEW — 가장 중요)

**시안 D Hero 의 idiom 을 그대로 미러링** — 좌측 텍스트 카피 + 우측 코드 패널.

**컨테이너**: 글라스 카드 — `bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 rounded-xl p-5 sm:p-6 mb-3` + 시안 D 의 brand-tinted shadow

**그리드**:
- 데스크톱 (`lg:`): `grid-cols-[0.95fr_1.05fr] gap-4 items-center`
- `< lg`: `grid-cols-1`, 우측 코드 패널이 텍스트 아래로 흐름

#### 3.1.1 Hero 좌측

순서대로 (시안 D Hero 좌측의 직접 미러):

1. **챕터 / 진도 pill**
   - `inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand/10 rounded-full text-xs text-brand font-medium mb-2.5`
   - 좌측 6px 도트 `bg-brand`
   - 콘텐츠: `DAY 16 / 20 · 누적 정답률 78%` (인증 시), `Day 1 시작 · 부트캠프 20일 코스` (신규 사용자)

2. **인사형 h2 (h1 은 페이지 본문에 별도)**
   - **2 줄 강제** (한국어 인사 + 질문):
     - 1행: `안녕하세요 {nickname} 님,`
     - 2행: `어떻게 학습할까요?`
   - `text-xl sm:text-2xl font-medium leading-tight tracking-tight text-fg`
   - **시간대별 분기** (선택):
     - 06–11: `좋은 아침이에요`
     - 11–17: `안녕하세요`
     - 17–22: `오늘 하루 어떠셨어요`
     - 22–06: `오늘도 늦게까지 고생 많아요`

3. **인라인 stats 메타 라인**
   - `mt-2 flex items-center gap-3 text-xs text-fg-muted mb-3`
   - 항목 (구분자 `|`):
     - `● 8일 연속` (도트 amber `text-amber-500 dark:text-amber-400`, streak)
     - `이번 주 풀이 24`
     - `+120 XP`
   - 데이터 없거나 0 인 경우 해당 항목만 silent (구분자도 함께 제거)

4. **CTA 한 쌍**
   - `flex flex-wrap gap-1.5`
   - Primary: `추천으로 시작` + `<ArrowRight />` — `bg-brand-gradient text-brand-fg`
     - 클릭 시: `오늘의 추천 주차` 로 자동 폼 채움 (Layer 2 의 주차 input 이 변경됨) + 즉시 시작은 안 함 (사용자가 다시 시작 버튼 눌러야 함). **명시적 confirm 패턴** 으로 사고 방지.
   - Secondary: `이어서 학습` (마지막 학습 세션 정보 — 1초 hover 시 tooltip `Day 5 PL/SQL CURSOR · 4일 전`) — `<Button variant="outline">`
     - 마지막 세션 데이터 없으면 이 버튼 자체 silent
   - **신규 사용자 분기**: 두 버튼 대신 `시작 가이드 보기` 한 개만

#### 3.1.2 Hero 우측 — 추천 문제 코드 패널

**시안 D `<HeroLivePanel>` 의 코드 영역 (Layer 1 + Layer 2) 컴포넌트를 그대로 재사용**. 신규 컴포넌트 만들지 말고 import.

- 만약 시안 D 가 코드 영역을 별도 컴포넌트로 추출하지 않았다면, 이번 PR 에서 `<CodePreviewPanel>` 로 추출하고 시안 D 호출부도 함께 변경 (작은 리팩터).
- 컨테이너: `rounded-lg overflow-hidden border border-white/8`
- Layer 1 (탭바): `bg-code-tab` + `font-mono text-[11px] text-slate-400` — 좌측 `● recommended.sql`, 우측 `PL/SQL · CURSOR` (현재 추천 주차 + 주제)
- Layer 2 (코드): `bg-code` + 라인 넘버 + 신택스 (시안 D §6) + `--syntax-blank` 빈칸
- **Layer 3 (메타) 신설** — 시안 D 의 라이브 ticker 자리지만 본 페이지는 정적으로:
  - `bg-bg-elevated/60 backdrop-blur px-3 py-1.5 flex items-center justify-between text-[11px]`
  - 좌: `DAY 16 추천 문제` (`text-fg-muted`)
  - 우: `평균 정답률 67%` (`text-fg-muted`)
  - 코드 미리보기는 클릭해도 시작 안 함 — 단순 anchor.

#### 3.1.3 Hero 데이터 의존성

- 인사 nickname → `currentUser.nickname` (PR-9a 의 `useUser()` 훅 재사용)
- 챕터 진도 → `userPracticeStats?.currentDay` 또는 `userStats.currentDay` (트랙 무관 — 부트캠프 진도)
- streak / 이번 주 풀이 / XP → `userWeeklyStats` 신규 endpoint (§4.2)
- 추천 문제 → `apiClient.questions.getRecommendedPreview()` 신규 endpoint (§4.2). 응답 없으면 코드 패널을 시안 D 데모 코드 (정적 mock) 로 fallback 후 `예시 미리보기` 라벨 표시.

### 3.2 페이지 본문 섹션 라벨

Hero anchor 와 폼 영역 사이의 시각 분리를 위해 작은 섹션 라벨 추가:

- `<h1>` 으로 의미적 마킹 (페이지의 진짜 main heading)
- 시각: `text-base sm:text-lg font-medium text-fg mt-6 mb-3 px-1`
- 콘텐츠: `솔로 플레이 설정`
- 기존 PR-9a 의 페이지 h1 위치를 여기로 **이동**. Hero 영역이 더 시선을 끌므로 본문 섹션은 작게.

ReviewBadge 는 이 h1 옆이 아니라 **Hero 영역 우상단 또는 CTA 그룹 내부**로 이동 — 시각 구성에 따라 받는 에이전트 판단. 가장 자연스러운 위치는 CTA 그룹 마지막에 글라스 pill 로 (`오늘 복습 N건` 클릭 시 `/review/mistakes` 라우팅).

### 3.3 트랙 타일 (PR-9a 컴포넌트 시각 풍부화)

`<TrackSelector>` 컴포넌트의 props / 책임 / 키보드 / aria 는 변경 없음. 시각만 변경.

#### 3.3.1 컨테이너

- 그리드: `grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3` (변경 없음)
- 각 타일: 글라스 카드 base 동일

#### 3.3.2 선택 안 된 타일

- 변경 없음 (PR-9a 그대로): `border border-white/15 ring-1 ring-inset ring-white/10 rounded-xl p-3.5 hover:border-brand/40 transition-colors`

#### 3.3.3 선택된 타일

- 좌상단 18px 원형 체크 마커 (`absolute top-2.5 right-2.5` — 우상단으로 변경) — `bg-brand text-brand-fg rounded-full w-[18px] h-[18px] flex items-center justify-center text-[10px]` + `<Check />` 10px
- 보더: `border-2 border-brand` + `ring-2 ring-brand/15`

#### 3.3.4 타일 콘텐츠 (시각 풍부화 핵심)

순서대로:

1. **36px 색상 아이콘 박스** (기존 22px → 36px 확대)
   - 컨테이너: `w-9 h-9 rounded-lg flex items-center justify-center mb-2.5`
   - 랭킹: `bg-amber-100 dark:bg-amber-900/30` + `<Trophy />` lucide 22px (`text-amber-700 dark:text-amber-400`)
   - 개인: `bg-purple-100 dark:bg-purple-900/30` + `<Brain />` lucide 22px (`text-purple-700 dark:text-purple-400`)

2. **타이틀** — `text-sm font-medium text-fg mb-1`
   - 콘텐츠: `랭킹 도전` / `개인 공부` (변경 없음)

3. **부제** — `text-xs text-fg-muted leading-relaxed mb-2.5`
   - 변경 없음

4. **Stats row 신규** (가장 큰 시각 풍부화)
   - 컨테이너: `pt-2 border-t border-white/10 flex flex-col gap-1 text-xs`
   - 각 행: `flex items-center justify-between`
     - 좌: 라벨 (`text-fg-muted`)
     - 우: 값 (`text-fg font-medium` 또는 brand 강조)

   **랭킹 도전 stats**:
   - `내 순위` → `7위 / 20` (`text-brand font-medium`)
   - `동기 풀이중` → `● 12명` (도트 `text-success`, 숫자 `text-success font-medium`)
   - `현재 점수` → `1,240 XP` (선택, 공간 따라)

   **개인 공부 stats**:
   - `풀이 문제` → `80`
   - `평균 / 강한 영역` → `73% · MC`
   - `약점 영역` → `용어` (선택, 강조 없이)

   **stats 데이터 없을 때 (신규 사용자)**:
   - 행 자체를 silent (라벨 + 값 모두 숨김)
   - 모든 stats 가 silent 면 `border-t` 도 함께 숨김
   - 이 경우 부제 아래 `시작하면 통계가 쌓입니다` 같은 마이크로 카피 1줄

#### 3.3.5 데이터 의존성

- 내 순위 → `userStats.rankedRank` / `userStats.totalUsers`
- 동기 풀이중 → `userWeeklyStats.activeUsers` (신규 endpoint, mock 시작점)
- 풀이 문제 / 평균 / 강한 영역 → `userPracticeStats` (시안 β §4.2 에서 이미 정의)

### 3.4 Split 폼 — 좌측 (주제 + 주차)

#### 3.4.1 컨테이너

- 그리드: `grid grid-cols-1 sm:grid-cols-[1fr_1.1fr] gap-2.5 mb-3`
- 좌측 카드: 글라스 base + `p-3.5`
- `< sm`: 두 카드가 세로로 stack

#### 3.4.2 주제 select

- 라벨: `text-[10px] text-fg-muted uppercase tracking-wider mb-1.5 font-medium` — `주제`
- shadcn `<Select>` (변경 없음, 기존 PR-9a 그대로)
- 좌측 6px 도트 `bg-brand` (선택된 주제 식별 시각 마커) — `<SelectValue>` 의 placeholder 영역에 prefix 로

#### 3.4.3 주차 picker (가장 시각 변화 큰 영역)

기존 native `<input type="number">` → 풍부한 day picker 로 교체.

**구성**:

1. **라벨**: `주차 · Day {N} 진행 중` — Day N 부분만 `text-fg font-medium`. 사용자의 부트캠프 진도와 다른 Day 를 선택했을 경우 자동 표기.
2. **현재 선택 input**: 글라스 박스 — 텍스트 `Day {selected}` (`text-sm text-fg`) + 우측 `−` / `+` step 버튼 (각 14px lucide `<Minus />` / `<Plus />` 또는 chevron)
3. **20-dot strip** (시안 D Journey strip 의 20-day grid 미니버전):
   - `grid grid-cols-20 gap-px mt-2`
   - 각 dot: `h-1 rounded-sm`
   - 색 매핑 (4 상태):
     - 완료 (Day 1~N-1 중 사용자가 적어도 1번 풀어본 day): `bg-brand`
     - 현재 부트캠프 진도 (오늘): `bg-amber-500` + `ring-1 ring-amber-200 dark:ring-amber-900` (시안 D Journey strip 의 today 인코딩 재사용)
     - 선택된 day (사용자가 폼에서 고른 day, 부트캠프 진도와 다를 수 있음): `bg-brand-strong` + 상단/하단 `outline-2 outline-brand`
     - 미진행 (아직 부트캠프가 도달 안 한 day): `bg-border`
   - dot 클릭 시 해당 day 선택 (인풋과 양방향 sync)
   - 각 dot 에 `aria-label="Day {N}, {상태}"` + 키보드 좌우 화살표
4. 컨테이너 자체는 `role="radiogroup" aria-label="주차 선택"`

### 3.5 Split 폼 — 우측 (모드 + 난이도)

#### 3.5.1 컨테이너

좌측 카드와 동일 base.

#### 3.5.2 모드 chip 풍부화 (`<ModeMultiSelect>` 시각 upgrade)

PR-9a `<ModeMultiSelect>` 의 props / 책임 / 다중 선택 로직 / 최소 1개 강제는 변경 없음. chip 시각만 풍부화.

**컨테이너**:
- 헤더 row: `flex justify-between items-baseline mb-2`
  - 좌: 라벨 `게임 모드`
  - 우: 메타 카운트 — `{N} 선택됨 · 섞여 출제` (1 선택이면 `1 선택됨 · 단일 모드`)
- 본문: chip 들이 **세로 list** 로 (가로 wrap 가 아닌 위→아래) — 각 chip 의 메타 정보가 우측에 들어가야 하므로 가로 스택보다 세로 list 가 가독성 ↑

**각 chip — 가로 4 col 구조**:

```
[icon 13px] [라벨 (flex-1)] [메타 텍스트] [선택 마커 ✓ / ○]
```

- 컨테이너: `flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors`
- 미선택: `bg-bg/60 border border-border text-fg hover:border-brand/40`
- 선택: `bg-brand/10 border border-brand text-fg-strong`

**좌측 13px 모드 아이콘** (lucide):
- `blank-typing` → `<Pencil />`
- `term-match` → `<AlignLeft />` 또는 `<Type />`
- `mc` → `<CheckCircle />`
- `result-prediction` → `<TrendingUp />`
- `category` → `<FolderTree />`

색은 선택 시 `text-brand`, 미선택 시 `text-fg-muted`. 추가 토큰 없음 (Tailwind 기본).

**가운데 라벨**: `flex-1 text-fg font-medium` (선택 시) / `text-fg` (미선택 시) — `GAME_MODE_LABELS` 그대로

**우측 메타** (시각 풍부함의 핵심):
- 콘텐츠 형태: `~{예상시간}분 · 정답률 {N}%`
- 예: `~7분 · 정답률 80%`, `~5분 · 정답률 60%`, `~6분` (정답률 데이터 없으면 시간만)
- 폰트: `text-[10px]` (작게)
- 색 분기:
  - 정답률 ≥ 70% → `text-fg-muted` (기본)
  - 정답률 50~69% → `text-fg-muted` (기본)
  - 정답률 < 50% → `text-error` (약점 — 시각적으로 눈에 띄게)
  - 정답률 데이터 없음 (신규 사용자 / 미플레이 모드) → 시간만 노출, `text-fg-muted/70`
- 메타 텍스트는 사용자별 데이터이므로 신규 endpoint 필요 (§4.2)

**우측 끝 선택 마커**:
- 선택: `<Check />` 11px in `text-brand`
- 미선택: 빈 `<Circle />` 11px in `text-fg-muted/40`

**키보드**: 각 chip `role="checkbox" aria-checked` (PR-9a 그대로) + 시각 변경만.

#### 3.5.3 난이도 chip 풍부화 (3중 인코딩)

PR-9a 의 라디오 그룹 그대로. 시각만 강도 인코딩 추가.

**랭킹 도전 트랙일 때**:
- 컨테이너: `mt-3` + 라벨 `난이도` + 본문 `flex gap-1`
- 3 chip 균등 (`flex: 1 each`)
- 각 chip: `px-2 py-1.5 rounded-md text-xs text-center`
  - 미선택 base: `bg-bg/60 border border-border` + 라벨 `text-fg-muted`
  - 선택 base: `border` 토큰 색별 분기 + 배경 alpha 12%
- **3 단계 색 분기 + 강도 dot**:
  - EASY (선택 시): `bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-400` + 라벨 `text-emerald-700 dark:text-emerald-300 font-medium` + 하단 강도 `●●○○○` (`text-emerald-500`, `letter-spacing: 1px`, `text-[8px]`)
  - MEDIUM (선택 시): `bg-amber-50 border-amber-500 ...` 동일 패턴 + `●●●○○`
  - HARD (선택 시): `bg-red-50 border-red-500 ...` (또는 `--error` 토큰) + `●●●●●`
- 미선택 시 강도 dot 은 `text-border` (회색) — 동일 위치 유지로 layout shift 방지

**개인 공부 트랙일 때** (PR-9a §3.1.5 그대로):
- 라디오 자리에 정보 박스 — `bg-bg-elevated border border-border rounded-md px-3 py-2 text-xs text-fg-muted flex items-center gap-2`
- 좌측 `<Sparkles />` 14px (`text-purple-500`)
- 텍스트: `난이도가 정답률에 따라 자동 조정됩니다`

### 3.6 라이브 통계 strip (NEW)

**컨테이너**: 글라스 카드 — `bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 rounded-xl px-4 py-3 mb-3`

**헤더 row** (`flex justify-between items-baseline mb-2`):
- 좌: `이번 주 학습 통계` — `text-xs font-medium text-fg`
- 우: 기간 라벨 — `월 ~ 일` (`text-[10px] text-fg-muted`). 또는 정확한 날짜 범위 (`4월 22 ~ 28일`).

**본문 — 4 metric grid** (`grid grid-cols-4 gap-2`):
- 각 metric:
  - 라벨: `text-[10px] text-fg-muted mb-0.5`
  - 값: `text-base sm:text-lg font-medium text-fg tabular-nums`
- 4 항목:
  1. `풀이` → `24` (개)
  2. `정답률` → `78` + 작은 `%` (`text-[10px] text-fg-muted`)
  3. `연속` → `8` + 작은 `●` (`text-[10px] text-amber-500 dark:text-amber-400`)
  4. `일평균` → `3.4` (소수점 1자리)

**데이터 없음 (신규 사용자)**:
- strip 자체를 silent (렌더 안 함) — 빈 strip 보다 차라리 없음. 1주일 후 자동 노출.
- 또는 placeholder 1줄 — `학습을 시작하면 통계가 여기에 쌓입니다.` (작은 글자, 가운데 정렬)

**모바일 (`< sm`)**: `grid-cols-2` 2x2 배치 + 각 metric 의 라벨/값 세로 배치.

### 3.7 CTA 그룹

PR-9a 의 CTA 그룹 시각 풍부화 + 보조 CTA 1개 추가.

**컨테이너**: `flex flex-wrap gap-2`

**Primary**: `시작하기 →`
- `flex-1 min-w-[140px] bg-brand-gradient text-brand-fg rounded-lg px-4 py-2.5 text-sm font-medium`
- valid 조건: 트랙 선택됨 + 주제 선택됨 + 주차 1~20 + 모드 ≥ 1 + (랭킹 시) 난이도 선택됨
- 로딩 상태: opacity-50 + spinner

**Secondary 1**: `최근 오답` (PR-9a 기존)
- `<Button variant="outline">` shadcn
- 좌측 12px `<Notebook />` 아이콘
- 클릭 → `/review/mistakes`
- 미해결 오답 0건이면 silent (렌더 안 함)

**Secondary 2**: `오늘의 챌린지` (NEW)
- 동일 outline 스타일, 좌측 12px `<Sparkles />` 아이콘
- 클릭 시: 백엔드의 "오늘의 추천 단일 라운드" 1회로 진입 — 5분짜리 빠른 풀이. 본 PR 에서는 placeholder route (`/play/solo?challenge=daily`) 로 두고 백엔드는 후속 PR.
- 백엔드 미연결 시 disabled 또는 silent

ReviewBadge 가 별도 위치 (Hero 우상단) 가 아니라 CTA 그룹 마지막에 합쳐지도록 권장 (§3.2).

---

## 4. 데이터 contract

### 4.1 PR-9a 의 데이터는 변경 없음

`SoloConfigSelection` 타입, `solo.start({ track, modes[], difficulty })` 시그니처, mock 빌더 모두 그대로.

### 4.2 신규 / 변경 endpoints (백엔드 영향)

본 PR 은 시각 풍부함이 핵심이지만, Hero anchor 와 stats strip 이 살아있게 하려면 다음 데이터가 필요. **모두 mock 시작점으로 PR-9a' 단일 PR 가능**, 백엔드 연결은 후속 PR.

| 데이터 | endpoint (제안) | 사용처 | mock 시작점 |
|---|---|---|---|
| 인사 nickname / currentDay | 기존 `useUser()` / `userStats` | Hero pill / 인사 | 변경 없음 |
| 이번 주 통계 (풀이 / 정답률 / 연속 / 일평균) | `GET /api/users/me/weekly-stats` | Hero 메타 라인 + 라이브 strip | `{ solved: 24, accuracy: 0.78, streak: 8, dailyAvg: 3.4 }` |
| 동기 풀이중 인원 | `GET /api/cohort/active` 또는 weekly-stats 응답에 포함 | 트랙 타일 (랭킹) stats row | `12` |
| 추천 문제 미리보기 | `GET /api/questions/recommended-preview` | Hero 우측 코드 패널 | 시안 D 데모 코드 1개 (DAY 16 CURSOR 예제) |
| 추천 주차 (auto-fill) | `GET /api/users/me/recommended-week` | Hero `추천으로 시작` CTA | 사용자 currentDay 그대로 |
| 모드별 사용자 통계 (예상 시간 / 정답률) | `GET /api/users/me/mode-stats` | 모드 chip 메타 | mock 5개 모드별 random 50~90% 분포 |
| 마지막 학습 세션 정보 | `GET /api/users/me/last-session` | `이어서 학습` CTA tooltip | `{ topic: 'pl-sql-cursor', day: 5, lastPlayedAt: 4일 전 }` |

### 4.3 Mock 데이터 구조

`apps/web/src/lib/play/mock.ts` 에 다음 추가 (PR-9a mock 위에):

- `mockWeeklyStats: WeeklyStats` — 위 endpoint 응답 shape
- `mockRecommendedPreview: CodeQuestion` — 코드 라인 배열 (시안 D §4 mock 형식)
- `mockModeStats: Record<GameMode, ModeStat>` — `{ estimatedMinutes, accuracyPct }`
- `mockLastSession: LastSessionSummary | null`

### 4.4 인증 분기

`/play/solo` 는 인증 필수 (PR-9a 동일). 게스트 → `/login` redirect.

신규 사용자 (가입 후 첫 진입, 모든 stats 0) 의 분기:
- Hero pill: `Day 1 시작 · 부트캠프 20일 코스`
- Hero stats 메타 라인: silent
- Hero CTA: `시작 가이드 보기` 1개
- 트랙 타일 stats row: silent
- 라이브 strip: placeholder 또는 silent
- 모드 chip 메타: 시간만 노출 (정답률 데이터 없음)

---

## 5. 디자인 토큰 / Tailwind 추가

### 5.1 신규 CSS 변수

기존 시안 D + PR-9a 토큰 모두 재사용. 본 작업에서 추가:

| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--difficulty-easy` | `#10b981` (emerald-500) | `#4ade80` (emerald-400) | 난이도 EASY 보더·텍스트·강도 dot |
| `--difficulty-easy-bg` | `#ecfdf5` | `rgba(74,222,128,0.12)` | EASY 선택 배경 |
| `--difficulty-medium` | `#f59e0b` (amber-500) | `#fbbf24` (amber-400) | MEDIUM 보더·텍스트·강도 dot |
| `--difficulty-medium-bg` | `#fffbeb` | `rgba(251,191,36,0.12)` | MEDIUM 선택 배경 |
| `--difficulty-hard` | `#dc2626` (red-600) | `#f87171` (red-400) | HARD 보더·텍스트·강도 dot |
| `--difficulty-hard-bg` | `#fef2f2` | `rgba(248,113,113,0.12)` | HARD 선택 배경 |

다크 모드 alpha 배경은 라이트의 단색 배경과 의도적으로 다르게 — 글라스 위에서 자연스럽게 보이도록.

**의도적으로 토큰화하지 않음**:
- 모드별 아이콘 색 → Tailwind 기본 `text-brand` / `text-fg-muted` 로 충분 (선택 / 미선택만 분기)
- amber/red 등 라이트 모드 액센트 → Tailwind 기본 팔레트 직접 (`text-amber-500`, `text-red-600` 등)
- 글라스 base → 시안 D 의 합성 (`bg-bg-elevated/55 ...`) 그대로

이유: 토큰 5종 만으로도 ADR 패치 부담이 작지 않음. 추가 토큰화는 후속 PR 에서 필요시.

### 5.2 Tailwind config 매핑

`theme.extend.colors` 에:
- `difficulty: { easy: { DEFAULT: 'var(--difficulty-easy)', bg: 'var(--difficulty-easy-bg)' }, medium: {...}, hard: {...} }`

→ `text-difficulty-easy`, `bg-difficulty-easy-bg`, `border-difficulty-easy` 등 사용 가능.

### 5.3 ADR-020 §3.3 패치

> | 2026-MM-DD | PR-9a' | `--difficulty-easy/medium/hard` (foreground) + `--difficulty-easy-bg/medium-bg/hard-bg` (background) 토큰 6종 추가. 난이도 chip 의 색·강도 분기 인코딩 (3중 인코딩 — 색 + 강도 dot + 라벨). 시안 ε `/play/solo` config polish. |

### 5.4 신규 의존성

| 패키지 | 도입 여부 | 비고 |
|---|---|---|
| `framer-motion` | **이미 PR-9b 트랙에서 도입 예정**. 본 PR 에서 함께 도입 가능 | Hero pill 등장 fade-in, 트랙 타일 hover scale, 통계 strip 카운터 tween (`useSpring`). 도입 시 ADR 한 줄 (이미 시안 β 명세에서 PR-9b 항목으로 합의됨 — 본 PR 에서 PR-9b 보다 먼저 들어가도 OK) |
| 기타 | 없음 | shadcn 외 component lib, CSS-in-JS, 새 icon lib 일절 없음 |

---

## 6. 신택스 / 색 매핑 (시안 D 재사용 + 신규 매핑)

### 6.1 코드 패널 (Hero 우측)

시안 D §6 그대로 재사용. 변경 없음.

### 6.2 모드별 lucide 아이콘 (신규)

| GameMode | lucide 아이콘 | 의미 |
|---|---|---|
| `blank-typing` | `<Pencil />` | 빈칸 직접 타이핑 |
| `term-match` | `<AlignLeft />` 또는 `<Type />` | 텍스트 / 용어 |
| `mc` | `<CheckCircle />` | 객관식 선택 |
| `result-prediction` | `<TrendingUp />` | 결과 예측 |
| `category` | `<FolderTree />` 또는 `<Tag />` | 카테고리 분류 |

미정 모드(미래): `<HelpCircle />` 기본.

### 6.3 난이도 강도 dot (신규)

5칸 dot 표시 — 채워진 칸은 해당 난이도 색, 빈 칸은 `text-border` (회색).
- EASY: `●●○○○` (2 채움)
- MEDIUM: `●●●○○` (3 채움)
- HARD: `●●●●●` (5 채움)
- 텍스트로 구현 (`<span style="letter-spacing: 1px; font-size: 8px;">●●○○○</span>` 같은 형태) — 웹 글꼴 의존성 없는 가장 안전한 방식
- `aria-hidden` (시각만, 의미는 라벨이 전달)

---

## 7. 인터랙션 / 모션

### 7.1 변경 없음

- 기존 메인 + 시안 D 의 transition 패턴 (트랙 타일 / shadcn Button focus / radial-gradient body bg) 그대로
- PR-9a 의 키보드 / aria 패턴 그대로 (트랙 좌우 화살표, 모드 스페이스 토글)

### 7.2 신규 / 강화 (Framer Motion 도입 시)

| 위치 | 효과 | duration |
|---|---|---|
| Hero anchor 진입 | `opacity 0 → 1 + y 6 → 0` (페이지 마운트 시 1회) | 250ms ease-out |
| Hero pill 의 streak 도트 | `pulse` (amber, 2초 주기) — `prefers-reduced-motion` 시 정적 | CSS keyframe |
| 트랙 타일 hover | scale 1 → 1.005 + ring opacity 강화 | 150ms (CSS only OK) |
| 트랙 타일 선택 변경 | 선택 마커 spring (scale 0 → 1) | 200ms |
| 모드 chip 토글 | bg + border-color transition + 우측 마커 morph (`<Circle />` ↔ `<Check />`) | 150ms |
| 난이도 chip 선택 | 강도 dot 의 채움 stagger (왼쪽부터 한 칸씩 색 채워짐) | 50ms × 5칸 |
| 라이브 strip 숫자 | `useSpring` 카운터 tween (페이지 진입 시 0 → 24, 등) | 600ms ease-out |
| 주차 dot strip — Day 변경 | 선택 dot 의 outline ring 이동 (인접 dot 으로) | 200ms |

`prefers-reduced-motion: reduce` 시 모든 motion 비활성. Framer Motion 의 `useReducedMotion()` 훅.

### 7.3 키보드 / aria

- Hero pill `role="status"` (정적 정보)
- Hero CTA `<button>` 기본
- 추천으로 시작 → 주차 input focus 자동 이동 (사용자가 즉시 시작 버튼 누를 수 있게)
- 라이브 strip — 컨테이너 `aria-label="이번 주 학습 통계"`, 각 metric 은 시각 (개별 aria 불필요)
- 주차 dot strip 좌우 화살표 (`role="radiogroup"`)

---

## 8. WCAG 2.1 AA 체크리스트

기존 + 본 시안 신규:

| 위치 | 위험 | 해결 |
|---|---|---|
| 난이도 chip 색 분기 (emerald / amber / red) | 색 단독 인코딩 (1.4.1) | 색 + 강도 dot + 라벨 + `aria-checked` 4중 인코딩. red 색은 `--error` 토큰 활용해 light/dark 둘 다 4.5:1 검증 필수 |
| 강도 dot (`●●○○○`) on 다양한 배경 | 작은 텍스트 (8px) → 11px 이상 권장 | dot 폰트는 가독성보다 **시각 강도 표현**이 목적이므로 8px 허용 단 `aria-hidden` 처리. 의미는 라벨이 전달 |
| Hero 우측 코드 패널 | 라이트 모드에서도 다크 (의도적) | 시안 D 와 동일 정책. `<pre><code>` + `aria-label="추천 문제 미리보기"`. 사용자 입력 영역 아니므로 키보드 진입 불필요 |
| 모드 chip 정답률 색 분기 (red < 50%) | 색 단독 (1.4.1) | 색 + 텍스트 (`정답률 60%` 자체가 의미 전달) — 충분 |
| 라이브 strip 의 streak `●` 도트 | 색 단독 | `aria-hidden` + 텍스트 (`8 연속`) 가 의미 전달 |
| 주차 dot strip 의 today amber + 선택 outline | 작은 dot (4px) 의 색 + outline 만으로 의미 전달 | `aria-label="Day {N}, {상태}"` 각 dot 에. 키보드 사용자에게 충분 |
| Hero stats 메타 라인의 amber `●` | 색 단독 | `aria-hidden` + 텍스트 `8일 연속` |
| Hero pill `bg-brand/10` on glass bg | 다크 모드에서 합성색 contrast | WebAIM 으로 라이트·다크 양쪽 4.5:1 검증 |
| `--difficulty-medium` (amber) on white bg | 라이트 amber-500 `#f59e0b` 대비 | `text-amber-700` (`#b45309`) 사용 필수 — `--difficulty-medium` 자체는 보더 색이지 텍스트 색이 아님 |

**검증 의무**: PR 머지 전 axe DevTools + WebAIM 라이트/다크 캡처 첨부. Hero anchor / 트랙 stats / 라이브 strip / 난이도 chip 4 영역 우선.

---

## 9. 파일 매핑

### 9.1 신규

| 경로 | 책임 |
|---|---|
| `apps/web/src/components/play/config-hero.tsx` | Hero anchor 좌+우 통합. 인사형 카피, stats 메타, CTA 한 쌍, 우측 코드 패널 import |
| `apps/web/src/components/play/code-preview-panel.tsx` | 시안 D `<HeroLivePanel>` 의 코드 영역 추출 (또는 기존 컴포넌트 재사용 시 import 만). Hero 우측 + (미래) 다른 곳에서 재사용 가능 |
| `apps/web/src/components/play/weekly-stats-strip.tsx` | 4-metric 글라스 strip |
| `apps/web/src/components/play/week-day-picker.tsx` | 주차 input + 20-dot strip 통합. PR-9a `<ConfigForm>` 의 native number input 을 교체 |
| `apps/web/src/lib/play/mock.ts` | weekly-stats / recommended-preview / mode-stats / last-session mock 추가 |
| `apps/web/src/lib/play/types.ts` | 신규 타입 (`WeeklyStats`, `ModeStat`, `LastSessionSummary`) |

### 9.2 수정

| 경로 | 변경 |
|---|---|
| `apps/web/src/app/play/solo/page.tsx` | config phase 영역 재구성 (Hero anchor 추가, 섹션 라벨 이동, split form 적용, 라이브 strip 추가) |
| `apps/web/src/components/play/track-selector.tsx` | 36px 아이콘 박스 + stats row 추가 (props 확장 — `stats?: TrackStats` 옵셔널) |
| `apps/web/src/components/play/mode-multi-select.tsx` | chip 가로 4 col 구조 (icon + 라벨 + 메타 + 마커). props 확장 — `modeStats?: Record<GameMode, ModeStat>` |
| `apps/web/src/components/play/config-form.tsx` | Split form 레이아웃, 난이도 chip 강도 dot, 주차 input 을 `<WeekDayPicker>` 로 교체 |
| `apps/web/src/app/globals.css` | §5.1 토큰 6종 추가 |
| `apps/web/tailwind.config.ts` | §5.2 매핑 추가 (`difficulty`) |
| `docs/architecture/decisions/ADR-020.md` | §3.3 패치 한 줄 (§5.3) |
| 시안 D `<HeroLivePanel>` (메인 페이지) | 코드 영역만 분리 시 호출부 변경 (작은 리팩터). 분리 안 하면 변경 없음 |

---

## 10. 컴포넌트 책임 (산문)

### 10.1 `<ConfigHero>` (CSR)

- **props**: `user: { nickname, currentDay }`, `weeklyStats: WeeklyStats | null`, `lastSession: LastSessionSummary | null`, `onRecommendedStart: () => void`, `recommendedPreview: CodeQuestion`
- **책임**: Hero pill, 인사형 h2, stats 메타 라인, CTA 한 쌍, 우측 `<CodePreviewPanel>` 호출. 시간대별 인사 분기 내부 처리. CTA 분기 (신규 사용자 / 마지막 세션 없음 등).
- **미책임**: API 호출 (상위 page.tsx 가 fetch), 시작 (단지 prop 콜백 호출).

### 10.2 `<CodePreviewPanel>` (RSC)

- **props**: `code: CodeLine[]`, `filename: string`, `topLabel: string`, `bottomLeftLabel?: string`, `bottomRightLabel?: string`
- **책임**: 시안 D Layer 1 (탭바) + Layer 2 (코드 본문) + Layer 3 (메타) 렌더. 신택스 매핑 (시안 D §6) 적용. `<pre><code>` + `aria-label`.
- **재사용**: 시안 D `<HeroLivePanel>` 의 코드 영역과 100% 호환 — 가능하면 같은 컴포넌트 사용. 시안 D 가 별도 추출하지 않았다면 본 PR 에서 추출.

### 10.3 `<WeeklyStatsStrip>` (RSC)

- **props**: `stats: WeeklyStats | null`, `dateRangeLabel?: string`
- **책임**: §3.6 의 4-metric 그리드. stats null 이면 silent 또는 placeholder. 모바일 grid-cols-2 분기.
- **미책임**: 데이터 fetch.

### 10.4 `<WeekDayPicker>` (CSR — Layer 1/2/3 모두 visible interactive)

- **props**: `value: number (1~20)`, `onChange: (day) => void`, `currentBootcampDay: number`, `playedDays: Set<number>`
- **책임**: input + step 버튼 + 20-dot strip. 4 상태 색 매핑. 키보드 좌우 화살표. dot 클릭 / step 버튼 / 직접 입력 모두 양방향 sync. 컨테이너 `role="radiogroup"`.
- **미책임**: API 호출.

### 10.5 `<TrackSelector>` 시각 upgrade (PR-9a 컴포넌트 변경)

- **props 추가**: `stats?: { ranked?: RankedTrackStats, practice?: PracticeTrackStats }` 옵셔널
- **책임 추가**: 36px 아이콘 박스 + stats row (각 타일 별도 stats prop 처리)
- **변경 없음**: 선택 상태, 키보드, aria, 두 트랙 배타

### 10.6 `<ModeMultiSelect>` 시각 upgrade (PR-9a 컴포넌트 변경)

- **props 추가**: `modeStats?: Record<GameMode, ModeStat>`
- **책임 추가**: chip 가로 4 col 구조, lucide 아이콘 매핑 (§6.2), 메타 텍스트 색 분기
- **변경 없음**: 다중 선택 로직, 최소 1개 강제, 라벨 (`GAME_MODE_LABELS`)

### 10.7 `<ConfigForm>` 시각 upgrade (PR-9a 컴포넌트 변경)

- **변경**: 레이아웃을 split (좌 주제+주차 / 우 모드+난이도) 로 재구성. 주차 input 을 `<WeekDayPicker>` 로 교체. 난이도 chip 의 색·강도 dot 추가.
- **변경 없음**: 폼 데이터 흐름, 검증 로직, props.

---

## 11. PR 분할

본 작업은 **단일 polish PR (PR-9a')** 로 진행 권장.

이유:
- 시각 풍부함은 한 번에 머지되어야 페이지가 일관됨 (단계 분할 시 어색한 중간 상태 발생)
- 토큰 추가 / 컴포넌트 변경 / 데이터 mock 모두 서로 의존
- 백엔드 endpoint 미연결이어도 mock 만으로 모든 시각 검증 가능

**PR-9a' 작업 순서**:

1. 토큰 §5.1 + Tailwind 매핑 §5.2 (1~2 시간)
2. mock 데이터 (`weeklyStats`, `recommendedPreview`, `modeStats`, `lastSession`) 작성
3. `<CodePreviewPanel>` 추출 (시안 D `<HeroLivePanel>` 이 별도 추출 안 됐다면)
4. `<ConfigHero>` 신규
5. `<WeekDayPicker>` 신규
6. `<WeeklyStatsStrip>` 신규
7. `<TrackSelector>` / `<ModeMultiSelect>` / `<ConfigForm>` 시각 upgrade
8. `page.tsx` 재구성 (Hero 추가, 섹션 라벨 이동, strip 추가)
9. ADR-020 §3.3 패치 한 줄
10. axe + WebAIM 라이트/다크 검증 캡처
11. PR 생성 + 외부 노트북 평가

**백엔드 PR (별도 트랙)**:
- weekly-stats / recommended-preview / mode-stats / recommended-week / last-session endpoint 5개
- 본 PR 머지 후 백엔드 준비되는 대로 mock → 실제 API 1:1 swap (컴포넌트 변경 없음)

---

## 12. Acceptance criteria

PR-9a' 머지 시점.

**시각**:
- 시안 ε 라이트/다크 양쪽 일치 — Hero anchor / 트랙 타일 / split 폼 / 라이브 strip / CTA
- 시안 D 와 옆에 놓고 봐도 같은 디자인 시스템임이 명확
- 모바일(`<sm`) / 태블릿 / 데스크톱(`lg+`) 3 breakpoint 깨짐 없음

**기능**:
- PR-9a 의 트랙 분기 / 모드 다중 / 난이도 분기 데이터 흐름 100% 보존
- 주차 dot strip 양방향 sync (input ↔ dot 클릭 ↔ step 버튼 ↔ 키보드)
- 신규 사용자 / 통계 데이터 없음 분기 모두 정상 (silent or placeholder)
- 모드 chip 의 정답률 데이터 없으면 시간만 노출
- `추천으로 시작` 클릭 시 주차 input 자동 채움 (즉시 시작 안 함)
- 모든 mock 데이터로 시각 검증 가능 (백엔드 변경 없음)

**접근성**:
- axe DevTools 무에러
- 트랙 타일 / 모드 chip / 난이도 chip / 주차 dot 모두 키보드 접근
- 색 단독 인코딩 위반 0건
- `prefers-reduced-motion` 시 모든 motion 비활성
- `<pre><code>` Hero 우측 패널 스크린리더 정상

**데이터 / 호환성**:
- shared 데이터 모델 변경 없음
- PR-9a 컴포넌트의 props 변경은 모두 옵셔널 추가 (기존 호출부 영향 없음)
- 백엔드 endpoint 미연결이어도 mock 으로 페이지 정상 작동

**빌드 / 정합성**:
- `pnpm build` 통과
- Pre-commit (lint, typecheck) 통과
- shadcn/ui 외 신규 component lib 미도입
- Tailwind v3 유지
- brief §8.3 변경 불가 항목 단 하나도 안 건드림

---

## 13. 변경 / 미변경 / 안 한 것

### 13.1 변경됨 (PR-9a 위에서)

- Hero anchor 신규 (좌측 카피 + 우측 코드 패널)
- 페이지 h1 "솔로 플레이 설정" 위치 이동 (Hero 아래로) + 시각 축소
- 트랙 타일: 22px → 36px 아이콘, stats row 추가
- 폼 카드: 한 카드 → 좌우 split (주제+주차 / 모드+난이도)
- 주차 input: native number → `<WeekDayPicker>` (input + 20-dot strip)
- 모드 chip: 텍스트만 → 아이콘 + 라벨 + 메타 + 마커 (가로 4 col)
- 난이도 chip: 같은 시각 무게 → 색 분기 + 강도 dot
- 라이브 통계 strip 신규
- CTA 그룹: 보조 1개 → 2개 (`최근 오답` + `오늘의 챌린지`)
- 신규 토큰 6종 (`--difficulty-{easy,medium,hard}` foreground + bg)

### 13.2 변경 없음

- PR-9a 의 시안 β §3.1 구조 (Layer 1 트랙 + Layer 2 주제·주차 + Layer 3 모드 + Layer 4 난이도 데이터 흐름)
- 라우트 (`/play/solo`)
- 인증 흐름 / 게스트 redirect
- shadcn/ui 사용
- Tailwind v3.4
- shared 데이터 모델 (`Topic`, `GameMode`, `Difficulty`, `TOPIC_LABELS`, `GAME_MODE_LABELS`)
- `apiClient.solo.start` 시그니처 (PR-9a 에서 확장한 것 그대로)
- 메인 시안 D 의 토큰 / 글라스 / brand-gradient
- 페이지 컨테이너 너비 (`max-w-5xl`)

### 13.3 안 한 것

- playing / finished phase 변경 (시안 β §3.2 / §3.3 — 각각 PR-9b / PR-9c 에서)
- `/review/mistakes` 변경 (PR-9d 에서)
- 친구 진행도 / 동기 비교 카드 (brief §11 후순위)
- 최근 활동 ticker 가로 스크롤 (brief §8.1 권장 사항이지만 ε 은 라이브 strip 으로 충분)
- 선택 미리보기 동적 갱신 (사용자가 주제·주차 바꾸면 코드 패널 갱신) — PR-9a' 에서는 Day 16 정적 mock, 후속 PR 에서 endpoint 연결 시 동적 전환
- 모바일 375px 최우선 (brief §8.3 유보)
- shadcn 외 component lib

---

## 14. 미해결 / 후속 결정

| 항목 | 상태 | 결정 시점 |
|---|---|---|
| 추천 문제 미리보기 동적 갱신 (주제·주차·모드 변경 시 코드 패널이 새 문제로) | 본 PR: 정적 mock. 후속 PR 에서 endpoint + debounce 연결 | 백엔드 endpoint 준비 후 |
| `오늘의 챌린지` CTA 의 백엔드 endpoint | 본 PR: placeholder route, disabled | brief §13 후속 |
| 마지막 학습 세션 정보 (`이어서 학습` CTA) | 본 PR: mock | 백엔드 |
| 동기 풀이중 인원 — 실시간 vs 5분 캐시 vs 1시간 캐시 | 미정 | 백엔드 결정 |
| Hero pill 의 시간대별 인사 분기 | 권장 사항. 받는 에이전트 product 한 번 confirm | PR 작업 시작 시 |
| `<TrackSelector>` 의 stats row — 트랙별 stats 가 없을 때의 fallback 카피 | 본 문서 제안: 부제 아래 `시작하면 통계가 쌓입니다` 1줄 | microcopy 검토 |
| 난이도 chip 의 HARD 색 — red 가 너무 부정적이지 않은지 | 다크 모드에서 `#f87171` (red-400) 사용 — 부드러움. 라이트는 `#dc2626` 강함 | 시안 검증 후 미세 조정 가능 |
| 신규 사용자의 Hero CTA `시작 가이드 보기` — 별도 라우트? | 본 PR 범위 외. 후속 PR 에서 onboarding 흐름 결정 | TBD |
| `<WeekDayPicker>` 의 dot 클릭 시 day 진입 가이드 — 미래 day 도 풀 수 있는지? | 백엔드 정책 | 백엔드 |

---

## 15. 외부 도구 / 디자이너 추가 핸드오프

본 문서를 입력 brief 와 시안 β 명세와 함께 넘길 때:

- brief §11.1 영어 prompt 끝에 한 줄 추가:
  > *Reference: see attached `solo-play-config-redesign-concept-epsilon.md` for the chosen design direction (Hero Mirror — direct mirror of concept-d hero idiom: personalized greeting + recommended question code panel anchor).*
- 본 문서의 §1 (요약), §2 (시각 레이아웃), §3.1 (Hero anchor) 만 발췌해도 80% 전달
- 시안 ε 의 핵심은 §3.1 (Hero) 한 곳

---

## 16. 결정 / 변경 기록

| 일자 | 변경 | 출처 |
|---|---|---|
| 2026-04-28 | v1 초안 — 시안 ε Hero Mirror 핸드오프, PR-9a polish 단일 PR 명세, 다른 Claude 에이전트 향 | 본 세션 |
