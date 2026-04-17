# OSS 모델 평가 전체 FAIL — 원인 분석 및 개선 방향

**작성일**: 2026-04-14
**작성자**: jokwangwon (Claude 4.6 보조, 3+1 합의 프로토콜 거침)
**관련**: `docs/architecture/oss-model-evaluation-design.md`, `docs/rationale/oss-model-selection-rationale.md`
**후속 산출물**: ADR-010 (예정)

---

## 1. 경과

2026-04-10 ~ 2026-04-13 기간 OSS 5개 모델(EXAONE 4.0/3.5 32B, Qwen2.5-Coder 32B, Qwen3-Coder-Next 80B MoE, Llama 3.3 70B) × 60 testcase 평가 수행.

**결과: 5개 모델 전부 합격선 미달.**

| 모델 | MT1 | MT2 | MT3 (≥90%) | MT4 (≥95%) | 비고 |
|------|-----|-----|-----------|-----------|------|
| M4 Qwen2.5-Coder | 100% | 98.3% | **46.7%** | **83.3%** | — |
| M2 EXAONE 3.5 | 98.3% | 98.3% | **81.4%** | **64.4%** | — |
| M1 EXAONE 4.0 | 98.3% | 98.3% | **83.3%** | **76.7%** | 최고 근접 |
| M3 Qwen3-Coder-Next | 100% | 100% | **63.3%** | **78.3%** | — |
| M5 Llama 3.3 70B | — | — | — | — | runner crash × 60 |

---

## 2. Phase 1 — 데이터 기반 원인 분석

### 2.1 실패 패턴 집계 (M1~M4, 240 testcase 합산)

**MT3 (화이트리스트) 위반 토큰 TOP**
| 토큰 | 빈도 | 유형 |
|------|------|------|
| SQL | 24 | 메타용어 (term-match description) |
| MANAGER | 12 | Oracle EMP.JOB 실제 값 |
| CLERK | 6 | 동 |
| SALESMAN | 6 | 동 |
| CNT, AVG_SALARY, EMP_COUNT, ... | 각 1~6 | 모델 생성 alias |

**MT4 (blanks 정답) 위반 TOP**
| 토큰 | 빈도 | 유형 |
|------|------|------|
| 10, 20, 30, 2000, 3000 | 각 1~6 | 숫자 리터럴 (DEPTNO/급여) |
| >, >=, IS NOT | 각 2~5 | SQL 연산자 |
| COUNT(*), COUNT(ENAME) | 각 3~4 | 집계 표현 |

**MT4 blank 개수 불일치**: 13건 (모델 instruction-following 실패)

**공통 실패 testcase 6개** (4모델 전원 실패): `gold-a-blank-typing-08`, `gold-b-bt-{04,12,13,14,15}` — 화이트리스트 설계 결함과 직접 충돌.

### 2.2 근본 원인 3분류

| 원인 | 유형 | 영향 |
|------|------|------|
| ① `week1-sql-basics.scope.ts` 설계 결함 (31 키워드만) | **가이드 결함** | MT3/MT4 실패의 ~80% |
| ② `extractOracleTokens` 토크나이저가 "식별자 vs 데이터 리터럴/연산자"를 구분 못 함 | **가이드 결함 (숨은 버그)** | 리터럴·연산자가 MT3 위반으로 오탐 |
| ③ MT4가 `blanks[i].answer`를 allowedKeywords로 검증 (`blank-consistency.ts` L76-92) | **센서 과도 설계** | MT3와 중복 검증 + 자유 값 불허 |
| ④ 모델 instruction-following (`___` 개수 불일치) | **실제 모델 품질** | MT4 실패 13건 |
| ⑤ M5 Llama 3.3 runner OOM 의심 | **인프라** | M5 전체 |

핵심 통찰: 실패의 주요 원인은 **평가 하네스의 가이드(화이트리스트 + 토크나이저) + 센서(MT4) 결함**이며, 모델 성능이 아니다.

---

## 3. Phase 2 — 3+1 합의 프로토콜

CLAUDE.md §3에 따라 "SDD 명세 검토 + 아키텍처 의사결정" 해당. 3개 에이전트 병렬 독립 분석 + Reviewer 합성.

### 3.1 에이전트 관점 요약

- **Agent A (구현 분석가)**: 옵션 2 즉시 채택, 1 조건부, 3 기각, 4 constraint만, 5 채택. 옵션 4↔5 충돌 가능성 유일 지적.
- **Agent B (품질/안전성 검증가)**: **토크나이저 자체 버그** 발견 (핵심 기여). SDD §3.1 MT4 문구 수정 필수, 옵션 1은 seed DB migration 동반 필수, 옵션 3의 -10%p는 SDD Phase 0 재보정 한계 초과, few-shot은 leakage 위험.
- **Agent C (대안 탐색가)**: **Ollama schema-constrained decoding** 강력 추천 (하네스 원칙 "잘못하는 것이 불가능하게"와 일치). Gold Set이 Claude 산출물이라는 **메타 편향** 지적. Jaccard 점수화 중기 대안.

### 3.2 교차 비교

**일치 (3/3)**
- 옵션 2 (MT4 answer 검증 제거) 채택
- 옵션 3 (합격선 완화) 기각
- 옵션 5 (M5 재실행) 채택 — 후행

