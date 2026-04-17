# ADR-009: AI 추상화/관측 레이어로 LangChain + Langfuse 강제

**상태**: 확정
**날짜**: 2026-04-08
**의사결정자**: 사용자 직접 지시
**관련 ADR**: ADR-005 (AI 백엔드 스택), ADR-008 (Oracle DBA 게임 기술 스택)

---

## 맥락 (Context)

ADR-008에서 LLM 공급자를 Claude API / OpenAI API로 결정했고, SDD §4(AI 콘텐츠 파이프라인)에 따라 BullMQ 워커가 LLM을 호출하여 5가지 게임 모드의 문제를 생성한다. 또한 노션 자료 분석(범위 추론), 출력 검증, 향후 Spaced Repetition 추천 등 다수의 LLM 호출 지점이 예정되어 있다.

LLM 직접 호출(`@anthropic-ai/sdk`)만으로는 다음 항목이 누락된다:

| 필요 기능 | SDK 직접 호출 | LangChain | Langfuse |
|-----------|--------------|-----------|----------|
| Chat / Prompt 추상화 | 수동 | ✅ | — |
| Output Parsing (Zod 호환) | 수동 | ✅ | — |
| Chain / Agent 구성 | 수동 | ✅ | — |
| Provider Swap (Claude ↔ OpenAI) | 코드 변경 | ✅ | — |
| Trace / Span 자동 기록 | — | — | ✅ |
| Prompt Versioning | 코드 하드코딩 | — | ✅ |
| Eval / 비용 추적 | 수동 | — | ✅ |

특히 헌법 §8-2조(하드코딩 금지)는 프롬프트도 코드 외부에서 관리하기를 요구한다. Langfuse Prompt Management가 이 요구와 직접 정합한다.

## 결정 (Decision)

**AI/LLM 관련 모든 코드는 LangChain JS + Langfuse JS SDK를 사용한다. `@anthropic-ai/sdk` 등 공급자 SDK 직접 import는 금지한다.**

| 차원 | 결정 |
|------|------|
| LLM 추상화 레이어 | LangChain JS (`langchain`, `@langchain/core`) |
| Provider 어댑터 | `@langchain/anthropic` (기본), `@langchain/openai` (대체) |
| Observability | Langfuse JS SDK (`langfuse`) + LangChain Callback Handler |
| Prompt 관리 | Langfuse Prompt Management (코드 외부) |
| Output 검증 | LangChain `StructuredOutputParser` + 기존 Zod 스키마 (`packages/shared/src/schemas/question.schema.ts`) |
| 환경변수 | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` 추가 |

## 선택지 (Options Considered)

### 선택지 A: `@anthropic-ai/sdk` 직접 사용 (현재 설치된 상태)
- 장점: 가장 단순, 추가 의존성 없음
- 단점: trace/eval 부재, prompt versioning 부재, provider swap 시 코드 변경, output parsing 직접 구현
- 기각 사유: 운영 안정성 + 헌법 §8-2 정합성 부족

### 선택지 B: LangChain만 사용 (Langfuse 없음)
- 장점: 추상화 + provider swap 가능
- 단점: trace/eval/prompt versioning은 여전히 부재
- 기각 사유: AI 운영의 핵심인 observability 누락

### 선택지 C: LangChain + Langfuse (선택)
- 장점: 추상화 + observability + prompt versioning 모두 충족
- 단점: 의존성 2개 추가 (~수 MB), 학습 곡선
- 채택 사유: **사용자 직접 지시**, 그리고 위 표의 7개 항목을 모두 만족하는 유일한 조합

### 선택지 D: 자체 wrapper + OpenTelemetry
- 장점: 완전 통제
- 단점: 구현 비용 큼, 생태계 단절
- 기각 사유: NIH(Not Invented Here)

## 근거 (Rationale)

1. **사용자 직접 지시 (최우선)**: 2026-04-08 세션에서 명시.
2. **헌법 §8-2 정합**: 프롬프트를 코드에서 분리(Langfuse) → 하드코딩 제거.
3. **헌법 §3 정합**: 출력 검증에 `StructuredOutputParser` + Zod를 결합하여 계산적 검증 우선 원칙 유지. Zod 스키마는 이미 `packages/shared/src/schemas/question.schema.ts`에 존재하므로 재사용.
4. **공급자 독립**: ADR-008에서 LLM_PROVIDER를 환경변수로 분리한 의도(Claude ↔ OpenAI)를 LangChain 어댑터가 코드 변경 없이 실현.
5. **TypeScript 정합**: Full-Stack TS 프로젝트 — LangChain JS / Langfuse JS 모두 1급 TS 지원.
6. **로컬 추론과 무관**: ADR-005(로컬 추론 시 Python 분리)는 우리가 LLM API만 호출하므로 적용 대상 아님. TS로 충분.

## 결과 (Consequences)

### 긍정적
- 모든 LLM 호출이 Langfuse trace에 자동 기록 → 디버깅/비용 분석 용이
- 프롬프트를 코드 변경 없이 갱신 가능 → 빠른 실험 사이클
- Claude → OpenAI 전환 시 환경변수 + provider 어댑터 한 줄만 변경
- LangChain의 `StructuredOutputParser` + 기존 Zod 스키마로 SDD §4.4 ① 검증 단계 자연스럽게 구현

### 부정적
- 의존성 추가: `langchain`, `@langchain/core`, `@langchain/anthropic`, `langfuse` (~수 MB)
- LangChain은 추상화 레이어가 두꺼워 디버깅 시 stack trace가 깊어질 수 있음
- Langfuse 자체 운영(self-host) 또는 Cloud 계정 필요 — 환경변수 + 비용 관리 필요

### 마이그레이션
- `apps/api/package.json`에서 `@anthropic-ai/sdk`는 **즉시 제거하지 않는다.** 아직 import 0건이므로 리스크 없으며, 다음 AI 워커 PR에서 LangChain 의존성을 추가할 때 같이 제거한다.
- 기존 코드 변경: 0건 (현재 AI 코드 자체가 없음)

## 강제 사항

**향후 어떤 PR도 다음을 어기면 거부된다:**

1. `@anthropic-ai/sdk`, `openai` 등 공급자 SDK를 직접 import하는 코드 추가
2. 프롬프트 문자열을 코드 안에 const로 하드코딩 (Langfuse Prompt Management로 외부화 필요)
3. Langfuse callback handler 없이 LangChain Chat Model 호출
4. LLM 출력을 Zod 검증 없이 DB에 저장

## 관련 문서

- `docs/architecture/oracle-dba-learning-game-design.md` §2.3 (기술 스택), §4 (AI 콘텐츠 파이프라인)
- `docs/decisions/ADR-005-ai-backend-stack-guideline.md`
- `docs/decisions/ADR-008-oracle-dba-game-tech-stack.md`
- `docs/IMPLEMENTATION_STATUS.md` §2.2 (기술 스택 설치 상태)
- `packages/shared/src/schemas/question.schema.ts` (Zod 검증 스키마)
