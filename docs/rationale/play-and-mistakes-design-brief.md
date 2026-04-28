# 플레이 + 오답 노트 디자인 브리프 v1 (2026-04-28)

> **목적**: `/play/solo` (config / playing / finished) 와 `/review/mistakes` 페이지를
> 외부 디자인 도구(v0.dev / Magic UI / 21st.dev / TweakCN / Figma / ChatGPT / Claude
> Artifacts) 또는 외부 디자이너에게 그대로 컨텍스트로 전달 가능한 형태로 정리한다.
>
> 본 문서는 **메인 페이지 시안 D 채택 후의 통합 디자인 시스템 시점** 에서 작성되며,
> 메인 페이지 디자인 브리프(`main-page-design-brief.md`) + 시안 D 명세
> (`main-page-redesign-concept-d.md`) 의 **연장선**으로 읽어야 한다.
>
> 즉 "메인 시안 D 톤(Apple Vision 글라스 + brand-gradient + `bg-code`/`syntax-blank`
> 토큰)" 을 게임 흐름 / 오답 흐름 전체에 일관되게 확장하는 것이 본 브리프의 목표.

---

## 1. 프로젝트 한 줄 (one-liner)

**Oracle DBA 학습 게임** — Oracle DBA 부트캠프 수강생(~20명) 이 SQL/PL-SQL 용어·문법·함수를
게임으로 외우는 학습 플랫폼. 본 문서가 다루는 두 페이지는 **학습 활동의 핵심 흐름**:

- `/play/solo` — 솔로 퀴즈 (현재 빈칸 타이핑 + 용어 맞추기 2 모드, MC + 결과 예측 + 카테고리 분류 + 시나리오 시뮬레이션 확장 예정)
- `/review/mistakes` — 오답 노트 (틀린 문제 다시 보기 + 검색 + 필터 + 상태 토글)

영어 한 줄: *Solo quiz play flow + mistake review notebook for an Oracle DBA bootcamp
gamified learning platform (~20 Korean students).*

---

## 2. 사용자 페르소나

`main-page-design-brief.md` §2 와 동일. 추가:

| 항목 | 값 |
|---|---|
| 학습 세션 길이 | 5~15분 (라운드 10개 ≈ 7~10분) |
| 동시 사용 | 1명 (실시간 대전 후순위) |
| 학습 동기 | 부트캠프 진도 + 성취감(점수/연속 정답) |
| 좌절 포인트 | 답 입력 후 정/오 피드백이 늦으면 학습 흐름 끊김, 오답 다시 보기 어려움 |

---

## 3. 현재 페이지 구조

### 3.1 `/play/solo` — phase: `config` (시작 화면)

