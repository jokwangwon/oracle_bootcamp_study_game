# 3+1 합의 보고서 002 — OSS 모델 자체 호스팅 평가 SDD

> CLAUDE.md §3 (3+1 멀티 에이전트 합의 프로토콜)에 따라 진행한 SDD 검토 결과.

| 항목 | 값 |
|---|---|
| **합의 ID** | consensus-002 |
| **검토 대상** | `docs/architecture/oss-model-evaluation-design.md` v1 (초안, 480줄) |
| **검토 일자** | 2026-04-09 |
| **프로토콜** | CLAUDE.md §3 (Phase 1 분배 → Phase 2 독립 분석 → Phase 3 교차 비교 → Phase 4 합의 → Phase 5 보고) |
| **에이전트 격리** | A/B/C는 서로의 출력을 보지 못함 (편향 차단) |
| **Reviewer** | 메인 컨텍스트 (Claude Code) |
| **선행 문서** | `docs/rationale/oss-model-selection-rationale.md` |
| **후속 산출물** | SDD v2, ADR-010 |

---

## 1. Phase 1 — 분배

| 에이전트 | 역할 | 핵심 질문 |
|---|---|---|
| **Agent A** | 구현 분석가 | "이 SDD대로 만들면 실제로 동작하는가?" |
| **Agent B** | 품질/안전성 검증가 | "안전하고 견고한가? 빠진 안전장치는?" |
| **Agent C** | 대안 탐색가 | "더 나은 방법이 있는가? 다른 트레이드오프는?" |
| **Reviewer** | 메인 컨텍스트 | "최선의 합의는?" |

각 에이전트에는 동일한 프로젝트 컨텍스트(NestJS + GB10/aarch64 + Ollama + 후보 5개 + ADR-009 강제) + SDD 경로 + 관련 파일 목록 + 검토 관점만 전달했다. 다른 에이전트의 결과는 공유하지 않았다.

---

## 2. Phase 2 — 독립 분석 결과

### 2.1 Agent A (구현 분석가) 종합

**판정**: `APPROVE_WITH_CHANGES`

**HIGH 이슈 4건**:
1. **GB10/aarch64 Ollama 안정성** — `ollama/ollama` Issue #15318(2026-04-05 미해결): DGX Spark에서 Gemma 4 segfault 보고. EXAONE/Llama 3.3 70B의 GB10 동작은 검증된 바 없음. SDD §14 미해결 1번이 사실상 HIGH 블로커.
2. **`format: 'json'` + `StructuredOutputParser` 충돌 가능성** — LangChain Issue #28753: ChatOllama의 `format` 파라미터가 schema 주입 parser와 동시 사용 시 오류 보고.
3. **EXAONE Modelfile TEMPLATE 토큰 오류** — SDD §8.1은 `<|system|>/<|user|>` 형식을 가정했으나, 실제 EXAONE 3.5/4.0 공식 템플릿은 `[|system|]/[|user|]/[|assistant|]/[|endofturn|]`(대괄호) 형식. 현재 Modelfile로는 동작하지 않을 가능성 매우 높음.
4. **judge용 별도 LlmClient 설계 누락** — 현재 `LlmClient`는 ConfigService 한 개를 받아 단일 provider를 하드와이어. 평가 중 `LLM_PROVIDER=ollama`인데 judge는 Claude여야 함 → 두 개의 LlmClient 인스턴스 필요. 현 설계로는 불가.

**MED 이슈**: 평가 wall-clock 시간 추정 누락(540회 ≈ 6.75시간 최선), `KEEP_ALIVE 30m`과 swap 충돌, depends_on 누락, ollama create 컨테이너 경로.

**누락 디테일**: `extractOracleTokens` export 리팩터링, prompt portability 검증, Gold Set B 작성/검수 주체, Ollama seed 옵션 지원 확인, 양자화 폴백 시 비교 공정성.

### 2.2 Agent B (품질/안전성 검증가) 종합

**판정**: `REQUEST_CHANGES` (3개 중 가장 엄격)

