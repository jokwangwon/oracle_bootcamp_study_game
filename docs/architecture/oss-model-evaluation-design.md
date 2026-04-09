# OSS 모델 자체 호스팅 평가 설계 (SDD v2)

> Oracle DBA 학습 게임의 LLM 런타임을 Claude API에서 자체 호스팅 OSS 모델로 교체하기 위한 평가 시스템 설계 문서.

| 항목 | 값 |
|---|---|
| **문서 유형** | SDD (Specification-Driven Design) |
| **버전** | **v2** (2026-04-09 — consensus-002 반영 + Q1~Q4 결정 반영) |
| **상태** | 사용자 검토 대기 |
| **선행 문서** | `docs/rationale/oss-model-selection-rationale.md`, `docs/rationale/exaone-license-extract.md`, `docs/review/consensus-002-oss-model-evaluation.md` |
| **관련 ADR** | ADR-005 (AI 백엔드 스택, 보안 3항목 정합), ADR-008 (Oracle DBA 게임 스택), ADR-009 (LangChain + Langfuse) |
| **후속 산출물** | ADR-010 (모델 선정 결정), 평가 결과 보고서, 운영 배포 ADR |

---

## 0. v1 → v2 변경 요약 (consensus-002 반영)

**v2는 v1 대비 다음 12개 HIGH + 6 MED + 5 LOW + 6 누락 + 4 사용자 결정을 반영한다.**

| 카테고리 | 항목 |
|---|---|
| **사용자 결정 Q1** | promptfoo 채택 (옵션 B). 자체 EvaluationRunner 트랙 폐기 |
| **사용자 결정 Q2** | Gold Set B = 30문제 (절충안) |
| **사용자 결정 Q3** | 평가 진행 + 운영 시점에만 LG 문의 + LICENSE 사본 첨부 |
| **사용자 결정 Q4** | Langfuse self-host (데이터 주권 정합) |
| **HIGH** | sanity check 5모델 확장 / `format`+Parser 충돌 회피 / EXAONE Modelfile 토큰 수정 / LlmClient factory 리팩터링 / Ollama 포트 비공개 / MT8 sanitization 신설 / 통계 강화 / Judge 편향 보정 / LICENSE 사본 / Langfuse self-host / Phase 0 베이스라인 / promptfoo |
| **MED** | C7 60s 완화 / KEEP_ALIVE -1 + 명시적 swap / temperature trace 검증 / GGUF+Ollama digest pin / Gold B 30 |
| **LOW** | depends_on healthcheck / Modelfile 컨테이너 경로 / round vs run 용어 통일 / 엣지 케이스 §10.4 / TDD 적용 불가 단계 smoke test |
| **누락** | extractOracleTokens export / prompt portability / Ollama seed 검증 / 양자화 폴백 공정성 / 결과 JSON schema / GB10 thermal |

---

## 1. 목적과 비목적

### 1.1 목적

1. 자체 호스팅 가능한 OSS 모델 5개를 정량적으로 비교하여 **Oracle DBA 학습 게임의 문제 생성용 LLM**을 한 개 선정한다.
2. 선정 결과를 기반으로 ADR-010을 작성하고, `LlmClient`에 ChatOllama 어댑터를 추가하는 후속 PR로 연결한다.
3. 평가 자체가 향후 모델 교체/업그레이드 시 재현 가능한 **회귀 가능한 평가 하네스**가 되도록 설계한다.

### 1.2 비목적 (이번 SDD가 다루지 않는 것)

- 모델 학습/파인튜닝 (LoRA 등) — 평가 결과로 필요성이 입증되면 별도 SDD
- 운영 단계 처리량 최적화 (vLLM 전환 등) — 평가 후 별도 ADR
- 임베딩/RAG 파이프라인 — 별도 작업
- 노션 import → 범위 추론 — 별도 트랙

### 1.3 합격선 (Pass Criteria) — v2 강화

> **v2 변경**: v1의 절대치 단독 게이트 → **절대치 + Claude 베이스라인 상대치 이중 게이트** (C-11)

선정 모델은 **모든** 다음 조건을 동시에 만족해야 한다:

| # | 조건 | 절대치 합격선 | 상대치 게이트 (Claude 베이스라인 대비) | 측정 도구 |
|---|---|---|---|---|
| **C1** | JSON 파싱 성공률 | ≥ 95% | -5%p 이내 | `StructuredOutputParser` 또는 native JSON mode (둘 중 하나, §7) |
| **C2** | Zod 스키마 통과율 | ≥ 95% | -5%p 이내 | `packages/shared/src/schemas/question.schema.ts` |
| **C3** | 학습 범위(화이트리스트) 통과율 | ≥ 90% | -5%p 이내 | `ScopeValidator` |
| **C4** | 빈칸-정답 일관성 (빈칸 모드) | ≥ 95% | -5%p 이내 | `packages/shared/src/utils/oracle-tokens.ts` (N-01 export) |
| **C5** | 한국어 자연스러움 (LLM-as-Judge pairwise + 보조 지표) | 평균 ≥ 4.0 | -0.3 이내 | Claude judge + 한국어 계산적 보조 (§3.2) |
| **C6** | Oracle SQL 사실 정확성 (LLM-as-Judge + spot-check) | 평균 ≥ 4.0 | -0.3 이내 | Claude + 사용자 spot-check (상위 2개 전수) |
| **C7** | 단일 라운드 종단 지연 (1문제 생성, GB10 환경) | **≤ 60s** (v1 30s → v2 완화, M-01) | — | Langfuse trace |
| **C8** | **출력 sanitization 통과율** (v2 신설, C-06) | **≥ 99%** | — | MT8 blocklist |

> **이중 게이트 의미**: 절대치를 통과하지 못해도 Claude 베이스라인 자체가 미달성한 메트릭은 상대치(Claude 대비 -5%p 이내)로 대체 인정. Phase 0(§Phase 0)에서 Claude 베이스라인을 먼저 측정한 뒤 합격선을 데이터 기반으로 ±5%p 범위에서 재보정한다.

> **여러 모델이 합격선을 통과한 경우의 우선순위**: ① 합격 메트릭 수 → ② 한국어 자연스러움(C5) → ③ 라이센스 안전성(§9) → ④ 지연(C7) → ⑤ 메모리 사용량.

---

## Phase 0 (v2 신설) — Claude 베이스라인 측정 + Prompt Portability 검증

> **C-11 + N-02 반영.** 후보 OSS 모델 평가(R1~R3) 시작 전에 Phase 0를 먼저 실행한다.

### Phase 0.1 — Claude 베이스라인 측정

| 단계 | 작업 |
|---|---|
| 1 | 현재 운영 중인 Claude API로 Gold Set A(30) + Gold Set B(30) 측정, 5 run 반복 |
| 2 | C1~C8 절대치 측정 결과 기록 |
| 3 | 합격선을 측정값 ±5%p 범위에서 재보정 (§1.3 수정) |
| 4 | 재보정 결과를 본 SDD §1.3 표에 patch (실제 측정 후 변경) |