```
┌─────────────────────────────────────────────────────────┐
│  Header (메인과 동일 — sticky 아님)                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  솔로 플레이 설정 (h1, 1.75rem)        [📚 오늘 복습 N건]  │
│  ─────────────────────────                              │
│                                                         │
│  주제                                                    │
│  ┌──────────────────────────────────┐                   │
│  │ SQL 기본 ▼                        │ ← <select>       │
│  └──────────────────────────────────┘                   │
│                                                         │
│  주차                                                    │
│  ┌──────────────────────────────────┐                   │
│  │ 1                                  │ ← <input number>  │
│  └──────────────────────────────────┘                   │
│                                                         │
│  게임 모드                                                │
│  ┌──────────────────────────────────┐                   │
│  │ 빈칸 타이핑 ▼                       │                   │
│  └──────────────────────────────────┘                   │
│                                                         │
│  난이도                                                   │
│  ┌──────────────────────────────────┐                   │
│  │ EASY ▼                            │                   │
│  └──────────────────────────────────┘                   │
│                                                         │
│  [ 시작하기 ]  ← bg-brand                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**현재 한계**:
- inline `style={{}}` 도배, shadcn 컴포넌트 미적용
- 4개 select 가 단조 — 어떤 주제를 고를지 시각적 가이드 없음
- `ReviewBadge` 가 우상단에 외로이 떠있음
- 시작 버튼 외 콜투액션 없음

### 3.2 `/play/solo` — phase: `playing` (인게임)

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  라운드 3 / 10                                            │
│                                                         │
│  ┌─ ContextPanel ─────────────────────────────────┐     │
│  │ 📋 상황: 직원 테이블에서 부서별 평균 급여 조회      │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  ┌─ Question Block (모드별 다름) ───────────────────┐    │
│  │ blank-typing (코드 with [____] 빈칸):             │    │
│  │   SELECT department_id, [____](salary)            │    │
│  │   FROM employees                                  │    │
│  │   GROUP BY department_id;                         │    │
│  │                                                   │    │
│  │ term-match (한 줄 설명):                           │    │
│  │   "행을 그룹화한 뒤 각 그룹마다 평균 값을 계산"     │    │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  [______________ 정답 입력 _____________________] ← input│
│                                                         │
│  [ 제출 ]  [ 힌트 보기 (1/2) ]                            │
│                                                         │
│  hintsUsed > 0 시:                                       │
│  ┌─ Hints (ul) ─────────────────────────────────┐       │
│  │ • 그룹화된 행에서 작동하는 집계 함수입니다        │       │
│  └──────────────────────────────────────────────┘       │
│                                                         │
│  showingFeedback (제출 후) 시:                            │
│  ┌─ FeedbackCard ─────────────────────────────────┐     │
│  │ ✓ 정답 (+10점)                                   │     │
│  │ 내 답:    AVG                                    │     │
│  │ 정답:     AVG                                    │     │
│  │ 해설:    SQL의 평균 집계 함수는 AVG 입니다.      │     │
│  │ 💡 왜?:  GROUP BY 와 함께 사용하면 그룹마다 평균을 │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  [ 다음 라운드 → ]  ← Enter 키도 동작                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**현재 한계**:
- 코드 블록이 `<pre>` 평면 — 빈칸 `[____]` 시각 강조 없음
- 라운드 진행 progress bar 없음 (텍스트 "3 / 10" 만)
- FeedbackCard 색조는 정/오 1px 보더만 — 카드 전체 정/오 컬러 immersion 부족
- 힌트 UI 가 단순 ul — 학습 중 시선 분산
- `<input>` 이 단조 — 코드 입력인지, 단어 입력인지 모드별 시각 차이 없음

### 3.3 `/play/solo` — phase: `finished` (결과 화면)

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  게임 종료 (h1)                                            │
│                                                         │
│  정답률: 7 / 10 (70%)                                     │
│  이번 세션 점수: 65                                        │
│                                                         │
│  ┌─ 누적 진도 (bg-elevated) ──────────────────────┐      │
│  │ 누적 진도                                       │      │
│  │ 총 점수: 1240                                   │      │
│  │ 플레이 횟수: 18                                  │      │
│  │ 누적 정답률: 78%                                  │      │
│  │ 현재 연속 정답: 4                                 │      │
│  └──────────────────────────────────────────────┘      │
│                                                         │
│  [ 다시 플레이 ]                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**현재 한계**:
- 결과 시각화 없음 — 정답률만 텍스트 (도넛/막대 차트 없음)
- "취약 분야 분석" 부재 (어떤 모드/주제에서 틀렸는지)
- "다시 플레이" 외 콜투액션 없음 (오답 노트 가기 / 다른 모드 / 홈)
- 누적 진도가 정적 텍스트 4행 — 변화 시각화 없음

### 3.4 `/review/mistakes` — 오답 노트

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                 │
├─────────────────────────────────────────────────────────┤
│  ┌── Sidebar (≥1024px lg, 좌측 고정) ──┐ ┌── Main ──────┐│
│  │ 🔍 검색                               │ │ [정렬 ▼]      ││
│  │ ┌──────────────────────┐              │ │              ││
│  │ │ keyword …            │              │ │ 활성 필터:    ││
│  │ └──────────────────────┘              │ │ [주제: SQL…] ││
│  │                                       │ │ [주차: 1]    ││
│  │ 📚 주제                               │ │ [상태: 미해결]││
│  │ • 전체     (32)                       │ │ [✕ 초기화]    ││
│  │ • SQL 기본  (18)                      │ │              ││
│  │ • 트랜잭션  (14)                      │ │ ┌─ Card ─┐    ││
│  │                                       │ │ │ Q: …   │    ││
│  │ 📅 주차                               │ │ │ 내 답: │    ││
│  │ • 1   (12)                           │ │ │ 정답:  │    ││
│  │ • 2    (8)                           │ │ │ 해설:  │    ││
│  │                                       │ │ │ [재도전]│    ││
│  │ 🎮 모드                               │ │ │ [해결]  │    ││
│  │ • 빈칸 타이핑 (15)                     │ │ └────────┘    ││
│  │ • 용어 맞추기 (12)                      │ │              ││
│  │                                       │ │ ┌─ Card ─┐    ││
│  │ 🚨 상태                               │ │ │ ...    │    ││
│  │ • 전체    (32)                       │ │ └────────┘    ││
│  │ • 미해결   (24)                       │ │              ││
│  │ • 해결됨    (8)                       │ │ [< 1 2 3 >]  ││
│  └───────────────────────────────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────┘
```

