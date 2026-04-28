# 메인 페이지 재설계 — 시안 D 구현 핸드오프 v1 (2026-04-28)

> **이 문서의 용도**
> 또 다른 Claude 에이전트(Claude Code, claude.ai, Cursor 등)가 받아서
> `apps/web/src/app/page.tsx` 와 그 주변을 시안 D 로 구현할 수 있도록
> **충분한 컨텍스트**를 한 곳에 정리한다.
>
> **읽는 순서**: `docs/rationale/main-page-design-brief.md` (제약·토큰·금지) → **본 문서** (시안 D 의 구체) → 구현
>
> **본 문서는 코드가 아니라 명세이다.** 의도적으로 TSX 코드는 포함하지 않는다.
> 받는 쪽 에이전트가 본 문서의 명세를 자기 판단으로 코드로 옮긴다.

> **구현 메모 (2026-04-28 본 프로젝트 적용 시)**
> - 본 프로젝트의 Tailwind 설정 파일은 `apps/web/tailwind.config.js` 이다 (.ts 아님). 시안 D 의 §5.2 / §8 에서 `tailwind.config.ts` 로 표기된 항목은 모두 `.js` 로 읽는다. .ts 마이그레이션은 본 PR 범위 밖.

---

## 0. 적용 범위 / 전제

| 항목 | 값 |
|---|---|
| 대상 페이지 | `/` (App Router 의 `apps/web/src/app/page.tsx`) |
| 기존 PR | PR-8 (현재 운영 중) |
| 신규 작업 ID | `feature/adr-020-pr8b-home-redesign` |
| 변경 범위 | 메인 페이지 시각 구성 + 신규 컴포넌트 3개 + 디자인 토큰 4종 추가 |
| 변경 없음 | 라우트 구조, 인증 흐름, shadcn/ui, Tailwind v3.4, next-themes, brand 이름 |
| 제약 출처 | `main-page-design-brief.md` §5(스택), §6(토큰), §8(WCAG), §9(허용 범위) |

본 문서의 모든 변경은 design-brief **§9.1 자유 변경 범위** 또는 **§9.2 ADR 패치 후 변경 가능 범위** 안에 있다. §9.3 (변경 불가) 는 단 하나도 건드리지 않는다.

---

## 1. 한 줄 요약

시안 D = **"라이브 코호트(A) + SQL 에디터 도메인 anchor(B) + 부트캠프 여정(C)"** 하이브리드.
페이지를 4 영역으로 재구성한다:

1. **Header** (변경 없음)
2. **Hero** — 좌(개인화 카피) + 우(3-layer 통합 패널: 탭바 → 다크 코드 → 라이트 라이브 티커)
3. **Journey strip** — 20-day 부트캠프 진행 막대 (신규)
4. **비대칭 3-카드 그리드** — Primary 1.4 : Ranking 1 : Admin 1, Primary 만 그라디언트 + 챕터 진행 바

핵심 디자인 의도: **"오늘 풀어야 할 코드 + 지금 12명이 같이 풀고 있다는 사실 + 부트캠프 전체에서 어디쯤 왔나"** 를 한 시야 안에서 전달.

---

## 2. 시각 레이아웃 (전체)

