# ADR-010: OSS 평가 하네스 결함 수정 (MT3 토크나이저 + MT4 단일 책임)

**상태**: Accepted
**날짜**: 2026-04-14
**의사결정자**: 3+1 에이전트 합의 + 사용자 승인

---

## 맥락 (Context)

OSS 평가 트랙 단계 8에서 5개 후보 모델(EXAONE 4.0 32B / EXAONE 3.5 32B / Qwen2.5-Coder 32B / Qwen3-Coder-Next 80B MoE / Llama 3.3 70B)을 Gold Set A+B 60문제로 평가한 결과, **5개 모델 전원이 MT3(C3 ≥ 90%) 및 MT4(C4 ≥ 95%) 합격선에 전면 미달**.

| 모델 | MT3 | MT4 | 상태 |
|------|-----|-----|------|
| M1 EXAONE 4.0 32B | 83.3% | 76.7% | FAIL |
| M2 EXAONE 3.5 32B | 81.4% | 64.4% | FAIL |
| M3 Qwen3-Coder-Next 80B | 63.3% | 78.3% | FAIL |
| M4 Qwen2.5-Coder 32B | 46.7% | 83.3% | FAIL |
| M5 Llama 3.3 70B | — | — | runner crash 60/60 |

실패 데이터를 240개 testcase에 걸쳐 집계한 결과, **실패의 ~80%는 모델 성능이 아니라 평가 하네스(가이드 + 센서)의 결함**에서 비롯:

- MT3 위반 토큰 TOP: `SQL` × 24, `MANAGER` × 12, `CLERK` × 6, `SALESMAN` × 6 (대부분 `WHERE JOB = 'MANAGER'` 형태의 **문자열 리터럴 내부**)
- MT4 위반 정답 TOP: `10`, `20`, `>`, `>=`, `COUNT(*)` (숫자/연산자/집계 표현 — 빈칸 정답으로 자연스러우나 화이트리스트 검증에 걸림)
- 4모델 전원 공통 실패 testcase 6개는 모두 화이트리스트 설계 결함과 직접 충돌

CLAUDE.md §3에 따라 "SDD 명세 검토 + 아키텍처 의사결정"으로 분류, 3+1 에이전트 합의 프로토콜 가동.

## 결정 (Decision)

다음 4건을 즉시 수정하고 SDD v2.7로 기록한다:

1. **`packages/shared/src/utils/oracle-tokens.ts`** — `extractOracleTokens`가 문자열 리터럴(`'...'`, `"..."`) 내부를 토큰 추출에서 제외하도록 수정 (정규식 전처리). MT3/ScopeValidator 양쪽에 동시 영향.
2. **`apps/api/src/modules/ai/eval/assertions/blank-consistency.ts`** — MT4에서 `blanks[i].answer` 화이트리스트 검증 블록(L75-92) 제거. 화이트리스트 검증은 MT3 단일 책임으로 이관.
3. **`apps/api/src/modules/content/seed/data/week1-sql-basics.scope.ts`** — JOB 실제 값 5개(MANAGER/CLERK/SALESMAN/ANALYST/PRESIDENT) + DNAME 4개(ACCOUNTING/RESEARCH/SALES/OPERATIONS) + "SQL" 메타용어 + 관용 alias 6개 추가.
4. **`apps/api/src/modules/ai/prompts/blank-typing.prompt.ts`** — 규칙 9: "`___` 개수와 blanks 배열 길이 정확 일치" constraint 추가. 운영 AQG와 평가가 동일 템플릿 공유하므로 자동 반영.

**SDD 변경**: `docs/architecture/oss-model-evaluation-design.md` §3.1 MT3/MT4 정의를 위 수정에 맞춰 갱신 (v2.7 patch).

## 선택지 (Options Considered)

### 옵션 1: 화이트리스트 확장
- 장점: 최소 수정, 즉시 효과
- 단점: 본질적 토크나이저 버그 은폐, 화이트리스트 무한 팽창

### 옵션 2: MT4에서 answer 화이트리스트 검증 제거
- 장점: MT3와 중복 제거, 자연스러운 리터럴 정답 허용
- 단점: SDD §3.1 MT4 정의 문구 수정 필수

### 옵션 3: 합격선 완화 (MT3 90→85, MT4 95→85)
- 장점: 코드 수정 없음
- 단점: **결함을 덮는 안티패턴**, SDD Phase 0 재보정 한계(-5%p) 초과, 헌법 §3 계산적 검증 KPI 약화

### 옵션 4: 프롬프트 few-shot + constraint 추가
- 장점: instruction-following 강화
- 단점: few-shot은 leakage 위험 + 운영-평가 divergence 위험 (constraint만은 안전)

### 옵션 5: Ollama schema-constrained decoding (JSON Schema grammar)
- 장점: instruction-following 실패가 물리적으로 불가능해짐 (하네스 원칙)
- 단점: 모델별 지원 불확실, 품질 저하 가능성