**현재 한계**:
- 사이드바 단순 리스트 — hover/active 상태 강조 약함
- 카드 한 줄 텍스트 위주 — 코드 블록 시각화 없음, 빈칸 강조 없음
- "재도전" / "해결됨 토글" 등 상태 변화 후 시각 피드백 약함
- 검색 + 필터 다중 활성 시 복잡도 증가 (UX 부담)
- mobile <1024px 에서 사이드바가 상단 스택 → 스크롤 길어짐

### 콘텐츠 인벤토리

| 영역 | 텍스트 | 변경 가능 여부 |
|---|---|---|
| 솔로 설정 h1 | "솔로 플레이 설정" | ✅ |
| ReviewBadge | "오늘 복습 N건" | ✅ 표현만 |
| 주제 라벨 | TOPIC_LABELS (sql-basics 등) | ❌ shared 패키지 |
| 모드 라벨 | GAME_MODE_LABELS | ❌ shared 패키지 |
| 인게임 라운드 헤더 | "라운드 X / Y" | ✅ |
| FeedbackCard | "✓ 정답" / "✕ 오답" / "(+점수)" | ✅ |
| 힌트 라벨 | "힌트 보기 (n/m)" | ✅ |
| 결과 h1 | "게임 종료" | ✅ |
| 결과 통계 | 정답률 / 점수 / 누적 진도 4행 | ✅ |
| 오답 사이드바 헤더 | 🔍 / 📚 / 📅 / 🎮 / 🚨 | ✅ 이모지/아이콘 |
| 오답 카드 액션 | "재도전" / "해결됨" 토글 | ✅ |

---

## 4. 사용자 평가 — 현재 시각적 약점

각 페이지마다 우선 검증 대상:

### 4.1 `/play/solo` config
- **단조 select 4개** — 시안 D 의 시각적 풍부함과 대비됨
- **시작 버튼만 큰 CTA** — "오늘 복습", "추천 주차" 같은 보조 콜투액션 부재
- **ReviewBadge 가 외로이** — 헤더와 뗀 위치가 어색

### 4.2 `/play/solo` playing
- **코드 블록 평면** — 시안 D Hero 의 `bg-code`/`syntax` 토큰을 재사용하지 않은 채 단순 `<pre>`
- **빈칸 `[____]` 강조 없음** — 어디를 채워야 하는지 시각 anchor 부족 (시안 D `--syntax-blank` 가 정확히 이 용도)
- **진행 progress 미시각화** — 텍스트 "3 / 10" 만, 색 막대/원 등 progress bar 없음
- **FeedbackCard 정/오 색조 약함** — 1px 보더만, 카드 전체 immersive feedback 부재
- **힌트 ul** — 학습 흐름 끊김

### 4.3 `/play/solo` finished
- **결과 시각화 부재** — 도넛/막대 차트 / streak 시각화 / 약점 분야 모두 없음
- **콜투액션 단일** — 다시 플레이 외 오답 노트 / 다른 주차 / 홈 등 분기 없음

### 4.4 `/review/mistakes`
- **사이드바 카운트 뱃지가 단조** — hover/selected 상태 시각화 약함
- **카드 본문 텍스트 위주** — 코드 블록 syntax highlight 없음 (시안 D 톤 미사용)
- **상태 토글 후 사라지는 카드의 motion 없음** (해결됨 → 카드 fade-out 등)

---

## 5. 기술 스택 / 제약 (변경 불가)

`main-page-design-brief.md` §5 와 동일.

추가:

| 항목 | 값 | 변경 가능 여부 |
|---|---|---|
| 인게임 상태 관리 | useState 5+ 개 (rounds/results/phase/...) | ❌ 구조 |
| API 시그니처 | `apiClient.solo.start/answer/finish/reviewQueue` + `apiClient.users.mistakes` | ❌ |
| 라운드 데이터 | `Round[]` (shared) — `question.content.{type, sql/description}` + `hints[]` + `scenario` + `rationale` | ❌ schema |
| EvaluationResult | `{isCorrect, score, correctAnswer[], explanation?}` | ❌ schema |
| MistakeItem | `{question, mistakeCount, lastFailedAt, status, ...}` | ❌ schema |
| 답 입력 | 현재 단일 `<input type="text">`. **MC 모드 도입 시 button 그룹 필요** (Q14 동안에는 후순위) | ⚠ 확장 |