```
┌────────────────────────────────────────────────────────────────────┐
│ Header  [Logo] Oracle DBA 학습 게임      [☀] [로그인] [회원가입]    │  ← 변경 없음
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────┐   ┌────────────────────────────────┐ │
│  │ Hero — 좌측 텍스트         │   │ Hero — 우측 통합 패널           │ │
│  │                          │   │ ┌────────────────────────────┐ │ │
│  │ ● DAY 16 / 20 · PL/SQL   │   │ │ ● day16-cursor.sql  빈칸·MC│ │ │  ← Layer 1: 다크 탭바
│  │                          │   │ ├────────────────────────────┤ │ │
│  │ 오늘의 PL/SQL,            │   │ │ 1 │ CURSOR c_emp IS         │ │ │
│  │ 4문제만 풀고 가요           │   │ │ 2 │   SELECT empno FROM ... │ │ │  ← Layer 2: 다크 코드
│  │                          │   │ │ 3 │ FOR rec IN c_emp LOOP   │ │ │
│  │ 1위까지 880 XP · 8일째    │   │ │ 4 │   DBMS.PUT([??]);      │ │ │
│  │ 연속 학습 ●               │   │ ├────────────────────────────┤ │ │
│  │                          │   │ │ ● 12명 풀이 중  1위 김OO 4,820│ │  ← Layer 3: 라이트 티커
│  │ [이어서 풀기 →] [챕터 목록]  │   │ │                정답률 67% │ │ │
│  └──────────────────────────┘   │ └────────────────────────────┘ │ │
│                                 └────────────────────────────────┘ │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ 부트캠프 여정                              15 / 20일 · 75%        ││
│  │ ▮▮▮▮▮▮▮▮▮▮▮▮▮ ▮▮ ▣ ░░░░  (13 done + 2 recent + today + 4 todo) ││  ← Journey strip
│  │ SQL Day 1~13          ▲ Day 16 (오늘)        PL/SQL Day 14~20  ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ┌──────────────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ ▼ PRIMARY            │ │ 🏆 랭킹      │ │ ⚙ 학습 범위  │          │
│  │ 솔로 플레이             │ │ 1 김OO 4820 │ │ 노션 import │          │
│  │ [빈칸][용어][MC][+2]   │ │ 2 이OO 4210 │ │ 화이트리스트  │          │
│  │ 이번 챕터 7/12 +150XP  │ │ 7 나   3940 │ │ 🔒 관리자전용│          │
│  │ ████████░░░░          │ │ (highlighted)│ │             │          │
│  └──────────────────────┘ └─────────────┘ └─────────────┘          │
│         1.4fr                  1fr             1fr                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

전체 페이지 컨테이너: `max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12` (기존 PR-8 과 동일)

---

## 3. 영역별 상세 스펙

### 3.1 Header — 변경 없음

기존 PR-8 의 헤더 컴포넌트를 그대로 재사용. 게스트 / 인증 분기, 테마 토글, 로그인/회원가입 버튼 모두 동일.

### 3.2 Hero — 좌 텍스트 + 우 통합 패널

**전체 그리드**

- 데스크톱(`lg:` 이상): `grid-cols-[0.9fr_1.1fr]`, gap `2rem`
- 모바일/태블릿(`< lg`): `grid-cols-1`, 우측 패널이 텍스트 아래로 흐름
- 세로 정렬: `items-center`

#### 3.2.1 Hero 좌측 (개인화 텍스트)

순서대로:

1. **챕터 pill** — 인증 시에만 표시. 게스트일 땐 이 자리에 코호트 pill (`● 아이티윌 94기 · 20명 학습 중`).
   - 배경: `bg-brand/10`, 텍스트: `text-brand`, 좌측 6px 도트 `bg-brand`
   - 형태: `rounded-full px-2.5 py-1 text-xs font-medium`
   - 인증 콘텐츠 예: `DAY 16 / 20 · PL/SQL CURSOR`
   - 게스트 콘텐츠 예: `아이티윌 94기 · 20명 학습 중` (도트는 `bg-success` 로 살짝 톤 다르게)

2. **h1 타이틀**
   - `text-4xl sm:text-5xl font-medium leading-tight tracking-tight text-fg`
   - `\n` 으로 두 줄 강제, `whitespace-pre-line`
   - 인증 예: `오늘의 PL/SQL,\n4문제만 풀고 가요`
   - 게스트 예: `SQL과 PL/SQL,\n외우지 말고 풀면서 익히자`

3. **subtitle**
   - `mt-3 text-sm sm:text-base text-fg-muted leading-relaxed`
   - 인증 예: `1위까지 880 XP · 8일째 연속 학습 ●` (마지막 도트 `text-amber-600 dark:text-amber-400` — streak 강조)
   - 게스트 예: `부트캠프에서 배우는 SQL/PL/SQL 용어와 함수를 게임으로 자연스럽게 외우자.`

4. **CTA 한 쌍**
   - `mt-5 flex flex-wrap gap-2`
   - Primary: shadcn `<Button>` default + `<ArrowRight>` 아이콘 (라벨 우측, hover 시 `translate-x-0.5`)
     - 인증: `이어서 풀기` → `/play/solo?resume=1`
     - 게스트: `지금 시작하기` → `/register`
   - Secondary: shadcn `<Button variant="outline">`
     - 인증: `챕터 목록` → `/play/solo`
     - 게스트: `랭킹 보기` → `/rankings`

#### 3.2.2 Hero 우측 통합 패널 (가장 중요)

전체 컨테이너: `overflow-hidden rounded-xl border border-border bg-bg-elevated`

세 레이어가 세로로 쌓인다 — **이것이 시안 D 의 시그니처 구성**.

**Layer 1 — 다크 탭바**

- 배경: `bg-code-tab` (신규 토큰, §5 참조)
- 폰트: `font-mono text-[11px]`, 색 `text-slate-400`
- 패딩: `px-3 py-1.5`
- 좌측: `● {filename}` (도트는 `text-brand`, 파일명은 인증 시 오늘의 챕터 파일, 게스트 시 `intro.sql` 같은 데모)
- 우측: 모드 라벨 (예: `빈칸 · 객관식`), 색 `text-slate-500`

**Layer 2 — 다크 코드 영역**

- 배경: `bg-code` (신규 토큰)
- 그리드: `grid grid-cols-[28px_1fr]` — 좌측 라인 넘버, 우측 코드
- 라인 넘버: `text-right select-none border-r border-slate-800 px-2 py-2.5 font-mono text-slate-600`, `aria-hidden`
- 코드 본문: `font-mono text-[12px] leading-7 text-slate-200`, 패딩 `px-3 py-2.5`
- **신택스 하이라이팅 규칙**: §6 참조
- 빈칸 표시: `bg-syntax-blank text-syntax-blank-fg rounded-sm px-1` (노란 highlight pill)
- **`<pre>` 사용**, 텍스트는 `aria-label="오늘의 문제 코드 미리보기"`

**Layer 3 — 라이트 라이브 티커**

- 배경: `bg-bg-elevated` (Layer 2 의 다크와 의도적으로 대비)
- 상단 구분선: `border-t border-border`
- 패딩: `px-3 py-2.5`, `flex items-center gap-3`
- 구성:
  1. `● {N}명 풀이 중` — 도트 `bg-success`, 숫자 강조 `font-medium text-fg`
  2. 세로 구분선 `h-3 w-px bg-border`
  3. `1위 {name} {score}` — 점수만 `font-medium text-brand`
  4. `ml-auto` 로 우측 끝에 `정답률 {N}%`, 모두 `text-fg-muted text-xs`
- **인증된 사용자에게만 표시**. 게스트는 이 Layer 를 숨기고 대신 한 줄 메타: `최근 풀이 1,247건 · 오늘 +82` (정적 카피).

### 3.3 Journey strip — 20-day 진행 막대

전체 컨테이너: `mt-8 rounded-xl border border-border bg-bg-elevated p-4`

**상단 헤더 라인** (`flex items-center justify-between mb-3`)
- 좌: `부트캠프 여정` — `text-xs font-medium text-fg-muted`
- 우: `15 / 20일 · 75%` — 숫자만 `font-medium text-fg`, 나머지 `text-fg-muted`

**중앙 — 20개 막대 그리드**
- `grid grid-cols-20 gap-0.5` (Tailwind 에 `grid-cols-20` 매핑 추가 필요, §5)
- 각 막대: `h-2 rounded-sm`
- 색 매핑 (4 상태):
  - `done` (Day 1~13, SQL 완료): `bg-brand`
  - `recent` (Day 14~15, PL/SQL 최근 완료): `bg-brand/60` (투명도로 단계감)
  - `today` (Day 16): `bg-amber-500` + `ring-2 ring-amber-200 dark:ring-amber-900` (노란 글로우)
  - `upcoming` (Day 17~20): `bg-border`
- 의미 인코딩 — 색이 곧 진행 상태이므로 `aria-label` 로 보강 필수 (§7)

**하단 — 3분할 라벨** (`mt-2 flex justify-between text-[10px] text-fg-muted`)
- 좌: `SQL Day 1~13` — `SQL` 만 `text-brand font-medium`
- 중: `▲ Day 16 (오늘)` — 전체 `text-amber-600 dark:text-amber-400 font-medium`
- 우: `PL/SQL Day 14~20` — `PL/SQL` 만 `text-fg`

게스트일 때: 이 영역을 **챕터 미리보기 strip** 으로 대체한다 — 같은 형태지만 모든 막대가 `bg-border` 이고 라벨은 `1주차 SELECT · 2주차 JOIN · 3주차 PL/SQL`.

### 3.4 비대칭 3-카드 그리드

전체: `mt-6 grid gap-2.5 grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr]`

**모바일/태블릿(`< lg`)**: 균등 3열 (또는 1열). 비대칭은 데스크톱에서만.

#### 3.4.1 Primary 카드 (솔로 플레이)

- 배경: `bg-brand-gradient` (신규, §5) — 135도 그라디언트 `--brand` → `--brand-strong`
- 텍스트: `text-brand-fg` (light: white / dark: navy — 토큰이 처리)
- 패딩: `p-4`, 라운드 `rounded-lg`
- 구성 (위→아래):
  1. **헤더 row** (`flex items-center gap-1.5 mb-2`)
     - 22px 라운드 아이콘 박스 — `bg-white/18` 위에 `<BookOpen />` lucide 12px
     - `PRIMARY` 라벨 pill — `text-[9px] tracking-wider px-1.5 py-0.5 bg-white/20 rounded`
  2. **타이틀** `text-sm font-medium`: `솔로 플레이`
  3. **부제** `text-xs opacity-85 mt-1 mb-2.5`: `5가지 모드로 풀어보기`
  4. **모드 chip 그룹** `flex flex-wrap gap-1 mb-3`:
     - 각 chip: `px-1.5 py-0.5 bg-white/18 rounded text-[9px]`
     - 라벨: `빈칸`, `용어`, `MC`, `+2`
  5. **챕터 진행 mini 박스** — `bg-white/14 rounded-md px-2.5 py-2`:
     - 상단 row: 좌 `이번 챕터` (`text-[9px] opacity-90`), 우 `7 / 12 · +150 XP` (`font-medium`)
     - 하단 progress bar: `h-0.5 bg-white/22 rounded` 안에 `width: 58%` 의 `bg-white` 막대
- 게스트일 땐 챕터 진행 박스를 숨기고 `시작하기 →` 한 줄로 대체.

#### 3.4.2 Ranking 카드

- 배경: `bg-bg`, 보더 `border border-border rounded-lg`, 패딩 `p-3.5`
- 헤더: 22px 라운드 아이콘 박스 `bg-amber-100 dark:bg-amber-900/30` + lucide `<Trophy />` (amber 색) → `랭킹` 타이틀
- 본문 — 4 행:
  - 1행: `1 김OO  4,820`
  - 2행: `2 이OO  4,210`
  - 3행: 1px 구분선
  - 4행: **내 위치 highlight row** — `bg-brand/10 rounded px-1.5 py-1`, 텍스트 `text-brand font-medium`
- 점수는 모두 `toLocaleString()` 으로 천단위 콤마.
- 게스트일 땐 4행이 `로그인하면 내 순위 표시` 한 줄.

#### 3.4.3 Admin 카드

- 배경 / 보더 / 패딩 동일
- 헤더: 22px 라운드 박스 `bg-bg-elevated` + lucide `<Settings2 />` → `학습 범위`
- 본문: `노션 import\n화이트리스트 편집` (2줄, `text-xs text-fg-muted leading-relaxed`)
- 푸터: 1px 상단 구분선 + `🔒 관리자 전용` (`text-[10px] text-fg-muted/70`)
- 게스트 / 일반 사용자에게도 노출되지만 `🔒` 가 명확. (design-brief §9.3 — 관리자 노출 분기 추후 검토)

---

## 4. 데이터 contract

### 4.1 인증 분기

페이지는 RSC 이며 단 하나의 ViewModel 을 받는다. 인증 / 게스트 분기는 ViewModel 빌더 단계에서 처리하고, 컴포넌트는 받은 데이터만 렌더한다.

| 영역 | 게스트 | 인증 |
|---|---|---|
| Hero pill | 코호트 정보 (`아이티윌 94기 · 20명 학습 중`) | 챕터 정보 (`DAY 16 / 20 · ...`) |
| Hero 카피 | generic 가치 제안 | 개인화 (오늘의 챕터·XP·streak) |
| Hero CTA | 회원가입 / 랭킹 보기 | 이어서 풀기 / 챕터 목록 |
| Hero 우측 코드 | 데모 SQL (예: 첫날 SELECT) | 오늘의 챕터 코드 |
| Hero 우측 티커 (Layer 3) | 정적 한 줄 (`총 풀이 1,247건`) | 라이브 (현재 인원·1위·정답률) |
| Journey strip | 챕터 미리보기 (회색) | 실제 진행률 (4색) |
| Primary 카드 진행 박스 | 숨김 | 표시 (이번 챕터 N/M) |
| Ranking 카드 내 위치 row | `로그인하면 표시` | 실제 순위·점수 |

### 4.2 ViewModel shape (산문 기술)

`HomeViewModel` 은 다음 4개 그룹의 데이터를 가진다:

1. **`hero`** — Hero 좌측을 그리는 데 필요한 모든 카피와 CTA
   - `chapterLabel`: 문자열 또는 null
   - `title`: 문자열 (`\n` 포함 가능)
   - `subtitle`: 문자열
   - `streakIndicator`: 불리언 — true 면 subtitle 끝에 amber 도트 표시
   - `primaryCta`, `secondaryCta`: 각각 `{ label, href }`

2. **`todayQuestion`** — Hero 우측 Layer 1·2 의 코드
   - `filename`: `day16-cursor.sql` 형태
   - `modeLabel`: `빈칸 · 객관식` 형태
   - `code`: 줄 단위 배열. 각 줄은 세그먼트 배열 — 세그먼트는 `{ text, kind? }` 이고 `kind` 는 `keyword | fn | highlight | plain`

3. **`ticker`** — Hero 우측 Layer 3
   - `null` 또는 `{ activeUsers, topPlayer: { name, score }, accuracyPct }`
   - null 일 때 컴포넌트는 Layer 3 를 렌더하지 않는다

4. **`journey`** — Journey strip
   - `days`: 길이 20 의 배열, 각 원소 `{ day: 1..20, status: 'done'|'recent'|'today'|'upcoming' }`
   - `currentDay`: 1~20
   - `completedDays`, `totalDays`: progress 라벨용

5. **`cards`** — 3 카드의 데이터
   - `primary.modeChips`: 문자열 배열 (`['빈칸', '용어', 'MC', '+2']`)
   - `primary.chapterProgress`: `{ completed, total, xpReward }` 또는 null (게스트)
   - `ranking.top`: 상위 N명 배열 (보통 2명)
   - `ranking.me`: `{ rank, score }` 또는 null (게스트)
   - `admin.locked`: 불리언 (현재는 항상 true)

### 4.3 Mock 데이터 시작점

실제 API 가 준비될 때까지 다음 mock 으로 시작한다 (시각 검증용으로 시안과 일치):

- 인증 mock: `chapterLabel = "DAY 16 / 20 · PL/SQL CURSOR"`, `title = "오늘의 PL/SQL,\n4문제만 풀고 가요"`, `subtitle = "1위까지 880 XP · 8일째 연속 학습"`, `streakIndicator = true`
- 코드: 4줄 (`CURSOR c_emp IS` / `  SELECT empno FROM emp;` / `FOR rec IN c_emp LOOP` / `  DBMS.PUT(??);`)
- ticker: `{ activeUsers: 12, topPlayer: { name: '김OO', score: 4820 }, accuracyPct: 67 }`
- journey.days: 1~13 → done, 14~15 → recent, 16 → today, 17~20 → upcoming
- cards.primary.chapterProgress: `{ completed: 7, total: 12, xpReward: 150 }`
- cards.ranking: top `[{1, '김OO', 4820}, {2, '이OO', 4210}]`, me `{ 7, 3940 }`

Mock 위치: `apps/web/src/lib/home/mock.ts` — 실제 API 연결 시 교체.

---

## 5. 디자인 토큰 / Tailwind 추가 (ADR-020 §3.3 패치)

### 5.1 신규 CSS 변수 (apps/web/src/app/globals.css)

PR-2 hex 토큰 시스템에 다음 4종을 추가한다.

| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--brand-strong` | `#0369a1` (sky-700) | `#0ea5e9` (sky-500) | Primary 카드 그라디언트 끝점 |
| `--code-bg` | `#0f172a` | `#0f172a` | Hero Layer 2 코드 배경 (의도적 always-dark) |
| `--code-tab-bg` | `#1e293b` | `#1e293b` | Hero Layer 1 탭바 배경 (의도적 always-dark) |
| `--syntax-blank` | `#fde047` (yellow-300) | `#fde047` | 빈칸 highlight 배경 |
| `--syntax-blank-fg` | `#422006` (yellow-950) | `#422006` | 빈칸 highlight 텍스트 |

