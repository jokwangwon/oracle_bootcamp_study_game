# OSS 모델 자체 호스팅 — 모델 선정 판단 근거

> **이 문서의 목적**: 코드/설계가 아니라 **"어떤 의사결정 흐름을 거쳐 후보가 정해졌는가"** 를 시간순으로 기록한 narrative. SDD/ADR 작성 전 단계의 판단 근거를 보존하기 위함.

| 항목 | 값 |
|---|---|
| **문서 유형** | Decision Rationale (판단 근거) |
| **작성일** | 2026-04-09 |
| **작성자** | 사용자(jokwangwon) + Claude (협업 분석) |
| **상태** | 작성 완료 (SDD 작성 전) |
| **관련 ADR** | ADR-005 (AI 백엔드 스택), ADR-008 (Oracle DBA 게임 스택), ADR-009 (LangChain + Langfuse) |
| **후속 산출물(예정)** | `docs/architecture/oss-model-evaluation-design.md` (SDD), `ADR-010` (모델 선정 결정) |

---

## 1. 배경 (Why)

### 1.1 출발점

Oracle DBA 학습 게임 MVP 1단계에서 AI 문제 생성 파이프라인은 **Claude API (`ChatAnthropic` via LangChain)** 를 사용하도록 ADR-009에서 결정되어 이미 동작 중이다 (`apps/api/src/modules/ai/`).

그러나 사용자가 다음 방향을 새로 제시했다:

> *"오픈 소스 모델을 검증하고 해당 모델 중에 테스트하여 검증 후 사용할 예정"*
> *"기본 모델을 대체하여 로컬 환경에서 처리되는 것이 목표 (문제 출제와 관리 부분에서만 사용). Claude는 개발 끝까지 사용 예정."*

### 1.2 동기

| 동기 | 설명 |
|---|---|
| **데이터 주권** | 부트캠프 학습 자료/생성 문제가 외부 API를 거치지 않음 |
| **운영 비용** | 부트캠프 ~20명 규모에서 Claude API 호출 누적 비용 절감 |
| **오프라인 가능성** | 외부 API 의존도 제거 |
| **학습 가치** | OSS 모델 평가/운영 자체가 부트캠프의 교육적 가치 |

> **Claude는 개발 도구(Claude Code)로 끝까지 유지**된다. 즉 이번 결정은 *런타임 LLM 호출*만 OSS로 교체하는 것이며, 개발 도구 측 의사결정과는 분리된다.

---

## 2. 의사결정 흐름 (시간순)

### Phase 1 — ADR 충돌 검토

OSS 자체 호스팅은 다음 ADR과 충돌 가능성이 있어 먼저 정리했다.

| ADR | 기존 결정 | 이번 결정의 영향 | 결론 |
|---|---|---|---|
| ADR-005 | 로컬 추론/학습 필요 → Python 분리 | 자체 호스팅 트리거 가능 | **재해석 필요** (§3 참조) |
| ADR-008 | LLM_PROVIDER = Claude / OpenAI API | OSS provider 추가 | 환경변수 + provider 추가로 흡수 가능 |
| ADR-009 | LangChain + Langfuse 강제 | 어댑터 교체로 유지 가능 | **변경 불필요** — `ChatAnthropic` → `ChatOllama` |
| ADR-004 | config 1줄 수정으로 모델 교체 | 정합 | **변경 불필요** |

→ **ADR-009는 그대로 유지**, ADR-005만 재해석이 필요한 것으로 식별.

### Phase 2 — 자체 호스팅 패턴 결정 (X vs Y)

자체 호스팅에는 두 가지 패턴이 있고, 어느 쪽이냐에 따라 ADR-005 발동 여부가 결정된다.

| 패턴 | 구성 | NestJS 측 | ADR-005 | 비고 |
|---|---|---|---|---|
| **X. 추론 서버 컨테이너 분리** | Ollama / vLLM 컨테이너만 추가, OpenAI 호환 HTTP API 노출 | `ChatOllama` 어댑터로 호출 | **미발동** (단순 HTTP) | 학습/파인튜닝 불필요 시 적합 |
| Y. apps/ai Python 분리 | FastAPI + transformers/vLLM 직접 코드 | HTTP로 `apps/ai` 호출 | **발동** | LoRA, custom inference 시 |

#### 채택: 패턴 X

