# 플레이 + 오답 노트 재설계 — 시안 β 구현 핸드오프 v1 (2026-04-28)

> **이 문서의 용도**
> 또 다른 Claude 에이전트가 받아서 `/play/solo` (config / playing / finished)
> 와 `/review/mistakes` 4 화면을 시안 β (Flow Glass) 로 구현할 수 있도록
> **충분한 컨텍스트**를 한 곳에 정리한다.
>
> **읽는 순서**:
> 1. `docs/rationale/main-page-design-brief.md` (전체 제약·토큰·금지)
> 2. `docs/rationale/main-page-redesign-concept-d.md` (메인 시안 D — 본 작업의 톤 기반선)
> 3. `docs/rationale/play-and-mistakes-design-brief.md` (본 작업의 입력 brief)
> 4. **본 문서** (시안 β + 옵션 1 + 적응형 난이도 — 구체 명세)
>
> **본 문서는 코드가 아니라 명세이다.** 받는 에이전트가 본 문서를 자기 판단으로
> 코드로 옮긴다.

---

## 0. 적용 범위 / 전제

| 항목 | 값 |
|---|---|
| 대상 페이지 | `/play/solo` (3 phase) + `/review/mistakes` |
| 의존 결정 | 메인 시안 D 가 머지된 상태 (Apple Vision 글라스 + `bg-code` + `bg-brand-gradient` + Journey strip 토큰) |
| 신규 작업 ID | `feature/adr-020-pr9-play-mistakes-redesign` (PR-9a ~ 9d 로 분할) |
| 변경 범위 | 4 화면 시각 + 신규 트랙 분기 (랭킹 / 개인 공부) + 모드 다중 선택 + 적응형 난이도 (개인 공부 한정) + 신규 컴포넌트 ~7개 + 디자인 토큰 2종 추가 |
| 변경 없음 | 라우트 (`/play/solo`, `/review/mistakes`), 인증 흐름, shadcn/ui, Tailwind v3.4, brand 이름, 학습 흐름의 본질 (config → playing → finished, 라운드 즉시 피드백 → 다음 라운드) |
| 제약 출처 | play-and-mistakes-brief §5, §8, §9, §10 |

본 문서의 모든 변경은 brief §9.1 자유 변경 범위 또는 §9.2 ADR 패치 후 변경 가능 범위 안에 있다. §9.3 (변경 불가) 는 단 하나도 건드리지 않는다.

**중요한 신규 결정 (사용자 confirm 2026-04-28)**:

1. **옵션 1 채택** — `/play/solo` config 에서 게임 모드를 **다중 선택** 가능하게 함. 한 세션 안에 여러 모드 (예: 빈칸 4 + 용어 3 + MC 3) 가 섞임.
2. **개인 공부 트랙 신설 + 적응형 난이도** — `/play/solo` 가 두 트랙으로 분기:
   - **랭킹 도전** — 기존 흐름 유지. 고정 난이도, 점수 랭킹 반영.
   - **개인 공부** — 신규 트랙. 적응형 난이도 (라운드별 자동 조정), 점수는 **랭킹 비반영** (별도 통계만 누적). 약점 분야 분석 결과 화면 노출.

---

## 1. 한 줄 요약

시안 β = **"메인 시안 D 의 글라스 + 코드 + brand-gradient 톤을 학습 흐름 4 화면에 일관되게 흘려보내고, /play/solo 를 랭킹·공부 두 트랙으로 분기"**.

핵심 시각 결정:
1. **코드 블록 = 시안 D Hero Layer 1·2 의 재사용** — `bg-code-tab` + `bg-code` + 신택스 색 + `--syntax-blank` 빈칸 강조. 메인부터 인게임·오답까지 동일한 코드 컴포넌트.
2. **글라스 카드 통일** — `bg-bg-elevated/55 backdrop-blur-2xl border-white/15 ring-1 ring-inset ring-white/10` 을 ContextPanel / FeedbackCard / mistakes 사이드바·카드 모두에 동일 적용.
3. **FeedbackCard immersive** — 1px 보더 → 카드 전체 `bg-feedback-correct` (또는 `bg-feedback-incorrect`) wash + 22px 원형 아이콘 + 점수 pill + Framer Motion 슬라이드인.
4. **트랙 분기** — config 최상단에 두 큰 글라스 타일 (랭킹 / 개인 공부). 선택 즉시 하단 옵션·인게임 UI·finished 화면 모두 분기.
5. **적응형 난이도 (개인 공부 한정)** — 인게임 progress 우측에 현재 난이도 인디케이터 (`EASY → MEDIUM` 같은 step), finished 에 라운드별 난이도 흐름 그래프.

---

## 2. 시각 레이아웃 (전체 4 화면)

### 2.1 `/play/solo` — config phase

```
┌────────────────────────────────────────────────────────────────────┐
│ Header (변경 없음)                                                   │
├────────────────────────────────────────────────────────────────────┤
│ 솔로 플레이 설정                                  [📚 오늘 복습 N건]  │
│                                                                    │
│  ┌──────────────────────────┐ ┌──────────────────────────┐         │
│  │ ▣ 랭킹 도전               │ │ ▷ 개인 공부               │         │  ← 트랙 타일 (Layer 1)
│  │ 고정 난이도 · 점수 랭킹     │ │ 적응형 난이도 · 약점 분석  │         │     선택된 타일은
│  │ ●●● 동기 풀이 12명 LIVE   │ │ ✓ 랭킹 비반영              │         │     brand-gradient 보더
│  └──────────────────────────┘ └──────────────────────────┘         │
│                                                                    │
│  주제                       주차                                    │
│  ┌─────────────┐ ┌────────┐                                        │  ← Layer 2: 기본 옵션
│  │ SQL 기본    ▼│ │  1   ↕│                                        │
│  └─────────────┘ └────────┘                                        │
│                                                                    │
│  게임 모드  (여러 개 선택 가능)                                      │
│  ☑ 빈칸 타이핑   ☑ 용어 맞추기   ☐ MC   ☐ 결과 예측   ☐ 카테고리   │  ← 신규: 다중 선택 chip
│                                                                    │
│  난이도   (랭킹 도전일 때만 표시 / 개인 공부 시 "AUTO 적응형" 안내)    │
│  ◉ EASY    ○ MEDIUM    ○ HARD                                      │
│                                                                    │
│  [ 시작하기 → ]   [ 오늘의 추천 주차 ]   [ 최근 오답 다시 보기 ]      │  ← 신규: 보조 CTA 2개
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 `/play/solo` — playing phase

```
┌────────────────────────────────────────────────────────────────────┐
│ Header                                                             │
├────────────────────────────────────────────────────────────────────┤
│  ┌─ Glass Progress Pill ─────────────────────────────────────┐     │
│  │ 라운드 3 / 10  ▮▮▮░░░░░░░  (랭킹: 4연속 ●)                │     │
│  │                            (개인공부: EASY → MEDIUM ↑)    │     │  ← 트랙별 분기
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  ┌─ Glass ContextPanel ───────────────────────────────────────┐   │
│  │ ⓘ 상황 — 직원 테이블에서 부서별 평균 급여 조회                 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─ Code Block (시안 D Layer 1+2 재사용) ────────────────────┐    │
│  │ ● quiz.sql · 빈칸 타이핑 · EASY              3/10          │    │
│  │ ─────────────────────────────────────────────────────────  │    │
│  │ 1│ SELECT department_id, [____](salary)                   │    │
│  │ 2│ FROM employees                                         │    │
│  │ 3│ GROUP BY department_id;                                │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                    │
│  [_______ 정답 입력 _______]   [ 제출 ]   [ 힌트 (1/2) ]           │
│                                                                    │
│  ▼ submitted 후                                                    │
│                                                                    │
│  ┌─ FeedbackCard (correct 시: green wash) ──────────────────┐     │
│  │ ✓ 정답입니다                              +10점          │     │
│  │ 내 답:  AVG       정답:  AVG                              │     │
│  │ 해설: SQL 의 평균 집계 함수는 AVG 입니다.                  │     │
│  │ ◆ 왜? GROUP BY 와 함께 쓰면 그룹별 평균을 반환합니다.      │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  [ 다음 라운드 → ]                                                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 `/play/solo` — finished phase (트랙별 분기)

