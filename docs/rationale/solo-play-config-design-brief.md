# 솔로 플레이 설정 디자인 brief v1 (2026-04-28)

> **목적**: `/play/solo` 의 **config phase (시작 화면)** 만 외부 도구
> (v0.dev / Magic UI / 21st.dev / TweakCN / Figma / ChatGPT / Claude Artifacts)
> 또는 외부 디자이너에게 그대로 컨텍스트로 전달 가능한 형태로 정리한다.
>
> **시점**: PR #41 (PR-9a) 가 시안 β `§3.1` 의 구조 (트랙 분기 + 옵션 1 다중 모드 +
> 난이도 분기) 를 이미 코드로 옮긴 후. 본 brief 는 그 **위에서 시각 풍부함을
> 한 단계 더 끌어올리기 위한 입력**이다.
>
> **읽는 순서**:
> 1. `docs/rationale/main-page-design-brief.md` (전체 제약 / 토큰 / 금지)
> 2. `docs/rationale/main-page-redesign-concept-d.md` (메인 시안 D — 톤 기반선)
> 3. `docs/rationale/play-and-mistakes-design-brief.md` (4 화면 통합 brief)
> 4. `docs/rationale/play-and-mistakes-redesign-concept-beta.md` (시안 β 구조 명세)
> 5. **본 문서** (config phase 시각 풍부함 입력 brief)
>
> **본 brief 의 결과물**: 사용자가 외부에서 시안 1~3 도출 → 명세 문서
> (`solo-play-config-redesign-concept-{X}.md`) 작성 → PR-9a' 또는 PR-9a polish 로 적용.

---

## 1. 한 줄 요약

`/play/solo` config phase 는 **사용자가 학습 세션을 시작하기 전 가장 먼저 만나는
화면**이다. 메인 페이지 시안 D 의 풍부함 (3-layer 글라스 + 코드 anchor +
brand-gradient + 라이브 ticker) 와 비교하면, PR-9a 적용 후에도 **시각 anchor
부재 + 빈 공간 + 콘텐츠 부족** 이 분명히 남아 있다. 본 brief 는 이를 **시안 β 의
구조 (Layer 1/2/3/4) 를 깨지 않으면서** 메인 수준의 시각 풍부함으로 끌어올리는
시안 도출용 입력이다.

영어 한 줄: *Visual richness brief for the `/play/solo` config screen, building on
PR-9a's structural infrastructure (track split + multi-mode + adaptive difficulty)
to match the home page's level of visual anchoring.*

---

## 2. 현재 상태 (PR-9a 적용 후)

