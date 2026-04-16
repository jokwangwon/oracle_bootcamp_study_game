# ADR-012: `answerFormat` 축 직교 확장 + 객관식 모드 신설

**상태**: Accepted
**날짜**: 2026-04-16
**의사결정자**: 3+1 에이전트 합의 + 사용자 최종 결정
**관련 합의**: `docs/review/consensus-004-problem-format-redesign.md`
**관련 ADR**: ADR-008 (기술 스택), ADR-013 (3단 채점), ADR-014 (캡스톤), ADR-015 (실시간)

---

## 맥락 (Context)

Oracle DBA 학습 게임 SDD v2.8은 5개 게임 모드(빈칸타이핑/용어맞추기/결과예측/카테고리분류/시나리오시뮬레이션)를 정의한다. 2026-04-16 사용자가 SQLD 시험 대비 사이트(데이터에듀/이기적 등)와 코딩 테스트 플랫폼의 **문제 형태 다양성**을 본 프로젝트에 도입할 것을 요청했다.

3+1 합의(consensus-004) 결과 세 에이전트 모두 "새 문제 형태 추가"에 찬성했으나, 다음 세 갈래로 제안이 갈렸다:

- **Agent A**: `answerFormat` 컬럼을 모드 축과 독립 도입 (직교 분리)
- **Agent B**: Mode 1 HARD / Mode 3 / Mode 5가 이미 작성형 맹아 — 기존 모드 하위모드 승격
- **Agent C**: 5모드를 기초/실전 트랙으로 재배치

사용자 최종 결정:

> "**주차와 별개로 문제 유형이 추가되는 것**입니다."

→ 트랙 분리 거부. 5모드는 그대로 유지하되, **답안 형식(answerFormat) 축**을 직교로 추가.

## 결정 (Decision)

**기존 5개 `GameMode`를 전면 유지하고, `answerFormat` 축을 Question 엔티티에 직교 축으로 신설한다.**

### 축 정의

```
GameMode × AnswerFormat (N × M 자유 조합)

GameMode:
  - blank-typing
  - term-match
  - result-predict
  - category-sort
  - scenario-sim
  - multiple-choice  ← 신규 (객관식 전용)

AnswerFormat:
  - single-token      (기존 빈칸타이핑 기본)
  - free-form         (자유 SQL 작성)
  - multiple-choice   (4지선다 / N지선다)
  - reorder           (쿼리 절 재배열)
  - drag-compose      (토큰 풀 → 문장 조립)
  - output-select     (여러 결과 테이블 중 정답 선택)
```

### 구현 범위

1. **`packages/shared/src/types/game.ts`** — `GAME_MODE_IDS`에 `'multiple-choice'` 추가.
2. **`packages/shared/src/types/question.ts`** — `QuestionContent` discriminated union에 `MultipleChoiceContent` 추가.
3. **`Question` 엔티티** — `answer_format` 컬럼(not null, default `'single-token'`).
4. **Strategy Pattern** — `MultipleChoiceMode` 신설 (`apps/api/src/modules/game/modes/multiple-choice.mode.ts`).
5. **기존 모드 variant** — Mode 1(BlankTyping)에 `variant: 'multi-blank' | 'reorder' | 'select-compose'`를 `QuestionContent` 내부 옵션으로 허용.
6. **AI 콘텐츠 파이프라인** — `output-schemas.ts`에 `multipleChoiceOutputSchema` + `answerFormat` 분기 prompt 추가.
7. **promptfoo** — 객관식 전용 assertion `mc-option-consistency` 신설 (R3 스위트 대상).

### 주차 제한 정책

**트랙 분리 없음.** 주차별 제한은 기존 `week_min` 메커니즘(문제 생성 시점 `week`/`topic` 필터) 그대로 유지. `answerFormat`은 모든 주차에 동일하게 적용 가능하며, 실제 문제 분포는 **시드 데이터 정책**으로 조정한다(예: 1주차에는 객관식 비중 높게).

## 선택지 (Options Considered)

### 선택지 A: `answerFormat` 직교 축 + 5모드 유지 (채택)
- 장점: 사용자 결정 직접 반영. 5모드 기존 자산 보존. 확장성 최대. N×M 조합으로 문제 다양성 자연 증가.
- 단점: 조합 폭발 가능성 (5 × 6 = 30). 일부 조합은 의미 없음(예: term-match × reorder). 시드/프롬프트 관리 비용 증가.

