# 메인 페이지 디자인 브리프 v1 (2026-04-28)

> **목적**: 메인 페이지(`/`) 의 현재 구조 · 토큰 · 제약 · 인터랙션을 한 곳에 정리하여
> 외부 디자인 도구(v0.dev, Magic UI, 21st.dev, TweakCN, Figma, ChatGPT/Claude 등)나
> 외부 디자이너에게 그대로 컨텍스트로 전달 가능하게 한다.
>
> 본 문서는 **현재(PR-8 시점)의 결정 사항**과 **변경 허용 범위**를 명확히 분리한다.
> "여기까지는 정해졌고, 여기서부터는 자유롭게 다시 그려도 된다" 의 경계.

---

## 1. 프로젝트 한 줄 (one-liner)

**Oracle DBA 학습 게임** — Oracle DBA 부트캠프 수강생(~20명)이 SQL/PL-SQL 용어·문법·함수를
게임으로 외우는 학습 플랫폼. 솔로 퀴즈가 핵심, 랭킹·관리자 도구가 보조.

영어 한 줄: *A gamified learning platform for Oracle DBA bootcamp students (~20 users)
to memorize SQL/PL-SQL syntax, terms, and functions through quizzes.*

---

## 2. 사용자 페르소나

| 항목 | 값 |
|---|---|
| 주 사용자 | Oracle DBA 부트캠프 수강생 |
| 인원 | ~20명 (소규모 폐쇄 운영) |
| 평균 연령 | 20대 후반~30대 |
| 디바이스 | 데스크톱 노트북 우선, 모바일 후순위 (375px 미지원, 유보 항목) |
| 언어 | 한국어 (UI 전체 한글) |
| 학습 맥락 | 매일 1~2회 짧은 세션 (5~15분) |
| 톤 | 친근하지만 학습 목적 — 너무 캐주얼/장난스러운 게임은 피함 |

---

## 3. 현재 메인 페이지 구조 (PR-8 기준)

```
┌─────────────────────────────────────────────────────────┐
│  Header (sticky 아님)                                    │
│  [Logo "Oracle DBA 학습 게임"]      [☀/🌙][로그인][회원가입] │
│  (또는 인증 상태에서) [☀/🌙][플레이][오답노트][로그아웃]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Hero                                                   │
│  ┌──────────────────────────────────────────┐           │
│  │ Oracle DBA 학습 게임 (h1, 4xl-5xl)        │           │
│  │ 부트캠프에서 배우는 SQL/PL/SQL 용어와 함수를 │           │
│  │ 게임으로 자연스럽게 외우자. (p, fg-muted)  │           │
│  └──────────────────────────────────────────┘           │
│                                                         │
│  Card Grid (1 / 2 / 3 columns @ sm / lg breakpoint)      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐              │
│  │ 📘 솔로     │ │ 🏆 랭킹   │ │ ⚙ 학습범위 │              │
│  │ (primary*) │ │           │ │           │              │
│  └───────────┘ └───────────┘ └───────────┘              │
│  *primary 만 상단 그라디언트 액센트                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 콘텐츠 인벤토리

| 영역 | 텍스트 | 비고 |
|---|---|---|
| 페이지 타이틀 | "Oracle DBA 학습 게임" | 변경 불가 (브랜드) |
| 헤로 설명 | "부트캠프에서 배우는 SQL/PL/SQL 용어와 함수를 게임으로 자연스럽게 외우자." | 1줄 ~ 2줄 권장 |
| Card 1 | 제목 "솔로 플레이" / 설명 "주차/주제/난이도 선택. 빈칸·용어·MC 등 5가지 모드." / 링크 `/play/solo` / 아이콘 `BookOpen` | **primary** |
| Card 2 | 제목 "랭킹" / 설명 "동기 수강생들과 점수 경쟁" / 링크 `/rankings` / 아이콘 `Trophy` | 일반 |
| Card 3 | 제목 "학습 범위 관리" / 설명 "(관리자) 노션 자료 import 및 화이트리스트 편집" / 링크 `/admin/scope` / 아이콘 `Settings2` | 일반 |
| 헤더 액션 (게스트) | 로그인 / 회원가입 (CTA) | 회원가입 강조 |
| 헤더 액션 (인증) | 플레이 / 오답 노트 / 로그아웃 | — |

---

## 4. 사용자 평가 (현재 시점, 2026-04-27)

> "카드/배너/색감 등 디자인이 밋밋하다."

PR-8 이후 다음 시각적 약점이 의심됨 — 외부 영감원 평가 시 우선 검증 대상:

- **Hero 가 너무 단조** — 한 줄 설명 외 시각적 anchor 없음 (배경 일러스트, 코드 스니펫, 데이터 시각화 등 부재)
- **카드 단순 평면 (flat) 디자인** — 그라디언트 액센트는 primary 한 줄뿐, 나머지는 단조로운 hex border + bg
- **색감 절제됨** — 단일 brand 색(`#0284c7` light / `#38bdf8` dark) 만 사용. 보조 색·그라디언트·강조 색 없음
- **배너/소셜 프루프 없음** — "현재 N명 학습 중", "이번 주 1위", "지금 풀어볼 만한 문제" 같은 라이브 정보 ZERO
- **타이포그래피 단조** — 시스템 sans-serif 한 weight, 디스플레이용 폰트 미사용
- **Empty area 큼** — `max-w-5xl` 카드 그리드 아래 빈 공간이 큰데 채울 콘텐츠가 없음