## 근거 (Rationale)

**채택: 옵션 1(보수적) + 옵션 2 + 옵션 4(constraint만) + 토크나이저 근본 수정**

- **옵션 2 (3/3 consensus)**: MT3가 이미 sql 본문 + top-level answer를 검사하므로 MT4의 answer 화이트리스트는 순수 중복 검증. 빈칸 정답에 "=", "10", "COUNT(*)" 같은 자연값이 들어가는 게 학습 문제로서 타당.
- **토크나이저 버그 수정 (Agent B 핵심 기여)**: `extractOracleTokens`가 식별자와 데이터 리터럴을 구별 못 한 것이 근본 원인. `'MANAGER'`는 Oracle 데이터이지 학습 범위 이탈이 아님. 이 수정이 MT3 위반의 대부분을 자동 해소.
- **옵션 1 보수적 적용**: JOB/DNAME 값은 `extractOracleTokens` 수정으로 대부분 해결되나, 따옴표 없이 등장(alias, COMMENT)할 수 있어 안전망으로 등록. alias는 Gold Set 실제 등장 토큰만 보수적으로.
- **옵션 4 constraint-only**: few-shot은 self-reference leakage 위험(Agent B). blank 개수 constraint 1줄은 hallucination 차단으로 정당.
- **옵션 3 기각 (3/3)**: 결함 은폐. 옵션 1+2+토크나이저 수정으로 자연 해소 기대.
- **옵션 5 (실험 트랙으로 분리)**: 현 ADR 범위 밖. 별도 파일럿(P2)으로 추적.

**운영 정합성 유지 (Agent B 조건)**: seed `*.scope.ts`가 단일 source of truth. DB migration으로 `weekly_scope` 테이블 동기화 동반.

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 옵션 2 채택 / 1 조건부 / 3 기각 / 4 constraint만 / 5 채택 | 옵션 4↔5 충돌 가능성 유일 지적 (긴 프롬프트 vs num_ctx 축소) |
| Agent B (품질) | **토크나이저 근본 버그 발견** + 옵션 2 채택 (SDD §3.1 수정 동반) + 1 조건부(seed + DB migration) + 3 기각 (-10%p 한계초과) + 4 조건부 (leakage 주의) + 5 채택 | `extractOracleTokens`가 식별자와 데이터 리터럴을 혼동하는 것이 근본 원인. few-shot은 gold set self-reference 위험 |
| Agent C (대안) | Ollama schema-constrained decoding 강력 추천 (대안 B) + Jaccard 점수화(대안 A) 중기 검토 + Gold Set이 Claude 산출물이라는 메타 편향 지적 | "잘못하는 것이 불가능하게" 하네스 원칙 관점. 장기 과제는 SDD v3에서 처리 |
| **Reviewer (Claude)** | **옵션 2 + 토크나이저 수정 + 옵션 1(보수) + 옵션 4(constraint-only). 옵션 3 기각. 옵션 5는 별도 P2 실험 트랙.** | 3 consensus 우선 + B의 근본 버그 지적 수용 + C의 대안은 SDD v3으로 이연 |

## 결과 (Consequences)

### 긍정적
- MT3 위반 토큰 대부분(`'MANAGER'` 등 리터럴)이 토크나이저 수정으로 자동 해소
- MT4와 MT3의 화이트리스트 이중 검증 제거 → 단일 책임 원칙 복원
- 학습 범위 검증(ScopeValidatorService)도 동일 수정 혜택 — 운영 품질 개선
- 테스트 전원 pass (252 + 신규 4), 회귀 없음

### 부정적
- SDD §3.1 MT4 정의가 변경됨 → 과거 평가 결과(R1)는 새 기준으로 재해석 불가, **R2 재평가 필수**
- 기존 `weekly_scope` DB 데이터는 seed와 동기화 필요 (migration 1건)
- 프롬프트 수정이 운영 AQG에도 전파됨 — 운영 토큰 비용 미세 증가 (1줄 추가)

### 주의사항
- **R2 재평가 결과가 여전히 FAIL이면** ADR-010-A 후속 논의 (schema-constrained decoding 파일럿 또는 SDD v3 합격선 재설계)
- **Gold Set 메타 편향** (Claude 산출 gold로 OSS 평가 = "Claude 어휘 재현력" 측정)은 본 ADR 범위 밖, SDD v3에서 다룰 장기 과제로 기록
- `num_ctx` 튜닝(M5 재실행)은 본 ADR과 별개의 인프라 이슈로 진행

---

**관련 문서**:
- `docs/rationale/oss-eval-failure-analysis-2026-04-14.md` (3+1 합의 원문 + 근거 데이터)
- `docs/architecture/oss-model-evaluation-design.md` (§3.1 v2.7 patch)
- 커밋: `b1a1c84` (P0 코드 수정)
