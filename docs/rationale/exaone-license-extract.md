# EXAONE AI Model License Agreement 1.2 - NC — 본 프로젝트 적용 분석

> **이 문서의 목적**: EXAONE 4.0 / 3.5 32B 라이센스 본문의 핵심 조항을 본 프로젝트(**유료 오라클 부트캠프 학습 게임**) 맥락에서 해석한 법적 검토 기록. SDD v2의 §9.1 라이센스 매트릭스의 근거 자료.

| 항목 | 값 |
|---|---|
| **문서 유형** | License 사본 + 적용 분석 |
| **작성일** | 2026-04-09 |
| **대상 라이센스** | EXAONE AI Model License Agreement **1.2 - NC** (Non-Commercial) |
| **대상 모델** | EXAONE 4.0 32B, EXAONE 3.5 32B (LG AI Research) |
| **적용 프로젝트** | Oracle DBA 학습 게임 — 유료 부트캠프 수강생 ~20명 대상 |
| **상태** | 1차 검토 (사용자 + LG AI Research 추가 문의 필요) |

---

## 1. 출처

- **공식 저장소**: https://github.com/LG-AI-EXAONE/EXAONE-4.0/blob/main/LICENSE
- **HuggingFace 모델카드**: https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B-GGUF
- **WebFetch 일자**: 2026-04-09

> 본 문서의 인용은 공식 LICENSE 텍스트를 정확히 보존하지 못할 수 있다. **법적 판단의 최종 근거는 LG AI Research의 공식 답변** 또는 **사내 법무 검토**이며, 본 문서는 그 전 단계의 사전 분석 기록이다.

---

## 2. 핵심 조항 (요약)

### 2.1 Section 2.1(a) — 허용되는 용도

> *"research and educational purposes" including "evaluation, testing, academic research, experimentation, learning, teaching, training"*

| 키워드 | 본 프로젝트에 해당하는가? |
|---|---|
| evaluation, testing | ✅ **평가 단계는 정확히 이 용도에 해당** — Gold Set A/B 측정은 evaluation/testing |
| academic research | ⚠ 부트캠프는 학술 연구 아님 |
| experimentation | ✅ 평가 단계의 모델 비교 = experimentation |
| learning, teaching | ✅ 학생 학습 활동 자체는 learning에 해당 가능 |
| training | ⚠ 모델 training 의미에 가까움 (학생 training이 아님) |

### 2.2 Section 3.1 — 금지되는 용도

> *"using the Model, Derivatives, or Output for any commercial purposes, including ... developing or deploying products, services, or applications that generate revenue"*

| 키워드 | 본 프로젝트에 해당하는가? |
|---|---|
| commercial purposes | ⚠ **회색지대** — 부트캠프 자체는 유료지만 게임은 수강생용 내부 도구 |
| developing or deploying products | ⚠ 학습 게임 = 수강생에게 제공되는 학습 보조 도구 = 일종의 product/service |
| **generate revenue** | ⚠ **이 표현이 핵심 분기점** — 부트캠프 수강료 자체는 revenue. 게임이 수강료의 직접적 가치 제안 일부인지 |

### 2.3 Section 2.1(d) & 3.1 — 재배포

- 재배포는 *"with a copy of this Agreement"* 조건으로 허용
- **Commercial distribution strictly prohibited without separate agreement**
- 본 프로젝트는 모델 가중치를 재배포하지 않음 (자체 호스팅) → 이 조항은 직접적 위배 없음

### 2.4 Section 3.2 — 리버스 엔지니어링 금지

- decompilation, source code derivation 금지
- 본 프로젝트는 추론만 수행 → 위배 없음

### 2.5 Section 4.2 — Output 소유권

> *"Licensor claims no rights in Output. Licensee is solely responsible for the Output and its use."*

- LG AI Research는 모델 출력(생성된 문제)에 대한 권리 주장 없음
- 출력 책임은 사용자 (본 프로젝트의 운영자) → 학습 자료로 사용해도 LG 측 권리 침해 없음
- **이 조항은 우리에게 유리** — 생성된 문제의 사용/재배포는 자유

### 2.6 Section 3.4 — 윤리적 사용

- 허위정보, 차별적 콘텐츠, IP 침해, 유해 사용 금지
- Oracle SQL 학습 문제 생성은 윤리적 문제 없음 → 위배 없음

### 2.7 모델 이름 규칙

- Modified version은 이름에 "EXAONE"을 포함해야 함
- 본 프로젝트는 modify/fine-tuning 안 함 → 해당 없음

---

## 3. 본 프로젝트 적용 단계별 판단

### 3.1 평가 단계 (Phase 0~3)

| 활동 | 판단 근거 | 결론 |
|---|---|---|
| Gold Set A/B에 대한 모델 출력 측정 | Section 2.1(a) "evaluation, testing, experimentation" 명시 | ✅ **안전** |
| LLM-as-Judge로 출력 비교 | 위와 동일 | ✅ **안전** |
| 평가 결과를 ADR-010으로 문서화 | Section 2.1 "공개적 결과 발표 허용" | ✅ **안전** |

→ **평가 단계에서 EXAONE 4.0 / 3.5 32B 사용은 라이센스상 명백히 안전하다.**

### 3.2 운영 단계 (선정 후)