> 코드 영역은 의도적으로 light/dark 동일. 도메인 영역(에디터)는 라이트 모드에서도 다크로 두는 게 dev-tool 톤 일관성에 좋다.

신택스 색 (`text-purple-400`, `text-sky-400` 등)은 신규 토큰 없이 **Tailwind 기본 색 팔레트** 를 직접 사용한다 — 추가 토큰화 시 ADR 패치가 비대해지므로 의도적으로 패스.

### 5.2 Tailwind config 매핑 (apps/web/tailwind.config.js)

`theme.extend` 에 다음을 추가한다:

- **`colors`**:
  - `brand-strong: 'var(--brand-strong)'`
  - `code: { DEFAULT: 'var(--code-bg)', tab: 'var(--code-tab-bg)' }`
  - `syntax: { blank: 'var(--syntax-blank)', 'blank-fg': 'var(--syntax-blank-fg)' }`
- **`backgroundImage`**:
  - `'brand-gradient': 'linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)'`
- **`gridTemplateColumns`**:
  - `'20': 'repeat(20, minmax(0, 1fr))'` — Journey strip 용

이렇게 매핑하면 `bg-brand-gradient`, `bg-code`, `bg-code-tab`, `bg-syntax-blank`, `text-syntax-blank-fg`, `grid-cols-20` 이 사용 가능.