```
┌────────────────────────────────────────────────────────────────────┐
│ Header (sticky 아님, 메인과 동일)                                    │
├────────────────────────────────────────────────────────────────────┤
│  솔로 플레이 설정                              [📚 오늘 복습 N건]    │  ← 헤더 단조
│                                                                    │
│  ┌──────────────────────────┐ ┌──────────────────────────┐         │
│  │ 🏆 랭킹 도전              │ │ 🧠 개인 공부              │         │  ← 트랙 타일 (시안 β §3.1.2 OK)
│  │ 고정 난이도 · 점수 랭킹    │ │ 적응형 난이도 · 약점 분석 │         │     글라스, 아이콘 작음
│  │ ● 동기 12명 풀이 중       │ │ ✓ 랭킹에 반영되지 않음     │         │     라이브 배지만 풍부
│  └──────────────────────────┘ └──────────────────────────┘         │
│                                                                    │
│  ┌─ 글라스 폼 카드 한 개 ──────────────────────────────────┐       │
│  │ 주제                       주차                            │       │
│  │ ┌─────────┐               ┌──────┐                       │       │
│  │ │ SQL 기본▼│               │  1  ↕│                       │       │
│  │ └─────────┘               └──────┘                       │       │
│  │                                                            │       │
│  │ 게임 모드 · 2개 이상 선택하면 라운드에서 섞여 출제됩니다     │       │
│  │ ☑ 빈칸 타이핑  ☐ 용어 맞추기  ☐ MC  ☐ 결과 예측  ☐ 카테고리│       │
│  │                                                            │       │
│  │ 난이도                                                      │       │
│  │ ◉ EASY  ○ MEDIUM  ○ HARD                                   │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                    │
│  [ 시작하기 → ]   [ 최근 오답 다시 보기 ]                            │  ← CTA, 보조 1개 (추천 주차 미연결)
│                                                                    │
│       ↓ ↓ ↓  큰 빈 공간  ↓ ↓ ↓                                     │  ← 페이지 아래 비어 있음
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**시각 톤**: 시안 D 의 글라스 (`bg-bg-elevated/55 backdrop-blur-2xl`) + 페이지
배경 radial-gradient blob + brand-gradient CTA. 라이트/다크 모두 적용됨.

---

## 3. 콘텐츠 인벤토리 (PR-9a 기준)

| 영역 | 텍스트 / 데이터 | 변경 가능 여부 |
|---|---|---|
| 페이지 h1 | "솔로 플레이 설정" | ✅ 텍스트 / 시각 |
| ReviewBadge | "오늘 복습 N건" / 0건이면 silent | ✅ 위치 / 시각 |
| 트랙 1 타이틀 | "랭킹 도전" + Trophy 아이콘 | ✅ 시각 풍부, 텍스트는 보존 |
| 트랙 1 부제 | "고정 난이도 · 점수가 랭킹에 반영됩니다" | ✅ |
| 트랙 1 라이브 배지 | "동기 N명 풀이 중" (mock=12) | ✅ 시각 |
| 트랙 2 타이틀 | "개인 공부" + Brain 아이콘 | ✅ |
| 트랙 2 부제 | "적응형 난이도 · 약점 분석" | ✅ |
| 트랙 2 정보 배지 | "랭킹에 반영되지 않습니다 · 자유롭게 학습하세요" | ✅ |
| 주제 select | shared `TOPIC_LABELS` 11종 | ❌ 라벨 / ✅ 시각 |
| 주차 input | number, 1~20 | ✅ 시각 (현재 native input) |
| 모드 chip | shared `GAME_MODE_LABELS` 6종 (5종 노출) | ❌ 라벨 / ✅ 시각 |
| 난이도 chip | EASY / MEDIUM / HARD | ❌ / ✅ 시각 |
| 시작 CTA | "시작하기 →" | ✅ |
| 보조 CTA | "최근 오답 다시 보기" → `/review/mistakes` | ✅ + 추가 권장 |
| 페이지 너비 | `max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12` (메인과 동일) | ✅ |

---

## 4. 자체 분석 — 본 화면의 8가지 시각 약점

PR-9a 적용 후에도 명백히 남아 있는 약점. 외부 시안 평가 시 **우선 검증 대상**.

| # | 약점 | 영향도 | 비교 (메인 시안 D) |
|---|---|---|---|
| 1 | **페이지 헤더 단조** — h1 + ReviewBadge 만, 시각 anchor 없음 | HIGH | 메인은 Hero Live Panel (3-layer + 코드 + ticker) 로 강력한 anchor |
| 2 | **트랙 타일 2개의 시각 풍부함 부족** — 아이콘이 작고 (18px), 부제가 단조, 라이브 배지가 있어야만 풍부 | HIGH | 메인 카드 그리드는 Primary 그라디언트 + 모드 chips + 진행 박스 |
| 3 | **글라스 폼 카드 단조** — Layer 2/3/4 가 한 카드 안에 stack, 시각 분할 약함 | HIGH | 메인 우측 패널은 3-layer 명확 분할 (탭바 / 코드 / ticker) |
| 4 | **모드 chip 단조** — 텍스트 + 체크만, 아이콘 없음, 메타 정보 없음 (예상 시간 / 난이도 추천 / 마지막 정답률) | MEDIUM | — |
| 5 | **난이도 chip 단조** — EASY/MEDIUM/HARD 가 같은 색 + 같은 시각 무게 | MEDIUM | — |
| 6 | **빈 공간 큼** — `max-w-5xl` 안 폼 끝나면 아래 큰 빈 영역 | HIGH | 메인은 Hero 다음 Journey strip + 카드 그리드로 채움 |
| 7 | **콘텐츠 anchor 부재** — "오늘의 추천 주차" / "최근 활동" / "이번 주 학습 통계" / "지금 풀어볼 만한 문제" / "친구 진행도" 같은 라이브 정보 0 | HIGH | 메인은 ticker / Journey strip / Ranking 카드로 라이브 정보 풍부 |
| 8 | **선택 미리보기 부재** — 주제·주차·모드 선택해도 어떤 문제가 나올지 시각적 미리보기 없음 | HIGH | 메인은 Hero 코드 패널이 직접 sample 코드 anchor 역할 |

---

## 5. 기술 스택 / 제약 (변경 불가)

`main-page-design-brief.md` §5 + `play-and-mistakes-design-brief.md` §5 와 동일.

| 항목 | 값 |
|---|---|
| Framework | Next.js 14 App Router |
| Server / Client | `/play/solo` 는 CSR (`'use client'`), 인증 필수 |
| Styling | Tailwind CSS v3.4 only |
| Component lib | shadcn/ui 만 (Button / Card / Input / Label / Dialog / DropdownMenu 설치됨) |
| Theme | next-themes (`defaultTheme="light"`, `enableSystem`) |
| Icon | lucide-react |
| Animation | Framer Motion 도입 예정 (PR-9b, ADR-020) |

**PR-9a 적용 후 추가 인프라** (재사용 의무):
- 토큰: `--feedback-correct` / `--feedback-incorrect` (alpha 10% wash, PR-9b 용)
- Tailwind 매핑: `bg-feedback-correct` / `bg-feedback-incorrect`
- 시안 D 토큰 6종 모두 재사용 (`--brand-strong` / `--code-bg` / `--code-tab-bg` / `--syntax-blank` / `--syntax-blank-fg` / `bg-brand-gradient`)
- 시안 β 인프라 컴포넌트 (`<TrackSelector>` / `<ModeMultiSelect>` / `<ConfigForm>`) — 새 시안에서 **시각만 풍부화**, 구조 / props / 책임은 유지
- `lib/play/{types,mock}.ts` 의 `SoloConfigSelection` / `SoloTrack` / mock 빌더 그대로

---

## 6. 디자인 토큰 (재사용 + 신규 후보)

### 6.1 재사용 (시안 D + 시안 β PR-9a)

```css
/* PR-2 hex */
--bg, --bg-elevated, --fg, --fg-muted, --brand, --brand-fg,
--success, --error, --border