> **핵심**: 데이터 모델 / API / 학습 흐름은 변경 불가. 시각 표현 / 모션 / 컴포넌트 분해만 자유.

---

## 6. 디자인 토큰 (시안 D 토큰 + 신규 후보)

### 6.1 시안 D 에서 이미 도입된 토큰 (재사용)

ADR-020 §3.3 + PR-8b 시안 D 합의 (`main-page-redesign-concept-d.md` §5):

```css
/* PR-2 hex (페이지 / 일반 영역) */
--bg, --bg-elevated, --fg, --fg-muted, --brand, --brand-fg,
--success, --error, --border

/* PR-8b 시안 D 신규 (코드 블록 / 빈칸 / 그라디언트) */
--brand-strong          /* light #0369a1 / dark #0ea5e9 */
--code-bg               /* always-dark #0f172a */
--code-tab-bg           /*               #1e293b */
--syntax-blank          /*               #fde047 (yellow-300) */
--syntax-blank-fg       /*               #422006 */
```

Tailwind 매핑: `bg-brand-gradient` (135deg, brand → brand-strong), `bg-code`, `bg-code-tab`, `text-syntax-blank`, `bg-syntax-blank`, `grid-cols-20`.

### 6.2 인게임 코드 블록 = 시안 D Hero code panel 의 자연 확장

**가장 큰 시각 가치**: 시안 D 의 Hero 우측 3-layer 패널 (`bg-code` 라인 넘버 + syntax 색상 + `--syntax-blank` 빈칸 강조) 을 **그대로 인게임 라운드 코드 블록에 사용**.

```jsx
{/* 현재 (단순 <pre>): */}
<pre style={{ background: 'var(--bg-elevated)', padding: '1.25rem' }}>
  SELECT department_id, [____](salary) FROM employees;
</pre>

{/* 시안 D 톤 적용 후 (예시): */}
<div className="bg-code rounded-xl border border-white/5 overflow-hidden">
  <div className="bg-code-tab px-4 py-2 text-xs text-fg-muted">
    <span className="size-2 rounded-full bg-success-500 inline-block mr-2" />
    quiz.sql · 빈칸 타이핑 · EASY
  </div>
  <pre className="p-4 text-sm leading-relaxed">
    <code>
      <span className="text-purple-400">SELECT</span>{' '}
      <span className="text-sky-400">department_id</span>,{' '}
      <span className="bg-syntax-blank text-syntax-blank-fg px-1 rounded">[____]</span>
      (<span className="text-sky-400">salary</span>) ...
    </code>
  </pre>
</div>
```

빈칸 강조가 시안 D 의 `--syntax-blank` 토큰과 완벽히 매칭. 메인 페이지 → 인게임 → 오답 카드까지 동일 코드 블록 시각으로 일관성.

### 6.3 신규 후보 토큰 (시안 D 외 — 인게임 특유)

| 토큰 | 용도 | 제안 값 (light/dark) |
|---|---|---|
| `--feedback-correct-bg` | FeedbackCard 정답 배경 (`bg-success/10`) | `rgba(22,163,74,0.10) / rgba(74,222,128,0.10)` |
| `--feedback-incorrect-bg` | FeedbackCard 오답 배경 (`bg-error/10`) | `rgba(220,38,38,0.10) / rgba(248,113,113,0.10)` |
| `--syntax-keyword` | SELECT / FROM / WHERE 등 키워드 색 (`text-purple-400` 매핑) | tailwind `purple-700 / purple-400` |
| `--syntax-fn` | 함수명 색 (`text-sky-400`) | tailwind `sky-700 / sky-400` |
| `--progress-track` | 라운드 진행 bar 트랙 | `bg-bg-elevated` |
| `--progress-fill` | 라운드 진행 bar 채움 | `bg-brand-gradient` |

> 토큰 추가는 ADR-020 §3.3 변경 기록 필수. 시안 채택 후 PR 분할 단계에서 결정.

---

## 7. 인터랙션 / 모션 (현재)