**부분 일치 (2/3)**
- 옵션 1 (화이트리스트 확장): A/B 조건부. C는 flat 반대. **B가 제시한 "토크나이저 수정 병행"을 전제로 수용**.
- 옵션 4 (프롬프트): A/B constraint만. C는 schema-constrained으로 대체. **단기는 constraint만, 장기는 C 대안 실험**.

**독립 insight 채택**
- B: SDD §3.1 MT4 정의 갱신 필수, 운영 AQG 프롬프트 동시 수정
- C: Ollama schema-constrained decoding 파일럿 트랙 신설

**Gap**
- A 놓침: 토크나이저 버그 (B가 커버), Gold Set 편향 (C가 커버)
- B 놓침: schema-constrained decoding (C가 커버)
- C 놓침: 옵션 2/5 단기 실행성 (A/B가 커버)

---

## 4. 최종 합의 — 실행 계획

### 4.1 P0 코드 수정 (즉시)

| # | 파일 | 변경 | 근거 |
|---|------|------|------|
| 1 | `apps/api/src/modules/ai/eval/assertions/blank-consistency.ts` | L76-92 answer 화이트리스트 검증 블록 제거 | 옵션 2, 3/3 consensus |
| 2 | `packages/shared/src/utils/oracle-tokens.ts` | `extractOracleTokens` 개선 — 따옴표 안 리터럴 제외, SQL reserved operators 제외 | B insight (근본 버그) |
| 3 | `apps/api/src/modules/content/seed/data/week1-sql-basics.scope.ts` | JOB 값 5개(MANAGER/CLERK/SALESMAN/ANALYST/PRESIDENT) + "SQL" 추가. 보수적 alias 5~10개 | 옵션 1, 2/3 조건부 |
| 4 | AQG blank-typing 프롬프트 + 평가 프롬프트 | "sql의 `___` 개수와 blanks 배열 길이는 반드시 일치" 1줄 constraint 추가 | 옵션 4 (constraint만) |

### 4.2 P0 SDD / 문서

- `docs/architecture/oss-model-evaluation-design.md` §3.1 MT4 정의 수정: "+ 정답이 화이트리스트에 존재" 조항 삭제, MT3가 단일 책임을 지도록 명시
- `docs/adrs/ADR-010-oss-eval-harness-fix.md` 신규 작성 (이 rationale을 요약)
- DB migration: `weekly_scope` 테이블의 week1 keywords를 `scope.ts`와 동기화

### 4.3 P1 재평가 (P0 완료 후)

- M1~M4: 4모델 재평가 1회, 예상 2~4h
- M5: num_ctx=4096, num_predict=1024로 별도 재실행 (Modelfile digest pin 갱신), 예상 1.5h
- 결과는 `apps/eval-results/R-{ts}/`에 저장, `generateComparisonReport()` 으로 비교표

### 4.4 P2 실험 트랙

- M4 단일로 Ollama `format: <json-schema>` (schema-constrained decoding) 파일럿
- baseline 대비 MT4 blank 개수 불일치가 물리적으로 0이 되는지 확인
- 효과 확인 시 전 모델 확대

### 4.5 기각/이연

- 합격선 단독 완화: **기각** (3/3 consensus)
- Few-shot prompting: **기각** (leakage 우려, B)
- AQG 패러다임 전환 (Template + hint-only): **보류** (최후 수단)
- 카테고리별 화이트리스트 재설계 (flat → 6 카테고리): **중기 이연** (SDD v3 논의)
- Jaccard 기반 MT3 연속 지표화: **중기 이연** (SDD v3 논의)
- Gold Set 메타 편향 ("Claude 어휘 재현력" 평가 문제): **장기 과제로 문서화**, 현 라운드엔 미적용

---

## 5. 리스크 & 모니터링

- **평가↔운영 divergence**: 옵션 1은 seed + DB migration 동반 필수. 단일 source of truth (`*.scope.ts`) 유지.
- **프롬프트 변경의 운영 전파**: 평가 프롬프트만 수정 시 평가의 외적 타당성 붕괴. 운영 AQG 프롬프트 동시 수정 필수.
- **토크나이저 변경의 파급**: 세 사용처(`ScopeValidatorService` / seed test / MT3 assertion) 모두 회귀 테스트 필수.
- **M5 num_ctx 축소**: MT7(한국어 자연스러움) 역효과 체크.

---

## 6. Gold Set 메타 편향 (미해결 장기 과제)

Agent C 지적대로, 현 Gold Set B는 Claude Opus가 생성 후 `validate-candidates.ts`로 자체 검증한 산출물이다. 즉 평가가 측정하는 것은 "Oracle DBA 지식"이 아니라 **"Claude의 어휘·스타일 재현력"**일 수 있다.

**향후 과제 (SDD v3 후보)**
- Ground truth를 실제 Oracle DB 실행 결과로 재정의 (SQL 실행 → 결과 일치)
- 복수 모델(Claude + Qwen + EXAONE)의 교집합으로 Gold Set 재구성
- 인간 검수자(DBA 강사) peer review 필수화

---

## 7. 참고

- 본 문서는 CLAUDE.md §3 "3+1 멀티 에이전트 합의 프로토콜" 결과물
- Phase 1 raw 데이터: `apps/eval-results/R-2026-04-10T08-40-45Z/`, `R-2026-04-10T11-27-15Z/`, `R-2026-04-13T02-41-36Z/`, `R-2026-04-13T03-07-55Z/`, `R-2026-04-13T04-25-43Z/`
- 메모리 규칙 "큰 결정 시 판단 근거 문서 작성"(2026-04-09 지시) 준수