**HIGH 이슈 6건**:
1. **ADR-005 보안 3항목 + Ollama 포트 노출** — SDD §6.1의 compose가 `ports:` 매핑으로 11434 포트를 호스트에 노출. 평가 환경이라도 외부에서 인증 없이 모델 추론 호출 가능 → 무인증 추론 악용 + prompt injection 벡터.
2. **출력 sanitization 부재** — Zod 스키마는 타입/길이만 검증. `<script>`, template injection, SSRF URL이 섞인 출력을 차단할 레이어가 없음.
3. **통계적 유의성 근거 부족** — n=3 반복은 표준편차 추정에 이론적으로 부족. 5개 모델 다중 비교에 Bonferroni 보정 미적용. t-test/CI 절차 없음.
4. **LLM-as-Judge 단일 judge 편향** — Claude는 영어 중심 → EXAONE 등 한국어 모델 체계적 저평가 가능성. 10% spot-check는 통계적 보정보다 구색에 가까움.
5. **EXAONE 라이센스 해석 확신 과잉** — HF 모델카드는 "educational purposes 허용"만 명시, "유료 교육"이나 "수강료 과금 허용"을 명시하지 않음. SDD는 LICENSE 전문 미인용.
6. **데이터 주권 vs Langfuse Cloud 충돌** — rationale §1.2는 "데이터 주권"을 동기로 명시했는데, SDD는 Langfuse Datasets에 prompt/output 본문을 업로드함 → 외부 이탈.

**MED 이슈**: 합격선 임의성(Claude 베이스라인 미측정), Gold Set B 작성자 편향, temperature/format Modelfile vs LangChain override 일관성, 재현성을 위한 GGUF SHA256/Ollama digest/driver 버전 미기록, GGUF 무결성 검증 누락.

**LOW 이슈**: 라운드 vs run 용어 혼재, 엣지 케이스 정책 부재(전체 탈락/회색지대/OOM), TDD 적용 불가 단계(1, 2, 8) 방법론 조정 필요.

### 2.3 Agent C (대안 탐색가) 종합

**판정**: `APPROVE_WITH_CHANGES`

**STRONG 권고 3건**:
1. **promptfoo로 EvaluationRunner 대체** — TS 네이티브, YAML 선언형, ChatOllama/Anthropic provider 내장, 커스텀 assertion이 JS 함수(기존 NestJS 코드 직접 import 가능), llm-rubric 기본 제공. **자체 EvaluationRunner 7개 파일 → assertion 7개**로 코드 ~70% 절감. ADR-009 호환(Langfuse trace는 callback으로 유지).
2. **합격선을 절대치 → "절대치 + Claude 베이스라인 상대치" 이중 게이트** — Claude도 측정 안 한 채 절대치만 정한 게 모순. Phase 0에서 Claude로 Gold A/B 측정 → 합격선 ±5%p 재보정.
3. **MT6 한국어 자연스러움 강화** — Pairwise judge(Chatbot Arena 방식) + 한국어 계산적 보조 지표(조사 정합성, 어절 다양성, KoBERTScore) Tier 1 편입 + 사용자 spot-check 10% → 상위 2개 모델 전수 검수(40건).

**OPTIONAL 권고 5건**:
- 양자화 Q8 → Q5_K_M 기본값 (32B dense 정확도 95~99% 유지 + 메모리 ~20% 절감 + 속도 향상)
- Stratified mean(macro by bucket) + Bootstrap 1000회 CI
- Gold Set B 20 → 50~60 확장 (Claude 합성 → 사용자 검수)
- `OLLAMA_KEEP_ALIVE 30m` → 평가 배치 동안 `-1` (영구) + runner 직접 swap 제어
- Langfuse Datasets 대신 promptfoo 리포트를 source of truth, Langfuse는 trace만

**확정 제약 잠재 비용** (참고): 자체 호스팅 vs 호스티드 OSS API TCO 비교, ADR-009의 LangChain 추상화가 모델별 저수준 튜닝 막을 가능성.

---

## 3. Phase 3 — 교차 비교

### 3.1 ① 일치 (Consensus — 3개 모두 동의)