### Phase 0.2 — Prompt Portability 검증

| 단계 | 작업 |
|---|---|
| 1 | 현재 Claude 용 system prompt를 OSS 모델(EXAONE 3.5, Qwen2.5-Coder)에 그대로 입력하여 출력 비교 |
| 2 | 의미적 차이가 있으면 OSS용 prompt variant를 Langfuse Prompt Management에 별도 등록 |
| 3 | Phase 1 평가에 어느 prompt를 사용할지 결정 (모델별 vs 공통) |

> Phase 0이 끝나야 Phase 1(R1~R3)이 신뢰할 수 있는 데이터로 시작될 수 있다.

---

## 2. 후보 모델 매트릭스

판단 근거는 `docs/rationale/oss-model-selection-rationale.md` 참조.

| # | 모델 | 크기 | Q8 메모리 | 라이센스 | Ollama 경로 | 역할 |
|---|---|---|---|---|---|---|
| **M1** | EXAONE 4.0 32B | 32B dense | ~35 GB | EXAONE 1.2 NC (`docs/rationale/exaone-license-extract.md` 참조) | `ollama create exaone4 -f Modelfile` (HF GGUF 직접 import, §8) | 한국어 SOTA 후보 |
| **M2** | EXAONE 3.5 32B | 32B dense | ~35 GB | EXAONE 1.2 NC | `ollama pull exaone3.5:32b` | 한국어 베이스라인 + M1 폴백 |
| **M3** | Qwen3-Coder-Next | 80B MoE / 3B active | ~85 GB | Apache 2.0 | `ollama pull qwen3-coder-next` (Ollama ≥ 0.15.5) | 코딩 SOTA |
| **M4** | Qwen2.5-Coder 32B | 32B dense | ~35 GB | Apache 2.0 | `ollama pull qwen2.5-coder:32b` | 코드 베이스라인 (Coder-Next 비교 대조군) |
| **M5** | Llama 3.3 70B | 70B dense | ~75 GB | Llama Community | `ollama pull llama3.3:70b` | 음의 베이스라인 (한국 특화 vs 글로벌 대형) |
| (참조) | Claude (현재 운영) | — | — | 상용 API | LlmClient 기존 경로 | **Phase 0 베이스라인 + 절대 기준선** |

> GB10 통합 메모리 119 GB 제약 안에서 M3가 가장 빠듯하므로, 평가 라운드에서는 한 번에 1개 모델만 swap하여 실행한다. **양자화 폴백 시 비교 공정성**(N-04): 모든 모델은 동일 양자화 계열(Q8 우선, Q5_K_M 폴백) 안에서만 비교하고, 다른 양자화 결과는 별도 컬럼으로 분리해 표기한다.

---

## 3. 평가 메트릭

CLAUDE.md §3 (계산적 검증 우선) 원칙에 따라 **계산적 메트릭 6개를 먼저** 측정하고, 통과한 후보에만 **추론적 메트릭 2개**를 적용한다.

### 3.1 Tier 1 — 계산적 메트릭 (모든 후보 적용)

| # | 메트릭 | 정의 | 도구 | 합격선 |
|---|---|---|---|---|
| **MT1** | JSON 파싱 성공률 | LLM 출력이 유효 JSON으로 파싱되는 비율 | `StructuredOutputParser` 또는 Ollama native `format: 'json'` (둘 중 하나만, §7.2 C-02) | C1 ≥ 95% |
| **MT2** | Zod 스키마 통과율 | 파싱된 JSON이 `BlankTypingContent` / `TermMatchContent` Zod 스키마를 통과한 비율 | `packages/shared/src/schemas/question.schema.ts` | C2 ≥ 95% |
| **MT3** | 화이트리스트 통과율 | 모든 keyword/term이 weekly_scope 화이트리스트에 존재 | `apps/api/src/modules/content/services/scope-validator.service.ts` | C3 ≥ 90% |
| **MT4** | 빈칸-정답 일관성 | `template`의 `___` 개수가 `answers` 길이와 일치 + 정답이 화이트리스트에 존재 | `packages/shared/src/utils/oracle-tokens.ts` (N-01 export 후 재사용) | C4 ≥ 95% |
| **MT5** | 종단 지연 / 토큰 / 비용 | wall-clock + I/O tokens + 메모리 사용 | Langfuse trace + `nvidia-smi` 샘플링 | C7 ≤ 60s |
| **MT8** (v2 신설) | **출력 sanitization** | blocklist 패턴(`<script`, `{{`, `}}`, `javascript:`, `data:`, SSRF host, SQL injection 패턴)이 출력에 등장하지 않는 비율 | `eval/assertions/sanitization.ts` (정규식 + URL 파싱) | **C8 ≥ 99%** |

### 3.2 Tier 2 — 추론적 메트릭 (Tier 1 통과 후보만, v2 강화)

> **C-08 반영**: 단일 judge → ① **pairwise judge** + ② **한국어 계산적 보조** + ③ **사용자 spot-check 확대**

#### MT6 — 한국어 자연스러움 (강화)

| 측정 방식 | 도구 | 가중치 |
|---|---|---|
| **계산적 보조** (Tier 1으로 부분 편입) | 어절 다양성, 조사 정합성 정규식, 한글 비율 | 30% |
| **Pairwise judge** (Chatbot Arena 방식) | Claude judge가 두 모델의 출력을 동시에 보고 "어느 쪽이 더 자연스러운가" 선택 + 이유 설명 | 50% |
| **사용자 spot-check** (R3 상위 2개 모델 전수 검수, 60건/모델) | 사용자 직접 검수 | 20% |

총점 5점 척도 환산. C5 절대치 ≥ 4.0, 상대치 -0.3 이내.

#### MT7 — Oracle SQL 사실 정확성

| 측정 방식 | 도구 | 가중치 |
|---|---|---|
| **Pairwise judge** | Claude judge가 두 모델 출력의 SQL 정확성 비교 | 60% |
| **사용자 spot-check** (상위 2개 전수, 60건/모델) | 사용자 직접 검수 | 40% |

총점 5점 척도. C6 절대치 ≥ 4.0, 상대치 -0.3 이내.

### 3.3 메트릭 집계 (v2 강화 — C-07)

- **표본 수**: 각 prompt × 5 run (v1 3 → v2 5)
- **집계**: macro stratified mean — 난이도(easy/medium/hard) × 모드(빈칸/용어) bucket의 평균을 다시 평균
- **신뢰구간**: bootstrap 1000회로 95% CI 산출
- **효과 크기**: Cohen's d (모델 간 차이의 표준화된 크기)
- **다중 비교 보정**: 5모델 10쌍의 pairwise 비교에 **Bonferroni** 보정 적용 (α=0.05/10=0.005)
- **모든 결과는 Langfuse(self-host) score + promptfoo 리포트(로컬 JSON+HTML)에 기록**