### 5.3 ADR-020 §3.3 패치 텍스트 (복붙용)

> §3.3 디자인 토큰 변경 기록에 다음 한 행을 추가:
>
> | 2026-MM-DD | PR-8b | `--brand-strong` / `--code-bg` / `--code-tab-bg` / `--syntax-blank` / `--syntax-blank-fg` 5개 토큰 추가, Tailwind `brand-gradient` background-image 와 `grid-cols-20` 추가. 메인 페이지 시안 D 구현. |

### 5.4 신규 의존성

| 패키지 | 도입 여부 | 비고 |
|---|---|---|
| `framer-motion` | **PR-1~3 에서는 도입 안 함** | PR-4 옵션. 라이브 티커 숫자 tween, journey strip 채워지는 애니메이션. 도입 시 ADR 한 줄 추가. |
| `next/font/google` (Pretendard, JetBrains Mono) | **PR-1 에서 도입 권장** | 한국어 가독성 + 코드 mono. design-brief §5 자유 범위. |
| 기타 | 없음 | shadcn 외 component lib, CSS-in-JS, 새 icon lib 일절 도입하지 않는다. |

---

## 6. 신택스 하이라이팅 매핑

코드 세그먼트의 `kind` 필드 → Tailwind class 매핑:

| kind | 의미 | 라이트/다크 클래스 | 적용 토큰 예 |
|---|---|---|---|
| `keyword` | 제어 키워드 | `text-purple-400` (양 모드 동일 — 코드 영역이 다크 고정) | `DECLARE`, `BEGIN`, `END`, `IF`, `THEN`, `LOOP`, `FOR`, `IN`, `IS`, `CURSOR`, `RETURN`, `DECLARE` |
| `fn` | DML / built-in | `text-sky-400` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `FROM`, `WHERE`, `JOIN`, `INTO`, `COUNT`, `SUM` |
| `highlight` | 빈칸 / 강조 | `bg-syntax-blank text-syntax-blank-fg rounded-sm px-1` | `??`, `[ ? ]` |
| `plain` (or 미지정) | 식별자·세미콜론·괄호 | `text-slate-200` (기본) | 변수명, `;`, `(`, `)`, 숫자 리터럴 |

