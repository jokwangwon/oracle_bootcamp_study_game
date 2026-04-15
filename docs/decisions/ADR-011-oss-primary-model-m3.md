# ADR-011: OSS Primary 모델 확정 — Qwen3-Coder-Next 80B MoE (M3)

**상태**: Accepted
**날짜**: 2026-04-15
**의사결정자**: 3+1 에이전트 합의 + 사용자 승인

---

## 맥락 (Context)

ADR-010(2026-04-14) 하네스 P0 수정 이후 M1~M4 4개 OSS 후보 모델에 대해 R2 재평가를 실시했다 (M5 Llama 3.3은 runner crash로 별도 트랙 분리). 결과:

| 모델 | C1 | C2 | C3 | C4 | C7 p95 | C8 | MT5 | 종합 |
|------|-----|-----|-----|-----|--------|-----|-----|------|
| M1 EXAONE 4.0 32B | 100% | 98.3% | 98.3% | ❌90.0% | ❌109.9s | 100% | 58.3% | FAIL |
| M2 EXAONE 3.5 32B | 100% | 98.3% | 96.7% | ❌86.7% | ❌135.4s | 100% | 68.3% | FAIL |
| **M3 Qwen3-Coder-Next 80B MoE** | **100%** | **100%** | **98.3%** | **96.7%** | **44.9s** | **100%** | **98.3%** | **🏆 PASS** |
| M4 Qwen2.5-Coder 32B | 100% | 100% | 96.7% | 98.3% | ❌103.2s | 100% | 85.0% | FAIL (지연만) |

- 평가 artifact: `apps/eval-results/R-2026-04-14T10-08-59Z` ~ `R-2026-04-14T12-10-27Z`
- 환경: Ollama 0.20.4 / CUDA 13.0 / GB10 aarch64 119GB / seed=42 / temp=0.2 / Gold Set A+B 60문제

**M3만 SDD §1.3의 전 게이트를 동시 PASS**. 이 결과를 근거로 primary 모델 확정이 가능한지 CLAUDE.md §3에 따라 3+1 에이전트 합의 프로토콜을 가동했다.

## 결정 (Decision)

**Oracle DBA 학습 게임의 primary OSS 문제 생성 모델로 M3 Qwen3-Coder-Next 80B MoE(`qwen3-coder-next:latest`)를 확정한다.**

- 추론 엔진: Ollama 0.20.4 (ADR-009 `ChatOllama` 어댑터 유지)
- 배포 단위: Docker Compose `ollama` 컨테이너 단일 인스턴스
- 동시성: BullMQ 워커 concurrency=1 (단일 추론 슬롯 직렬 처리)
- EXAONE 4.0 commercial license 문의는 **불필요로 전환** (M3 Apache 2.0으로 상용 리스크 해소)

**조건 이행 후 운영 배포한다** (아래 "채택 조건" 참조).

## 선택지 (Options Considered)

### 옵션 A: M3 단독 primary (채택)
- 장점: R2 전 게이트 PASS, Apache 2.0 라이센스, p95 44.9s 마진 충분, 즉시 투입 가능
- 단점: 80B MoE 단일 실패점, Gold Set 메타 편향 잔존

### 옵션 B: M3 primary + M4 지연 튜닝 후 backup
- 장점: 리스크 분산, M4 경량성 활용
- 단점: 튜닝 1-2주 소요, 지연 개선 불확실, 운영 개시 지연

### 옵션 C: M3 + M4 이중 운영 (난이도별 라우팅)
- 장점: 처리량/UX 최적화, 비용 절감 가능성
- 단점: 라우팅 근거 데이터 부재, 부트캠프 초기 복잡도 조기 도입

### 옵션 D: M4 단독 primary (튜닝 시도)
- 장점: 32B로 운영 부담 절감
- 단점: MT5 85%(합격선 미달), p95 103.2s 하드웨어 한계 가능성, 재평가 연쇄 지연

### 옵션 E: 평가 데이터 확대 (60→200) 후 재결정
- 장점: 메타 편향 완화, 신뢰성 ↑
- 단점: 결정 지연 5-6주, R2가 이미 충분한 분별력 제공

### 옵션 F: ADR-010 확장으로 기록 (vs 신설 ADR-011)
- 장점: 연속성
- 단점: ADR-010 주제(하네스 수정)와 주제 혼합, 감사 난이도 증가

## 근거 (Rationale)

**채택: 옵션 A + 옵션 C를 3개월 로드맵으로 병행 예약**

