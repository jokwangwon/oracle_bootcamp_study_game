# ADR-013: 역피라미드 3단 채점 파이프라인 (AST → 키워드 → LLM-judge)

**상태**: Accepted
**날짜**: 2026-04-16
**의사결정자**: 3+1 에이전트 합의 + 사용자 승인
**관련 합의**: `docs/review/consensus-004-problem-format-redesign.md`
**관련 ADR**: ADR-012 (answerFormat 축), ADR-016 (LLM-judge 안전), ADR-017 (MT6/MT7/MT8)

---

## 맥락 (Context)

ADR-012로 도입된 `answerFormat = 'free-form'`(자유 SQL 작성)은 **실 SQL 실행환경 없이** 채점해야 한다(사용자 결정: "객관식/작성형 위주, 실 실행 없음"). 기존 `BlankTypingMode.normalize` (`trim + toUpperCase`) 수준으로는:

- 토큰 순서 (`SELECT a,b` vs `SELECT b,a`)
- 동치 구문 (`NVL` vs `COALESCE`, ANSI JOIN vs Oracle `(+)`)
- 서브쿼리 vs JOIN 동치
- 공백·주석·세미콜론 변이

를 처리할 수 없다. Agent B는 **CLAUDE.md §2 "계산적 > 추론적"** 원칙에 따라 LLM 채점 도입 시 반드시 계산적 canonicalization 선행을 요구했다.

## 결정 (Decision)

**작성형 답안 채점은 역피라미드 3단 파이프라인으로 수행한다. 상위 레이어에서 판정이 나면 하위 레이어는 호출하지 않는다.**

```
Layer 1 (AST Canonicalize)          [항상 실행, 계산적]
  │
  ├─ PASS → is_correct = true, 종료
  ├─ FAIL → is_correct = false, 종료
  └─ UNKNOWN (방언 미지원 등) → Layer 2
            │
            ▼
Layer 2 (Keyword/Token Coverage)    [계산적, 필수]
  │
  ├─ PASS → is_correct = true, partial_score = 1.0
  ├─ FAIL (명백히 부족) → is_correct = false, partial_score < 0.3
  └─ AMBIGUOUS → Layer 3
            │
            ▼
Layer 3 (LLM-judge)                  [추론적, UNKNOWN일 때만]
  │
  ├─ verdict = PASS → is_correct = true
  ├─ verdict = FAIL → is_correct = false
  └─ verdict = UNKNOWN → grading_method='held', 관리자 큐로 이관
```

### Layer 1 — AST Canonicalize

- 라이브러리: `node-sql-parser` + Oracle 방언 커스텀 확장
- 과정: 학생 답안과 정답 템플릿(`question.answer` 배열의 각 요소)을 AST로 파싱 → 구조적 정규화 → 비교
  - 정규화: identifier case fold(Oracle 기본 대문자), alias 통일, 공백/주석 제거, 절 순서 표준화(SELECT/FROM/WHERE/GROUP/HAVING/ORDER)
  - 비교 대상: 테이블/컬럼 집합, JOIN 타입/조건, WHERE 술어 집합, GROUP BY 집합, SELECT 프로젝션 순서(프로젝션만 순서 민감)
- 방언 화이트리스트: `DUAL`, `ROWNUM`, `CONNECT BY`, `(+)` 조인, `NVL`, `DECODE`, `LISTAGG`, `MERGE` 등
- 방언 미지원 시: AST 파싱 실패 → `UNKNOWN` 반환 → Layer 2

### Layer 2 — Keyword/Token Coverage

- 재사용: `apps/api/src/modules/ai/eval/assertions/extract-oracle-tokens.ts`
- 과정:
  1. 정답셋 토큰 집합 `T_expected` 추출
  2. 학생 답안 토큰 집합 `T_student` 추출
  3. `coverage = |T_expected ∩ T_student| / |T_expected|`
  4. `extra_penalty = |T_student \ allowlist(week)| * 0.05`
  5. `partial_score = max(0, coverage - extra_penalty)`
- 판정:
  - `partial_score ≥ 0.95` → PASS
  - `partial_score < 0.3` → FAIL
  - 그 외 → AMBIGUOUS → Layer 3

### Layer 3 — LLM-judge

- **Layer 1/2가 UNKNOWN/AMBIGUOUS일 때만 호출** (ADR-016 안전 프로토콜 필수)
- 호출률 모니터링: **MT8 (llm-judge-invocation-ratio) ≤ 10%** 게이트
- 출력 구조: `{ verdict: 'PASS'|'FAIL'|'UNKNOWN', rationale: string, confidence: number }`
- UNKNOWN 시 `grading_method='held'`로 `answer_history` 기록 → 관리자 수동 리뷰 큐로 이관 (기존 `pending_review` 흐름 재활용)

### 기록 필드