/* PR-8b 시안 D */
--brand-strong, --code-bg, --code-tab-bg, --syntax-blank, --syntax-blank-fg

/* PR-9a 시안 β */
--feedback-correct, --feedback-incorrect

/* shadcn HSL */
--background, --foreground, --primary, --card, --muted, --accent,
--destructive, --border, --input, --ring, --radius

/* Tailwind extend */
bg-brand-gradient (135deg, brand → brand-strong)
grid-cols-20
```

### 6.2 신규 후보 (시안 채택 시 ADR-020 §3.3 패치)

| 토큰 | 용도 | 비고 |
|---|---|---|
| `--difficulty-easy` / `--difficulty-medium` / `--difficulty-hard` | 난이도 chip 색 분기 (현재 동일) | 약점 #5 해결 — 색 + 강도 + 아이콘 3중 인코딩 |
| `--mode-icon-{blank,term,mc,result,category}` | 모드 chip 좌측 아이콘 색 | 약점 #4 해결 |
| 추가 글라스 변형 | 페이지 헤더 / 콘텐츠 anchor 카드 | 메인 시안 D 톤 안에서 |

토큰 추가는 시안 채택 후 명세 문서에서 결정.

---

## 7. WCAG 2.1 AA (변경 불가)

`play-and-mistakes-design-brief.md` §8 + 시안 β §8 그대로. 본 화면 특화:

- 트랙 타일 / 모드 chip / 난이도 chip 의 선택 상태 = 색 + 보더 + 아이콘 / 가중치 3중 이상 인코딩 의무 (1.4.1)
- 새 색 추가 (난이도 분기 등) 시 light/dark 양쪽 4.5:1 검증
- 키보드 좌우 화살표 (트랙) / 스페이스 토글 (모드 chip) 유지
- ReviewBadge 0건 silent (4.1.3)

---

## 8. 변경 허용 범위

### 8.1 자유롭게 변경 가능 (시각 풍부함 강화)

- ✅ **페이지 헤더 영역 전체** — h1 외 sub-header / 인사 / 사용자 진도 요약 / 추천 라벨 등 추가
- ✅ **트랙 타일 시각 표현** — 큰 아이콘 / 일러스트 / 미니 차트 / hover 시 추가 정보 등
- ✅ **글라스 폼 카드 분할** — Layer 2 / Layer 3 / Layer 4 를 별도 카드로 분리 / 가로 배치 / 좌우 split 등
- ✅ **모드 chip 풍부화** — 좌측 아이콘 / 우측 메타 정보 (예상 시간 / 정답률) / hover detail
- ✅ **난이도 chip 분기 시각** — 색 / 아이콘 / 강도 표시 (별 / 게이지 등)
- ✅ **빈 공간 채움** — 다음 라이브 anchor 카드 1~3 개 추천:
  - "오늘의 추천 주차" — 사용자 평균 정답률 기반
  - "이번 주 학습 통계" — 풀이 수 + 정답률 + streak
  - "최근 활동 ticker" — 동기들이 푼 문제 가로 스크롤
  - "친구 진행도" — 부트캠프 동기 진도 비교
  - "지금 풀어볼 만한 문제" — 추천 단일 문제 미리보기
- ✅ **선택 미리보기** — 현재 선택한 주제·주차·모드 조합으로 sample 코드/문장 미리보기 (시안 D Hero 의 코드 패널 재사용 가능)
- ✅ **CTA 영역 풍부화** — 보조 CTA 추가 (예: "친구와 같이 풀기" / "오늘의 챌린지" 등)
- ✅ Framer Motion 도입 (PR-9b 예정 — ADR 한 줄)

### 8.2 변경 시 ADR 패치 / 합의 필요

- ⚠ 신규 토큰 추가 → ADR-020 §3.3 변경 기록
- ⚠ 새 dependency 도입 → ADR
- ⚠ 페이지 컨테이너 너비 변경 (현재 `max-w-5xl`)

### 8.3 변경 불가 (확정)

- ❌ Tailwind v3.4 → v4
- ❌ shadcn 외 component lib
- ❌ 모바일 375px 최우선
- ❌ 시안 β §3.1 의 **구조** — Layer 1 (트랙 분기) / Layer 3 (모드 다중) / Layer 4 (난이도 분기) 의 데이터 흐름은 보존 (시각만 풍부화)
- ❌ shared 데이터 모델 (Topic / GameModeId / Difficulty / TOPIC_LABELS / GAME_MODE_LABELS)
- ❌ API 시그니처 (PR-9a 의 `modes[0]` / `difficulty ?? 'EASY'` 변환은 유지)
- ❌ 메인 시안 D 의 글라스 톤 / brand-gradient / 코드 패널
- ❌ 라우트 (`/play/solo`)

---

## 9. 메인 시안 D + 시안 β 와의 일관성 (필수 유지)

본 작업은 **메인 시안 D 의 통합 디자인 시스템 안에서** 진행. 다음을 깨뜨리면 안 됨:

| 영역 | 시안 D / 시안 β 결정 | 본 brief 에서 |
|---|---|---|
| 글라스 톤 | `bg-bg-elevated/55 backdrop-blur-2xl border-white/15 ring-1 ring-inset ring-white/10` | 같은 base — 변형 OK 단 톤 통일 |
| 페이지 배경 | `body::before` radial-gradient blob (light/dark) | 그대로 (변경 없음) |
| 코드 블록 | `bg-code` always-dark + `bg-code-tab` + syntax + `--syntax-blank` | 미리보기 anchor 재사용 권장 (약점 #8) |
| Primary CTA | `bg-brand-gradient text-brand-fg` | 그대로 (변경 없음) |
| Hover | `-translate-y-0.5 + border-brand/40` | 같음 |
| 뱃지 / 액티브 | `bg-brand/10` highlight | 같음 |
| 페이지 컨테이너 | `max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12` | 같음 |

원칙: **시각 언어를 깨지 않고, 풍부함만 더한다.** 시안 D 와 본 화면을 옆에 놓고 봐도 같은 디자인 시스템이라는 인상.

---

## 10. 영감원 후보

`main-page-design-brief.md` §10 + 추가:

| 영역 | 사이트 | 본 화면 영감 포인트 |
|---|---|---|
| 학습 시작 화면 | Anki, Duolingo lesson selector, Brilliant.org topic page | 주제 / 난이도 선택의 시각 anchor |
| Dev tools 설정 화면 | Vercel new project, Linear project setup, Cal.com event type setup | 옵션 풍부함 + 빈 공간 활용 |
| 게임 lobby | Polytopia matchmaking, Civilization VI start screen | 트랙 분기의 시각 무게 |
| Quiz 카드 그리드 | Quizlet study set page, Codecademy track home | 모드 / 주차 선택의 anchor |
| 통계 / streak | Wordle daily, GitHub contribution graph | "이번 주 학습 통계" anchor |

**우리에게 적합한 분위기**:
- 한국어: 차분한 / 학습 동기 부여 / 시작 부담 없음 / 시각적으로 풍부하지만 단정한
- 영어: *welcoming, motivating, low-pressure to start, visually rich but composed*

**피해야 할 분위기**:
- 게임 lobby 의 폭죽 / 캐릭터 / 만화체
- 너무 많은 라이브 정보로 시선 분산
- 메인 시안 D 와 다른 톤 (보라 / 빨강 강조 등)
- 주제·주차 선택을 어렵게 만드는 미사여구

---

## 11. 외부 도구 prompt 템플릿

### 11.1 v0.dev / Magic UI / Claude Artifacts (영어)

```
Design the config (start) screen of `/play/solo` for "Oracle DBA Study Game",
a gamified Korean SQL/PL-SQL learning platform for ~20 bootcamp students.
The home page already uses the "Apple Vision glass" tone (concept-d) and
the config screen has been partially rebuilt (PR-9a, see concept-beta §3.1):
two glass track tiles + multi-mode chips + difficulty chips. The current
result is structurally correct but visually thin compared to the home page.