- **R2가 결정적 분별력 제공**: 4개 모델 중 M3만 전 게이트 PASS. M1/M2는 C4+C7 이중 FAIL, M4는 C7 FAIL. 추가 데이터 없이도 선정 충분.
- **라이센스 안전성이 결정적**: Apache 2.0은 상업적 재배포 자유. EXAONE NC 회색지대(유료 부트캠프 = 상업 운영) 문제를 애초에 회피.
- **옵션 B/D 기각 (Agent A/C 공통)**: M4 지연은 하드웨어 한계 가능성 + 튜닝 후 재평가 비용. 지금 확정할 만한 근거가 없음.
- **옵션 C는 유효하나 조기 도입 비용 크다 (Agent C 2순위)**: 부트캠프 개시 후 실제 문제 분포 데이터가 쌓여야 라우팅 기준 수립 가능. 3개월 로드맵으로 예약.
- **옵션 E 기각**: R2 결과가 이미 분별력 있고 결정 지연 비용이 크다. Gold Set 확대는 P3 병렬 트랙으로 병행.
- **옵션 F 기각 (Reviewer 판단)**: ADR-010은 "하네스 결함 수정"이 주제이고 Consequences가 R2 실행으로 닫혔다. "모델 선정"은 별도 결정으로 기록해야 감사/추적 용이.

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 옵션 A 채택, M4는 secondary fallback 유지 / 옵션 D 기각 | 메모리 34GB 마진, aarch64 검증, p95 마진 16초, MoE cold start 미감지. M4 num_ctx 튜닝 효과 불확실 |
| Agent B (품질) | 조건부 채택 → **Reviewer 정정 후 채택** + 운영 게이트 3건 | (※ R1/R2 데이터 혼동 오류 정정됨) 라이센스 Apache 2.0, Ollama digest "unknown" 무결성 체인 부재, Gold Set 메타 편향, SQL 도메인 적합성 운영 모니터링 필요 |
| Agent C (대안) | 1순위 A (즉시) / 2순위 C (3개월 후 라우팅 전환) / 기각 D | "완벽보다 빠른 투입" 부트캠프 초기 원칙. M3 확정은 성장 경로를 닫지 않고 점진 개선 가능 |
| **Reviewer (Claude)** | **옵션 A 채택 + 운영 게이트 3건 + 로드맵 P2/P3/P4 기록** | 3/3 consensus 우선 + B 사실 오류 정정 후 유효 리스크 수용 + C 2순위를 로드맵으로 예약 |

상세 원문: `docs/rationale/oss-primary-model-selection-2026-04-15.md`

## 채택 조건 (운영 배포 전 게이트)

| # | 게이트 | 상태 |
|---|--------|------|
| 1 | R2 전 게이트 PASS + Apache 2.0 라이센스 | ✅ 완료 |
| 2 | Ollama `qwen3-coder-next` sha256 digest 조회 + pin 자동화 | ⏳ 대기 |
| 3 | 운영 초기 100건 실사용 모니터링 파이프라인 구축 (MT3/MT4 샘플 재측정) | ⏳ 대기 |
| 4 | 메타 편향 주의문 SDD/운영 문서 명시 | ⏳ 대기 |

## 로드맵 (조건부 트리거)

| Phase | 시점 | 작업 | 트리거 조건 |
|---|---|---|---|
| **P1** | 즉시 | M3 단독 운영 개시, BullMQ concurrency=1 | 위 채택 조건 2-4 이행 완료 |
| **P2** | 3개월 후 | M4 지연 튜닝 + 이중 라우팅 재검토 | 부트캠프 피드백 ≥100건 축적 |
| **P3** | 병렬 트랙 | Gold Set 200문제 확대 + DBA 강사 peer review | 메타 편향 정량 측정 필요 시 |
| **P4** | 별도 ADR | M5 Llama 3.3 num_ctx 튜닝, Ollama schema-constrained decoding | ADR-012 또는 ADR-010-A로 분리 |

## 결과 (Consequences)

### 긍정적
- OSS 런타임 전환 가능 (Claude API 호출 비용 절감, 데이터 주권 확보)
- Apache 2.0 라이센스로 상용 리스크 제로 (유료 부트캠프 정합)
- M3의 p95 44.9s + MT5 98.3%로 품질/지연 모두 운영 기준 만족
- EXAONE commercial license 문의 절차 불필요로 전환 (일정 단축)

### 부정적
- 80B MoE 단일 인스턴스는 단일 실패점 — P2/P4에서 보완 예정
- Gold Set 메타 편향이 잔존하며 실 도메인 성능은 운영 모니터링으로만 검증 가능
- Ollama 모델 digest "unknown" 상태 — 무결성 체인 수동 구축 필요

### 주의사항
- **P2 트리거 조건 점검 의무**: 부트캠프 3개월차에 피드백 데이터 집계 + 라우팅 전환 판단 미팅 필수
- **R2 이후 재평가는 P3 게이트** — 운영 중 이상 패턴 감지 시 앞당길 수 있음
- **BullMQ concurrency 변경 금지** (단일 인스턴스 메모리 한계) — 변경 필요 시 별도 ADR

---

**관련 문서**:
- `docs/rationale/oss-primary-model-selection-2026-04-15.md` (3+1 합의 원문 + narrative)
- `docs/rationale/oss-model-selection-rationale.md` (2026-04-09, 후보 5개 선정 근거)
- `docs/decisions/ADR-010-oss-eval-harness-fix.md` (하네스 P0 수정)
- `docs/architecture/oss-model-evaluation-design.md` (SDD v2.7 — primary 선정 결과 반영 예정)
- R2 평가 artifact: `apps/eval-results/R-2026-04-14T11-32-26Z/` (M3 근거 데이터)