**랭킹 도전 종료**:
```
┌────────────────────────────────────────────────────────────────────┐
│ 게임 종료 — 랭킹 도전                                               │
│                                                                    │
│  ┌───────────────┐ ┌─────────────────┐                             │
│  │ ◉ 정답률      │ │ 이번 세션 점수   │                             │
│  │ 7 / 10 (70%) │ │      65         │                             │
│  │ [donut chart]│ │  +8 ▲ 누적      │                             │
│  └───────────────┘ └─────────────────┘                             │
│                                                                    │
│  ┌─ 이번 세션 라운드 (Journey strip 재활용) ────────────┐           │
│  │ ✓ ✓ ✗ ✓ ✓ ✗ ✓ ✓ ✓ ✗  (라운드 1~10 정/오)         │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                    │
│  ┌─ 누적 진도 (4 metric cards) ─────────────────────────┐          │
│  │ 총 점수 1,240 │ 플레이 18 │ 누적 78% │ 연속정답 4    │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                    │
│  [ 다시 도전 ]  [ 오답 노트 ]  [ 개인 공부로 전환 ]  [ 홈 ]         │
└────────────────────────────────────────────────────────────────────┘
```

**개인 공부 종료**:
```
┌────────────────────────────────────────────────────────────────────┐
│ 학습 종료 — 개인 공부                  ※ 랭킹 비반영               │
│                                                                    │
│  ┌───────────────────┐ ┌─────────────────────────────────┐         │
│  │ ◉ 정답률          │ │ 적응형 난이도 흐름                │         │
│  │ 7 / 10 (70%)      │ │ EASY ━━ MEDIUM ━━ HARD ━ MEDIUM │         │
│  │ [donut chart]     │ │ R1   R2 R3   R4 ... R10           │         │
│  └───────────────────┘ └─────────────────────────────────┘         │
│                                                                    │
│  ┌─ 약점 분야 (개인 공부 전용) ────────────────────────────┐         │
│  │ 빈칸 타이핑     ▮▮▮▮▮▮▮▮▯▯  80%                      │         │
│  │ 용어 맞추기     ▮▮▮▮▮▮▯▯▯▯  60%  ← 약점                │         │
│  │ MC              ▮▮▮▮▮▮▮▮▮▯  90%                      │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                    │
│  ┌─ 학습 누적 (별도 — 랭킹과 분리된 통계) ────────────────┐         │
│  │ 학습 세션 8 │ 풀이 80문제 │ 평균 정답률 73% │ 강한 영역 MC │       │
│  └────────────────────────────────────────────────────────┘         │
│                                                                    │
│  [ 약한 영역 다시 풀기 ]  [ 다른 주차 ]  [ 오답 노트 ]  [ 홈 ]      │
└────────────────────────────────────────────────────────────────────┘
```

### 2.4 `/review/mistakes` — 오답 노트

```
┌────────────────────────────────────────────────────────────────────┐
│ Header                                                             │
├──────────────────────┬─────────────────────────────────────────────┤
│ Glass Sidebar (≥lg)   │ Main                                       │
│                      │                                             │
│ ⌕ keyword …          │ [ 정렬 ▼ ]    활성 필터: [SQL][1주차][미해결]│
│                      │                                             │
│ 주제 (active = pill) │  ┌─ Glass Mistake Card ──────────────────┐ │
│ ▸ 전체     32        │  │ ⓘ DAY 5 · SQL 기본 · 빈칸 타이핑       │ │
│ ▶ SQL 기본 18 ←      │  │ ┌─ Mini code block ─────────────────┐ │ │
│ ▸ 트랜잭션 14        │  │ │ SELECT [GROUP BY] FROM ...         │ │ │
│                      │  │ │   ↑ 빨간 strikethrough (내 답)      │ │ │
│ 주차                 │  │ │ SELECT GROUP BY FROM ...           │ │ │
│ ▶ 1주차    12        │  │ │   ↑ 초록 (정답)                     │ │ │
│ ▸ 2주차     8        │  │ └────────────────────────────────────┘ │ │
│                      │  │ 해설: GROUP BY 는 …                    │ │
│ 모드                 │  │ [ 재도전 ]  [ ☐ 해결됨 ]              │ │
│ ▶ 빈칸     15        │  └────────────────────────────────────────┘ │
│ ▸ 용어     12        │                                             │
│                      │  ┌─ Glass Mistake Card ──────────────────┐ │
│ 상태                 │  │ …                                       │ │
│ ▶ 미해결    24       │  └────────────────────────────────────────┘ │
│ ▸ 해결됨     8       │                                             │
│                      │  [ < 1 2 3 > ]                              │
└──────────────────────┴─────────────────────────────────────────────┘
```

전체 페이지 컨테이너: `max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12` (메인과 동일).

---

## 3. 영역별 상세 스펙

### 3.1 `/play/solo` — config phase

전체 컨테이너: `space-y-6` 로 위에서 아래로 스택.

#### 3.1.1 페이지 헤더

- 좌: `<h1>` `솔로 플레이 설정` — `text-2xl sm:text-3xl font-medium tracking-tight text-fg`
- 우: `<ReviewBadge>` (기존 컴포넌트 재사용) — `오늘 복습 N건`. 글라스 pill `bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 rounded-full px-3 py-1.5 text-xs`. 0건이면 silent (렌더 안 함, brief §8 4.1.3).
- 정렬: `flex items-center justify-between mb-6`

#### 3.1.2 Layer 1 — 트랙 선택 (신규, 가장 중요)

**그리드**: `grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6`

**랭킹 도전 타일**:
- 컨테이너: 글라스 카드, 클릭 가능 (`button` 또는 `[role=radio]` + `aria-checked`)
- 선택 안 됐을 때: `bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 rounded-xl p-5 hover:border-brand/40 transition-colors cursor-pointer`
- 선택됐을 때: `border-2 border-brand` + `ring-2 ring-brand/20` + 좌상단 체크 마커 (`<Check />` lucide 14px in `bg-brand text-brand-fg rounded-full w-5 h-5`)
- 내용 (위→아래):
  1. 헤더 row: `<Trophy />` 22px in `bg-amber-100 dark:bg-amber-900/30 rounded-md` + 타이틀 `랭킹 도전` (`text-base font-medium text-fg`)
  2. 부제: `text-xs text-fg-muted mt-1`: `고정 난이도 · 점수가 랭킹에 반영됩니다`
  3. 라이브 배지 (인증 시): `mt-3 flex items-center gap-1.5 text-xs`: 녹색 도트 + `동기 12명 풀이 중`. 게스트면 숨김.

**개인 공부 타일**:
- 같은 글라스 + 선택 상태 처리
- 내용:
  1. 헤더: `<Sparkles />` (또는 `<Brain />`) 22px in `bg-purple-100 dark:bg-purple-900/30 rounded-md` + 타이틀 `개인 공부`
  2. 부제: `적응형 난이도 · 약점 분석`
  3. 정보 배지: `mt-3 flex items-center gap-1.5 text-xs text-fg-muted`: 체크 아이콘 + `랭킹에 반영되지 않습니다 · 자유롭게 학습하세요`

**기본값**: 페이지 진입 시 **랭킹 도전 선택됨** (기존 사용자 흐름 유지). URL 쿼리 `?track=practice` 면 개인 공부로 진입.

**상호작용**: 두 타일은 서로 배타. 키보드 접근: 좌우 화살표로 전환 (`role=radiogroup` 패턴).

#### 3.1.3 Layer 2 — 기본 옵션 (주제 / 주차)

`grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4` (기존과 거의 동일하지만 글라스 컨테이너 안에 통합)

- 각 항목: `<Label>` + shadcn `<Select>` 또는 `<Input>`
- 글라스 컨테이너 wrap: 두 항목을 한 글라스 카드 `bg-bg-elevated/55 ... p-5` 안에 놓음
- 라벨: `text-xs font-medium text-fg-muted uppercase tracking-wider mb-1.5`
- 주제 select: shared 의 `TOPIC_LABELS` 그대로 사용
- 주차 input: number, min=1, max=20

#### 3.1.4 Layer 3 — 게임 모드 다중 선택 (옵션 1 핵심 변경)