---

## 4. 데이터셋 설계

두 개의 골드셋(Gold Set)을 사용한다. 평가는 두 셋을 모두 통과한 모델만 선정 후보로 본다.

### 4.1 Gold Set A — 기존 시드 30문제 (Recall 검증)

**목적**: "이미 검증된 정답이 있는 입력으로 모델이 같은 영역을 재현할 수 있는가" 측정.

**구성**:
- 출처: `apps/api/src/modules/content/seed/data/week1-sql-basics.questions.ts`
- 빈칸 타이핑 15 + 용어 맞추기 15 = 30문제
- 각 문제의 keyword/term을 prompt 입력으로 사용하고 모델이 문제를 재생성
- 정답 비교가 아니라 **계산적 메트릭(MT1~MT5, MT8)** 만 적용
- 30문제 × 5개 모델 × 5 run = **750 라운드**

### 4.2 Gold Set B — 신규 평가셋 30문제 (Generalization 검증) — v2 변경

> **M-06 반영**: v1 20문제 → v2 **30문제**

**목적**: "본 적 없는 입력에서도 합격선을 유지하는가" 측정.

**구성**:
- **별도 작성**: 빈칸 15 + 용어 15 = **30문제**
- 1주차 sql-basics 화이트리스트 안의 keyword를 사용하되, 시드와 다른 주제 조합
- 난이도 분포: easy 10 / medium 12 / hard 8 (난이도 균형)
- **작성/검수 분리** (B-MED + 누락 반영): 작성자는 Claude(합성), 검수자는 사용자(부트캠프 운영자)
  1. Claude로 80문제 합성
  2. 사용자가 부적합/중복 제거하여 30문제 확정
  3. 작성자 ≠ 검수자 보장
- 30문제 × 5개 모델 × 5 run = **750 라운드**
- Tier 2 (MT6, MT7) 측정 시 Gold B 우선 사용

### 4.3 데이터셋 저장

- **위치**: `apps/api/src/modules/ai/eval/datasets/`
- **포맷**: TypeScript 모듈 + promptfoo YAML 참조
  - `gold-set-a.ts` — 기존 시드 prompt 매핑
  - `gold-set-b.ts` — 신규 30문제
  - `gold-set-b.synthesis.log.md` — Claude 합성 → 사용자 검수 로그 (감사용)

---

## 5. 평가 하네스 — promptfoo (v2 결정 Q1)

> **Q1 결정**: 자체 EvaluationRunner 폐기 → **promptfoo 단일 트랙 채택**

### 5.1 채택 근거 (consensus-002 C-12)

- **TS 네이티브** — 모노레포(apps/api NestJS)와 동일 런타임, ADR-005 미발동 유지
- **YAML 선언형** — providers + tests + assertions 선언만으로 평가 표현
- **Ollama / Anthropic provider 내장** — `providers: [ollama:chat:..., anthropic:claude-...]`
- **커스텀 assertion = JS 함수** — MT2/MT3/MT4/MT8을 기존 NestJS 코드 직접 import해 호출
- **llm-rubric assertion** — MT6/MT7 LLM-as-Judge 기본 제공 (pairwise 모드 지원)
- **HTML 리포트 + JSON export** — 감사용 결과 보존
- **CI 친화** — pass/fail exit code

### 5.2 디렉토리 구조 (v2 갱신)

```
apps/api/src/modules/ai/eval/
├── promptfoo.config.yaml           # 평가 선언 (providers, tests, assertions, output)
├── README.md                       # 사용법
├── datasets/
│   ├── gold-set-a.ts
│   ├── gold-set-b.ts
│   └── gold-set-b.synthesis.log.md
├── assertions/                     # promptfoo 커스텀 assertion = JS 함수
│   ├── json-parse.ts               # MT1
│   ├── zod-schema.ts               # MT2 (question.schema.ts wrap)
│   ├── scope-whitelist.ts          # MT3 (ScopeValidator wrap)
│   ├── blank-consistency.ts        # MT4 (oracle-tokens.ts 재사용)
│   ├── latency.ts                  # MT5
│   ├── sanitization.ts             # MT8 (v2 신설)
│   └── korean-features.ts          # MT6 계산적 보조 (어절 다양성, 조사)
├── providers/
│   └── langfuse-wrapped.ts         # promptfoo provider를 LlmClient + Langfuse trace로 wrap
├── modelfiles/
│   └── exaone4.Modelfile           # EXAONE 4.0 GGUF 임포트 (§8)
├── reports/
│   ├── schema.v1.ts                # 결과 JSON schema (감사용 고정 양식, N-05)
│   └── report-generator.ts         # markdown 보고서 생성
└── eval.controller.ts              # POST /api/eval/run (관리자 전용 트리거)
```

### 5.3 promptfoo 어댑터 패턴 (Langfuse trace 유지)

```yaml
# promptfoo.config.yaml (의도)
providers:
  - id: ollama:chat:exaone3.5:32b
    config:
      apiBaseUrl: http://ollama:11434
      temperature: 0.2
      seed: 42
  - id: anthropic:messages:claude-opus-4-6
    config:
      apiKey: ${ANTHROPIC_API_KEY}
      temperature: 0.2

tests: file://./datasets/gold-set-a.yaml

defaultTest:
  assert:
    - type: javascript
      value: file://./assertions/json-parse.ts
    - type: javascript
      value: file://./assertions/zod-schema.ts
    - type: javascript
      value: file://./assertions/scope-whitelist.ts
    - type: javascript
      value: file://./assertions/blank-consistency.ts
    - type: javascript
      value: file://./assertions/sanitization.ts

# Tier 2는 별도 config로 분리 (Tier 1 통과 모델만)
```

> Langfuse trace는 promptfoo provider를 `langfuse-wrapped.ts`로 감싸 LlmClient를 경유시키면 자동 부착됨 → ADR-009 ③ 강제 사항 정합 유지.

### 5.4 Langfuse self-host (v2 결정 Q4)

> **Q4 결정**: Langfuse self-host

- docker-compose에 `langfuse` + `langfuse-db` 컨테이너 추가 (§6.1)
- `LANGFUSE_HOST=http://langfuse:3000` (compose 내부)
- prompt/output 본문이 외부로 나가지 않음 → rationale §1.2 데이터 주권 정합

---

## 6. 인프라 변경

### 6.1 docker-compose 추가 (v2.1 — Langfuse v3 풀 인프라)