GOAL: Make this screen as visually rich as the home page hero, WITHOUT
breaking the existing structure.

Existing structure (must preserve):
1. Page header — h1 "솔로 플레이 설정" + ReviewBadge ("오늘 복습 N건",
   silent if 0)
2. Layer 1: 2 glass track tiles
   - "랭킹 도전" — Trophy icon, "고정 난이도 · 점수가 랭킹에 반영됩니다",
     live "동기 N명 풀이 중" badge (when authenticated)
   - "개인 공부" — Brain icon, "적응형 난이도 · 약점 분석", info
     "랭킹에 반영되지 않습니다 · 자유롭게 학습하세요"
3. Layer 2: 주제 (topic dropdown, 11 SQL/PL-SQL topics) + 주차 (week 1-20)
4. Layer 3: 게임 모드 (multi-select chips, min 1) — 빈칸 타이핑 / 용어
   맞추기 / MC / 결과 예측 / 카테고리 분류
5. Layer 4: 난이도 (track-dependent)
   - ranked: EASY / MEDIUM / HARD radio chips
   - practice: AUTO 적응형 info box
6. CTA: 시작하기 → (brand-gradient) + 최근 오답 다시 보기 (outline)

Tech constraints:
- Tailwind CSS v3.4 only (no CSS-in-JS), darkMode: "class"
- shadcn/ui (Button, Card, Input, Label, Dialog, DropdownMenu installed)
- next-themes (light default + system + manual)
- lucide-react icons
- Framer Motion OK (will be added via ADR)