**같은 글라스 카드 안에서 별도 섹션**:
- 라벨: `게임 모드` + 부제 (작은 글씨): `2개 이상 선택하면 라운드에서 섞여 출제됩니다`
- 컨테이너: `flex flex-wrap gap-2 mt-3`
- 각 모드 = 토글 chip:
  - 미선택: `border border-border bg-bg rounded-full px-3 py-1.5 text-xs text-fg hover:border-brand/40`
  - 선택: `border border-brand bg-brand/10 text-brand rounded-full px-3 py-1.5 text-xs font-medium` + 좌측 14px `<Check />`
- 라벨: shared 의 `GAME_MODE_LABELS` 사용
- 최소 1개 선택 강제 — 모두 해제하려고 하면 마지막 1개는 토글 비활성 + tooltip `최소 1개 모드를 선택하세요`
- **기본값**: `[빈칸 타이핑]` 1개 선택 (기존 단일 모드 사용자 호환)
- API 시그니처 영향: §4.2 참조

#### 3.1.5 Layer 4 — 난이도 (트랙별 분기)

**랭킹 도전 선택 시**:
- 라디오 그룹 `flex gap-2`: `EASY` / `MEDIUM` / `HARD` 3개 chip (3.1.4 와 같은 토글 스타일이지만 단일 선택)
- 기본값: 사용자 평균 정답률 기준 백엔드 추천 (없으면 EASY)

**개인 공부 선택 시**:
- 라디오 그룹 자리에 정보 박스: `bg-bg-elevated border border-border rounded-md px-3 py-2 text-xs text-fg-muted flex items-center gap-2`
- 좌측: `<Sparkles />` 14px (purple)
- 텍스트: `난이도는 자동으로 조정됩니다 — 정답률에 따라 EASY ↔ MEDIUM ↔ HARD 사이를 오갑니다.`
- 해당 박스는 클릭 불가 (단순 안내)

#### 3.1.6 CTA 그룹

- 컨테이너: `flex flex-col sm:flex-row gap-2 mt-2`
- Primary: `시작하기 →` — `bg-brand-gradient text-brand-fg` shadcn Button. 트랙·주제·주차·모드 배열·난이도 모두 valid 일 때만 enabled
- Secondary 1: `오늘의 추천 주차` — outline. 클릭 시 사용자의 최근 7일 평균 정답률 기반 백엔드가 추천한 주차로 주차 input 자동 채움 (mock 단계에서는 `Math.ceil(현재요일/2)` 같은 단순 로직)
- Secondary 2: `최근 오답 다시 보기` — outline. 클릭 시 `/review/mistakes` 로 라우팅
- 로딩 시: Primary 만 `disabled + opacity-50 + spinner`

### 3.2 `/play/solo` — playing phase

기본 구조는 brief §3.2 와 같지만 시각 언어 전부 교체.

#### 3.2.1 Glass Progress Pill (상단)

- 컨테이너: 글라스 `bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 rounded-full px-4 py-2.5 mb-4 flex items-center gap-3`
- 좌: `라운드` (`text-xs text-fg-muted`) + `3 / 10` (`text-sm font-medium text-fg`)
- 중: progress bar — `flex-1 h-1 bg-bg rounded-full overflow-hidden` 안에 `bg-brand-gradient` 채움 막대 (`width: ${currentRound/totalRounds * 100}%`)
- 우 — 트랙별 분기:
  - **랭킹 도전**: `4 연속` (amber 도트 `bg-amber-500` + 텍스트 `text-fg-muted text-xs`) — streak 표시
  - **개인 공부**: `EASY → MEDIUM ↑` 형태의 난이도 인디케이터. 두 difficulty 레벨이 화살표로 연결. 변동 발생 시 (직전 라운드 결과로 난이도 변경) 우측 화살표는 `text-amber-500` (상승) 또는 `text-fg-muted` (하강) 또는 숨김 (변동 없음).

#### 3.2.2 Glass ContextPanel

- 컨테이너: 글라스 (위와 동일 base) + `rounded-xl px-4 py-3 mb-4`
- 좌측 16px 색상 마커: `<Info />` lucide in `bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md`
- 본문 2단:
  - 라벨 `상황` — `text-[10px] text-fg-muted uppercase tracking-wider`
  - 본문 — `text-sm text-fg leading-relaxed` (Round 데이터의 `scenario` 필드)
- `scenario` 가 비어있으면 ContextPanel 자체를 렌더하지 않음

#### 3.2.3 Code Block (시안 D Layer 1+2 재사용 — 가장 중요)

**시안 D Hero 의 우측 패널 Layer 1+2 를 그대로 재사용**. 이미 만들어진 컴포넌트가 있다면 import, 없으면 신규.

- 컨테이너: `rounded-xl overflow-hidden border border-white/5 mb-4`
- **Layer 1 — 탭바**: `bg-code-tab px-3 py-1.5 flex items-center justify-between font-mono text-[11px]`
  - 좌: `<span class="text-brand">●</span> {filename}` — `quiz.sql` 또는 라운드별 다른 이름
  - 우: 모드 라벨 (예: `빈칸 타이핑 · EASY`) — `text-slate-400`. 우우측 끝에 `3 / 10` (작게)
- **Layer 2 — 코드**: `bg-code grid grid-cols-[28px_1fr] font-mono text-[12px] leading-7`
  - 라인 넘버: 회색, `aria-hidden`
  - 코드 본문: 시안 D 신택스 매핑 (§6) 사용
  - 빈칸 위치: `bg-syntax-blank text-syntax-blank-fg rounded-sm px-1 font-medium`
- **`<pre><code>` 사용**, `aria-label="문제 코드"` 추가

**모드별 분기**:
- `blank-typing` 또는 `result-prediction`: 코드 블록 그대로 렌더, 빈칸 highlight
- `term-match`: 코드 블록 대신 **Term Block** 으로 대체 — 글라스 카드 + `text-base text-fg leading-relaxed` 한국어 설명 (scenario 자체) + 강조할 키워드는 `bg-brand/10 text-brand rounded px-1`
- `mc` (객관식): 코드 블록은 그대로 (있으면), 정답 입력 영역이 `<input>` 대신 button 그룹 (4지선다). 본 PR 범위는 brief §13 후순위 — **PR-9b 에서는 placeholder 만 두고, 실제 MC 답 UI 는 후속 PR**.

#### 3.2.4 답 입력 + 액션

- 컨테이너: `flex flex-col sm:flex-row gap-2 mb-4`
- Input — shadcn `<Input>`:
  - `flex-1 font-mono text-sm` (코드 모드)
  - 또는 `flex-1 text-sm` (term-match 모드)
  - placeholder 는 모드별 분기: 빈칸 → `정답을 입력하세요`, term → `용어를 입력하세요`
  - Enter 키로 제출
- Submit 버튼: `bg-brand-gradient text-brand-fg shadcn <Button>` + `loading` 상태 (spinner)
- Hint 버튼: `<Button variant="outline">` + `힌트 (1/2)` 라벨 (n = hintsUsed, m = total)
  - hintsUsed === total 시 disabled + `힌트 모두 사용` 라벨

#### 3.2.5 Hints (활성화된 힌트 표시)

- hintsUsed > 0 일 때만 렌더
- 컨테이너: 글라스 카드 (작은 buffer) + `rounded-md p-3 mb-4 space-y-1.5`
- 각 힌트: `flex items-start gap-2 text-sm text-fg-muted`
  - 좌측 12px `<Lightbulb />` lucide (`text-amber-500`)
  - 본문: 힌트 텍스트
- `aria-live="polite"` 로 새 힌트 스크린리더 알림

#### 3.2.6 FeedbackCard (immersive)

`showingFeedback === true` 일 때만 렌더. **시안 β 의 가장 큰 시각 변화**.

- 컨테이너 — 정/오 분기:
  - 정답: `bg-feedback-correct border border-success/40 ring-1 ring-inset ring-success/10 rounded-xl px-4 py-3.5 mb-4` (배경은 신규 토큰 §5)
  - 오답: `bg-feedback-incorrect border border-error/40 ring-1 ring-inset ring-error/10 ...`
