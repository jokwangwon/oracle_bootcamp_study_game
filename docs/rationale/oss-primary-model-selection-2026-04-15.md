# OSS Primary 모델 확정 — 판단 근거 (R2 재평가 기반)

> **이 문서의 목적**: R2 재평가 결과를 토대로 **"M3 Qwen3-Coder-Next 80B MoE를 primary OSS로 확정"** 하는 결정에 이르기까지의 판단 흐름을 시간순으로 기록한 narrative. ADR-011 작성 전 단계의 판단 근거를 보존.

| 항목 | 값 |
|---|---|
| **문서 유형** | Decision Rationale (판단 근거) |
| **작성일** | 2026-04-15 |
| **작성자** | 사용자(jokwangwon) + Claude (3+1 에이전트 합의 Reviewer) |
| **상태** | 작성 완료 (ADR-011 작성 전) |
| **선행 문서** | `oss-model-selection-rationale.md` (2026-04-09, 후보 5개 선정), `oss-eval-failure-analysis-2026-04-14.md` (R1 실패 분석) |
| **관련 ADR** | ADR-009 (LangChain + Langfuse), ADR-010 (하네스 P0 수정), ADR-011 (이 문서의 후속) |

---

## 1. 배경 (Why Now)

### 1.1 R1 전원 FAIL → ADR-010 → R2 재평가

2026-04-13 R1 배치에서 5개 후보 모델 전원이 MT3/MT4 합격선에 전면 미달했다. 원인 분석 결과 **실패의 ~80%가 평가 하네스 결함**이었고, ADR-010(2026-04-14)으로 4건의 P0 수정을 단행했다:

1. `extractOracleTokens` — 문자열 리터럴 내부 토큰 제외
2. MT4 — answer 화이트리스트 중복 검증 제거 (단일 책임)
3. `week1-sql-basics.scope.ts` — JOB/DNAME 실제 값 + SQL 메타용어 추가
4. `blank-typing.prompt.ts` — 빈칸 개수 ↔ blanks 배열 길이 일치 constraint

이 수정 후 2026-04-14~15에 R2 재평가를 M1~M4 대상으로 실시 (M5 Llama는 runner crash 별도 트랙).

### 1.2 R2 결과 (수치)

| 모델 | C1 | C2 | C3 | C4(빈칸) | C7(p95) | C8 | MT5 | 종합 |
|---|---|---|---|---|---|---|---|---|
| M1 EXAONE 4.0 32B | 100% | 98.3% | 98.3% | **❌90.0%** | **❌109.9s** | 100% | 58.3% | **FAIL** |
| M2 EXAONE 3.5 32B | 100% | 98.3% | 96.7% | **❌86.7%** | **❌135.4s** | 100% | 68.3% | **FAIL** |
| **M3 Qwen3-Coder-Next 80B MoE** | **100%** | **100%** | **98.3%** | **96.7%** | **44.9s** | **100%** | **98.3%** | **🏆 PASS** |
| M4 Qwen2.5-Coder 32B | 100% | 100% | 96.7% | 98.3% | **❌103.2s** | 100% | 85.0% | **FAIL (지연만)** |

- 측정 artifact: `apps/eval-results/R-2026-04-14T10-08-59Z` ~ `R-2026-04-14T12-10-27Z`
- 환경: Ollama 0.20.4, CUDA 13.0, seed=42, temperature=0.2, Gold Set A+B 60문제

**M3만 유일하게 전 게이트 PASS**. 이 결과를 근거로 primary 확정이 가능한가를 3+1 에이전트 합의로 판단했다.

---

## 2. 3+1 에이전트 합의 요약

CLAUDE.md §3에 따라 "아키텍처 의사결정 / SDD 명세 검토"에 해당하여 3+1 합의 프로토콜을 가동했다.

### 2.1 Agent 역할 배분
| Agent | 관점 | 핵심 질문 |
|---|---|---|
| A (구현 분석가) | 기술/운영 | M3가 실제 동작하는가? M4 튜닝 가능성? |
| B (품질/안전성) | 라이센스/리스크/SDD | 안전하고 견고한가? 운영 게이트는? |
| C (대안 탐색가) | 트레이드오프 | M3 외 대안(이중 운영, 재평가 확대 등)은? |
| Reviewer | 교차 비교 | 합의 도출 |

### 2.2 3/3 일치 항목 (Consensus)

- **M3 기술적 타당성**: 119GB 통합 메모리에 85GB 상주 가능, aarch64 검증 완료, p95 44.9s 마진 16초 충분
- **라이센스 안전성**: Apache 2.0 = 상업적 재배포 자유, EXAONE NC 회색지대와 대비되는 명확한 이점
- **M4 단독 primary 기각**: MT5 85.0% + 지연 튜닝 불확실성 + 재평가 비용
- **Gold Set 메타 편향 존재**: Claude 생성 gold로 OSS 평가 = "Claude 어휘 재현력" 측정 가능성

### 2.3 Agent B 보고서 사실 오류 정정

Agent B는 "M3는 C3 63.3%, C4 78.3%로 FAIL"이라고 주장했으나 이는 R1(ADR-010 이전) 데이터였다. **R2 실측에서 M3는 C3 98.3% / C4 96.7% / 전 게이트 PASS**이다. 이 정정 후 B의 입장은 "조건부 채택" → "채택 + 운영 게이트"로 상향.

그러나 B가 제기한 **다음 리스크는 정정 후에도 유효**:
- Ollama 모델 digest "unknown" — sha256 무결성 체인 부재
- Gold Set 메타 편향 (ADR-010에 이미 기록된 장기 과제)
- Qwen3-Coder가 일반 코딩 특화 — Oracle SQL 도메인 적합성은 운영 모니터링 필요