> **C-05 (Ollama 포트 비공개) + Q4 (Langfuse self-host) + L-01 (depends_on healthcheck) + M-05 (이미지 digest pin) 반영**
>
> **v2.1 patch (2026-04-09)**: 단계 1 sanity check 시 Langfuse v3가 `CLICKHOUSE_URL is not configured` 오류로 restart loop 발견. v3는 단순 `langfuse + postgres` 2 컨테이너 구성이 더 이상 동작하지 않으며 **postgres + clickhouse + redis + minio + langfuse-worker + langfuse-web 5개 컨테이너 풀 인프라**가 필수. 사용자 결정으로 옵션 B (v3 풀 인프라 도입)를 채택하여 본 절 yml을 갱신.

```yaml
  ollama:
    image: ollama/ollama@sha256:<pinned-digest>   # M-05: digest pin
    container_name: oracle-game-ollama
    restart: unless-stopped
    environment:
      OLLAMA_HOST: 0.0.0.0:11434
      OLLAMA_KEEP_ALIVE: "-1"                      # M-02: 평가 배치 동안 영구 유지
      OLLAMA_NUM_PARALLEL: 1                       # 결정론
    # ports 블록 제거 — compose 내부 네트워크에서만 접근 (C-05)
    expose:
      - "11434"
    volumes:
      - ./ollama-data:/root/.ollama
      - ./apps/api/src/modules/ai/eval/modelfiles:/modelfiles:ro   # L-02
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Langfuse v3 풀 인프라 (postgres + clickhouse + redis + minio + worker + web)
  langfuse-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: langfuse
      POSTGRES_PASSWORD: ${LANGFUSE_DB_PASSWORD}
      POSTGRES_DB: langfuse
    volumes: [./langfuse-db-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U langfuse"]

  langfuse-clickhouse:
    image: clickhouse/clickhouse-server:latest
    user: "101:101"
    environment:
      CLICKHOUSE_USER: ${LANGFUSE_CLICKHOUSE_USER}
      CLICKHOUSE_PASSWORD: ${LANGFUSE_CLICKHOUSE_PASSWORD}
    volumes:
      - ./langfuse-clickhouse-data:/var/lib/clickhouse
      - ./langfuse-clickhouse-logs:/var/log/clickhouse-server
    healthcheck:
      test: wget --no-verbose --tries=1 --spider http://localhost:8123/ping || exit 1

  langfuse-redis:
    image: redis:7-alpine
    command: --requirepass ${LANGFUSE_REDIS_AUTH} --maxmemory-policy noeviction
    volumes: [./langfuse-redis-data:/data]
    # 기존 oracle-game-redis (BullMQ)와 분리 — 네트워크 호스트명도 다름

  langfuse-minio:
    image: minio/minio:latest
    command: -c 'mkdir -p /data/langfuse && minio server --address ":9000" --console-address ":9001" /data'
    environment:
      MINIO_ROOT_USER: ${LANGFUSE_MINIO_USER}
      MINIO_ROOT_PASSWORD: ${LANGFUSE_MINIO_PASSWORD}
    volumes: [./langfuse-minio-data:/data]
    ports: ["127.0.0.1:${LANGFUSE_MINIO_CONSOLE_PORT}:9001"]   # console UI만 노출

  langfuse-worker:
    image: langfuse/langfuse-worker:3
    depends_on: &lf-deps
      langfuse-db: { condition: service_healthy }
      langfuse-clickhouse: { condition: service_healthy }
      langfuse-redis: { condition: service_healthy }
      langfuse-minio: { condition: service_healthy }
    environment: &lf-env
      DATABASE_URL: postgresql://langfuse:${LANGFUSE_DB_PASSWORD}@langfuse-db:5432/langfuse
      SALT: ${LANGFUSE_SALT}
      ENCRYPTION_KEY: ${LANGFUSE_ENCRYPTION_KEY}   # ★ 정확히 64자 hex (openssl rand -hex 32)
      CLICKHOUSE_URL: http://langfuse-clickhouse:8123
      CLICKHOUSE_MIGRATION_URL: clickhouse://langfuse-clickhouse:9000
      CLICKHOUSE_USER: ${LANGFUSE_CLICKHOUSE_USER}
      CLICKHOUSE_PASSWORD: ${LANGFUSE_CLICKHOUSE_PASSWORD}
      REDIS_HOST: langfuse-redis
      REDIS_PORT: "6379"
      REDIS_AUTH: ${LANGFUSE_REDIS_AUTH}
      LANGFUSE_S3_EVENT_UPLOAD_BUCKET: langfuse
      LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT: http://langfuse-minio:9000
      LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID: ${LANGFUSE_MINIO_USER}
      LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY: ${LANGFUSE_MINIO_PASSWORD}
      LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE: "true"
      # ... LANGFUSE_S3_MEDIA_UPLOAD_*도 동일하게 minio로 (실제 yml 참조)

  langfuse:
    image: langfuse/langfuse:3
    depends_on: *lf-deps
    environment:
      <<: *lf-env
      NEXTAUTH_SECRET: ${LANGFUSE_NEXTAUTH_SECRET}
    ports: ["127.0.0.1:${LANGFUSE_PORT}:3000"]   # 호스트 UI: http://localhost:3010
```

> 위 yml은 SDD에서 핵심 환경변수만 발췌. 전체 정의는 실제 `docker-compose.yml`과 `scripts/eval/README.md` 참조. 단계 1 트러블슈팅 표는 `scripts/eval/README.md`에 있다.

#### `api` 서비스 환경변수 변경

```yaml
  api:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      ollama:                                  # L-01: depends_on healthcheck
        condition: service_healthy
      langfuse:
        condition: service_started
    environment:
      ...
      OLLAMA_BASE_URL: http://ollama:11434     # 내부 네트워크
      LLM_PROVIDER: ${LLM_PROVIDER:-anthropic} # 평가 시 'ollama' 사용
      LLM_MODEL: ${LLM_MODEL:-claude-opus-4-6}
      LANGFUSE_HOST: http://langfuse:3000      # self-host로 변경
      LANGFUSE_PUBLIC_KEY: ${LANGFUSE_PUBLIC_KEY}
      LANGFUSE_SECRET_KEY: ${LANGFUSE_SECRET_KEY}
```

### 6.2 GB10 / aarch64 환경 특이사항

1. **Ollama ARM 빌드**: 첫 부팅 시 multi-arch 매니페스트 검증 필수 (§14 미해결 1)
2. **NVIDIA 드라이버**: GB10 + CUDA 13.0 + driver 580.126.09. Ollama 자동 감지
3. **통합 메모리**: GB10은 CPU/GPU가 119GB 공유. `nvidia-smi` VRAM "Not Supported" 정상
4. **Issue #15318 (DGX Spark Gemma segfault) 위험**: §11 R2 + 단계 1 sanity check (C-01)에서 5개 모델 전부 load + 1문제 생성을 강제 검증
5. **`OLLAMA_KEEP_ALIVE=-1`** + runner의 명시적 swap 제어 (M-02)
6. **Thermal throttling** (B-LOW + N-06): 119GB 통합 메모리 풀의 장시간 평가 시 throttle 발생 가능 → §14 미해결로 추적