- Framer Motion `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}` (PR-9b 에서 framer-motion 도입 — §5.4)
- `role="status" aria-live="polite"`

내용 (정답 case 예시):
1. **헤더 row** (`flex items-center justify-between mb-3`)
   - 좌: 22px 원형 아이콘 (`<Check />` 또는 `<X />`) `bg-success text-success-fg rounded-full w-[22px] h-[22px] flex items-center justify-center text-xs font-medium` + 라벨 `정답입니다` (`text-sm font-medium`, 색은 success-on-bg)
   - 우: 점수 pill `+10점` — 정답 시 `bg-success/20 text-success-strong rounded-full px-2.5 py-0.5 text-xs font-medium`. 오답 시 `+0점` 으로 표시 (또는 숨김)
2. **답 비교 표** (`grid grid-cols-[56px_1fr] gap-y-1 gap-x-3 text-xs mb-2.5`)
   - 라벨 `내 답` / `정답` (`text-fg-muted`)
   - 값 (`font-mono text-fg font-medium`)
   - 정답 모드일 땐 `정답` 행 hide 가능 (값이 같으니 중복) — 단, 일관성 위해 그대로 둠
   - `correctAnswer` 가 배열이고 length > 1 이면 첫 답을 표시 + 우측 작게 `+ N개 더` (클릭 시 expand)
3. **해설**: `border-t border-success/20 pt-2.5 text-sm leading-relaxed text-fg`
   - `<Markdown>` 렌더 (해설에 코드 백틱 포함 가능 — `<code>` 는 `bg-bg-elevated px-1.5 py-0.5 rounded text-[12px] font-mono`)
4. **`왜?` 박스** (rationale 가 있을 때만):
   - `mt-2.5 bg-bg/60 backdrop-blur border border-success/20 rounded-md px-3 py-2 text-xs flex items-start gap-2`
   - 좌측 `<Diamond />` 또는 `<Sparkles />` 14px (`text-amber-500`)
   - 본문: `<span class="font-medium">왜?</span> {rationale}`

오답 case: 위 구조 동일하되 색은 모두 `error/...` 토큰으로. 점수 pill 대신 `재도전 가능` 라벨 (작게).

#### 3.2.7 Next 버튼

- 풀폭 `<Button>`: `w-full bg-brand-gradient text-brand-fg`
- 라벨: `다음 라운드 →` (또는 마지막 라운드면 `결과 보기 →`)
- Enter 키 작동: `useEffect` 로 `keydown` 리스너, FeedbackCard 렌더 중일 때만 활성

### 3.3 `/play/solo` — finished phase

트랙별 분기 핵심.

#### 3.3.1 페이지 헤더

- `<h1>`: 트랙별 분기
  - 랭킹: `게임 종료` (기존 유지)
  - 개인 공부: `학습 종료` + 우측 작은 pill `※ 랭킹 비반영` (`bg-bg-elevated text-fg-muted text-[11px] rounded-full px-2 py-0.5`)

#### 3.3.2 상단 메트릭 (트랙별 분기)

**랭킹 도전 — 2 카드**:

`grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6`

1. **정답률 도넛 카드** (글라스):
   - 좌측: 86px `<RadialBarChart>` (recharts) — 70% 채움 (brand-gradient stroke)
   - 우측: `7 / 10` (`text-2xl font-medium`) + 라벨 `정답률` + 부제 `(70%)` (작게)
2. **세션 점수 카드** (글라스):
   - 큰 숫자 `65` (`text-3xl font-medium`) + 변동 표시 `+8 ▲ 누적` (`text-xs text-success`)

**개인 공부 — 2 카드**:

1. **정답률 도넛 카드** (랭킹과 동일)
2. **적응형 난이도 흐름 카드** (글라스):
   - 미니 step chart: 가로축 R1~R10, 세로축 EASY/MEDIUM/HARD 3 step
   - 각 라운드의 난이도를 점으로 + 인접 점을 선으로 연결
   - 색: 정답 라운드 `text-success`, 오답 `text-error`
   - SVG 직접 또는 recharts `<LineChart>` minimal 변형

#### 3.3.3 라운드 결과 strip (공통)

- 컨테이너: 글라스 카드 `rounded-xl px-4 py-3 mb-6`
- 헤더: `이번 세션 라운드` (좌) + 우측 작은 라벨 (`정답 7 · 오답 3` 같은 카운트)
- 본문: `flex gap-1.5` 또는 `grid grid-cols-10 gap-1.5`
  - 각 라운드 = 24x24 박스 (`rounded-md`)
  - 정답: `bg-success/20 border border-success/40 text-success-strong` + 가운데 14px `<Check />`
  - 오답: `bg-error/20 border border-error/40 text-error-strong` + 가운데 14px `<X />`
- 시안 D Journey strip 의 색 인코딩 패턴 재사용

#### 3.3.4 약점 분야 (개인 공부 전용)

랭킹 도전에서는 **렌더하지 않음** — 점수 비교가 전부이므로.

- 컨테이너: 글라스 카드 + `rounded-xl px-4 py-4 mb-6`
- 헤더: `약점 분야` (좌) + 우측 작은 라벨 `이번 세션 + 최근 5회 평균`
- 본문: 모드별 horizontal bar
  - 각 행: `flex items-center gap-3 mb-2`
    - 좌측 라벨 (110px 고정): `빈칸 타이핑` 등
    - 중앙 bar (`flex-1 h-2 bg-bg rounded-full overflow-hidden`) 안에 채움 막대 (`bg-brand-gradient` 또는 정답률 60% 미만이면 `bg-error/60`)
    - 우측 숫자 (`60%`)
  - 가장 낮은 정답률에 `← 약점` 라벨 (`text-xs text-error font-medium`) 추가

#### 3.3.5 누적 진도 (트랙별 통계 분리)

**랭킹 도전**:
- 4 metric cards (`grid grid-cols-2 sm:grid-cols-4 gap-2`)
- 각 card: `bg-bg-elevated rounded-md p-3` + 라벨 (`text-[11px] text-fg-muted uppercase`) + 값 (`text-lg font-medium`)
- 항목: `총 점수` / `플레이 횟수` / `누적 정답률` / `현재 연속 정답`

**개인 공부**:
- 4 metric cards (별도 통계 — §4.2 데이터 contract)
- 항목: `학습 세션` / `풀이 문제` / `평균 정답률` / `강한 영역` (가장 높은 정답률 모드명, 예: `MC`)

#### 3.3.6 CTA 그룹 (트랙별 분기)

`flex flex-wrap gap-2 mt-2`

**랭킹 도전**:
1. `다시 도전` (primary, brand-gradient) — 같은 config 로 새 세션
2. `오답 노트` (outline) — `/review/mistakes`
3. `개인 공부로 전환` (outline + `<Sparkles />` 아이콘) — 같은 주제·주차로 개인 공부 트랙으로 진입 (`?track=practice`)
4. `홈` (ghost) — `/`

**개인 공부**:
1. `약한 영역 다시 풀기` (primary) — 약점 분야의 모드 1개로 새 세션 (`?prefilled=...`)
2. `다른 주차 도전` (outline) — config 로 (주차 비움)
3. `오답 노트` (outline)
4. `홈` (ghost)

### 3.4 `/review/mistakes`

기본 구조 유지 (사이드바 + 메인). 시각 언어만 시안 β 톤으로 교체.

#### 3.4.1 Glass Sidebar (`>= lg` 고정 좌측)

- 컨테이너: `lg:sticky lg:top-20 lg:w-64 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto`
- 글라스 wrap: `bg-bg-elevated/55 backdrop-blur-2xl border border-white/15 ring-1 ring-inset ring-white/10 rounded-xl p-4 space-y-4`
- 모바일 (`< lg`): 사이드바를 메인 위로 stack. brief §9.3 best-effort.

**검색 input**:
- shadcn `<Input>` + 좌측 14px `<Search />` 아이콘 (absolute positioning)
- placeholder: `오답 검색...`

**필터 그룹** (각 그룹 동일 패턴):
- 헤더: 작은 아이콘 + 라벨 (`text-[11px] text-fg-muted uppercase tracking-wider mb-1.5`)
  - 주제 = `<BookOpen />`, 주차 = `<Calendar />`, 모드 = `<Gamepad2 />`, 상태 = `<AlertCircle />`