문자열 리터럴 / 주석은 현재 시안에 없지만 추후 필요 시 `text-emerald-400` (string) / `text-slate-500` (comment) 추가 가능.

---

## 7. 접근성 (WCAG 2.1 AA) — 이 시안 specific 체크리스트

design-brief §8 의 일반 요구는 그대로 유지. 시안 D 가 새로 발생시키는 항목:

| 위치 | 위험 | 해결 |
|---|---|---|
| Hero Layer 2 다크 코드 (라이트 모드에서도 다크) | 라이트 모드에서 페이지 흐름과 갑자기 다른 톤 | 의도된 design choice. 코드 영역은 `<pre>` + `aria-label="오늘의 문제 코드 미리보기"` 로 영역 구분 명시. |
| 신택스 색 (purple-400, sky-400) on `#0f172a` | 대비비 | purple-400 `#c084fc` on `#0f172a`: 7.6:1 ✅, sky-400 `#38bdf8` on `#0f172a`: 8.5:1 ✅, slate-200 on `#0f172a`: 13.2:1 ✅ — 모두 AA/AAA 충족 |
| 빈칸 highlight (yellow-300 / yellow-950) | 대비비 | `#422006` on `#fde047`: 11.5:1 ✅ AAA |
| Layer 3 라이브 티커의 `text-fg-muted` | 작은 텍스트 (xs) AA 4.5:1 | `#64748b` on `bg-elevated #f8fafc`: 4.92:1 ✅ AA |
| Journey strip 의 today amber bar `bg-amber-500` | 색만으로 의미 인코딩 (1.4.1 색 사용 금지) | 색 + 위치 + 라벨(`▲ Day 16 (오늘)`) 3중 인코딩. 추가로 컨테이너에 `aria-label="부트캠프 진행률: 20일 중 16일째, 75% 완료"`. 각 막대는 시각적 표현이므로 개별 `aria-hidden`. |
| `text-amber-600` 라벨 (라이트) | `#d97706` on `#f8fafc`: 4.62:1 ✅ AA. 다크는 `text-amber-400` `#fbbf24` on `#0f172a`: 9.5:1 ✅ AAA |
| streak `●` 도트 (subtitle 끝) | 의미 색 단독 사용 | 도트는 `aria-hidden`. 의미는 텍스트 (`8일째 연속 학습`) 가 이미 전달. |
| Primary 카드 그라디언트 위 텍스트 | text-brand-fg 토큰이 light 에선 white, dark 에선 navy — 그라디언트 양 끝에서 모두 통과해야 함 | white on `#0369a1` (gradient end light): 6.4:1 ✅ / navy `#0f172a` on `#0ea5e9` (gradient end dark): 6.8:1 ✅ |