### 6.3 환경변수 추가

`.env.example`에 추가:

```
# OSS 모델 평가 (SDD: oss-model-evaluation-design.md v2)
OLLAMA_BASE_URL=http://ollama:11434

# Langfuse self-host (v2 Q4)
LANGFUSE_HOST=http://langfuse:3000
LANGFUSE_DB_PASSWORD=changeme
LANGFUSE_NEXTAUTH_SECRET=changeme
LANGFUSE_SALT=changeme

# 평가 시에만 LLM_PROVIDER=ollama 로 override
# LLM_PROVIDER=ollama
# LLM_MODEL=exaone3.5:32b
```

---

## 7. LangChain `ChatOllama` 통합 + LlmClient factory 리팩터링 (v2)

### 7.1 LlmClient factory 리팩터링 (C-04)

> v1의 단일 provider 하드와이어 → **EvaluationLlmClientFactory** 또는 `LlmClient` factory 패턴

```typescript
// apps/api/src/modules/ai/llm-client.factory.ts (의도)

@Injectable()
export class LlmClientFactory {
  constructor(private readonly config: ConfigService) {}

  /** 운영용 — 환경변수 기반 단일 인스턴스 (기존 동작 호환) */
  createDefault(): LlmClient { ... }

  /** 평가용 — provider/model을 호출 시점에 지정 */
  createFor(opts: { provider: 'anthropic' | 'ollama'; model: string; baseUrl?: string }): LlmClient {
    return new LlmClient({
      provider: opts.provider,
      model: opts.model,
      baseUrl: opts.baseUrl,
      callbacks: this.config.get('LANGFUSE_PUBLIC_KEY') ? [/* langfuse */] : [],
    });
  }
}
```

이로써 평가 중 **judge=Claude + eval target=Ollama 동시 인스턴스** 가능.

### 7.2 ChatOllama 어댑터 추가 + format 충돌 회피 (C-02)

```typescript
// LlmClient.createModel() 안에:
if (provider === 'ollama') {
  const baseUrl = opts.baseUrl ?? this.config.get<string>('OLLAMA_BASE_URL');
  return new ChatOllama({
    baseUrl,
    model: opts.model,
    temperature: 0.2,
    // C-02: format: 'json' 또는 StructuredOutputParser 둘 중 하나만
    // → 단계 3 전 실증 테스트로 결정. 아래 둘 중 하나만 활성화
    // format: 'json',           // (a) Ollama native JSON mode
    // ↑↓ 둘 다 비활성화하고 StructuredOutputParser만 사용  // (b) LangChain parser
  });
}
```

> **결정 시점**: 단계 3 시작 전에 두 옵션을 작은 샘플로 실증 비교 후 한쪽으로 확정. 결과를 본 SDD §7.2에 patch.

### 7.3 ADR-009 정합성 점검 (v2 갱신)

| ADR-009 강제 사항 | v2 변경 | 충돌? |
|---|---|---|
| ① SDK 직접 import 금지 | `@langchain/ollama` 어댑터만 import | ✅ 없음 |
| ② 프롬프트 하드코딩 금지 | `PromptManager` (Langfuse self-host) 그대로 사용 | ✅ 없음 |
| ③ Langfuse callback 자동 부착 | `LlmClient.invoke()`가 callbacks 자동 부착 (factory도 동일) | ✅ 없음 |
| ④ Zod 검증 없이 DB 저장 금지 | 평가 결과는 DB 저장 안 함 (Langfuse + 로컬 JSON) | ✅ 없음 |

### 7.4 ADR-005 보안 3항목 정합성 (v2 신설, C-05)

| ADR-005 보안 항목 | v2 SDD 반영 |
|---|---|
| 키 관리 | `LANGFUSE_*`, `OLLAMA_BASE_URL`은 .env로 분리 (§6.3). secrets는 .env.local로 격리 |
| 출력 검증 | MT2(Zod) + MT3(ScopeValidator) + MT8(sanitization, C-06) 3중 |
| 인젝션 방어 | (a) 사용자 입력은 prompt 삽입 전 화이트리스트 검증 (b) 출력은 MT8 blocklist (c) Ollama 컨테이너는 외부 노출 차단 (§6.1) |

### 7.5 의존성

```
apps/api/package.json:
  "dependencies": {
    "@langchain/ollama": "^x.y.z"   # 추가
  }
  "devDependencies": {
    "promptfoo": "^x.y.z"            # 평가 도구
  }
```

---

## 8. EXAONE 4.0 GGUF 임포트 절차 (v2.2 patch — chat_template 1차 검증 반영)

### 8.1 Modelfile (v2.2 — 검증된 chat_template 형식)

> **C-03 (v2)**: v1의 `<|...|>` → v2의 **`[|...|]`** (실제 EXAONE 토큰 형식)
>
> **§14 미해결 #2 (v2.2 patch, 2026-04-09)**: WebFetch로 다음 두 파일을 검증 완료 →
> - `tokenizer_config.json`: bos=`[BOS]`, eos=`[|endofturn|]`(id 361), 역할 토큰 `[|system|]`(357) `[|user|]`(360) `[|assistant|]`(359) `[|tool|]`(358), chat_template 필드는 이 파일에 없음
> - `chat_template.jinja`: 각 역할 토큰 뒤 `\n` 강제, `end_of_turn = '[|endofturn|]\n'`, BOS prompt에 미삽입, assistant 턴 시작 시 (non-thinking 분기) `<think>\n\n</think>\n\n` 빈 블록 삽입
>
> v2 (단순) → v2.2 (검증된 형식) 차이:
> 1. 역할 토큰 뒤 개행 강제
> 2. `[|endofturn|]` 뒤 개행 강제
> 3. assistant 턴 시작 시 빈 `<think></think>` 블록 강제 삽입 (EXAONE 4.0은 thinking 모델, non-thinking 평가 모드)
> 4. 단순 .System/.Prompt/.Response 형식 → `.Messages` 형식 (ChatOllama /api/chat 호환)

```dockerfile
# /modelfiles/exaone4.Modelfile (컨테이너 내부 경로, L-02)
# 호스트 경로: apps/api/src/modules/ai/eval/modelfiles/exaone4.Modelfile
# 실제 파일: apps/api/src/modules/ai/eval/modelfiles/exaone4.Modelfile (커밋됨)
# README:    apps/api/src/modules/ai/eval/modelfiles/README.md (다운로드/import 절차)
FROM /modelfiles/EXAONE-4.0-32B-Q8_0.gguf   # HuggingFace 실제 파일명

PARAMETER temperature 0.2
PARAMETER num_ctx 8192
PARAMETER stop "[|endofturn|]"

SYSTEM ""

# .Messages-aware 형식 — chat_template.jinja와 1:1 매핑
TEMPLATE """{{- range .Messages }}
{{- if eq .Role "system" }}[|system|]
{{ .Content }}[|endofturn|]
{{ else if eq .Role "user" }}[|user|]
{{ .Content }}[|endofturn|]
{{ else if eq .Role "assistant" }}[|assistant|]
<think>

</think>

{{ .Content }}[|endofturn|]
{{ end }}
{{- end }}[|assistant|]
<think>

</think>

"""
```