---

## 5. 기술 스택 / 제약 (변경 불가)

| 항목 | 값 | 변경 가능 여부 |
|---|---|---|
| Framework | Next.js 14 App Router | ❌ 불가 |
| Server / Client component | `/`(home) 는 RSC, `/login`/`/register` 는 CSR | ❌ 불가 |
| Styling | **Tailwind CSS v3.4** (`darkMode: 'class'`) | ❌ 불가 |
| Component lib | **shadcn/ui** (copy-paste, `apps/web/src/components/ui/`) | ❌ 불가 |
| Theme | **next-themes** (`attribute='class'`, `defaultTheme='light'`, `enableSystem`) | ❌ 불가 |
| Icon | **lucide-react** | ✅ 자유 사용 |
| Animation | tailwindcss-animate (현재 사용 안 함) / Framer Motion 도입 가능 | ⚠ 신규 의존성은 ADR 후 |
| Font | 기본 시스템 — **변경 가능 (next/font 사용)** | ✅ 자유 |
| Image | next/image, public 폴더 | ✅ 자유 |

> **핵심 원칙**: 새 CSS-in-JS 라이브러리(emotion, styled-components 등) 도입 금지.
> Tailwind utility + shadcn 컴포넌트 + CSS 변수 토큰만으로 표현 가능해야 함.

---

## 6. 디자인 토큰 (변경 시 ADR-020 §3.3 패치 필요)

**중요** — 두 토큰 시스템이 공존한다.

### 6.1 PR-2 hex 토큰 (페이지 inline-style 호환용, ADR-020 §3.3)

```css
:root {
  --bg: #ffffff;
  --bg-elevated: #f8fafc;
  --fg: #0f172a;
  --fg-muted: #64748b;
  --brand: #0284c7;
  --brand-fg: #ffffff;     /* brand 위 텍스트, WCAG AA 4.5:1+ 보장 */
  --success: #16a34a;
  --error: #dc2626;
  --border: #e2e8f0;
}
.dark {
  --bg: #0f172a;
  --bg-elevated: #1e293b;
  --fg: #f1f5f9;
  --fg-muted: #94a3b8;
  --brand: #38bdf8;
  --brand-fg: #0f172a;
  --success: #4ade80;
  --error: #f87171;
  --border: #334155;
}
```

Tailwind 매핑: `bg-bg`, `bg-bg-elevated`, `text-fg`, `text-fg-muted`, `bg-brand`, `text-brand-fg`, `border-border`, `text-success`, `text-error`.

### 6.2 shadcn HSL 토큰 (shadcn 컴포넌트 alpha 호환용)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 199.4 88.7% 39.4%;     /* PR-2 --brand 와 동일 색의 HSL 표현 */
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;          /* hover bg, brand 와 무관 (shadcn 표준) */
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

Tailwind 매핑: `bg-primary`, `bg-card`, `border-input`, `ring-ring`.

### 6.3 토큰 사용 가이드 (현 시점 합의)

- 페이지 레이아웃 컨테이너 / 텍스트 / 일반 영역 → **PR-2 토큰** (`bg-bg-elevated`, `text-fg`)
- shadcn 컴포넌트 (Button / Card / Input / Label) → **shadcn 토큰** (자동 적용)
- 브랜드 강조 (CTA, 액센트, 그라디언트) → **PR-2 `brand`** (`bg-brand`, `text-brand-fg`, `border-brand`)
- hover bg / muted bg → **shadcn `accent`** (`hover:bg-accent`)

---

## 7. 인터랙션 / 모션 (현재)

| 위치 | 효과 | duration |
|---|---|---|
| 헤더 로고 hover | `text-fg` → `text-brand` | 150ms (transition-colors) |
| 카드 hover | `-translate-y-0.5 + border-brand + shadow-lg` | 200ms |
| ArrowRight (카드 우상단) | hover 시 `translate-x-0.5 + text-brand` | 200ms |
| 버튼 (shadcn) | bg/90 hover, focus-visible ring | 150ms |