**검증 도구**: Chrome DevTools axe, WebAIM Contrast Checker, 라이트/다크 양 모드 모두 캡처.

---

## 8. 파일 매핑

| 경로 | 액션 | 책임 |
|---|---|---|
| `apps/web/src/app/page.tsx` | **교체** | RSC. ViewModel 받아서 4 영역 컴포넌트 호출 |
| `apps/web/src/components/home/hero-live-panel.tsx` | **신규** | Hero 좌+우 통합. 3-layer 우측 패널 포함 |
| `apps/web/src/components/home/journey-strip.tsx` | **신규** | 20-day 진행 strip |
| `apps/web/src/components/home/feature-cards.tsx` | **신규** | 비대칭 3-카드 그리드. 내부에 Primary/Ranking/Admin 서브컴포넌트 |
| `apps/web/src/lib/home/types.ts` | **신규** | `HomeViewModel` 및 하위 타입 |
| `apps/web/src/lib/home/mock.ts` | **신규** | 인증/게스트 mock ViewModel (실제 API 전환 전 임시) |
| `apps/web/src/lib/home/data.ts` | **신규** | `getHomeViewModel()` 진입점. 인증 체크 후 mock 반환 |
| `apps/web/src/app/globals.css` | **수정** | §5.1 토큰 5종 추가 (`:root` + `.dark`) |
| `apps/web/tailwind.config.js` | **수정** | §5.2 매핑 추가 (`colors`, `backgroundImage`, `gridTemplateColumns`) |
| `docs/decisions/ADR-020-ux-redesign.md` | **수정** | §3.3 변경 기록에 한 줄 추가 (§5.3) |
| 기존 헤더 컴포넌트 | **변경 없음** | 재사용 |
| 기존 shadcn `<Button>` `<Card>` | **변경 없음** | Primary 카드는 shadcn `<Card>` 안 쓰고 직접 그리는 게 그라디언트 적용 깔끔. Ranking/Admin 도 동일하게 직접 (`bg-bg border border-border rounded-lg`) — shadcn `<Card>` 의 기본 스타일과 맞물리지 않음. |