- 항목 리스트: `space-y-0.5`
- 각 항목 = pill button:
  - 미선택: `w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm text-fg hover:bg-bg/40 transition-colors`
  - 선택: `bg-brand/10 text-brand font-medium ring-1 ring-inset ring-brand/20`
  - 우측: 카운트 뱃지 — `text-[11px] tabular-nums` + 옅은 배경 (`bg-bg/60 px-1.5 rounded`)
- 선택 표시는 색 + 보더 + weight 3중 (brief §8 1.4.1)

#### 3.4.2 Main 영역

**헤더 row** (`flex items-center justify-between mb-4`):
- 좌: 활성 필터 chips (`flex flex-wrap gap-1.5`). 각 chip = `bg-brand/10 text-brand rounded-full px-2.5 py-1 text-xs flex items-center gap-1` + 우측 `<X />` 12px (클릭 시 해당 필터 해제). 우측 끝에 `초기화` (`text-xs text-fg-muted hover:text-error underline-offset-4 hover:underline`)
- 우: shadcn `<DropdownMenu>` 정렬 — `최신 / 가장 자주 틀림 / 가장 최근 틀림`

**카드 리스트** (`space-y-3`):

각 카드 — 글라스 wrap + `rounded-xl overflow-hidden`:

1. **카드 헤더** (`px-4 py-2.5 border-b border-white/10 flex items-center gap-2 text-xs`):
   - 좌측 색상 dot + 메타 정보: `DAY 5 · SQL 기본 · 빈칸 타이핑` (`text-fg-muted`)
   - 우측: 상태 뱃지 — 미해결 `bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5` / 해결됨 `bg-success/15 text-success rounded-full ...`

2. **카드 본문** (`px-4 py-3 space-y-3`):

   **(a) 미니 코드 블록** (가장 시각적 차별점):
   - 컨테이너: `bg-code rounded-md overflow-hidden border border-white/5`
   - Top bar: `bg-code-tab px-3 py-1 font-mono text-[10px] text-slate-500` — `mistake.sql`
   - 본문: `font-mono text-[11px] leading-6 px-3 py-2 text-slate-200`
   - **Diff 스타일**:
     - 사용자 답이 들어간 줄 prefix: `<span class="text-error">-</span>` + 줄 전체 `bg-error/15`
     - 정답 줄 prefix: `<span class="text-success">+</span>` + 줄 전체 `bg-success/15`
     - 빈칸 위치 강조: 사용자 답은 빨간 strikethrough (`line-through text-red-300`), 정답은 초록 underline (`text-emerald-300 underline decoration-wavy`)
   - term-match 모드는 코드 블록 대신 일반 텍스트 (`bg-bg-elevated rounded-md p-3 text-sm`)

   **(b) 해설**: `text-xs text-fg-muted leading-relaxed`. 길이 > 200자 면 `한 줄 요약` 후 `더 보기` 토글 (인라인 expand).

3. **카드 액션** (`px-4 py-2.5 border-t border-white/10 flex items-center justify-between bg-bg/30`):
   - 좌: `재도전` 버튼 (`bg-brand-gradient text-brand-fg` Button sm) → 클릭 시 `/play/solo?topic=...&week=...&modes=...&mistakeId=...&track=practice` (개인 공부 트랙으로 prefilled, 점수 비반영)
   - 우: `해결됨` 토글 — shadcn `<Switch>` + 라벨
     - 토글 ON 시 카드 fade-out + height collapse (Framer Motion `<AnimatePresence>` `exit={{ opacity: 0, height: 0 }}`). 200ms.

**Pagination**: shadcn 또는 직접 — `flex items-center justify-center gap-1 mt-6` + 페이지 번호 button (active 는 `bg-brand text-brand-fg`).

---

## 4. 데이터 contract

### 4.1 두 트랙의 데이터 모델 영향 (가장 중요)

기존 `apiClient.solo.start/answer/finish` 시그니처는 **그대로 유지**. 다음 두 가지만 추가:

1. **`solo.start({ track: 'ranked' | 'practice', ... })` 의 `track` 파라미터 추가**
2. **응답 SoloSession 에 `track` 필드 추가**

이 외 데이터 모델 (Round, EvaluationResult, MistakeItem) 은 **변경 없음**. brief §5 변경 불가 항목 준수.

`track === 'practice'` 일 때 백엔드 동작 차이:
- 라운드 생성 시 적응형 난이도 적용 (직전 라운드 결과로 다음 라운드 difficulty 자동 결정)
- 세션 종료 시 `weakAreas` 분석 결과 함께 반환
- 점수가 사용자의 `rankedScore` / leaderboard 에 누적되지 않음. 별도 `practiceStats` 테이블에만 누적.

### 4.2 신규 / 변경 필드

**SoloStartRequest 에 추가**:
- `track: 'ranked' | 'practice'`
- `modes: GameMode[]` (기존 `mode: GameMode` → 배열로 확장. 옵션 1 핵심)
- `difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null` (track === 'practice' 면 null 허용 — 백엔드가 결정)

**SoloSession 응답에 추가**:
- `track`
- `adaptiveHistory: { round: number, difficulty: 'EASY' | 'MEDIUM' | 'HARD' }[]` (track === 'practice' 일 때만)
- `weakAreas: { mode: GameMode, topic: TopicId, accuracyPct: number }[]` (track === 'practice' 일 때만, finished 시점)

**Round 객체 (기존)**: 변경 없음. `mode` 필드는 이미 라운드별로 다를 수 있음 (옵션 1 은 백엔드가 라운드 mode 를 다양하게 채우는 것뿐 — 클라이언트 변경 거의 없음).

**기존 stats / progress 필드 분리**:
- 기존 `userStats` 는 랭킹 도전 통계 — 변경 없음
- 신규 `userPracticeStats` 추가:
  - `practiceSessions: number`
  - `practiceQuestions: number`
  - `practiceAccuracy: number` (0~1)
  - `strongMode: GameMode | null`
  - `weakMode: GameMode | null`

`/api/users/me/stats` 응답 shape 확장: `{ ranked: {...}, practice: {...} }`

### 4.3 인증 분기

`/play/solo` 와 `/review/mistakes` 모두 **인증 필수**. 게스트 → `/login` redirect (현재 동작 유지). 게스트 분기 UI 없음.

### 4.4 Mock 데이터 시작점

PR-9a~9d 동안 백엔드 변경 전이라도 시각 검증 가능하게:

- `apps/web/src/lib/play/mock.ts` — `mockRankedSession`, `mockPracticeSession` 두 빌더
- `mockPracticeSession` 의 `adaptiveHistory`: 10 라운드, `[EASY, EASY, MEDIUM, MEDIUM, HARD, MEDIUM, MEDIUM, MEDIUM, HARD, HARD]` 같은 점진적 상승 패턴
- `weakAreas`: `[{mode: 'term-match', topic: 'sql-basics', accuracyPct: 60}, ...]`
- `userPracticeStats`: `{ practiceSessions: 8, practiceQuestions: 80, practiceAccuracy: 0.73, strongMode: 'mc', weakMode: 'term-match' }`

---

## 5. 디자인 토큰 / Tailwind 추가 (ADR-020 §3.3 패치)

시안 D 의 토큰 (`--brand-strong`, `--code-bg`, `--code-tab-bg`, `--syntax-blank`, `--syntax-blank-fg`, `bg-brand-gradient`, `grid-cols-20`) 은 **그대로 재사용**. 본 작업에서 신규 토큰은 다음 2종만:

### 5.1 신규 CSS 변수

| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--feedback-correct` | `rgba(22,163,74,0.10)` | `rgba(74,222,128,0.10)` | FeedbackCard 정답 배경 wash |
| `--feedback-incorrect` | `rgba(220,38,38,0.10)` | `rgba(248,113,113,0.10)` | FeedbackCard 오답 배경 wash |

`--success` / `--error` 토큰은 이미 PR-2 단계에서 도입됨 (brief §6.1). 본 토큰은 그 위에 alpha 10% 채움용.

### 5.2 Tailwind config 매핑

`theme.extend.backgroundColor` 또는 `colors` 에:
- `feedback-correct: 'var(--feedback-correct)'`
- `feedback-incorrect: 'var(--feedback-incorrect)'`

→ `bg-feedback-correct`, `bg-feedback-incorrect` 사용 가능.

신택스 색 (`text-purple-400`, `text-sky-400`), diff 색 (`text-emerald-300`, `text-red-300`) 은 시안 D 와 동일 — Tailwind 기본 팔레트 직접 사용. 추가 토큰화 없음 (의도적).

### 5.3 ADR-020 §3.3 패치 텍스트 (복붙용)

> §3.3 디자인 토큰 변경 기록에 다음 한 행 추가:
>
> | 2026-MM-DD | PR-9a | `--feedback-correct` / `--feedback-incorrect` 토큰 2종 추가 (alpha 10% 정/오 wash). FeedbackCard immersion 강화. 시안 β `/play/solo` 적용. |

### 5.4 신규 의존성

| 패키지 | 도입 PR | 비고 |
|---|---|---|
| `framer-motion` | **PR-9b** | FeedbackCard slide-up, mistakes 카드 fade-out + height collapse. 도입 시 ADR-020 §6.x 한 줄 또는 별도 ADR. brief §13 항목. |
| `recharts` | **PR-9c** | finished 화면 도넛 / 적응형 난이도 흐름 / 약점 분야 horizontal bar. brief §13 항목. ADR-020 §6.x 한 줄. |
| 기타 | 없음 | shadcn 외 component lib, CSS-in-JS, 새 icon lib 일절 도입 없음. |

---

## 6. 신택스 하이라이팅

시안 D §6 그대로 재사용. 변경 없음.

| kind | 의미 | 클래스 |
|---|---|---|
| `keyword` | SQL/PL-SQL 키워드 (SELECT, FROM, BEGIN, ...) | `text-purple-400` |
| `fn` | 함수명 / 컬럼명 강조 | `text-sky-400` |
| `highlight` | 빈칸 / `??` | `bg-syntax-blank text-syntax-blank-fg rounded-sm px-1` |
| `plain` | 식별자 / 숫자 / 기호 | `text-slate-200` (기본) |

mistakes 카드의 diff 스타일 추가 매핑:
| diff kind | 의미 | 클래스 |
|---|---|---|
| `removed` | 사용자 답 (틀림) | `bg-error/15 text-red-300` + 줄 prefix `-` |
| `added` | 정답 | `bg-success/15 text-emerald-300` + 줄 prefix `+` |
| `mistake-blank` | 사용자가 잘못 채운 빈칸 위치 | `line-through text-red-400 decoration-2` |
| `correct-blank` | 정답 빈칸 위치 | `text-emerald-300 underline decoration-emerald-500/40 underline-offset-2` |

---

## 7. 인터랙션 / 모션

### 7.1 변경 없음 (기존 + 시안 D)

- 헤더 / 메인 / 카드 hover (`-translate-y-0.5 + border-brand/40`)
- shadcn Button focus-visible ring
- 페이지 배경 radial-gradient 블롭 (시안 D `body::before`)

### 7.2 신규 (Framer Motion 도입 — PR-9b 부터)

| 위치 | 효과 | duration / easing |
|---|---|---|
| FeedbackCard 등장 | `opacity 0 → 1 + y 8 → 0` | 200ms ease-out |
| 다음 라운드 진입 | FeedbackCard `exit: opacity 0` + 입력 input 새로 mount cross-fade | 150ms |
| 인게임 progress bar | width transition | 300ms ease-out (CSS transition 으로도 가능, framer 불필요) |
| mistakes 카드 해결 토글 ON | `<motion.div>` exit `{ opacity: 0, height: 0, marginTop: 0 }` | 200ms ease-in-out |
| config 트랙 타일 hover | scale 1 → 1.01 + ring opacity | 150ms (CSS only) |
| config 모드 chip 토글 | `bg` + `border-color` 색 transition (CSS only) | 150ms |

`prefers-reduced-motion: reduce` 시 모든 motion 비활성. Framer Motion 의 `useReducedMotion()` 훅 사용.

### 7.3 키보드

- config: 트랙 타일 좌우 화살표, 모드 chip 스페이스로 토글
- playing: input Enter 제출, FeedbackCard 표시 후 Enter 다음 라운드, Esc 로 힌트 닫기 (없음, 힌트 인라인)
- mistakes: 카드 내부에서 Tab 으로 재도전·토글 도달

---

## 8. WCAG 2.1 AA 체크리스트 (시안 β 신규 위험)

brief §8 의 일반 + 시안 D §7 모두 그대로. 본 시안에서 새로 발생하는 항목:

| 위치 | 위험 | 해결 |
|---|---|---|
| 트랙 타일 선택 상태 | 색만으로 선택 표시 (1.4.1) | 색 + 보더 두께 + 좌상단 체크 아이콘 + `aria-checked` 4중 인코딩 |
| 모드 chip 선택 상태 | 색만 (1.4.1) | 색 + 좌측 체크 아이콘 + `aria-pressed` |
| FeedbackCard 정/오 wash | 색만 (1.4.1) | 색 + 22px 원형 아이콘 (✓/✕) + `정답입니다/오답입니다` 텍스트 + 점수 pill 4중 |
| `bg-feedback-correct` (alpha 10%) 위 텍스트 | 라이트: `success-strong text-green-800 #166534` on 합성색 (`#f0fdf4`). 4.5:1 검증. 다크: `text-green-300 #86efac` on 합성색 — 검증 필요 | WebAIM 으로 양쪽 측정. 부족 시 `success-strong` 별도 토큰 추가 |
| 적응형 난이도 인디케이터 (`EASY → MEDIUM ↑`) | 색만으로 상승/하강 표시 | 색 + 화살표 방향 + `aria-label="난이도 상승"` |
| 진행 progress bar | 시각만, 백분율 없음 | `role="progressbar" aria-valuenow={N} aria-valuemax={10} aria-valuemin={0}` + 텍스트 `3 / 10` 병기 |
| mistakes diff 코드 (`-` / `+` 줄) | 색만으로 구별 | prefix 기호 + `aria-label="틀린 답" / "정답"` + 백그라운드 |
| mistakes 사이드바 카운트 뱃지 | 작은 숫자 가독성 | `text-[11px] tabular-nums` + 충분한 패딩 + WCAG AA 대비 |
| Term-match 모드 (코드 블록 없음) | 시각 anchor 부족 | 글라스 카드 + 여백 충분 + 키워드 brand highlight |
| FeedbackCard slide-up 모션 | `prefers-reduced-motion` 무시 시 어지러움 | Framer Motion `useReducedMotion()` 훅으로 비활성 |

**검증 의무**: PR-9b 머지 전 axe DevTools + WebAIM Contrast Checker 라이트·다크 양쪽 통과 캡처 첨부.

---

## 9. 파일 매핑

### 9.1 `/play/solo` 관련

| 경로 | 액션 | 책임 |
|---|---|---|
| `apps/web/src/app/play/solo/page.tsx` | **재작성** | CSR (`'use client'`) 유지. ViewModel 레벨에서 트랙 분기 |
| `apps/web/src/components/play/track-selector.tsx` | **신규** | 트랙 2 타일 선택 UI |
| `apps/web/src/components/play/config-form.tsx` | **신규** | 주제 / 주차 / 모드 다중 / 난이도 폼 |
| `apps/web/src/components/play/mode-multi-select.tsx` | **신규** | 모드 토글 chip 그룹 (옵션 1 핵심) |
| `apps/web/src/components/play/glass-progress-pill.tsx` | **신규** | 인게임 상단 progress 글라스 pill (트랙별 분기 포함) |
| `apps/web/src/components/play/code-question-block.tsx` | **신규 또는 메인 시안 D 컴포넌트 재사용** | Layer 1 + 2 코드 블록. 메인 `<HeroLivePanel>` 의 우측 패널 일부를 컴포넌트 분리 |
| `apps/web/src/components/play/term-question-block.tsx` | **신규** | term-match 모드용 |
| `apps/web/src/components/play/feedback-card.tsx` | **신규** | FeedbackCard immersive 정/오 wash + 모션 |
| `apps/web/src/components/play/finished-ranked.tsx` | **신규** | 랭킹 도전 결과 화면 |
| `apps/web/src/components/play/finished-practice.tsx` | **신규** | 개인 공부 결과 화면 (적응형 흐름 + 약점 분야) |
| `apps/web/src/lib/play/types.ts` | **신규** | `SoloViewModel`, `SoloTrack`, `AdaptiveHistory`, `WeakArea` 등 |
| `apps/web/src/lib/play/mock.ts` | **신규** | mock 빌더 |