| 활동 | 판단 근거 | 결론 |
|---|---|---|
| 부트캠프 수강생 ~20명에게 실시간 문제 생성 제공 | Section 3.1 "products, services, applications that generate revenue" — 부트캠프 수강료가 revenue에 해당하는지 | 🔴 **회색지대** |
| 게임이 수강료의 일부 가치를 제공 | "학습 게임"이 부트캠프 커리큘럼의 일부 → 수강료의 직접적 가치 제안 | 🔴 **회색지대 (위배 가능성 높음)** |
| 게임이 무료/오픈 액세스 | 만약 부트캠프 외부에도 무료 공개 시 | ⚠ revenue generation 측면에서 회피되지만 다른 조항 검토 필요 |

→ **운영 단계는 회색지대이며 보수적으로 해석하면 NC 위배 가능성이 있다.**

### 3.3 가장 보수적 해석

> "유료 부트캠프 운영의 일부로 EXAONE을 런타임에 사용하는 것은, 모델 출력이 부트캠프의 product/service 일부가 되어 revenue 창출에 기여하므로 Section 3.1의 commercial purposes에 해당한다."

이 해석을 채택하면 운영 단계에는 **반드시 LG AI Research의 commercial license**가 필요하다.

### 3.4 가장 관대한 해석

> "학습 게임은 수강생을 위한 교육 보조 도구이며 directly revenue를 발생시키지 않는다. 부트캠프 커리큘럼의 일부 내부 도구로 학생의 learning을 돕는 용도이므로 Section 2.1(a)의 'learning, teaching' 범위 안에 있다."

이 해석을 채택하면 운영 단계에도 별도 라이센스 없이 사용 가능. 다만 **이 해석은 LG AI Research의 명시적 확인 없이 채택하기에는 리스크가 높다.**

---

## 4. 다른 후보 모델과의 비교

| 모델 | 라이센스 | 유료 부트캠프 운영 |
|---|---|---|
| EXAONE 4.0 32B | EXAONE 1.2 NC | 🔴 회색지대 (본 문서 분석) |
| EXAONE 3.5 32B | EXAONE 1.2 NC | 🔴 회색지대 (동일 라이센스 계열) |
| Qwen3-Coder-Next | Apache 2.0 | ✅ 자유 |
| Qwen2.5-Coder 32B | Apache 2.0 | ✅ 자유 |
| Llama 3.3 70B | Llama Community License | ✅ 자유 (700M MAU 미만 자동 허용, 부트캠프 ~20명은 그 안) |

→ **EXAONE 두 모델만 라이센스 회색지대.** 다른 후보 3개는 운영 단계에서 자유.

---

## 5. 권고 (SDD v2 §9.2 운영 배포 게이트와 연동)

### 5.1 평가 단계 — 진행

**EXAONE 4.0 / 3.5 32B를 평가에 포함한다.** Section 2.1(a)의 "evaluation, testing, experimentation"이 명시적으로 허용하므로 안전.

### 5.2 운영 단계 — 차단 게이트

다음 두 가지 중 하나가 충족되어야 EXAONE을 운영 환경에 배포할 수 있다:

1. **LG AI Research의 commercial license 발급** (또는 본 프로젝트가 NC 범위에 해당한다는 LG의 공식 서면 확인)
2. **부트캠프 사용 형태가 LG에서 명시적으로 허용한 educational use case에 정확히 부합한다는 사내 법무 검토 기록**

위 조건을 평가 종료 후 ADR-010 작성 시점에 결정한다.

### 5.3 폴백 정책 (이미 SDD v1 §9.2에 명문화)

- 평가 결과 1위가 EXAONE이라도 위 조건 미충족 시 **2위 모델(자동 폴백)** 로 운영 진입
- 1위와 2위의 점수 차이 + 폴백 손실을 ADR-010에 정량 기록

---

## 6. 후속 작업

| # | 작업 | 책임 | 시점 |
|---|---|---|---|
| 1 | LG AI Research 공식 채널(이메일/문의 폼)로 본 프로젝트 형태(유료 부트캠프 + 학습 게임 + 자체 호스팅)에 대한 사용 가능성 문의 | **사용자** | 평가 라운드 시작 후 ~ ADR-010 작성 전 |
| 2 | 답변 수령 시 본 문서에 답변 사본 추가 | Claude | 답변 수령 직후 |
| 3 | 사내/외부 법무 검토 (선택) | 사용자 | 운영 진입 전 |
| 4 | LICENSE 1.3 등 후속 버전이 출시되면 본 문서 갱신 | Claude | 정기 |

---

## 7. 변경 이력

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-04-09 | 초안 작성 | consensus-002 합의 결과 C-09 반영 |

---

## 8. 면책

본 문서는 **법적 자문이 아니며**, Claude(AI 에이전트)가 공개 LICENSE 텍스트를 1차 분석한 기록이다. 운영 배포 전 반드시 LG AI Research 공식 답변 또는 자격 있는 법무 전문가의 검토가 필요하다.

---

## 9. 참고 자료

- [LG-AI-EXAONE/EXAONE-4.0/blob/main/LICENSE](https://github.com/LG-AI-EXAONE/EXAONE-4.0/blob/main/LICENSE)
- [LGAI-EXAONE/EXAONE-4.0-32B-GGUF — Hugging Face](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B-GGUF)
- `docs/rationale/oss-model-selection-rationale.md`
- `docs/architecture/oss-model-evaluation-design.md` (v2 §9)
- `docs/review/consensus-002-oss-model-evaluation.md` (C-09)