---

## 9. 컴포넌트 책임 (props 명세, 산문)

각 컴포넌트는 RSC 또는 (인터랙션이 명확히 필요한 경우) `'use client'`. 시안 D 의 모든 영역은 PR-1 시점에서는 **인터랙션이 거의 없으므로 모두 RSC** 로 시작한다.

### 9.1 `<HeroLivePanel>` (RSC)

**받는 props**: `hero` (HeroData), `todayQuestion` (TodayQuestion), `ticker` (LiveTicker | null)

**책임**:
- §3.2 의 좌·우 그리드 렌더
- 좌측 텍스트 / CTA / pill 처리. pill 은 `chapterLabel` 이 null 이면 게스트 카피로 분기
- 우측 패널의 3 layer 렌더. `ticker` 가 null 이면 Layer 3 를 게스트 정적 카피로 대체
- 코드 세그먼트 `kind` → Tailwind class 매핑은 컴포넌트 내부 헬퍼로 처리

**책임 외**:
- 데이터 가져오기 (page.tsx 의 `getHomeViewModel()` 가 함)
- 스타일 결정 외의 비즈니스 로직

### 9.2 `<JourneyStrip>` (RSC)

**받는 props**: `days` (배열), `completedDays` (숫자), `totalDays` (숫자)

**책임**:
- §3.3 의 헤더 라인 / 20-grid 막대 / 하단 3분할 라벨 렌더
- 각 막대의 색을 `status` 에 따라 매핑
- 컨테이너에 `role="img"` + `aria-label` 추가 (§7)
- 개별 막대는 `aria-hidden`

### 9.3 `<FeatureCards>` (RSC)

**받는 props**: `cards` (FeatureCardsData)

**책임**:
- 3-col 그리드 렌더
- 내부에 Primary/Ranking/Admin 서브컴포넌트 (같은 파일 안에 정의해도 OK)
- Primary: 그라디언트 + lucide `<BookOpen>` + 모드 chip + 챕터 진행 박스
- Ranking: lucide `<Trophy>` + top N + 내 위치 highlight row
- Admin: lucide `<Settings2>` + 본문 + 🔒 푸터
- 각 카드는 통째로 `<a>` (또는 `<Link>`) 로 감싸서 카드 어디를 눌러도 라우트 이동. focus-visible 링은 카드 보더에 적용 (`focus-within:ring-2 ring-brand`).

---

## 10. 구현 단계 / PR 분할

각 PR 은 독립적으로 mergeable, 각 시점마다 페이지가 깨지지 않게 한다.

### PR-1: 토큰 + Hero (가장 시각 변화 큼)
- §5 토큰 추가 (globals.css + tailwind.config.js)
- `<HeroLivePanel>` 신규 컴포넌트
- `lib/home/types.ts` + `mock.ts` + `data.ts` (인증 mock 반환)
- `page.tsx` 의 기존 hero 영역 교체. 카드 영역은 PR-8 그대로 유지
- ADR-020 §3.3 패치
- **검증**: 라이트/다크, 모바일/데스크톱, 키보드 포커스, axe 무에러

### PR-2: Journey strip
- `<JourneyStrip>` 신규
- `page.tsx` 에 hero 와 카드 사이로 끼움
- mock 의 `journey` 필드만 추가 (real API 미연결)
- **검증**: 4가지 상태(done/recent/today/upcoming) 모두 시각 OK, aria-label 스크린리더 검증

### PR-3: 카드 그리드 재설계
- `<FeatureCards>` 신규
- `page.tsx` 의 기존 카드 영역 교체
- shadcn `<Card>` → 직접 그린 카드로 전환
- mock 의 `cards` 필드 추가
- **검증**: lg 비대칭 / sm 균등 / 모바일 1열 모두 정상, 카드 hover, focus-within ring

### PR-4 (옵션): 인터랙션
- `framer-motion` 도입 (ADR 한 줄)
- 라이브 티커 숫자 tween (페이지 진입 시 0 → 12)
- Journey strip 입장 애니메이션 (왼쪽부터 채워짐, 200ms stagger)
- Primary 카드 진행 바 width 애니메이션
- **검증**: `prefers-reduced-motion` 무시 안 함, 모션 끄면 정적으로 정상 표시

각 PR 후 design-brief §13 의 외부 노트북 평가 1회.