| 위치 | 효과 | duration |
|---|---|---|
| 헤더 / 메인 / 카드 | `main-page-design-brief.md` §7 와 동일 | — |
| 인게임 입력창 | 평범한 `<input>` focus | brand 토큰 transition |
| 제출 버튼 | `submitting` 시 opacity 0.5 + cursor wait | 즉시 |
| FeedbackCard | 등장 시 motion 없음 (마운트 즉시) | — |
| 오답 카드 상태 토글 | 즉시 갱신 (motion 없음) | — |
| 사이드바 필터 hover | bg 변경만 (Tailwind transition-colors) | 150ms |

**확장 여지**:
- FeedbackCard `aria-live="polite"` 등장 시 0.2s slide-up + 정/오 컬러 wave (정답: `success-500` glow / 오답: `error-500` shake)
- 라운드 progress bar 채움 transition (300ms ease-out)
- "다음 라운드" 진입 시 cross-fade
- 오답 카드 "해결됨" 토글 시 fade-out + height collapse

신규 motion 도입 시 ADR-020 §3.3 또는 별도 §추가 필요.

---

## 8. WCAG 2.1 AA 요구사항 (변경 불가)

`main-page-design-brief.md` §8 와 동일 + 추가:

| 기준 | 인게임 / 오답 페이지 특화 |
|---|---|
| 1.4.3 대비비 | `--syntax-blank` (yellow-300) 위 텍스트 → 어두운 `--syntax-blank-fg` 4.5:1+ 검증됨. 신규 syntax 색 추가 시 light/dark 양쪽 검증 |
| 1.4.1 색만으로 정보 전달 금지 | FeedbackCard 정/오는 **색 + 아이콘(✓/✕) + 텍스트** 3중 인코딩. 시안 변경 시 유지 의무 |
| 2.1.1 Keyboard | 인게임 input → Enter 로 제출 → Enter 로 다음 (현재 OK). 시안 변경 시 유지 |
| 2.4.7 Focus Visible | 모든 button / select / input 에 ring |
| 3.3.1 Error Identification | API 에러 → `role="alert"` 단일 사용 |
| 4.1.3 Status Messages | FeedbackCard `aria-live="polite"`, ReviewBadge silent (0건 표시) |

**사이드바 + 코드 블록 특화**:
- 사이드바 카운트 뱃지: 색만으로 활성 상태 표시 금지 (border / background / weight 조합)
- 코드 블록 syntax: 색 외 monospace 폰트로 코드 vs 일반 텍스트 구분

---

## 9. 변경 허용 범위

### 9.1 자유롭게 변경 가능

- ✅ `/play/solo` config — select 4개를 카드 그리드 / 칩 / 라디오 그룹 등으로 표현
- ✅ 인게임 코드 블록 시각화 (syntax highlight, 빈칸 강조, 라인 넘버 등)
- ✅ FeedbackCard 정/오 immersive 색감 (배경 wash, glow, motion)
- ✅ 라운드 progress bar / step indicator
- ✅ 결과 페이지 차트 (도넛 / 막대 / radial / streak heatmap)
- ✅ 오답 카드 레이아웃 (현재 텍스트 위주 → 코드 블록 + 정/오 시각)
- ✅ 사이드바 hover/active 상태 강조 (글라스 / pill / 보더 강조)
- ✅ 새 섹션 추가 (예: "취약 분야 추천 주차", "이번 세션 streak", "오답 패턴 분석")
- ✅ Framer Motion 도입 (ADR 한 줄)

### 9.2 변경 시 ADR 패치 / 합의 필요

- ⚠ 신규 토큰 추가 (§6.3 후보 등) → ADR-020 §3.3 변경 기록
- ⚠ 새 dependency (chart 라이브러리, motion lib 등) → ADR-020 §6.x 또는 별도 ADR
- ⚠ MC 모드 답 입력 UI (button 그룹) — Q14 가 도입 결정 시점

### 9.3 변경 불가 (확정)

- ❌ Tailwind v3 → v4
- ❌ shadcn 외 component lib
- ❌ 모바일 375px 최우선 (Q12=a 유보, mistakes 사이드바는 ≥1024px lg 우선)
- ❌ 학습 흐름 (config → playing → finished, 라운드 즉시 피드백 → 다음 라운드)
- ❌ API 시그니처 / 데이터 모델
- ❌ shared 패키지의 TOPIC_LABELS / GAME_MODE_LABELS

---

## 10. 메인 시안 D 와의 일관성 (필수 유지점)