Design tokens (must use):
- (PR-2 hex) --bg, --bg-elevated, --fg, --fg-muted, --brand (#0284c7/#38bdf8),
  --success, --error, --border
- (PR-8b 시안 D) --brand-strong (#0369a1/#0ea5e9), --code-bg (#0f172a always-dark),
  --code-tab-bg (#1e293b), --syntax-blank (#fde047), --syntax-blank-fg (#422006)
- (PR-9a 시안 β) --feedback-correct, --feedback-incorrect (alpha 10% washes)
- Tailwind: bg-brand-gradient (135deg), bg-code, bg-code-tab, bg-syntax-blank

Visual continuity REQUIRED with home page (concept-d):
- Apple Vision glass: bg-bg-elevated/55 backdrop-blur-2xl border-white/15
  ring-1 ring-inset ring-white/10 + brand-tinted shadow
- body::before pseudo-element radial-gradient blob (already provides
  page background)
- Code block (when shown): bg-code always-dark + bg-code-tab top bar +
  syntax colors

Mood: welcoming, motivating, low-pressure to start, visually rich but composed.
NOT: cartoonish lobby, cluttered, hacker-dark, cold enterprise, tone-shift
from the home page.

Page weak points to fix:
1. Page header is plain (h1 + ReviewBadge only) — needs a visual anchor
   like the home hero
2. Track tiles are visually thin — small icons, monotone subtitle
3. Form glass card is monolithic — Layer 2/3/4 stacked without separation
4. Mode chips are plain text + check — no icons / no meta info
5. Difficulty chips have identical visual weight (color + icon + intensity?)
6. Big empty space below the form (max-w-5xl)
7. NO live content — no "today's recommended week", "this week's stats",
   "friends progress", "recommended question preview"
8. NO selection preview — picking topic/week/mode shows nothing about
   what kind of question will appear

Encouraged additions (free):
- Page sub-header with personalized greeting / today's progress
- Bigger track tile visuals (large icon, hover detail, mini stats)
- Mode chips with icons + meta (estimated time / last accuracy / difficulty hint)
- Difficulty chips with intensity (stars / gauge / color)
- Live content cards below the form:
  - "오늘의 추천 주차" (today's recommended week, based on accuracy)
  - "이번 주 학습 통계" (this week: solved count + accuracy + streak)
  - "최근 활동 ticker" (peer activity scroll)
  - "지금 풀어볼 만한 문제" (recommended single question preview, reusing
    the home hero code panel pattern)
- Selection preview — when topic/week/mode is selected, show a sample
  question or code snippet (reuse concept-d hero code block pattern)
- Secondary CTAs: "오늘의 추천 주차" (auto-fills week input), "친구와
  같이 풀기" (future)

Accessibility: WCAG 2.1 AA contrast in BOTH light and dark modes,
keyboard nav (←/→ for track tiles, space for mode chips), aria labels
for live regions, color + icon + text triple encoding for any state.

Deliver: full Tailwind utility component code as a Next.js 14 RSC or CSR
(can mix). Be aggressive on visual richness while preserving the structure.
Make light AND dark both work. Match the home page (concept-d) tone exactly.
```

### 11.2 ChatGPT / Claude 비교 prompt (한국어)

```
다음은 우리 프로젝트의 `/play/solo` config (시작 화면) 디자인 brief야.
[docs/rationale/solo-play-config-design-brief.md 본문 첨부]

또한 함께 참고할 문서:
1. 메인 시안 D 명세: docs/rationale/main-page-redesign-concept-d.md
   (이미 머지됨 — 본 화면이 같은 톤이어야 함)
2. 4 화면 통합 brief: docs/rationale/play-and-mistakes-design-brief.md
3. 시안 β 명세 (구조): docs/rationale/play-and-mistakes-redesign-concept-beta.md
   (이미 PR-9a 로 §3.1 구조가 코드에 적용됨)

이 제약 + 이미 적용된 PR-9a 인프라 + 메인 시안 D 톤 안에서, 본 화면을
**시각적으로 풍부하게** 다시 설계한 시안 3개를 제안해줘.

각 시안은 다음 형식으로:
1. 한 줄 컨셉 (메인 시안 D 와의 톤 호응 명시)
2. 페이지 헤더 변경 (약점 #1 해결 안)
3. 트랙 타일 시각 풍부화 (약점 #2)
4. 글라스 폼 카드 분할 / 재구성 (약점 #3)
5. 모드 chip + 난이도 chip 풍부화 (약점 #4, #5)
6. 빈 공간 채움 + 콘텐츠 anchor 추가 (약점 #6, #7)
7. 선택 미리보기 (약점 #8) — 시안 D Hero 코드 패널 재사용 여부
8. 사용한 토큰 + 신규 토큰 (있다면)
9. 신규 dependency (Framer Motion 외)
10. 예상 사용자 체감 변화
11. 구현 난이도 (S/M/L)

평가 기준:
- 메인 시안 D 와의 일관성 > 새로움
- 시안 β §3.1 구조 (Layer 1/2/3/4) 보존 > 시각 변화
- 풍부함 > 미니멀
- 1주차 학생도 이해 가능한 직관성
```

### 11.3 Figma / 디자이너 핸드오프

이 문서 + 다음을 함께:
- 현재 PR-9a 적용 후 화면 캡처 (light / dark, 1440px)
- 메인 시안 D 머지 후 캡처 (참조 톤)
- `apps/web/src/app/play/solo/page.tsx` 현재 코드 (config phase 부분)
- `apps/web/src/components/play/{track-selector, mode-multi-select, config-form}.tsx`

**디자이너에게 명확히 전달**:
- "메인 시안 D 가 이미 머지되어 있고 본 화면이 같은 톤이어야 함"
- "시안 β 의 구조 (Layer 1/2/3/4) 는 코드로 이미 적용됨 — 시각만 풍부화"
- "Tailwind utility + 기존 토큰 (시안 D + PR-9a) 으로 표현 가능한 범위"
- "코드 블록 미리보기는 시안 D Hero 코드 패널을 그대로 재사용 가능"
- "shadcn Button / Input / Label 의 기본 형태 유지, 글라스 / 그라디언트 / 모션만 변경"
- "light / dark 둘 다"

---

## 12. 미해결 / 후속 검토

| 항목 | 상태 |
|---|---|
| 페이지 헤더의 sub-header 콘텐츠 (오늘 진도 / 인사 / 추천) — 어디까지 백엔드 데이터가 필요? | 시안 채택 후 결정 |
| "이번 주 학습 통계" / "최근 활동 ticker" — 현재 백엔드 endpoint 부재. mock 시작점 + 백엔드 PR | 별도 트랙 |
| 선택 미리보기 — 주제·주차·모드 조합으로 sample 문제 fetch — `apiClient.questions.preview()` 같은 endpoint 필요 | 시안 채택 후 결정 |
| 추천 주차 자동 채움 endpoint (`/api/users/me/recommended-week`) | 시안 채택 후 |
| 친구 진행도 / 동기 비교 — 인증 + 친구 관계 모델 부재. 후순위 | TBD |
| 모드 chip 메타 정보 (예상 시간 / 정답률) — 사용자별 데이터 필요 | mock 시작점 → 백엔드 |

---

## 13. 결정 / 변경 기록

| 일자 | 변경 | 출처 |
|---|---|---|
| 2026-04-28 | v1 초안 — `/play/solo` config phase 시각 풍부함 brief, PR-9a 후속 시안 도출용 | 본 세션 |

---

## 14. 다음 단계 (이 brief 를 받은 사람의 행동)

### 14.1 외부 도구 / 디자이너에게 전달

1. 본 문서 + 위 4개 참조 문서 + PR-9a 적용 후 캡처 함께 전달
2. 시안 1~3 받기
3. 본 프로젝트 컨텍스트 (학생 ~20명 / 학습 톤 / 메인 시안 D 일관성 / 시안 β 구조 보존) 평가

### 14.2 시안 채택 후

1. 새 명세 문서 (`docs/rationale/solo-play-config-redesign-concept-{X}.md`) — 시안 D 명세 형식 차용 (15 섹션)
2. ADR-020 §3.3 또는 §11 변경 기록 (신규 토큰 / dependency)
3. **PR-9a 의 처리 결정**:
   - (a) 머지 후 PR-9a' polish 로 시안 적용
   - (b) PR-9a 위에 commit 추가 (PR #41 그대로 진행)
   - (c) PR-9a close 하고 새 PR 으로 교체
4. 시안 적용 PR — Pre-commit + build + 컨테이너 검증 + tailscale 외부 노트북 평가