| 항목 | A | B | C | 분류 |
|---|---|---|---|---|
| 큰 방향(패턴 X / Tier 1-2 / ADR-009 정합 / EXAONE 운영 게이트)은 건전 | ✅ | ✅ | ✅ | **긍정 합의** |
| 단일 judge(Claude) + 한국어 모델 편향 위험 → 보정 필요 | △ | ✅ HIGH | ✅ STRONG | **보정 필요 합의** |
| 합격선의 임의성 (Claude 베이스라인 미측정) | △ | ✅ MED | ✅ STRONG | **재보정 필요 합의** |
| Gold Set B 작성자/주체 불명 | ✅ 누락 | ✅ MED | ✅ OPTIONAL | **명시 필요 합의** |
| `KEEP_ALIVE` 30m + 모델 swap 메모리 충돌 가능성 | ✅ MED | — | ✅ OPTIONAL | **수정 필요** |

### 3.2 ② 부분 일치 (Partial — 2명 이하 동의, 단독이지만 근거 강함)

| 항목 | 출처 | 근거 강도 | 채택 |
|---|---|---|---|
| GB10 멀티모델 sanity check 확장 (Issue #15318) | A 단독 | **강** (GitHub Issue 인용) | ✅ |
| `format: 'json'` + `StructuredOutputParser` 충돌 | A 단독 | **강** (Issue #28753) | ✅ |
| EXAONE Modelfile TEMPLATE 토큰 오류 (`<|...|>` → `[|...|]`) | A 단독 | **강** (HF tokenizer_config 검증) | ✅ |
| LlmClient 단일 provider 하드와이어 → judge 분리 필요 | A 단독 | **강** (코드 분석) | ✅ |
| ADR-005 보안 3항목 누락 + Ollama 포트 호스트 노출 | B 단독 | **강** (헌법 + ADR 인용) | ✅ |
| 출력 sanitization (prompt injection / SSRF / script) | B 단독 | **강** (보안 critical) | ✅ |
| 통계적 유의성 (n=3 → n=5/bootstrap, Bonferroni) | B HIGH + C OPTIONAL | **강** (방법론) | ✅ |
| EXAONE 라이센스 LICENSE 전문 인용 + 법적 검토 기록 | B 단독 | **강** (법적 안전성) | ✅ |
| 데이터 주권 vs Langfuse Cloud 충돌 | B HIGH + C OPTIONAL | **강** (rationale §1.2 동기 충돌) | ✅ |
| promptfoo로 EvaluationRunner 대체 | C 단독 | 강 (구현 비용 대폭 절감) | ⚠ **사용자 결정 필요** |
| 양자화 Q8 → Q5_K_M | C OPTIONAL | 중 (성능 손실 최소) | 🟡 검토 채택 |

### 3.3 ③ 불일치 (Divergence — 의견이 갈림)

| 항목 | A | B | C | Reviewer 결정 |
|---|---|---|---|---|
| **종합 판정** | APPROVE_WITH_CHANGES | **REQUEST_CHANGES** | APPROVE_WITH_CHANGES | **REQUEST_CHANGES 채택**. B가 지적한 보안 + 통계 + 라이센스 + 데이터 주권 4건은 평가 실행 전에 반드시 반영되어야 함. 단, "v2 작성 후 사용자 직접 승인"으로 진행 (3+1 재합의는 생략). |

### 3.4 ④ 누락 (Gap — 1명만 언급)

| 항목 | 출처 | Reviewer 판단 |
|---|---|---|
| `extractOracleTokens` export 리팩터링 | A | ✅ 작업 분해에 추가 |
| Prompt portability 검증 (Claude용 → OSS 모델 재사용 가능?) | A | ✅ Phase 0 추가 |
| Ollama `seed` 옵션 지원 확인 | A | ✅ §14 미해결에 추가 |
| 양자화 폴백 시 비교 공정성 명시 | A | ✅ §10 명문화 |
| 결과 JSON schema (감사용 고정 양식) | B | ✅ 보고서 양식에 포함 |
| GB10 thermal throttling 모니터링 | B | ⚠ 운영 단계 우려, 평가는 LOW. 미해결 항목으로만 추가 |
| Gold Set B 20 → 50~60 확장 | C | ⚠ 사용자 비용 부담 → **30** 절충 후 사용자 결정 |
| TCO 호스티드 비교 | C | ❌ 사용자 명시적 자체 호스팅 결정. 정보 제공만 |
| Pairwise judge | C | ✅ MT6 강화에 통합 |
| 호스팅형 OSS API 1회 측정 (참고) | C | ❌ 같은 이유로 거부 |

---

## 4. Phase 4 — 합의 도출

### 4.1 즉시 SDD v2 반영 (HIGH/STRONG 12개 항목)

| # | 변경 | 출처 | SDD §  | 우선순위 |
|---|---|---|---|---|
| **C-01** | 단계 1 sanity check를 "5개 모델 전부 load + 1문제 생성"으로 확장 + 실패 시 차단 게이트 | A-HIGH | §6, §11, §12 | P0 |
| **C-02** | `format: 'json'` 또는 `StructuredOutputParser` 둘 중 하나만 사용 (단계 3 전 실증 테스트 필수) | A-HIGH | §7.2 | P0 |
| **C-03** | EXAONE Modelfile TEMPLATE 토큰을 `[|system|]/[|user|]/[|assistant|]/[|endofturn|]` 형식으로 수정 + HF `tokenizer_config.json` `chat_template.jinja` 정확 인용 + stop token `[|endofturn|]` | A-HIGH | §8.1 | P0 |
| **C-04** | LlmClient를 factory + per-call config로 리팩터링 (또는 `EvaluationLlmClientFactory` 신설). judge=Claude + eval=Ollama 동시 인스턴스화 명시 | A-HIGH | §7.1, §7.2 | P0 |
| **C-05** | docker-compose `ports: 11434` 제거 → compose internal network만 사용 (또는 `127.0.0.1:11434:11434`로 localhost 바인드). ADR-005 보안 3항목(키 관리/출력 검증/인젝션 방어)을 §13에 명시 | B-HIGH | §6.1, §13 | P0 |
| **C-06** | **MT8 (출력 sanitization) 신설** — Tier 1에 추가. blocklist 패턴(script/template/SSRF URL/SQL injection 패턴) 자동 검사. 합격선 ≥99% | B-HIGH | §3.1, §1.3 | P0 |
| **C-07** | 통계 강화: n=3 → n=5 또는 bootstrap 1000회 + Cohen's d + 95% CI + Bonferroni 보정(5모델 10쌍) + macro stratified mean(난이도×모드 bucket) | B-HIGH + C-OPTIONAL | §10.3 | P0 |
| **C-08** | LLM-as-Judge 편향 보정 강화: ① pairwise judge(Chatbot Arena 방식) ② 한국어 계산적 보조 지표(조사 정합성/어절 다양성) Tier 1 편입 ③ 사용자 spot-check 10% → R3 상위 2개 모델 전수 검수(40건) | B-HIGH + C-STRONG | §3, §10 | P0 |
| **C-09** | EXAONE LICENSE 전문을 `docs/rationale/exaone-license-extract.md`에 사본 첨부 + 평가 라운드 전 LG AI Research 문의 또는 내부 법적 검토 기록(사용자 책임) | B-HIGH | §9, §14 | P0 |
| **C-10** | Langfuse Cloud 사용 차단 (데이터 주권). Langfuse self-host 권고 + Langfuse Datasets 대신 promptfoo/로컬 JSON을 source of truth, Langfuse는 callback trace만(metadata에 본문 미기록) | B-HIGH + C-STRONG | §3.3, §5, §6 | P0 |
| **C-11** | **합격선 — Claude 베이스라인 실측 후 보정** — Phase 0(Phase 1 전): Claude로 Gold A/B 측정 → 합격선을 ±5%p 범위에서 재보정. 절대치 + 상대치 이중 게이트 | B-MED + C-STRONG | §1.3, §10 | P0 |
| **C-12** | **promptfoo 채택 검토** — SDD §5에 옵션 A(자체 EvaluationRunner) vs 옵션 B(promptfoo + 어댑터) 두 트랙 명시. 사용자 결정 후 한쪽으로 확정 | C-STRONG | §5 | **사용자 결정** |

### 4.2 MED 이슈 반영

| # | 변경 | 출처 |
|---|---|---|
| M-01 | 평가 wall-clock 추정 추가, **C7 합격선 30s → 60s 완화** | A-MED |
| M-02 | `OLLAMA_KEEP_ALIVE: "30m"` → 평가 배치 동안 `"-1"` (영구) + runner가 명시적 swap 제어 | A-MED + C-OPTIONAL |
| M-03 | temperature/format이 Modelfile vs LangChain override 시 어느 쪽이 적용되는지 trace 검증 sanity check 단계 추가 | B-MED |
| M-04 | 보고서 양식에 GGUF SHA256, Ollama image digest, CUDA/driver 버전, Ollama 버전 필수 필드 추가 (재현성/감사) | B-MED |
| M-05 | GGUF 다운로드 시 SHA256 검증 명시 + Ollama 이미지 digest pin (`ollama/ollama@sha256:...`) | B-MED |
| M-06 | Gold Set B 크기 20 → **30 절충** (작성자/검수자 분리 명시) | A-누락 + B-MED + C-OPTIONAL |

### 4.3 LOW 이슈 반영

| # | 변경 | 출처 |
|---|---|---|
| L-01 | docker-compose api 서비스에 `depends_on: { ollama: { condition: service_healthy } }` 추가 | A-LOW |
| L-02 | `ollama create` Modelfile 컨테이너 경로 명확화 (`./apps/api/.../modelfiles:/modelfiles:ro` 볼륨 mount) | A-LOW |
| L-03 | "라운드(round)" vs "실행(run)" 용어 통일 — 1 round = 1 prompt-model 페어, 1 run = 1 round의 1회 실행. 전체 = round × runs | A-LOW + B-LOW |
| L-04 | 엣지 케이스 정책 §10.4 신설 — 전체 모델 탈락 / 합격선 회색지대(±2%p) / 모델 OOM/timeout / hallucination loop 정책 | B-LOW |
| L-05 | TDD 적용 불가 단계(단계 1/2/8)는 "smoke test + 수동 checklist" 방법론으로 명시 | B-LOW |

### 4.4 누락 항목 추가

| # | 변경 |
|---|---|
| N-01 | `extractOracleTokens`를 `packages/shared/src/utils/oracle-tokens.ts`로 export 리팩터링 (작업 분해 단계 4-1로 신설) |
| N-02 | Phase 0에 "Prompt portability 검증" — Claude용 prompt를 OSS 모델에서도 동일하게 이해하는지 확인 |
| N-03 | Ollama `seed` 옵션 지원 여부 검증 (§14 미해결 항목 #8) |
| N-04 | 양자화 폴백 시(예: M3 Q8 → Q5/Q4) 비교 공정성 — "동일 양자화 계열에서 비교" 규칙 §10 명시 |
| N-05 | 결과 JSON schema (감사용 고정 양식) — `apps/api/src/modules/ai/eval/reports/schema.v1.ts` |
| N-06 | GB10 thermal throttling 모니터링 — §14 미해결 항목으로 추가 (운영 단계 우려) |

### 4.5 거부 / 보류

| 항목 | 출처 | 거부 사유 |
|---|---|---|
| TCO 호스티드 vs 자체 호스팅 비교 분석 | C 참고용 | 사용자가 자체 호스팅을 명시 결정. SDD 범위 외 |
| 호스팅형 OSS API 1회 측정 (Fireworks/Together 등) | C 참고용 | 같은 이유로 거부 |
| Gold Set B 20 → 50~60 확장 (C 권고) | C OPTIONAL | 사용자 작성 비용 부담 → **30 절충** (M-06) |

---

## 5. Phase 5 — 사용자 결정 필요 항목

SDD v2 작성을 시작하기 전에 다음 4개 항목은 사용자 답변이 필요하다.

### Q1. promptfoo 채택 여부 (C-12)

- **옵션 A**: 자체 `EvaluationRunner` 유지 (SDD v1 그대로) — 코드량 많지만 LangChain/Langfuse 통합 직접 제어
- **옵션 B**: **promptfoo 채택** (Agent C STRONG 권고) — 코드 ~70% 절감, YAML 선언형, 외부 도구 의존성 추가
- **옵션 C**: 하이브리드 — promptfoo를 CLI로 띄우고 결과 JSON을 NestJS가 후처리

> Reviewer 의견: **옵션 B 추천**. 성숙한 OSS 평가 프레임워크 + 모노레포 동일 런타임(TS) + ADR-009 호환 + 코드 절감 효과 명확. 외부 의존성은 BSD-2 라이센스로 안전.

### Q2. Gold Set B 크기 (M-06)

- **20문제** (SDD v1 그대로) — 통계 검정력 빈약 가능성
- **30문제** (Reviewer 절충안) — n=30 × 5 run = 150 샘플, 검정력 향상
- **50~60문제** (Agent C STRONG) — 검정력 강화 + 사용자 검수 30분 추가

> Reviewer 의견: **30문제 절충 추천**. C-07 통계 강화(bootstrap 1000회 + n=5 run)와 결합하면 검정력 충분.

### Q3. EXAONE 라이센스 — LG AI Research 문의 시점 (C-09)

- **옵션 A**: 평가 라운드 전에 LG AI Research에 commercial license 문의 → 답변 받은 후 EXAONE 평가 진행 (보수적, 안전)
- **옵션 B**: 평가 라운드는 진행(연구/평가 = NC 안전 영역) + 운영 배포 결정 시점에만 문의 (현재 SDD v1 입장)
- **옵션 C**: 평가에서 EXAONE 자체를 잠정 제외, Qwen + Llama 4개로만 평가 → 라이센스 리스크 0

> Reviewer 의견: **옵션 B 유지 + 명문화 강화**. 평가는 NC 범위 안. 단 운영 진입 전에 LG 문의를 차단 게이트로 명시 (이미 SDD §9.2). 추가로 LICENSE 전문을 docs/rationale에 사본 첨부.

### Q4. Langfuse Cloud vs Self-host (C-10)

- **옵션 A**: Langfuse self-host (rationale §1.2 데이터 주권 정합) — Docker 컨테이너 추가, 관리 부담
- **옵션 B**: Langfuse Cloud + 본문은 metadata 제외(score만 업로드) — 본문 외부 이탈 차단, 관리 편의
- **옵션 C**: Langfuse 사용 중지, promptfoo 리포트만 사용 — ADR-009 ③(callback 자동 부착)와 충돌

> Reviewer 의견: **옵션 A 추천**. 데이터 주권 동기와 정합. Langfuse self-host는 docker-compose에 1개 컨테이너 추가로 끝남. 옵션 C는 ADR-009 위반.

---

## 6. 최종 합의 결론

| 항목 | 결정 |
|---|---|
| **종합 판정** | **REQUEST_CHANGES** (Agent B 판정 채택) |
| **재합의 필요?** | ❌ 아니오 — v2는 **사용자 직접 승인**으로 진행 (Q1~Q4 답변 후 SDD v2 작성 → 사용자 검토 → 별도 브랜치 TDD 진입). 합의 결과가 명확하므로 3+1 재합의 오버헤드 불필요. |
| **블로킹 항목** | C-01 ~ C-12 (12개) — v2 반영 필수 |
| **MED/LOW** | M-01 ~ M-06 + L-01 ~ L-05 + N-01 ~ N-06 — v2 반영 필수 |
| **구현 진입 조건** | (1) SDD v2 작성 (2) Q1~Q4 사용자 답변 (3) 사용자 v2 검토 통과 (4) ADR-010(평가 SDD 채택) |

### 합의로 강화된 핵심 변경 4가지

1. **보안** — Ollama 포트 비공개, MT8 출력 sanitization, GGUF/이미지 digest pin
2. **통계 견고성** — n=5 또는 bootstrap, Bonferroni, macro stratified mean, Cohen's d, 95% CI
3. **편향 보정** — Pairwise judge, 한국어 계산적 보조 지표, spot-check 확대
4. **법적/데이터 주권** — EXAONE LICENSE 사본, Langfuse self-host, Cloud 본문 업로드 차단

---

## 7. SDD v2 작성 작업 목록

Q1~Q4 사용자 답변 직후 본 합의 보고서를 기반으로 다음을 수행한다:

1. SDD v1을 v2로 갱신 (C-01 ~ C-12 + M + L + N 모두 반영)
2. ADR-009 정합성 점검 표(SDD §7.3)에 ADR-005 보안 3항목 추가
3. SDD §13 헌법/원칙 정합성 점검 표 갱신
4. 변경 이력(SDD §16) 추가
5. 사용자에게 v2 검토 요청 → 통과 시 ADR-010 작성
6. 별도 브랜치 `feature/oss-model-eval` 생성 + TDD 진입

---

## 8. 변경 이력

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-04-09 | 초안 작성 (Phase 1~5 전체) | Agent A/B/C 독립 분석 + Reviewer 합의 |

---

## 9. 부록 — 에이전트 보고서 원본 메타

| 에이전트 | 사용 도구 | duration | tokens |
|---|---|---|---|
| Agent A | Read, WebFetch, WebSearch | ~333s | ~71K |
| Agent B | Read, WebFetch, WebSearch | ~163s | ~62K |
| Agent C | Read, WebFetch, WebSearch | ~152s | ~57K |
| **합계** | — | — | **~190K** |

> 원본 보고서 본문은 본 합의 보고서 §2에 핵심만 인용. 전체 raw output은 본 세션의 Agent tool 응답 로그에 보존됨 (`agentId` 참조: A=`ac3dbf4e395c2a45c`, B=`ac2cb769132751e9e`, C=`a7828fc5dc32cb31d`).

---

## 10. 참고 자료 (3개 에이전트가 인용한 외부 근거 통합)

### 구현 분석 (Agent A)
- [ollama/ollama Issue #15318 — DGX Spark Gemma segfault](https://github.com/ollama/ollama/issues/15318)
- [ollama.com/library/qwen3-coder-next (q8_0 85GB 태그 실존)](https://ollama.com/library/qwen3-coder-next)
- [@langchain/ollama npm](https://www.npmjs.com/package/@langchain/ollama)
- [langchain Issue #28753 — ChatOllama format parameter bug](https://github.com/langchain-ai/langchain/issues/28753)
- [Arm Learning Path — DGX Spark llama.cpp/Ollama](https://learn.arm.com/learning-paths/laptops-and-desktops/dgx_spark_llamacpp/2_gb10_llamacpp_gpu/)
- [LGAI-EXAONE/EXAONE-4.0-32B-GGUF HF](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B-GGUF)
- [Langfuse Experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)

### 품질/안전성 (Agent B)
- 위 EXAONE HF 모델카드 (LICENSE 전문 미공개 확인)
- `docs/decisions/ADR-005-ai-backend-stack-guideline.md` (보안 3항목)
- `docs/constitution/PROJECT_CONSTITUTION.md` §3, §8, §8-2

### 대안 탐색 (Agent C)
- [LLM Evaluation Frameworks: Head-to-Head Comparison — Comet](https://www.comet.com/site/blog/llm-evaluation-frameworks/)
- [DeepEval alternatives 2026 — Braintrust](https://www.braintrust.dev/articles/deepeval-alternatives-2026)
- [8 Best DeepEval Alternatives — ZenML](https://www.zenml.io/blog/deepeval-alternatives)
- [DeepEval vs Langfuse](https://deepeval.com/blog/deepeval-vs-langfuse)
- [GGUF Quantization Explained — willitrunai](https://willitrunai.com/blog/quantization-guide-gguf-explained)
- [Blind testing different quants — llama.cpp Discussion #5962](https://github.com/ggml-org/llama.cpp/discussions/5962)
- [GGUF Quantization Quality vs Speed — dasroot.net](https://dasroot.net/posts/2026/02/gguf-quantization-quality-speed-consumer-gpus/)

---

**본 합의 보고서는 사용자 결정 4건(Q1~Q4) 이후 SDD v2 작성 트리거로 사용된다.**