본 작업은 **시안 D 의 통합 디자인 시스템 확장** 이므로 다음을 유지해야 한다:

| 영역 | 시안 D 결정 | 본 페이지에서의 적용 |
|---|---|---|
| 톤 | Apple Vision 글라스 (`backdrop-blur-2xl border-white/15 ring-1 ring-inset`) | config / FeedbackCard / 오답 사이드바 / 카드 컨테이너 |
| 페이지 배경 | `body::before` radial-gradient 글라스 블롭 (`globals.css`) | 메인과 동일 — 본 페이지 변경 없음 |
| 코드 블록 | `bg-code` always-dark + `bg-code-tab` + syntax + `--syntax-blank` | 인게임 + 오답 카드의 코드 블록 |
| Primary 강조 | `bg-brand-gradient` (135deg brand → brand-strong) | 시작 버튼 / 다음 라운드 / 다시 플레이 |
| Hover | `-translate-y-0.5 + border-brand/40` | 사이드바 항목 / 오답 카드 |
| 뱃지 / 액티브 | `bg-brand/10` highlight (시안 D Ranking 카드 내 위치 패턴) | 사이드바 active 항목 / FeedbackCard 정답 강조 |
| 게스트 분기 | 시안 D 가 `isGuest` 분기 처리 | `/play/solo` / `/review/mistakes` 는 인증 필수, 게스트 → `/login` redirect (현재 동작) |

**원칙**: 시안 D 의 시각 언어를 새 페이지가 깨뜨리지 않도록 — 색감 / blur 강도 / 라운딩 / 그라디언트 방향 일관.

---

## 11. 영감원 후보

`main-page-design-brief.md` §10 + 추가:

| 영역 | 사이트 | 본 페이지 영감 포인트 |
|---|---|---|
| 학습 / 퀴즈 | Anki, Duolingo, Brilliant.org, Khan Academy | 라운드 진행 progress + 정/오 즉시 피드백 톤 |
| 코드 학습 | Codecademy, Frontend Mentor, Codewars, LeetCode | 인게임 코드 블록 syntax highlight + 빈칸 강조 |
| 오답 / 노트 | Anki review screen, Notion sidebar, Linear inbox | 사이드바 필터 + 카드 카운트 뱃지 |
| 데이터 시각화 | Tremor, recharts, victory, Cal.com analytics | 결과 페이지 차트 |
| 게임 result 화면 | Wordle, Duolingo end-of-lesson, Sudoku 결과 | finished phase 임팩트 + streak 표현 |

**우리에게 적합한 인게임 분위기**:
- 한국어: 집중되는 / 학습 흐름이 끊기지 않는 / 정/오 임팩트 있는 / 부담 없는
- 영어: *focused, flow-preserving, immediate feedback with personality, low-pressure*

**피해야 할 분위기**:
- 게임 점수 폭죽 / 캐릭터 응원 (학습 톤 깨짐)
- 다크/네온 hacker (가독성 저하)
- 시험 같은 차가운 enterprise (부담 증가)

---

## 12. 외부 도구 prompt 템플릿

### 12.1 v0.dev / Magic UI / Claude Artifacts 용 (영어)