`answer_history`에 채점 이력 누적:
- `grading_method`: `'ast' | 'keyword' | 'llm-v{X}' | 'held' | 'admin-override'`
- `grader_digest`: AST/키워드는 `harness_version`, LLM은 모델 sha256 digest (ADR-011 pin 재사용)
- `grading_layers_used`: `[1]` / `[1,2]` / `[1,2,3]` 배열
- `partial_score`: 0.0 ~ 1.0

## 선택지 (Options Considered)

### 선택지 A: 역피라미드 3단 (채택)
- 장점: 계산적 우선 + LLM 호출 최소화 + 재현성/비용/지연 균형
- 단점: 구현 공수 상, Oracle 방언 파서 확장 필요

### 선택지 B: LLM-judge 단독
- 장점: 구현 최소
- 단점: 재현성 낮음(temp > 0 시 비결정적), 비용 폭발, CLAUDE.md §2 위반, 인젝션 벡터 직접 노출

### 선택지 C: 토큰 정규화만 (Layer 2 단독)
- 장점: 즉시 구현 가능
- 단점: 동치 구문/서브쿼리 등 구조 동치 판정 불가 → 정답 오인

### 선택지 D: 실행 기반 채점 (실 Oracle 컨테이너)
- 장점: 결과셋 비교로 의미 검증 가능
- 단점: **사용자 결정 거부** (실행환경 미제공). per-user 샌드박스 인프라 복잡도 폭증

## 근거 (Rationale)

**채택: 선택지 A**

- **CLAUDE.md §2 "계산적 > 추론적" 원칙 준수** — Layer 1/2가 계산적, Layer 3만 추론적.
- **재현성 확보** — Layer 1/2는 결정적. Langfuse trace에 `grading_layers_used` 기록으로 감사 가능.
- **비용·지연 관리 가능** — 평균 호출은 Layer 1에서 종료. LLM 호출은 10% 미만 예상.
- **Agent B 필수안 흡수** — 계산적 canonicalization 선행 + UNKNOWN 시 LLM 호출.
- **Agent A 구체안 반영** — `node-sql-parser` + Oracle 방언 화이트리스트 + 3단 구조.
- **자기검증 편향 부분 완화** — Layer 3가 호출되는 경우가 소수여서 M3 자기검증 편향 영향 최소화 (ADR-011 메타 편향 주의문 4항 연계).

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 3단 파이프라인 구체안 제시 | Tier-1 토큰(재사용 80%) → Tier-2 AST(신규 의존성) → Tier-3 LLM. 평균 지연 < 500ms |
| Agent B (품질) | 필수 안전장치로 지정 | 계산적 우선 + LLM UNKNOWN 시만 호출 + 경계 태그 + WORM 기록. CLAUDE.md §2 준수 |
| Agent C (대안) | 벤치마크 검증 | solvesql은 실행 기반, 본 프로젝트는 사용자 제약상 불가 → AST+LLM 하이브리드가 차선책 최선 |
| **Reviewer** | **3단 역피라미드 채택** | 3자 논리 일관. 사용자 "실 실행 없음" 결정과 정합 |

## 결과 (Consequences)

### 긍정적
- 재현성·비용·지연 3축 균형 확보
- `answer_history` 감사 로그로 채점 분쟁 대응 가능
- LLM 의존성 최소화로 M3 자기검증 편향 영향 감소
- Oracle 방언 확장 시 Layer 1 커버리지 지속 개선 가능

### 부정적
- `node-sql-parser` Oracle 방언 커버리지 한계 → Layer 2/3 의존 증가 가능성
- 3단 파이프라인 구현 공수 ≥ 5인일
- 관리자 수동 리뷰 큐 부하 (Layer 3 UNKNOWN 케이스)

### 주의사항
- **MT8 게이트 강제**: LLM-judge 호출률 > 10% 시 `gate_breach` (ADR-017).
- **Layer 1 미실행 시 Layer 3 호출 차단**: 런타임 assert로 강제.
- **Oracle 방언 커버리지 CI**: `DUAL`/`ROWNUM`/`CONNECT BY`/`(+)` 전용 테스트 스위트 유지.
- **Layer 3 프롬프트 외부화**: Langfuse Prompt Management `evaluation/free-form-sql-v{N}` 등록 (ADR-009 정합).
- **promptfoo R3 스위트**: 작성형 gold set 30~50건 추가 + `semantic-equivalence` assertion.
- **관리자 리뷰 큐 UI**: `status='pending_review'` 흐름 재활용 + `grading_method='held'` 전용 탭.

---

**관련 문서**:
- `docs/review/consensus-004-problem-format-redesign.md`
- `docs/architecture/oracle-dba-learning-game-design.md` §4.4 (v2.9 개정 예정)
- `apps/api/src/modules/ai/eval/assertions/` (Layer 2 재사용)
- ADR-011 (M3 운영 모델), ADR-016 (LLM-judge 안전), ADR-017 (MT 지표)