**확장 여지** — Framer Motion / view transitions / GSAP 등 도입 시 ADR 추가 필요. 현재는 Tailwind utility 만으로 충분한 영역.

---

## 8. WCAG 2.1 AA 요구사항 (변경 불가)

| 기준 | 현재 구현 |
|---|---|
| 1.4.3 대비비 ≥ 4.5:1 | light/dark 모든 조합 토큰으로 보장. 신규 색상 추가 시 **광원·배경 양쪽 검증 필수** |
| 1.4.13 Content on Hover | 카드 hover 효과는 정보 추가가 아닌 시각적 강조만 |
| 2.1.1 Keyboard | shadcn Radix 기본 + Link/Button native |
| 2.4.7 Focus Visible | `focus-visible:ring-2 ring-brand ring-offset-bg` |
| 4.1.2 Name/Role/Value | 모든 button `aria-label` 또는 텍스트 / Link href |
| 4.1.3 Status Messages | 폼 에러 `role="alert"` `aria-live="polite"` |

**디자인 변경 시 검증 의무**: 새 색 조합 추가 시 https://webaim.org/resources/contrastchecker/ 또는 axe DevTools로 light/dark 양쪽 통과 증명.

---

## 9. 변경 허용 범위

### 9.1 자유롭게 변경 가능

- ✅ Hero 영역 전체 구성 (배경 패턴 / 일러스트 / 코드 스니펫 / motion / 라이브 카운터 등)
- ✅ Card 시각 표현 (그라디언트, glassmorphism, 3D, 보더 스타일, 일러스트 등)
- ✅ 카드 그리드 레이아웃 (3 균등 → primary 큰 카드 + 보조 작은 카드 비대칭 등)
- ✅ 폰트 (next/font 로 Pretendard / Inter / IBM Plex 도입 가능)
- ✅ 새 섹션 추가 (예: "이번 주 학습 통계", "최근 풀이한 문제", "리더보드 티저", "오늘의 한 문제")
- ✅ 아이콘 표현 (lucide → 다른 lucide 아이콘 / Hero Icons 라이브러리 추가 가능)
- ✅ 마이크로 인터랙션 (Framer Motion 도입 시 ADR 한 줄)

### 9.2 변경 시 ADR 패치 / 합의 필요

- ⚠ 디자인 토큰 추가 / 변경 (color, radius, spacing) → ADR-020 §3.3 변경 기록
- ⚠ 새 dependency 도입 (Framer Motion, animation lib, 새 component lib) → ADR 한 줄 또는 §10 연결 ADR 기록
- ⚠ 반응형 breakpoint 변경 (현재 sm/lg 기본)

### 9.3 변경 불가 (확정)

- ❌ Tailwind v3 → v4 마이그레이션 (shadcn 가이드 v3 기반)
- ❌ shadcn 외 component lib 도입 (Mantine, MUI, AntD 등) — Q14=4 거절
- ❌ 모바일 375px 최우선 지원 (Q12=a 유보)
- ❌ 로그인하지 않은 사용자에게 학습 범위 관리 카드 노출 (현재 노출 → 추후 인증 분기 검토 가능)
- ❌ "Oracle DBA 학습 게임" 브랜드명 변경

---

## 10. 영감원 후보 (외부 평가 / prompt 시 참고)

학습 + 게임 + 데이터 분야 레퍼런스 — **베끼지 말고 영감만**:

| 영역 | 사이트 |
|---|---|
| 학습 플랫폼 | Anki, Duolingo, Brilliant.org, Codecademy, Frontend Mentor |
| Dev tools 랜딩 | Vercel.com, Linear.app, Resend.com, Cal.com, Supabase.com, Neon.tech |
| Quiz / 게임 | Quizlet, Kahoot, BoardGameArena (UI 방향) |
| Component 갤러리 | shadcn/ui examples, **21st.dev**, **Magic UI**, **Aceternity UI**, Tremor |
| 색감 / 다크 | Tailwind UI dark variants, GitHub Primer, Stripe |

**우리에게 적합한 분위기 키워드** (한국어 / 영어):
- 한국어: 차분한 / 학습용 / 신뢰감 / 데이터 중심 / 살짝 게임적 / 미니멀
- 영어: *calm, study-focused, trustworthy, data-driven, subtly gamified, minimal but with personality*

**피해야 할 분위기**:
- 너무 캐주얼한 게임 (랜딩에 폭죽, 캐릭터, 만화체)
- 너무 차가운 SaaS (이모션 없는 enterprise dashboard)
- 너무 어두운 hacker theme (가독성 저하)