```
Design 4 connected screens for "Oracle DBA Study Game", a gamified Korean SQL/PL-SQL
learning platform for ~20 bootcamp students. The home page already uses an
"Apple Vision glass" tone (see attached concept-d spec) — these new screens MUST
extend the same visual language.

Screens to design (each as separate Next.js 14 RSC component, except where noted):

1. /play/solo (config phase) — quiz setup
   - h1 "솔로 플레이 설정"
   - 4 inputs: 주제 (topic, dropdown), 주차 (week number), 게임 모드 (dropdown),
     난이도 (EASY/MEDIUM/HARD)
   - Right side: ReviewBadge ("오늘 복습 N건")
   - Primary CTA: "시작하기" (start button, brand-gradient)
   - Optional: secondary CTAs ("오늘의 추천 주차", "최근 오답 다시 보기")

2. /play/solo (playing phase) — in-game
   - "라운드 X / Y" header + progress bar
   - ContextPanel (📋 상황: ...) — already exists, glass extension
   - Question block: code block (blank-typing mode) OR plain text (term-match mode)
       - blank-typing: SQL with "[____]" — MUST use --syntax-blank token (yellow-300)
       - terms: Korean description sentence
   - Single text input for answer
   - Buttons: "제출" + "힌트 보기 (n/m)"
   - After submit: FeedbackCard (✓ 정답 / ✕ 오답 + 점수 + 내 답 + 정답 + 해설 + 💡 왜?)
       - immersive correct/incorrect color wash (not just 1px border)
       - aria-live="polite" + slide-up motion
   - "다음 라운드 →" button (Enter key works too)

3. /play/solo (finished phase) — result
   - h1 "게임 종료"
   - Score block: 정답률 X/Y (Z%) + 이번 세션 점수
   - 누적 진도 panel: 총 점수 / 플레이 횟수 / 누적 정답률 / 현재 연속 정답
   - PRIMARY suggestion: visualize results (donut/bar/radial chart) for accuracy +
     streak. Highlight weak topics if possible.
   - CTA: "다시 플레이" + secondary "오답 노트로 가기" / "다른 주차 도전"

4. /review/mistakes — mistake review notebook (CSR, has filters)
   - Left fixed sidebar (≥1024px): 🔍 search + 📚 topic filter + 📅 week filter +
     🎮 mode filter + 🚨 status filter (각 항목에 카운트 뱃지)
   - Right main: sort dropdown + active filter chips + card list + pagination
   - Card per mistake: question content + 내 답 + 정답 + 해설 + status toggle
       (미해결/해결됨) + "재도전" button → routes to /play/solo with prefilled context
   - <1024px: sidebar stacks on top

Tech constraints:
- Tailwind CSS v3.4 only (no CSS-in-JS), darkMode: "class"
- shadcn/ui (Button, Card, Input, Label, Dialog, DropdownMenu already installed)
- next-themes (light default + manual + system)
- lucide-react icons
- Framer Motion OK (will add via ADR)

Design tokens (must use):
- (PR-2 hex) --bg, --bg-elevated, --fg, --fg-muted, --brand (#0284c7/#38bdf8), --success, --error, --border
- (PR-8b 시안 D) --brand-strong, --code-bg (#0f172a always-dark), --code-tab-bg,
  --syntax-blank (#fde047), --syntax-blank-fg (#422006)
- Tailwind classes: bg-brand-gradient (135deg), bg-code, bg-code-tab, bg-syntax-blank,
  grid-cols-20

Visual continuity REQUIRED with home page (see concept-d):
- Apple Vision glass: bg-bg-elevated/55 backdrop-blur-2xl border-white/15 ring-1
  ring-inset ring-white/10 + brand-tinted shadow
- body::before pseudo-element radial-gradient blob already provides page background
- code block: bg-code (always-dark, never inverts) + bg-code-tab top bar + syntax colors

Mood: focused, flow-preserving, immediate feedback with personality, low-pressure.
NOT: cartoonish celebration, neon hacker, cold enterprise.

Accessibility: WCAG 2.1 AA contrast in BOTH light and dark modes, focus-visible ring,
keyboard navigation (Enter to submit/next), role=alert for errors,
aria-live="polite" for feedback, color-blind safe (color + icon + text triple encoding).

Current weakness to address:
- Plain <pre> code blocks (no syntax highlight, no blank emphasis)
- Flat select dropdowns (no visual hint about topic content)
- No round progress visualization (only "3 / 10" text)
- FeedbackCard correct/incorrect distinction is just 1px border (low immersion)
- Result page has zero charts (text only)
- Mistake card body is text-only (no code visualization)

Deliver: full Tailwind utility component code per screen. Make it visually memorable
while staying minimal. Be aggressive on syntax highlighting and feedback immersion.
Mobile <1024px reflows acceptable but desktop-first.
```

### 12.2 ChatGPT / Claude 비교 prompt (한국어)

```
다음은 우리 프로젝트의 두 페이지 디자인 브리프야.
[docs/rationale/play-and-mistakes-design-brief.md 본문 첨부]
또한 이미 채택된 메인 페이지 시안:
[docs/rationale/main-page-redesign-concept-d.md 본문 첨부]

이 제약 + 이미 채택된 시안 D 의 톤 안에서, /play/solo 의 3 phase
(config / playing / finished) + /review/mistakes 4 화면을 통합 디자인 시스템으로
다시 설계해서 구체적인 시안 3개를 제안해줘.

각 시안은 다음 형식으로:
1. 한 줄 컨셉 (시안 D 와 어떻게 호응하는지 명시)
2. /play/solo config 변경 (4 select → 어떻게 표현)
3. /play/solo playing 변경 (코드 블록 syntax / progress / FeedbackCard immersion)
4. /play/solo finished 변경 (결과 시각화 / 차트 / streak)
5. /review/mistakes 변경 (사이드바 / 카드 / 상태 토글 motion)
6. 사용한 토큰 / 신규 토큰 (시안 D 토큰 재사용 + 신규)
7. 신규 dependency (Framer Motion / chart / 등) — 있으면 명시
8. 예상 사용자 체감 변화
9. 구현 난이도 (S/M/L) per 화면

평가 기준: 시안 D 와의 일관성 > 새로움. 동일한 토큰/glass/code 톤이 4 화면에 자연스럽게 흐르는가.
```