**근거**:
1. ADR-005의 본 의도는 *"transformers/torch 등 ML 라이브러리를 직접 import해야 할 때"* 이지, "OSS 모델 사용" 자체가 트리거가 아님.
2. 평가 단계에서는 학습/파인튜닝이 없고 추론만 필요하다.
3. NestJS의 LangChain JS는 `ChatOllama` 어댑터를 1급으로 지원하므로 ADR-009가 그대로 유지된다.
4. 만약 평가 결과 "기본 모델로 부족 → LoRA 파인튜닝 필요"가 드러나면 그때 패턴 Y로 전환하면 된다 (그때 ADR-011 신설).

→ **현 단계에서 ADR-005는 발동하지 않는다.** SDD에 이 해석을 명시한다.

### Phase 3 — 서버 환경 조사 (결정적 분기점)

후보 모델 선정 전에 사용 가능한 GPU/메모리를 확인했다. 결과:

```
GPU         : NVIDIA GB10 (Grace Blackwell)
아키텍처     : aarch64 (ARM)
메모리       : 119 GiB (CPU/GPU 통합 LPDDR5X)
디스크       : 1.9 TB NVMe (1.7 TB 가용)
OS          : Ubuntu 24.04.4 LTS
Docker      : 29.1.3 + Compose v5.0.1
호스트명     : promaxgb10-f3c4
CUDA        : 13.0 (driver 580.126.09)
```

#### 의미

이 환경은 일반 데스크탑 GPU(24GB/48GB) 시나리오와 다르다. **GB10은 NVIDIA DGX Spark급**이며, 통합 메모리 119GB는 사실상 CPU+GPU가 공유한다 (`nvidia-smi`에 VRAM이 "Not Supported"로 나오는 이유).

**파급 효과**:
- 단일 GPU 24GB 제약이 사라짐 → 32B, 70B, MoE까지 후보 가능
- 디스크 여유가 커서 다수 모델 가중치 동시 보관 가능 → Ollama swap 평가에 최적
- aarch64 → 추론 엔진 호환성 별도 확인 필요 (Ollama/vLLM 모두 ARM 지원 확인됨)
- 통합 메모리 → 모델 swap 시 PCIe 병목 없음 → 평가 라운드에 매우 유리

→ **이 환경 발견이 후보 선정 기준을 완전히 바꿨다.** 작은 모델만 고려하던 1차 후보 안이 큰 모델까지 확장되었다.

### Phase 4 — 1차 후보군 도출 (검색 기반)

웹 검색으로 2026년 4월 기준 OSS 모델 시장 지형을 파악했다. 부트캠프 게임의 요구사항은:

1. **한국어 출력 품질** (학생 모국어)
2. **Oracle SQL 정확성** (도메인 지식)
3. **JSON 스키마 준수** (`AiQuestionGenerator + Zod`와 호환)
4. **자체 호스팅 가능** (단일 GB10 박스)

이 4축 위에서 1차 후보 6개를 도출:

| # | 모델 | 1차 선정 이유 |
|---|---|---|
| 1 | EXAONE 4.0 32B (LG) | 한국어 SOTA, 32B로 단일 GPU 가능 |
| 2 | HyperCLOVA X SEED 3B (Naver) | 한국어 6500배 데이터, KMMLU 1위 |
| 3 | Solar Pro 2 (Upstage) | 한국 모델 중 유일하게 Frontier LM 등재 |
| 4 | Qwen3-Coder-Next | 2026.02 최신, 코딩 SOTA, multilingual code |
| 5 | Qwen2.5-Coder 32B | 검증된 코드 베이스라인 |
| 6 | Llama 3.3 70B | 음의 베이스라인 (글로벌 대형 vs 한국 특화 비교용) |

### Phase 5 — 라이센스 + Ollama 가용성 검증 (제거 단계)

자체 호스팅 + Ollama 컨테이너 + 부트캠프 운영이라는 제약 위에서 1차 후보를 다시 검증했다. **이 단계에서 후보 2개가 실격되고 1개의 노란불이 발견되었다.**

#### 🔴 제외 #1: Solar Pro 2

| 검증 항목 | 결과 |
|---|---|
| 라이센스 | 명목상 MIT 언급되나... |
| 가중치 공개 여부 | **❌ Solar Pro 2 (Reasoning)는 proprietary, 가중치 비공개. Upstage Console API 전용** |
| 자체 호스팅 가능? | **불가능** |