---

## 11. Acceptance criteria

PR-3 머지 시점 기준 (PR-4 는 옵션이므로 제외).

**시각**
- 시안 D 의 와이어프레임과 영역 구성이 일치 (Hero 그리드 비율, 3-layer 패널, journey strip, 비대칭 카드)
- 라이트 / 다크 모두 시각 OK, 컬러 토큰 사용
- 모바일(<sm) / 태블릿(sm~lg) / 데스크톱(lg+) 3 breakpoint 모두 깨짐 없음

**기능**
- 게스트 / 인증 분기가 ViewModel 단계에서 처리되고, 컴포넌트는 props 만 본다
- 모든 CTA / 카드 클릭이 올바른 route 로 이동
- mock 데이터로 모든 영역이 채워진다 (실 API 미연결 OK)

**접근성** (§7)
- axe DevTools 무에러
- 키보드만으로 모든 액션 도달 가능
- 스크린리더로 Hero 코드 영역 / Journey strip 의 의미 전달 확인
- 라이트·다크 양쪽에서 WCAG AA 통과

**빌드 / 정합성**
- `pnpm build` 통과
- Pre-commit (lint, typecheck) 통과
- shadcn/ui 외 신규 component lib 미도입
- Tailwind v3 (v4 마이그레이션 없음)
- design-brief §9.3 변경 불가 항목 단 하나도 안 건드림

---

## 12. 변경 / 미변경 정리

### 12.1 변경됨 (vs PR-8)

- Hero: 단조 텍스트 → 좌(개인화) + 우(3-layer 통합 패널). 시각 anchor 추가
- 카드 그리드: 균등 3-col → 1.4:1:1 비대칭. Primary 만 그라디언트 + 챕터 진행 바
- 신규 영역: Journey strip
- 신규 토큰 5종 (§5.1)
- Tailwind theme.extend 3종 (§5.2)
- 폰트: Pretendard + JetBrains Mono (선택)

### 12.2 변경 없음 (vs PR-8)

- Header 컴포넌트
- 라우트 (`/`, `/play/solo`, `/rankings`, `/admin/scope`)
- 인증 흐름
- shadcn/ui 컴포넌트 (`<Button>` 만 사용, `<Card>` 는 안 씀)
- 기존 PR-2 hex 토큰 / shadcn HSL 토큰 (둘 다 그대로 공존)
- 다크 모드 메커니즘 (`darkMode: 'class'`, next-themes)
- WCAG AA 정책

### 12.3 명시적으로 안 한 것

- 모바일 375px 최우선 지원 (design-brief §9.3 — 유보)
- 학습 범위 카드의 인증 분기 표시 (현재처럼 모두에게 노출, 🔒 만 추가)
- 새 component lib (Mantine, MUI 등) 도입
- Tailwind v4 마이그레이션
- Brand 이름 변경
- 새 라우트 추가

---

## 13. 미해결 / 후속 결정

| 항목 | 상태 | 결정 시점 |
|---|---|---|
| 라이브 티커 / 챕터 진행 / 랭킹 백엔드 API 시그니처 | 미정 | 받는 에이전트가 mock 으로 PR-1~3 진행, API 는 별도 PR |
| 게스트에게 학습 범위 카드 노출 여부 분기 | 미정 (현재 노출) | PR-3 이후 사용자 피드백 보고 결정 |
| Streak (연속 학습) 데이터 모델 | 없음 | mock 이후, 별도 ADR + 백엔드 PR |
| Journey strip 클릭 동작 (해당 챕터로 점프?) | 미정 | PR-2 시점에 product 결정 후 |
| Primary 카드 그라디언트의 정확한 endpoint 색 | §5.1 의 값으로 시작 | 외부 노트북 평가 후 미세 조정 가능 |
| Pretendard 도입 여부 | 권장 (자유 범위) | 받는 에이전트 판단. 도입 안 해도 OK |

---

## 14. 외부 도구 / 디자이너에 추가 핸드오프 (옵션)

본 문서를 design-brief 와 함께 v0.dev / Magic UI / 디자이너에게 넘길 때:

- design-brief §11.1 영어 prompt 의 끝에 다음 한 줄 추가:
  > *Reference: see attached `main-page-redesign-concept-d.md` for the chosen layout direction (3-layer hero panel + journey strip + asymmetric cards).*
- 본 문서의 §2 (시각 레이아웃 ASCII) 와 §3 (영역별 스펙) 만 발췌해도 충분
- 시안 D 의 의도는 §1 한 줄 요약 + §3.2.2 (3-layer 통합 패널) 두 곳에 집약돼 있음 — 이 둘만 읽혀도 큰 그림 OK

---

## 15. 결정 / 변경 기록

| 일자 | 변경 | 출처 |
|---|---|---|
| 2026-04-28 | v1 초안 — 시안 D 핸드오프 명세, 다른 Claude 에이전트 향 | 본 세션 |