검증 출처:
- https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B/raw/main/tokenizer_config.json
- https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B/raw/main/chat_template.jinja

추가 발견 (v2.2):
- HuggingFace GGUF 파일명은 `EXAONE-4.0-32B-Q8_0.gguf` (34 GB), v2의 가정 `exaone-4.0-32b-q8.gguf`와 다름. 정정.
- Ollama 컨테이너 0.20.4 확인 (실측). EXAONE 4.0 architecture 코드는 ≥ v0.11.5-rc2부터 지원되므로 GGUF import 성공 확률 ↑. 단, `ollama.com/library/exaone4`는 404 (라이브러리 미등록) → §8.3 GGUF 수동 import 경로 그대로 유효.
- 단계 1 sanity v2 (5모델, M1은 import 미완료 시 SKIP) 통과: M2 24s / M3 25s / M4 19s / M5 48s / M1 SKIP. 모두 C7(60s) 이내.

### 8.2 임포트 + 무결성 검증 (M-04, M-05)

```bash
# 1. HF에서 GGUF 다운로드 + SHA256 검증
huggingface-cli download LGAI-EXAONE/EXAONE-4.0-32B-GGUF \
  exaone-4.0-32b-q8.gguf --local-dir ./ollama-data/models/
sha256sum ./ollama-data/models/exaone-4.0-32b-q8.gguf > sha256.txt
# HF 페이지의 hash와 비교

# 2. 컨테이너 내부 모델 생성
docker compose exec ollama \
  ollama create exaone4:32b -f /modelfiles/exaone4.Modelfile

# 3. 동작 확인
docker compose exec ollama ollama run exaone4:32b "안녕하세요. 자기소개 부탁드립니다."

# 4. 평가 결과 보고서에 다음 메타 기록
#    - GGUF SHA256
#    - Ollama image digest (M-05)
#    - CUDA/driver 버전 (nvidia-smi)
#    - Ollama 버전
```

### 8.3 폴백 전략