### 9.2 `/review/mistakes` 관련

| 경로 | 액션 |
|---|---|
| `apps/web/src/app/review/mistakes/page.tsx` | **재작성** |
| `apps/web/src/components/review/mistakes-sidebar.tsx` | **신규** |
| `apps/web/src/components/review/mistake-card.tsx` | **신규** |
| `apps/web/src/components/review/mistake-diff-block.tsx` | **신규** (코드 diff 시각화) |
| `apps/web/src/lib/review/types.ts` | **신규** |
| `apps/web/src/lib/review/mock.ts` | **신규** |

### 9.3 공유 / 토큰 / 의존성

| 경로 | 액션 |
|---|---|
| `apps/web/src/app/globals.css` | **수정** §5.1 토큰 2종 추가 |
| `apps/web/tailwind.config.ts` | **수정** §5.2 매핑 추가 |
| `apps/web/package.json` | **수정** PR-9b 에 framer-motion / PR-9c 에 recharts 추가 |
| `docs/architecture/decisions/ADR-020.md` | **수정** §3.3 패치 + §6.x 신규 의존성 기록 |
| `apps/web/src/components/home/hero-live-panel.tsx` (시안 D) | **변경 가능성** | 코드 블록 부분만 별도 컴포넌트 추출 시 호출부 수정. 추출 안 하면 변경 없음 |

### 9.4 백엔드 / shared 패키지 영향

| 영역 | 변경 |
|---|---|
| shared `Round`, `EvaluationResult`, `MistakeItem` | 변경 없음 |
| shared `SoloSession` (있다면) | `track`, `adaptiveHistory?`, `weakAreas?` 필드 추가 |
| shared `UserStats` (있다면) | `ranked`, `practice` 두 분기로 split 또는 nested |
| API `solo.start` 시그니처 | `{ track, modes[], difficulty? }` 추가 |
| API `solo.start` / `answer` 응답 | 위 신규 필드 동봉 (track === 'practice' 시) |
| 백엔드 라운드 생성 로직 | track === 'practice' 시 적응형 난이도 알고리즘 적용 (백엔드 결정 사항 — §13) |
| 백엔드 점수 누적 로직 | track === 'practice' 시 leaderboard 비반영, `practiceStats` 만 누적 |

---

## 10. 컴포넌트 책임 (산문)

각 신규 컴포넌트의 props 와 책임을 산문으로 명시. 시그니처는 받는 에이전트 결정.

### 10.1 `<TrackSelector>` (CSR)

- **props**: `value: 'ranked' | 'practice'`, `onChange: (track) => void`, `liveUserCount?: number`
- **책임**: 두 글라스 타일 렌더, 선택 상태 시각, 키보드 좌우 화살표, `aria-radiogroup` / `aria-checked`. `liveUserCount` 가 주어지면 랭킹 타일에 라이브 배지 표시.
- **미책임**: 트랙 변경 후의 폼 분기 (상위가 처리)

### 10.2 `<ModeMultiSelect>` (CSR)

- **props**: `value: GameMode[]`, `onChange: (modes) => void`, `availableModes: GameMode[]`
- **책임**: 모드별 토글 chip 렌더, 최소 1개 강제, 라벨은 `GAME_MODE_LABELS` 사용
- **미책임**: API 호출

### 10.3 `<GlassProgressPill>` (CSR)

- **props**: `currentRound: number`, `totalRounds: number`, `track: 'ranked' | 'practice'`, `streak?: number`, `currentDifficulty?: 'EASY'|'MEDIUM'|'HARD'`, `previousDifficulty?: 'EASY'|'MEDIUM'|'HARD'`
- **책임**: 좌(라운드) + 중(progress bar) + 우(트랙별 인디케이터) 렌더. ARIA progressbar 필수.
- **미책임**: 라운드 진행 로직

### 10.4 `<CodeQuestionBlock>` (CSR or RSC — 인터랙션 없으면 RSC)

- **props**: `code: CodeLine[]`, `filename: string`, `modeLabel: string`, `currentRound: number`, `totalRounds: number`
- **책임**: 시안 D Layer 1 + 2 렌더. 신택스 매핑 (§6) 적용. `<pre><code>` + `aria-label`.
- **재사용**: 메인 시안 D `<HeroLivePanel>` 의 코드 영역과 100% 호환 — 가능하면 같은 컴포넌트로 통합

### 10.5 `<FeedbackCard>` (CSR)

- **props**: `result: EvaluationResult`, `userAnswer: string`, `rationale?: string`
- **책임**: 정/오 분기 wash, 헤더 row, 답 비교 표, 해설, `왜?` 박스, slide-up 모션, `aria-live`. 10개 뷰 상태:
  - 정/오 × (해설 있음/없음) × (rationale 있음/없음) — 8가지
  - + correctAnswer 가 배열일 때 expand UI
  - + 모드별 미세 차이 (term-match 는 `font-mono` 빼고 일반 텍스트)
- **미책임**: 다음 라운드 트리거 (상위가)

### 10.6 `<FinishedRanked>` / `<FinishedPractice>` (RSC)

- **props**: `session: SoloSession`, `stats: UserStats`
- **책임**: §3.3 의 트랙별 결과 화면 전체. recharts 컴포넌트 import.

### 10.7 `<MistakesSidebar>` (CSR)

- **props**: `filters: MistakeFilters`, `counts: { topic, week, mode, status }`, `onChange: (filters) => void`
- **책임**: 검색 input, 4 필터 그룹, 카운트 뱃지, hover/active 상태, 키보드 접근

### 10.8 `<MistakeCard>` (CSR)

- **props**: `mistake: MistakeItem`, `onResolveToggle: (id, resolved) => void`, `onRetry: (mistake) => void`
- **책임**: 헤더(메타 + 상태) + 본문(diff 코드 블록 또는 텍스트) + 액션(재도전 + 해결 토글). Framer Motion exit 애니메이션. 재도전은 `?track=practice` 로 라우팅 (랭킹 비반영).

### 10.9 `<MistakeDiffBlock>` (RSC)

- **props**: `userAnswer: string`, `correctAnswer: string`, `originalCode?: CodeLine[]`, `mode: GameMode`
- **책임**: 모드별 분기. 코드 모드 → diff 라인 (- / +). term-match → 단일 텍스트 비교. §6 diff 매핑 적용.

---

## 11. PR 분할

각 PR 독립 mergeable. 머지 후에도 페이지가 깨지지 않게 (랭킹 도전 흐름은 항상 작동 유지).

### PR-9a: config phase + 트랙 분기 + 모드 다중 선택

- 토큰 §5.1 추가
- `<TrackSelector>` / `<ModeMultiSelect>` / `<ConfigForm>` 신규
- `page.tsx` config phase 만 교체. playing / finished 는 기존 PR-8 그대로 유지 (시각적 부조화 일시적으로 OK)
- mock 데이터 `track` 추가 (백엔드 변경 전 클라이언트만 보냄, 백엔드는 무시 OK)
- ADR-020 §3.3 패치 한 줄
- **검증**: 라이트/다크, 트랙 두 상태에서 폼이 올바르게 분기, 모드 1개 강제, 키보드 접근

### PR-9b: playing phase + immersive feedback + framer-motion

- `framer-motion` 의존성 추가 + ADR
- `<GlassProgressPill>` / `<CodeQuestionBlock>` / `<TermQuestionBlock>` / `<FeedbackCard>` 신규
- `page.tsx` playing phase 교체
- mock 의 라운드 데이터 풍부화 (모드별 1~2 라운드 포함)
- **검증**: 정/오 양쪽 FeedbackCard 색감 + 모션, prefers-reduced-motion 비활성, 적응형 난이도 인디케이터 (mock 으로 ranked 와 practice 두 모드 토글 가능하게)