### 2.4 불일치 — M4의 위상

| | Agent A | Agent B | Agent C |
|---|---|---|---|
| M4 역할 | secondary fallback | 언급 없음 | 2순위(3개월 후 이중 라우팅) |

**합의안**: M4를 즉시 튜닝/투입하지 않되, **3개월 후 부트캠프 피드백 기반 라우팅 전환 게이트**를 ADR-011에 로드맵으로 명시.

### 2.5 불일치 — ADR 기록 위치

- Agent B: ADR-010 확장
- Reviewer 판단: **ADR-011 신설**

**근거**:
1. ADR-010의 선언된 주제는 "하네스 결함 수정"이지 "모델 선정"이 아니다.
2. 하나의 ADR에 여러 결정을 혼합하면 미래 감사/역추적 난이도가 증가한다.
3. ADR-010의 "Consequences"는 R2 재평가 실행으로 이미 닫혔다 (해당 ADR 본문 L93 "R2 재평가 필수" 항목 이행 완료).

---

## 3. 최종 합의 결론

### 3.1 채택

**M3 Qwen3-Coder-Next 80B MoE를 Oracle DBA 학습 게임의 primary OSS 문제 생성 모델로 확정.**

### 3.2 기각된 대안

| 대안 | 기각 사유 |
|---|---|
| M4 단독 primary | MT5 85.0%(합격선 90% 미달) + p95 103.2s 지연 튜닝 불확실 |
| 즉시 이중 운영 (M3+M4 라우팅) | 부트캠프 개시 전 복잡도 조기 도입, 라우팅 근거 데이터 부재 |
| 평가 확대 후 재결정 (F) | 결정 지연 5-6주, R2 결과가 이미 충분히 분별력 있음 |
| EXAONE 복귀 | R2에서도 C4/C7 이중 FAIL + MT5 <70%, 라이센스 회색지대 |

### 3.3 채택 조건 (운영 배포 전 게이트)

1. ✅ **이미 충족** — R2 전 게이트 PASS, Apache 2.0 라이센스
2. ⏳ **Ollama 모델 digest pin** — 현재 result.json에 `"Ollama 이미지 digest": "unknown"`. sha256 기록 + pin 자동화 필요
3. ⏳ **운영 초기 100건 실사용 모니터링** — MT3/MT4 샘플 재측정 + 이상 케이스 로그
4. ⏳ **메타 편향 주의문 명시** — SDD/운영 문서에 "현 평가는 Claude 생성 Gold Set 기준이며, Oracle SQL 도메인 실성능은 운영에서 검증 지속" 기록

### 3.4 로드맵 (ADR-011 본문에 조건부 트리거로 명기)

| Phase | 시점 | 내용 | 조건 |
|---|---|---|---|
| **P1** | 즉시 | M3 단독 운영 개시, BullMQ 워커 concurrency=1 | 위 3.3의 ⏳ 3건 완료 |
| **P2** | 3개월 후 | M4 지연 튜닝 + 이중 라우팅 재검토 | 부트캠프 피드백 ≥100건 축적 |
| **P3** | 병렬 트랙 | Gold Set 200문제 확대 + DBA 강사 peer review | 메타 편향 완화 필요 판단 시 |
| **P4** | 별도 ADR | M5 Llama 3.3 num_ctx 튜닝, Ollama schema-constrained decoding | ADR-010-A 또는 ADR-012로 분리 |

---

## 4. 미해결 / 후속 확인 항목

| # | 항목 | 책임 | 시점 |
|---|---|---|---|
| 1 | Ollama `qwen3-coder-next:latest` sha256 digest 조회 + pin 방식 결정 | Claude + 사용자 | 운영 배포 전 |
| 2 | BullMQ 워커 concurrency 명시값 (docker-compose.yml) | Claude | 운영 배포 전 |
| 3 | 장기 가동 안정성 (vRAM 누수, token 누적 side effect) 측정 | 사용자 | 운영 1주차 |
| 4 | EXAONE 4.0 commercial license 문의는 **불필요로 전환** (M3 채택으로 상용 리스크 해소) | — | 종결 |
| 5 | SDD `oss-model-evaluation-design.md`에 "§1.3 primary 선정 결과" 절 추가 | Claude | ADR-011 작성 직후 |

---

## 5. 변경 이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-15 | 초안 작성 | R2 재평가 완료 + 3+1 합의 결과 |

---

## 6. 참고 자료

### R2 평가 결과 artifact
- `apps/eval-results/R-2026-04-14T10-08-59Z/` (M1 EXAONE 4.0)
- `apps/eval-results/R-2026-04-14T11-04-44Z/` (M2 EXAONE 3.5)
- `apps/eval-results/R-2026-04-14T11-32-26Z/` (M3 Qwen3-Coder-Next) ← **primary 근거**
- `apps/eval-results/R-2026-04-14T12-10-27Z/` (M4 Qwen2.5-Coder)

### 프로젝트 내부 참조
- `docs/rationale/oss-model-selection-rationale.md` (2026-04-09, 후보 5개 선정)
- `docs/rationale/oss-eval-failure-analysis-2026-04-14.md` (R1 실패 분석)
- `docs/decisions/ADR-010-oss-eval-harness-fix.md` (하네스 P0 수정)
- `docs/architecture/oss-model-evaluation-design.md` (SDD v2.7)

### 외부 참조
- [qwen3-coder-next — Ollama Library](https://ollama.com/library/qwen3-coder-next)
- [Qwen Apache 2.0 License — Qwen/Qwen3-Coder GitHub](https://github.com/QwenLM/Qwen3-Coder)

---

**이 문서는 판단 근거만 보존한다. 실제 결정 기록은 ADR-011에서 다룬다.**