1. GGUF import 실패 → **EXAONE 3.5 32B (Ollama 정식)** 폴백
2. Ollama 측 EXAONE 4.0 정식 지원 PR(#11433) 머지 시 → 정식 경로 전환 + sanity check (두 경로 출력 일치 확인)

---

## 9. 라이센스 매트릭스 + 운영 배포 게이트

### 9.1 라이센스 매트릭스

| 모델 | 라이센스 | 평가 단계 | 운영 단계 (유료 부트캠프) |
|---|---|---|---|
| EXAONE 4.0 32B | EXAONE 1.2 NC ([extract](../rationale/exaone-license-extract.md)) | ✅ Section 2.1(a) "evaluation, testing, experimentation" 명시 | 🔴 **회색지대** — LG 문의 필수 |
| EXAONE 3.5 32B | EXAONE 1.2 NC | ✅ 동일 | 🔴 **회색지대** — 동일 |
| Qwen3-Coder-Next | Apache 2.0 | ✅ | ✅ |
| Qwen2.5-Coder 32B | Apache 2.0 | ✅ | ✅ |
| Llama 3.3 70B | Llama Community | ✅ | ✅ (700M MAU 미만 자동 허용) |
| (참조) Claude API | Anthropic 상용 | ✅ | ✅ (Phase 0 베이스라인) |

### 9.2 운영 배포 게이트 (v2 — Q3 결정)

> **Q3 결정**: 평가는 진행 + 운영 배포 결정 시점에만 LG 문의

```
[평가 종료]
   │
   ▼
선정 모델이 EXAONE (M1 또는 M2)?
   │
   ├─ Yes ──▶ LG AI Research에 commercial license 또는 사용 가능 여부 문의
   │            │
   │            ├─ 명시적 허용 응답 ──▶ 운영 배포 OK
   │            ├─ commercial license 확보 ──▶ 운영 배포 OK
   │            └─ 거절/지연/응답 없음 ──▶ 자동으로 2위 모델로 폴백
   │
   └─ No (Qwen / Llama) ──▶ 운영 배포 OK
```

이 게이트는 **ADR-010(선정 결정)에 명문화**한다. 1위와 2위의 점수 차이 + 폴백 손실(점수 비교)도 ADR-010에 정량 기록.

---

## 10. 평가 라운드 + 통계적 견고성 (v2 강화)

### 10.1 라운드 구성 (v2 용어 통일 — L-03)

> **L-03**: round = 1 prompt × 1 model 페어. run = 1 round의 1회 실행. 전체 호출 수 = round × runs.

| 라운드 | 데이터셋 | 측정 메트릭 | 적용 모델 | round 수 | runs/round | 호출 수 |
|---|---|---|---|---|---|---|
| **Phase 0** | A(30) + B(30) | Phase 0 (베이스라인) | Claude only | 60 | 5 | 300 |
| **R1** | Gold A (30) | MT1~MT5, MT8 | M1~M5 (5개) | 150 | 5 | 750 |
| **R2** | Gold B (30) | MT1~MT5, MT8 | R1 통과 모델 | 30~150 | 5 | 150~750 |
| **R3** | R2 통과 결과 | MT6, MT7 (Tier 2 — pairwise judge) | R2 통과 모델 | 30~60 | 3 | 90~180 |
| **R4** | 사용자 spot-check | MT6, MT7 보강 | R3 상위 2개 | 60 | 1 | 60 (인간) |

총 호출 수: **약 1,350 ~ 2,040 회** (Phase 0 + R1 + R2 + R3) + 인간 검수 60건

### 10.2 결정론과 재현성 (v2 강화 — M-04, M-05, N-03)

- `temperature=0.2` 통일
- 동일 prompt template (Langfuse versioned prompt)
- Ollama `seed=42` 고정 (N-03: 단계 1에서 지원 여부 검증)
- `OLLAMA_NUM_PARALLEL=1`
- 보고서 메타 (M-04): GGUF SHA256, Ollama image digest, CUDA/driver 버전, Ollama 버전, prompt version

### 10.3 통계 (v2 강화 — C-07)

- **표본 수**: 5 run/round (v1 3 → v2 5)
- **평균**: macro stratified (난이도 × 모드 bucket)
- **95% CI**: bootstrap 1000회
- **효과 크기**: Cohen's d
- **다중 비교 보정**: Bonferroni (5모델 10쌍, α=0.005)
- **유의 차이 판정**: Cohen's d ≥ 0.5 + Bonferroni-adjusted p < 0.005

### 10.4 엣지 케이스 정책 (v2 신설 — L-04)

| 케이스 | 정책 |
|---|---|
| **모든 모델이 합격선 미달** | Phase 0에서 Claude도 미달성한 메트릭은 상대치(-5%p)로 완화 적용. 그래도 전부 미달이면 Claude 운영 유지 + 후보 재선정 |
| **합격선 회색지대 (절대치 ±2%p)** | C5/C6 점수가 더 높은 쪽 우선 + 사용자 최종 결정 게이트 |
| **모델 OOM/segfault/timeout** | 해당 모델은 R1에서 자동 탈락. 메모리 폴백(Q5_K_M)으로 1회 재시도 |
| **무한 루프 / hallucination loop** | 단일 round timeout 120s, runner가 강제 종료하고 fail 카운트 |
| **EXAONE 토큰 template 작동 불가** | EXAONE 3.5 32B로 즉시 폴백 (M1 → M2) |
| **GB10 thermal throttling 의심** | `nvidia-smi`로 5분 간격 온도 샘플링, throttle 감지 시 휴지 5분 후 재개 |

---

## 11. 위험과 대응 (v2 갱신)

| # | 위험 | 가능성 | 영향 | 대응 |
|---|---|---|---|---|
| R1 | EXAONE 4.0 GGUF 임포트 실패 (TEMPLATE 토큰 등) | 중 | 한국어 SOTA 후보 손실 | EXAONE 3.5 32B 폴백 (이미 후보) + §14 미해결 #2 사전 검증 |
| R2 | **GB10/aarch64 segfault (Issue #15318 + 변형)** | **중** | **전체 또는 일부 모델 평가 차단** | **단계 1 sanity check를 5모델 전부 load+1문제 생성으로 강제** (C-01). 실패 시 vLLM 컨테이너로 전환 검토 |
| R3 | LLM-as-Judge 한국 모델 편향 | 중 | 한국 모델 점수 저평가 | Pairwise judge + 한국어 계산적 보조 + 사용자 spot-check 확대 (C-08) |
| R4 | EXAONE 라이센스 문의 거절 | 중 | EXAONE 운영 사용 불가 | Qwen/Llama 자동 폴백 (§9.2) |
| R5 | Qwen3-Coder-Next 80B Q8 ~85GB가 119GB에 안 들어감 | 낮음~중 | M3 후보 손실 | Q5_K_M 다운양자화 후 재시도 (양자화 폴백 비교 공정성 N-04 적용) |
| R6 | Gold Set 분포 편향 → 한 모델 유리 | 중 | 선정 신뢰도 하락 | Macro stratified mean (C-07) + 작성자/검수자 분리 |
| R7 | `format: 'json'` + Parser 충돌 (Issue #28753) | 중 | MT1 실패 | 단계 3 전 실증 → 둘 중 하나로 확정 (C-02) |
| R8 (v2 신설) | Langfuse self-host 첫 부팅 실패 | 낮음 | trace 미기록 | LANGFUSE_*가 없으면 NoOp callback (기존 동작), 추후 self-host 재구성 |
| R9 (v2 신설) | LG 라이센스 답변 지연 | 중 | 운영 진입 지연 | §9.2 자동 폴백 — Qwen 등 라이센스 자유 모델로 즉시 운영 |

---

## 12. 작업 분해 (v2 갱신)

본 SDD가 검토 완료 시 별도 브랜치(`feature/oss-model-eval`)에서 진행:

| 단계 | 작업 | 산출물 | 방법론 |
|---|---|---|---|
| **0** (v2 신설) | extractOracleTokens를 `packages/shared/src/utils/oracle-tokens.ts`로 export 리팩터링 + 단위 테스트 | shared 패키지 | TDD |
| 1 | docker-compose에 ollama + langfuse + langfuse-db 추가 + sanity check (5모델 전부 load + 1문제 생성, C-01) | `docker-compose.yml`, smoke test 스크립트 | smoke test + 수동 checklist (L-05) |
| 2 | 5개 모델 pull/import (M1은 Modelfile + EXAONE chat_template 검증 후 patch) | `eval/modelfiles/`, README, sanity 결과 | smoke test + checklist |
| 3 | `LlmClientFactory` 신설 + `'ollama'` provider 분기 + format vs Parser 실증 비교 + 단위 테스트 | `llm-client.factory.ts`, `llm-client.test.ts` | TDD |
| 4 | Gold Set A(30) + Gold Set B(30, Claude 합성 → 사용자 검수) | `eval/datasets/`, synthesis.log.md | TDD (셋 검증 함수) |
| 5 | promptfoo 설정 + assertion 7개 작성 + langfuse-wrapped provider | `promptfoo.config.yaml`, `eval/assertions/*.ts`, `eval/providers/langfuse-wrapped.ts` | TDD (assertion 단위 테스트) |
| 6 | 결과 JSON schema (감사용 N-05) + report-generator | `eval/reports/schema.v1.ts`, `report-generator.ts` | TDD |
| 7 | eval.controller.ts (관리자 트리거) | `eval/eval.controller.ts` | TDD |
| 8 | **Phase 0 실행** (Claude 베이스라인 + prompt portability) → 합격선 patch | Phase 0 결과 보고서 | 실행 + 수동 분석 |
| 9 | R1~R4 실행 + 보고서 생성 | `eval-results/{date}/promptfoo-report.html` + `report.md` | 실행 |
| 10 | ADR-010 작성 + 운영 배포 게이트 적용 + LlmClient 운영 모델 교체 + 회귀 테스트 | `docs/decisions/ADR-010-...md`, 환경변수 변경 | TDD (회귀) |

> 단계 1, 2, 8, 9는 외부 인프라/실행 의존이라 RED-GREEN-REFACTOR 사이클이 불가 → smoke test + 수동 checklist로 대체 (L-05).

---

## 13. 헌법/원칙 정합성 점검 (v2 갱신)

| 항목 | 정합성 | 비고 |
|---|---|---|
| 헌법 §3 (계산적 검증 우선) | ✅ | Tier 1(MT1~MT5+MT8 6개) → Tier 2(MT6, MT7) |
| 헌법 §4 (TDD) | ✅ | 단계 0/3/4/5/6/7/10은 RED→GREEN→REFACTOR. 1/2/8/9는 smoke test (L-05) |
| 헌법 §8-2 (환경변수 + 하드코딩 금지) | ✅ | OLLAMA_*, LANGFUSE_*, LLM_* 모두 .env로 분리. 모델명/임계값도 promptfoo.config.yaml에서 환경변수 참조 |
| **ADR-005 보안 3항목** (v2 신설 §7.4) | ✅ | 키 관리 + 출력 검증(MT2/MT3/MT8) + 인젝션 방어(입력 화이트리스트 + 출력 blocklist + 컨테이너 격리) |
| ADR-005 (Python 분리) | ✅ 미발동 | 패턴 X. promptfoo도 TS 네이티브 |
| ADR-006 (Docker-First) | ✅ | ollama + langfuse 모두 docker-compose |
| ADR-007 (변경 영향 분석) | ✅ | §11 위험 분석 |
| ADR-009 (LangChain + Langfuse) | ✅ | ChatOllama 어댑터 추가, SDK 직접 import 없음. promptfoo provider도 LlmClient 경유 (§5.3) |
| TEST_STRATEGY (70% 커버리지) | 목표 | TDD 단계에 적용 |

---

## 14. 미해결 / 후속 확인 항목 (v2 갱신)

| # | 항목 | 책임 | 시점 |
|---|---|---|---|
| 1 | Ollama multi-arch 매니페스트가 GB10 aarch64에서 정상 pull되는지 | 사용자 (Docker 실측) | 단계 1 |
| 2 | ~~EXAONE 4.0 정확한 chat template 토큰 (`tokenizer_config.json` / `chat_template.jinja`)~~ → **v2.2 해소 (2026-04-09)**: WebFetch 1차 검증 완료, §8.1 patch 반영. GGUF import 후 실측 동작 검증은 단계 2 잔여 작업 | ~~Claude (HF WebFetch) + 사용자 실측~~ | ~~단계 2~~ |
| 3 | Qwen3-Coder-Next Q8 ~85GB가 GB10 119GB에서 다른 프로세스와 공존 가능한지 | 사용자 (실측) | 단계 1 sanity check |
| 4 | Langfuse self-host 운영 안정성 (백업/복구) | 사용자 | 단계 1 |
| 5 | LG AI Research commercial license 절차/비용 (선정이 EXAONE인 경우) | 사용자 | R3 종료 후 |
| 6 | LLM-as-Judge 편향 추가 보정 — 한국어 judge(Qwen 등) 도입 검토 | Claude (조사) | R3 시작 전 |
| 7 | 평가 결과 보고서 양식 합의 (markdown 템플릿) | 사용자 + Claude | 단계 6 |
| **8** (v2) | **Ollama `seed` 옵션 LangChain ChatOllama에서 노출되는지** (N-03) | Claude + 사용자 실측 | 단계 3 |
| **9** (v2) | **`format: 'json'` vs StructuredOutputParser 실증 비교 결과** (C-02) | Claude + 사용자 | 단계 3 |
| **10** (v2) | **GB10 thermal throttling 모니터링 임계값** (N-06) | 사용자 | 단계 1 + 단계 9 진행 중 |
| **11** (v2) | **promptfoo 버전 호환성** — Ollama provider + custom JS assertion 2026 안정 버전 | Claude (npm) | 단계 5 |

---

## 15. 후속 산출물 예고

```
docs/
├── architecture/
│   └── oss-model-evaluation-design.md       # 본 문서 v2
├── decisions/
│   └── ADR-010-oss-model-selection.md       # 평가 결과 + 선정 + 운영 게이트
├── review/
│   ├── consensus-001-oracle-dba-game.md
│   └── consensus-002-oss-model-evaluation.md  # 본 SDD v1에 대한 합의
├── rationale/
│   ├── oss-model-selection-rationale.md       # 후보 선정 narrative
│   └── exaone-license-extract.md              # LICENSE 사본 + 적용 분석
└── ... (평가 결과 보고서는 apps/api/eval-results/{date}/ + ADR-010에 인용)
```

---

## 16. 변경 이력

| 날짜 | 버전 | 변경 | 근거 |
|---|---|---|---|
| 2026-04-09 | **v1** | 초안 작성 | 사용자 지시 — `oss-model-selection-rationale.md` 기반 SDD화 |
| 2026-04-09 | **v2** | consensus-002 합의 + Q1~Q4 사용자 결정 반영 (HIGH 12 + MED 6 + LOW 5 + 누락 6) | `docs/review/consensus-002-oss-model-evaluation.md` |
| 2026-04-09 | **v2.1 patch** | 단계 1 sanity 시 Langfuse v3 `CLICKHOUSE_URL is not configured` 오류 발견. §6.1을 v3 풀 인프라(clickhouse + redis + minio + worker + web 5컨테이너)로 갱신. 사용자가 옵션 B 채택 | 사용자 직접 결정 (단계 1 실측) |
| 2026-04-09 | **v2.2 patch** | 단계 2 시작 — §14 미해결 #2 해소: WebFetch로 EXAONE 4.0 chat_template 1차 검증, §8.1 TEMPLATE을 검증된 형식으로 patch (역할 토큰 뒤 \n / endofturn 뒤 \n / 빈 \<think\>\</think\> 블록 / .Messages 형식). GGUF 실제 파일명 `EXAONE-4.0-32B-Q8_0.gguf` 정정. Ollama 0.20.4 확인. 단계 1 sanity v2 (M1 SKIP 분기 추가) 4 PASS / 1 SKIP 통과. exaone4.Modelfile + README 커밋. | 검증 출처 HF raw URL + Ollama 컨테이너 실측 |

---

## 17. 참고 문서

### 프로젝트 내부
- `CLAUDE.md` (§1 SDD+TDD, §3 3+1 합의)
- `docs/rationale/oss-model-selection-rationale.md`
- `docs/rationale/exaone-license-extract.md` (v2 신규)
- `docs/review/consensus-002-oss-model-evaluation.md` (v2 신규)
- `docs/architecture/oracle-dba-learning-game-design.md` §4
- `docs/decisions/ADR-005-ai-backend-stack-guideline.md` (보안 3항목)
- `docs/decisions/ADR-008-oracle-dba-game-tech-stack.md`
- `docs/decisions/ADR-009-langchain-langfuse-stack.md`
- `apps/api/src/modules/ai/llm-client.ts`
- `packages/shared/src/schemas/question.schema.ts`
- `apps/api/src/modules/content/services/scope-validator.service.ts`
- `apps/api/src/modules/content/seed/seed.data.test.ts`

### 외부
- promptfoo 공식 문서: https://promptfoo.dev/docs/intro/
- LangChain Ollama 어댑터: https://js.langchain.com/docs/integrations/chat/ollama/
- Langfuse self-hosting: https://langfuse.com/docs/deployment/self-host
- Ollama Modelfile reference: https://github.com/ollama/ollama/blob/main/docs/modelfile.md
- ollama/ollama Issue #15318 (DGX Spark Gemma segfault)
- ollama/ollama Issue #11433 (EXAONE 4.0 정식 지원)
- langchain-ai/langchain Issue #28753 (ChatOllama format)

---

**SDD v2는 사용자 검토 통과 후 ADR-010 작성과 별도 브랜치 TDD 진입의 기준 문서가 된다.**