---

## 11. 외부 도구 prompt 템플릿

### 11.1 v0.dev / Magic UI / Claude Artifacts 용 (영어, 그대로 복붙 가능)

```
Design a Next.js 14 (App Router) home page for "Oracle DBA Study Game",
a gamified learning platform for ~20 Korean bootcamp students learning Oracle SQL/PL-SQL.

Tech constraints:
- Tailwind CSS v3.4 only (no CSS-in-JS), darkMode: "class"
- shadcn/ui components (Button, Card already available)
- next-themes (light default + system + manual toggle)
- lucide-react icons

Structure:
- Header: logo "Oracle DBA 학습 게임" (left), theme toggle + auth actions (right)
- Hero: h1 "Oracle DBA 학습 게임" + 1-line subtitle in Korean about gamified SQL/PL-SQL learning
- 3 cards (CTA grid):
    1. PRIMARY: "솔로 플레이" — solo quiz, /play/solo, BookOpen icon
    2. "랭킹" — leaderboard, /rankings, Trophy icon
    3. "학습 범위 관리" — admin scope, /admin/scope, Settings2 icon

Design tokens (must use as CSS variables):
- Light: bg #ffffff, bg-elevated #f8fafc, fg #0f172a, fg-muted #64748b, brand #0284c7
- Dark: bg #0f172a, bg-elevated #1e293b, fg #f1f5f9, fg-muted #94a3b8, brand #38bdf8

Mood: calm, study-focused, trustworthy, data-driven, subtly gamified, minimal but with personality.
NOT: cartoonish, hyper-casual, hacker-dark, enterprise-cold.

Accessibility: WCAG 2.1 AA contrast in BOTH light and dark modes, focus-visible ring,
keyboard navigation, role=alert for errors.

Current weakness to address: hero feels flat (no visual anchor), cards look generic (only single
gradient accent), no personality, single brand color used (no secondary/gradient/accent).

Deliver: full RSC component code (no useState in home), Tailwind utility classes only,
make it visually memorable while staying minimal.
```

### 11.2 ChatGPT / Claude 비교 prompt (한국어)

```
다음은 우리 프로젝트의 메인 페이지 디자인 브리프야.
[docs/rationale/main-page-design-brief.md 본문 첨부]

이 제약 안에서 메인 페이지를 더 매력적으로 만들 수 있는 구체적인 디자인 시안 3개를 제안해줘.
각 시안은 다음 형식으로:
1. 한 줄 컨셉
2. Hero 영역 변경 (텍스트, 시각 요소, motion)
3. 카드 그리드 변경 (레이아웃, 시각 표현)
4. 새 섹션 제안 (있다면)
5. 사용한 토큰 / 신규 토큰 (있다면)
6. 예상 사용자 체감 변화
7. 구현 난이도 (S/M/L)
```

### 11.3 Figma / 디자이너 핸드오프 용

이 문서 + 다음 화면 캡처를 함께 전달:
- 현재 light 모드 데스크톱 (1440px)
- 현재 dark 모드 데스크톱 (1440px)
- 현재 모바일 (375px) — 정식 지원은 아니지만 reflow 확인

**디자이너에게 명확히 전달할 것**:
- "Tailwind utility 로 표현 가능한 범위에서 시안 부탁" (디자이너가 Figma 무한 자유도로 그리면 구현 부담)
- "shadcn Button/Card 의 기본 형태는 유지, 컨테이너·강조·여백·motion 만 변경"
- "light/dark 둘 다 그려야 함"

---

## 12. 결정 / 변경 기록

| 일자 | 변경 | 출처 |
|---|---|---|
| 2026-04-28 | v1 초안 작성 — 외부 도구 / 디자이너 핸드오프 용 | 본 세션 |

---

## 13. 다음 단계 (이 브리프를 받은 사람의 행동)

### 13.1 외부 도구 / 디자이너에게 전달 시

1. 본 문서 그대로 전달 (한국어 가능 / 영어 prompt 만 발췌도 OK)
2. `apps/web/src/app/page.tsx` 현재 코드도 함께 (1 페이지 분량)
3. 시안 1~3개 받기 → 본 프로젝트 컨텍스트(사용자 ~20명 / 학습 톤)에 맞는지 평가

### 13.2 시안 채택 후

1. 새 ADR 또는 ADR-020 §3.3 변경 기록 한 줄 (토큰 추가 시)
2. PR 1개로 메인 페이지 재작성 (`feature/adr-020-pr8b-home-redesign` 등)
3. Pre-commit + build + 컨테이너 검증 후 외부 노트북 평가