### 선택지 B: 기초/실전 트랙 분리 (Agent C 원안)
- 장점: SQLD 시험 구조 정합 + Bloom's Taxonomy 상위 레이어 공백 해소.
- 단점: 사용자 거부. 기존 5모드의 주차별 의미가 재배치되어 SDD §3.3 전면 수정 필요.

### 선택지 C: 기존 모드에만 variant 추가 (Agent B 원안)
- 장점: 새 축 도입 없이 최소 변경. 하위 호환 100%.
- 단점: Mode 1 HARD가 점점 비대해지며 엔트로피 증가. 객관식을 기존 모드에 끼워넣기 어색.

### 선택지 D: 5모드 → 2+1 축소 (Agent A 원안)
- 장점: 운영 단순화.
- 단점: 사용자 거부. 기존 시드(sql-basics, transactions) 재작업 필요.

## 근거 (Rationale)

**채택: 선택지 A**

- **사용자 결정 존중**: "주차와 별개로 문제 유형 추가" = `answerFormat` 직교 축의 정확한 정의.
- **N×M 조합 폭발 관리 가능**: 의미 있는 조합만 시드로 제작(예: term-match × reorder는 시드 0건). 30개 이론 조합 중 실제 운영 조합은 ~12개로 수렴 예상.
- **Agent B/C의 지적 흡수**: Mode 1 variant(B) + 출력 테이블 선택(C)을 `answerFormat` 값으로 정규화 → 설계 일관성 확보.
- **기존 자산 보존**: sql-basics / transactions 시드는 `answer_format='single-token'` 기본값으로 마이그레이션.
- **ADR-011 정합**: M3 Qwen3-Coder-Next의 문제 생성 능력이 `answerFormat`별로 재평가 필요(R3 스위트). 단, 2-모드(빈칸/용어)는 R2에서 이미 PASS → 신규 4개 형식만 평가 대상.

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 조건부 YES — `answerFormat` 축 분리 권장 | `Question.answerFormat` 컬럼 + 기존 Strategy Pattern 확장으로 수용 가능. 구현 공수 MC만 3~4인일 |
| Agent B (품질) | 조건부 SAFE — Mode 1 HARD / Mode 3 / Mode 5 중복 재평가 필요 | 새 모드 남발보다 기존 하위모드 승격이 SDD 일관성 유리. 인젝션/WORM 안전장치 ADR-016 의존 |
| Agent C (대안) | 부분 수정 — 트랙 분리가 베스트 프랙티스지만 직교 축도 유효 | SQLD 실 시험 = 객관식+단답형. 직교 축이면 주차별 비중 조정으로 커리큘럼 정합 달성 가능 |
| **Reviewer** | **선택지 A 채택 (사용자 최종 결정 반영)** | 3자 모두 `answerFormat` 분리에 명시/암시적 동의. 사용자 결정으로 트랙 분리 제거 → A가 최선 |

## 결과 (Consequences)

### 긍정적
- 문제 다양성 N×M 확장으로 SQLD 시험 대비 역량 강화
- 기존 5모드 + 시드 자산 완전 보존
- 객관식 도입으로 MVP-A 2주 내 출시 가능
- 주차 독립 적용으로 커리큘럼 운영 유연성

### 부정적
- 조합 폭발 관리 필요 — 의미 없는 조합 시드 차단 정책 필수
- promptfoo dataset 확장 (R3 스위트 객관식/작성형 case 추가)
- `Question.answer` 타입을 확장 필요 (객관식은 `string[]` opt id, 작성형은 `string[]` 다중 정답)

### 주의사항
- **`answerFormat` 마이그레이션** — 기존 questions 테이블에 `answer_format DEFAULT 'single-token'` backfill. 다운타임 없음.
- **프론트 UI 분기** — 답안 입력 위젯이 `answerFormat`별로 분기(텍스트입력 / 라디오 / 체크박스 / 드래그리스트 / 테이블선택). MVP-A에서 객관식 위젯 우선.
- **시드 운영 정책 문서화** — 어떤 (모드 × 형식) 조합을 운영할지 SDD §3.3 매핑 표에 명시.
- **객관식 distractor 품질 assertion** 필요 — Agent C 지적. MVP-A 착수 시 promptfoo에 `mc-distractor-plausibility` 추가 검토.

---

**관련 문서**:
- `docs/review/consensus-004-problem-format-redesign.md`
- `docs/architecture/oracle-dba-learning-game-design.md` §3.1/§3.2/§3.3 (v2.9 개정 예정)
- `packages/shared/src/types/question.ts`
- `packages/shared/src/types/game.ts`