### 12.3 Figma / 디자이너 핸드오프 용

이 문서 + 다음을 함께 전달:
- 현재 4 화면 캡처 (light/dark, 1440px) — config / playing / finished / mistakes
- `main-page-redesign-concept-d.md` (시안 D 명세) + 시안 D 머지 후 실제 메인 캡처
- shadcn 설치 컴포넌트 목록 (`components/ui/` 디렉토리)

**디자이너에게 명확히 전달할 것**:
- "메인 페이지가 시안 D 톤으로 이미 머지됨 — 본 4 화면이 같은 시각 언어 안에 있어야 함"
- "Tailwind utility + 기존 토큰(시안 D 포함) 으로 표현 가능한 범위"
- "코드 블록은 시안 D Hero 의 3-layer code panel 을 그대로 차용 가능"
- "shadcn Button/Card/Input/Label 등은 기본 형태 유지, 글라스/그라디언트/모션만 추가"
- "light/dark 둘 다 그려야 함"
- "정/오 피드백은 시안 D 톤 안에서 immersive 하게"

---

## 13. 미해결 / 후속 검토 항목

| 항목 | 상태 | 근거 |
|---|---|---|
| MC (Mode 6 객관식) 답 입력 UI | 후순위 (Q14) | MVP-A 완료, 시각만 미결 |
| 캡스톤 (MVP-C) 화면 | 본 brief 범위 외 | 별도 brief 필요 |
| 실시간 대전 (ADR-015) | 후순위 | 사용자 결정 2026-04-17 |
| 결과 차트 라이브러리 | 미정 | recharts vs Tremor vs SVG 직접 — 시안 결정 후 ADR |
| Framer Motion | 미정 | 채택 시 ADR-020 §6.x |
| 모바일 <1024px reflow | best-effort | Q12=a 유보 |

---

## 14. 결정 / 변경 기록

| 일자 | 변경 | 출처 |
|---|---|---|
| 2026-04-28 | v1 초안 작성 — `/play/solo` 3 phase + `/review/mistakes` 통합 brief, 시안 D 톤 확장 강조 | 본 세션 |

---

## 15. 다음 단계 (이 브리프를 받은 사람의 행동)

### 15.1 외부 도구 / 디자이너에게 전달 시

1. 본 문서 그대로 전달 (한국어 가능 / 영어 prompt 만 발췌도 OK)
2. **반드시 함께 전달**: `main-page-redesign-concept-d.md` (시안 D 명세) + 시안 D 머지 후 실제 메인 페이지 캡처
3. `apps/web/src/app/play/solo/page.tsx` (638 LOC) + `apps/web/src/app/review/mistakes/page.tsx` (678 LOC) 현재 코드도 함께
4. 시안 1~3개 받기 → 본 프로젝트 컨텍스트 (학생 ~20명 / 학습 톤 / 시안 D 일관성) 평가

### 15.2 시안 채택 후

1. 새 명세 문서 작성 (`docs/rationale/play-and-mistakes-redesign-concept-{X}.md`) — 시안 D 명세 형식 차용 (15 섹션)
2. ADR-020 §3.3 또는 §6 변경 기록 (신규 토큰 / 신규 dependency)
3. **단계 분할 PR 진행** (사용자 결정 채택):
   - PR-9a — `/play/solo` config phase + 토큰 추가 + 신규 컴포넌트 분해
   - PR-9b — `/play/solo` playing phase + 인게임 코드 블록 syntax + FeedbackCard immersion
   - PR-9c — `/play/solo` finished phase + 결과 차트 (의존성 추가 시 ADR)
   - PR-9d — `/review/mistakes` 사이드바 + 카드 + 상태 토글 motion
4. 각 PR 마다 pre-commit + build + 컨테이너 검증 + tailscale 외부 노트북 평가