### PR-9c: finished phase + 차트 + 약점 분야

- `recharts` 의존성 추가 + ADR
- `<FinishedRanked>` / `<FinishedPractice>` 신규
- `page.tsx` finished phase 교체
- mock 의 `weakAreas`, `adaptiveHistory`, `practiceStats` 추가
- **검증**: 두 트랙 결과 화면 모두 렌더, 도넛/horizontal bar/step chart 라이트·다크, CTA 라우팅

### PR-9d: `/review/mistakes` + diff + Framer 카드 exit

- `<MistakesSidebar>` / `<MistakeCard>` / `<MistakeDiffBlock>` 신규
- `page.tsx` 재작성
- mock 의 mistake 데이터 (모드별 5~6 항목)
- 해결 토글 시 fade-out + height collapse
- **검증**: 사이드바 active 상태 색·보더, 카드 diff 시각, 재도전 라우팅 (`?track=practice`), 토글 모션

각 PR 머지 후 brief §15.2 외부 노트북 평가 1회.

### 백엔드 PR (별도 트랙)

본 4 PR 은 모두 mock 으로 시각 검증. **실제 트랙 분기 로직 / 적응형 난이도 알고리즘 / practiceStats 누적 / weakAreas 분석은 백엔드 PR 로 별도 진행**. 프론트엔드는 백엔드 준비되는 대로 mock → 실제 API 로 1:1 swap.

---

## 12. Acceptance criteria

PR-9d 머지 시점 기준.

**시각**:
- 4 화면 모두 시안 β 와 일치 (글라스, 코드 블록, FeedbackCard 정/오 wash, mistakes diff)
- 라이트 / 다크 모두 OK
- 모바일(`<sm`) / 태블릿(`sm~lg`) / 데스크톱(`lg+`) 3 breakpoint 깨짐 없음
- `/review/mistakes` 사이드바: 데스크톱 좌측 고정, 모바일 stack

**기능**:
- config 의 트랙 분기로 인게임·결과 화면이 올바르게 분기
- 모드 다중 선택 → 한 세션 안에 여러 모드 라운드 mix 출제 (mock 단계에서도 검증 가능)
- 적응형 난이도 인디케이터가 practice 트랙에서만 표시
- 약점 분야 / 적응형 흐름 차트가 practice 결과 화면에서만 표시
- mistakes 재도전이 항상 practice 트랙으로 진입 (점수 비반영)
- 해결 토글 → 카드 fade-out + 사이드바 카운트 즉시 갱신

**접근성** (§8):
- axe DevTools 무에러
- 트랙 타일 / 모드 chip 키보드 좌우 화살표 + space toggle
- FeedbackCard `aria-live="polite"` 정/오 텍스트 스크린리더 전달
- progress bar `role="progressbar"` 값 정확
- diff 코드 prefix + `aria-label`
- `prefers-reduced-motion` 시 모든 motion 비활성

**데이터 / 호환성**:
- 백엔드 변경 없이 mock 으로 모든 화면 작동 (PR-9a~9d 단독 검증 가능)
- 백엔드 준비 후 mock → 실제 API swap 시 컴포넌트 변경 없음
- shared 패키지 데이터 모델 변경 없음 (Round, EvaluationResult, MistakeItem)

**빌드 / 정합성**:
- `pnpm build` 통과
- Pre-commit (lint, typecheck) 통과
- shadcn/ui 외 신규 component lib 미도입
- Tailwind v3 유지
- brief §9.3 변경 불가 항목 단 하나도 안 건드림

---

## 13. 변경 / 미변경 / 안 한 것

### 13.1 변경됨

- `/play/solo` config: 4 select 단조 → 트랙 선택 + 글라스 카드 + 모드 다중 chip
- `/play/solo` playing: 평면 `<pre>` → 시안 D 코드 블록 재사용 + 빈칸 강조
- `/play/solo` playing: progress 텍스트만 → 글라스 progress pill + 트랙별 인디케이터
- `/play/solo` playing: 1px 보더 FeedbackCard → wash + 아이콘 + 점수 pill + 모션
- `/play/solo` finished: 텍스트 통계 → 도넛 + step chart + 약점 분야 (트랙별 분기)
- `/review/mistakes`: 평면 카드 → 글라스 + diff 코드 블록
- 신규 트랙 (개인 공부) + 적응형 난이도 (개인 공부 한정)
- 신규 토큰 2종 (§5.1)
- 신규 의존성 2개 (framer-motion, recharts)

### 13.2 변경 없음

- 라우트 (`/play/solo`, `/review/mistakes`)
- 인증 흐름
- shadcn/ui (Button / Card / Input / Label / Select / Switch / Dialog / DropdownMenu)
- Tailwind v3.4
- next-themes
- shared 데이터 모델 (Round / EvaluationResult / MistakeItem)
- 학습 흐름의 본질 (config → playing → finished, 라운드 즉시 피드백 → 다음)
- 메인 시안 D 의 토큰 / 글라스 / brand-gradient
- 헤더 컴포넌트
- 게스트 흐름 (인증 필수 redirect 그대로)

### 13.3 안 한 것

- MC 모드 답 입력 UI 풀구현 (brief §13 후순위 — placeholder 만)
- 캡스톤 / 실시간 대전 (brief §13 범위 외)
- SRS (간격 반복) — 별도 ADR 검토 항목
- 모바일 375px 최우선 (brief §9.3 유보)
- 트랙별 라우트 분리 (`/play/ranked` vs `/play/practice`) — 같은 라우트 + 쿼리·state 로 분기
- Tailwind v4 마이그레이션
- shadcn 외 component lib

---

## 14. 미해결 / 후속 결정

| 항목 | 상태 | 결정 시점 |
|---|---|---|
| 적응형 난이도 알고리즘 (시작 난이도, 변동 임계, EASY↔HARD 점프 가능 여부) | **백엔드 결정 사항** | PR-9c 백엔드 PR 시점. 프론트는 결과만 받아 표시 |
| 약점 분야 분석 윈도우 (이번 세션만 / 최근 5회 / 전체) | 미정 (UI 는 `이번 세션 + 최근 5회 평균` 기본 가정) | 백엔드와 같이 |
| 점수 / 랭킹 비반영 정책 — practice 점수도 별도 leaderboard 만들지? | 미정 (현재는 통계만 누적) | UX 피드백 후 |
| 트랙 전환 UX — 인게임 중 트랙 변경 가능? | **불가** (현재 결정) | 변경 없음 |
| Term-match 모드의 다중 정답 처리 | 기존 `correctAnswer: string[]` 그대로 | 변경 없음 |
| MC 모드 본격 구현 | brief §13 후순위 | Q14 진척 후 |
| SRS 도입 | brief §13 + 본 문서 §13.3 — 별도 ADR | TBD |
| Microcopy 최종 (`랭킹 도전` / `개인 공부` 라벨) | 받는 에이전트가 PR-9a 시 product 와 한 번 confirm 권장 | PR-9a 작업 시작 시 |
| 적응형 난이도 인디케이터 표현 (`EASY → MEDIUM ↑` 형태가 베스트인지 / 색·아이콘만으로 충분한지) | 시안 채택 후 검증 | PR-9b 외부 노트북 평가 |

---

## 15. 외부 도구 / 디자이너 추가 핸드오프

본 문서를 brief 와 시안 D 명세와 함께 넘길 때:

- brief §12.1 영어 prompt 끝에 한 줄 추가:
  > *Reference: see attached `play-and-mistakes-redesign-concept-beta.md` for the chosen design (Flow Glass extension of concept-d, with new track split for ranked vs practice and adaptive difficulty in practice mode).*
- 본 문서의 §1 (요약), §2 (4 화면 ASCII), §3 (영역별 스펙) 만 발췌해도 충분
- 시안 β 의 핵심은 §3.1.2 (트랙 타일) + §3.2.6 (FeedbackCard immersive) + §3.3.4 (약점 분야) 세 곳

---

## 16. 결정 / 변경 기록

| 일자 | 변경 | 출처 |
|---|---|---|
| 2026-04-28 | v1 초안 — 시안 β + 옵션 1 + 개인 공부 트랙 + 적응형 난이도 핸드오프, 다른 Claude 에이전트 향 | 본 세션 |