> 출처: Dataconomy — *"Solar Pro 2 (Reasoning) is proprietary and the model weights are not publicly available."*
>
> Solar Pro **Preview** 22B는 오픈웨이트이지만 구버전이며 사용자가 추가를 원하지 않는다고 명시 → 백업 후보로도 미채택.

→ **자체 호스팅이라는 사용자 요구사항과 정면 충돌. 즉시 제외.**

#### 🔴 제외 #2: HyperCLOVA X SEED

| 검증 항목 | 결과 |
|---|---|
| 라이센스 | ✅ 상업용 오픈소스 명시 |
| GGUF 변환 | ❌ Naver 측이 "GGUF/Ollama 지원 계획 없다"고 HF Discussion에서 공식 답변 |
| 자체 호스팅 경로 | transformers 직접 호출 → `apps/ai` Python 분리(ADR-005 발동) |

→ 라이센스는 OK이지만 **Ollama 패턴 X와 호환되지 않는다.** 한 모델만을 위해 ADR-005를 발동시키는 것은 인프라 비용 대비 가치가 낮다 → **제외**.

#### ⚠ 노란불: EXAONE 4.0 32B

| 검증 항목 | 결과 |
|---|---|
| 라이센스 | EXAONE License **1.2 NC** (Non-Commercial). 2025년 업데이트로 **교육 목적 명시 허용** (초등~대학) |
| Ollama 정식 지원 | ❌ 아직 미지원 (`ollama/ollama` Issue #11433 진행 중, llama.cpp 대기) |
| GGUF 공개 | ✅ LG 공식 `LGAI-EXAONE/EXAONE-4.0-32B-GGUF` HF에 존재 |
| 자체 호스팅 경로 | `ollama create -f Modelfile`로 GGUF 직접 import 가능 |

##### 라이센스 회색지대 분석 (사용자 답변: "유료 오라클 교육")

EXAONE 4.0의 라이센스 1.2 NC는 다음을 명시한다:
- ❌ "상업적 활용/리버스 엔지니어링 금지"
- ✅ 2025년 업데이트: "교육 목적 사용 허용 (초등~대학)"

| 사용 단계 | 평가 (학습/실험) | 운영 (실 서비스) |
|---|---|---|
| **무료 부트캠프** | ✅ 안전 | ✅ 안전 |
| **유료 부트캠프 (현재 케이스)** | ⚠ 안전(연구/평가에 해당) | 🔴 **회색지대** |

> **유료 오라클 부트캠프는 "교육 + 상업"이 결합된 케이스이며, NC 라이센스 해석상 운영 배포에 리스크가 있다.**
>
> **결론**:
> 1. **평가 라운드는 진행** — 연구/평가 용도이므로 NC 범위 안.
> 2. **운영 배포 전에는 LG AI Research에 commercial license 문의 필수** — 라이센스 리스크 명시 항목으로 SDD에 포함.
> 3. **운영에 못 쓰게 될 경우의 폴백 = EXAONE 3.5 32B**. 동일 LG 모델군이며 평가 데이터를 재활용 가능.
> 4. 평가 결과로 EXAONE 4.0이 1위라도, 라이센스 미해결 시 **2위 모델로 운영 진입**하는 의사결정 게이트를 SDD에 명시.

#### ✅ EXAONE 3.5 32B 신규 추가

위 노란불의 폴백/대조군으로 EXAONE 3.5 32B를 새 후보로 추가:

| 항목 | 값 |
|---|---|
| Ollama 정식 지원 | ✅ `ollama pull exaone3.5:32b` |
| 한국어 능력 | ◎ 검증된 한·영 이중언어 |
| 라이센스 | EXAONE 3.5도 NC지만 Ollama 정식 등재 = 광범위 사용 사례 존재 |
| 역할 | (a) EXAONE 4.0 GGUF 임포트 실패 시 즉시 폴백, (b) 4.0 vs 3.5 세대 차이 측정 |

### Phase 6 — 후보 5개 최종 확정

| # | 모델 | 크기 | Ollama | 한국어 | 코드 | 역할 |
|---|---|---|---|---|---|---|
| 1 | **EXAONE 4.0 32B** | 32B dense | GGUF 수동 import | ◎ | ○ | 한국어 SOTA (라이센스 노란불) |
| 2 | **EXAONE 3.5 32B** | 32B dense | ✅ 정식 | ◎ | ○ | 한국어 검증 베이스라인 + #1 폴백 |
| 3 | **Qwen3-Coder-Next** | 80B MoE / 3B active | ✅ Ollama ≥0.15.5 | ○ | ◎ | 코딩 SOTA (2026.02 최신) |
| 4 | **Qwen2.5-Coder 32B** | 32B dense | ✅ 정식 | ○ | ◎ | 코드 베이스라인 (Coder-Next 비교 대조군) |
| 5 | **Llama 3.3 70B** | 70B dense | ✅ 정식 | △ | ○ | 음의 베이스라인 (한국 특화 vs 글로벌 대형) |

#### GB10 메모리 점검 (Q8 기준)

| 모델 | Q8 메모리 | GB10 119GB 통합 메모리 | 상태 |
|---|---|---|---|
| EXAONE 4.0 32B | ~35 GB | | ✅ 여유 |
| EXAONE 3.5 32B | ~35 GB | | ✅ 여유 |
| Qwen3-Coder-Next 80B MoE | ~85 GB | | ✅ 빠듯하지만 가능 |
| Qwen2.5-Coder 32B | ~35 GB | | ✅ 여유 |
| Llama 3.3 70B | ~75 GB | | ✅ 가능 |

> Ollama는 요청 시 모델을 자동 swap하므로 동시에 여러 모델을 메모리에 올릴 필요 없음. 평가는 1개씩 swap하면서 진행.

---

## 3. 추론 엔진 — Ollama 채택

| 비교 항목 | Ollama | vLLM |
|---|---|---|
| 설치 난이도 | 매우 낮음 (Docker 1줄) | 중간 |
| 모델 swap | 자동 (요청 시 로드) | 수동 (재시작) |
| 양자화 | GGUF 자동 (Q4/Q5/Q8/FP16) | safetensors (AWQ/GPTQ) |
| 동시 처리량 | 낮음~중간 | **높음** (paged attention) |
| OpenAI 호환 API | ✅ | ✅ |
| ARM(aarch64) | ✅ | ✅ (NVIDIA 컨테이너) |
| **이번 use case 정합도** | **◎ 평가 단계** | △ 운영 단계 |

### 채택 근거
1. **평가 단계에서 모델 swap 빈도가 높다** — Ollama의 핵심 강점
2. 부트캠프 ~20명 + BullMQ 비동기 워커 → 동시성 요구가 낮아 Ollama 처리량으로 충분
3. GGUF 자동 다운로드/관리 → EXAONE 4.0 같은 수동 import 모델도 Modelfile 한 줄로 처리
4. ADR-009의 LangChain JS는 `ChatOllama` 어댑터를 1급 지원

### 추후 옵션
선정된 단일 모델로 운영 단계 진입 시, 처리량이 부족하다고 판단되면 vLLM으로 전환 가능. 그때 별도 ADR로 결정.

---

## 4. 후속 SDD에서 다룰 항목 (이 문서 범위 밖)

이 문서는 *판단 근거*만 기록하며, 실제 평가 설계는 SDD에서 다룬다.

```
docs/architecture/oss-model-evaluation-design.md (예정)
├─ 1. 평가 목적 + 합격선 (정량적)
├─ 2. 후보 5개 + 각 모델의 메모리/라이센스/Ollama 경로
├─ 3. 메트릭 7개
│   ├─ 계산적 (5): JSON 파싱, Zod 스키마, 화이트리스트, 빈칸-정답 일관성, 지연/비용
│   └─ 추론적 (2): LLM-as-Judge (Claude를 judge로), 한국어 자연스러움
├─ 4. 데이터셋 설계
│   ├─ Gold Set A: 기존 시드 30문제 (검증된 정답 활용)
│   └─ Gold Set B: 신규 평가셋 N문제 (난이도 분포 + 도전 문제)
├─ 5. 평가 하네스 아키텍처 (Langfuse Datasets + Experiments 활용)
├─ 6. docker-compose ollama 서비스 추가 + GB10 ARM 환경 특이사항
├─ 7. LangChain ChatOllama 통합 (ADR-009 호환 유지)
├─ 8. EXAONE 4.0 GGUF Modelfile 임포트 절차
├─ 9. 라이센스 매트릭스 + 운영 배포 전 게이트
└─ 10. 통계적 유의성 / 라운드 수 / 합격 조건 (목표 vs 실측)
```

---

## 5. 미해결 / 후속 확인 항목

| # | 항목 | 책임 | 시점 |
|---|---|---|---|
| 1 | EXAONE 4.0 운영 배포용 commercial license — LG AI Research 문의 | 사용자 | 평가 라운드 종료 후 |
| 2 | Qwen3-Coder-Next 정확한 아키텍처/벤치마크 (한국어 SQL 분야) | Claude (SDD 단계) | SDD 작성 시 |
| 3 | Ollama ≥0.15.5 GB10/aarch64 빌드 호환성 실측 | 사용자 (Docker pull) | docker-compose 추가 시 |
| 4 | EXAONE 4.0 GGUF Modelfile 작성 방법 검증 | Claude + 사용자 | SDD 첨부 |
| 5 | LLM-as-Judge로 Claude를 사용해도 ADR-009 강제(LangChain) 위반 안 됨을 확인 | Claude | SDD 작성 시 (예: ChatAnthropic 그대로 사용) |

---

## 6. 변경 이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-09 | 초안 작성 | 사용자 요청 — "판단 근거 작성만 해둘 문서" |

---

## 7. 참고 자료

### 라이센스 / 모델 카드
- [LGAI-EXAONE/EXAONE-4.0-32B-GGUF — Hugging Face](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B-GGUF)
- [LG-AI-EXAONE/EXAONE-4.0 — GitHub (Official Repo + LICENSE)](https://github.com/LG-AI-EXAONE/EXAONE-4.0)
- [EXAONE 4.0 32B (Reasoning) — Dataconomy](https://dataconomy.com/ai-models/exaone-4-0-32b-reasoning/)
- [exaone3.5 — Ollama Library](https://ollama.com/library/exaone3.5)
- [qwen3-coder-next — Ollama Library](https://ollama.com/library/qwen3-coder-next)
- [Qwen3-Coder-Next: Complete 2026 Guide — DEV Community](https://dev.to/sienna/qwen3-coder-next-the-complete-2026-guide-to-running-powerful-ai-coding-agents-locally-1k95)
- [Solar Pro 2 (Reasoning) — Dataconomy (가중치 비공개 명시)](https://dataconomy.com/ai-models/solar-pro-2-reasoning/)
- [Solar Pro 2 — Upstage 공식 발표](https://www.upstage.ai/blog/en/solar-pro-2-launch)
- [HyperCLOVA X SEED — Ollama 지원 계획 없음 (HF Discussion)](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Vision-Instruct-3B/discussions/5)

### Ollama / 런타임
- [Support EXAONE-4.0 — ollama/ollama Issue #11433](https://github.com/ollama/ollama/issues/11433)
- [Ollama Library — 전체 모델 목록](https://ollama.com/library)
- [Qwen3-Coder Local Run Guide — Unsloth](https://unsloth.ai/docs/models/qwen3-coder-how-to-run-locally)

### 시장/벤치마크
- [Best Open-Source LLMs in 2026 — BentoML](https://www.bentoml.com/blog/navigating-the-world-of-open-source-large-language-models)
- [Best Self-Hosted LLM Leaderboard 2026 — Onyx AI](https://onyx.app/self-hosted-llm-leaderboard)
- [Best Open Source LLM 2026 | Benchmarks + Self-Hosting Guide — whatllm.org](https://whatllm.org/blog/best-open-source-models-january-2026)
- [Meet South Korea's LLM Powerhouses — MarkTechPost](https://www.marktechpost.com/2025/08/21/meet-south-koreas-llm-powerhouses-hyperclova-ax-solar-pro-and-more/)

### 프로젝트 내부 참조
- `CLAUDE.md` (§1 SDD+TDD, §3 3+1 합의 프로토콜)
- `docs/decisions/ADR-005-ai-backend-stack-guideline.md`
- `docs/decisions/ADR-008-oracle-dba-game-tech-stack.md`
- `docs/decisions/ADR-009-langchain-langfuse-stack.md`
- `docs/CONTEXT.md`
- `docs/IMPLEMENTATION_STATUS.md`

---

**이 문서는 행동/결정의 판단 근거만 보존한다. 실제 코드/설계는 후속 SDD와 ADR-010에서 다룬다.**
