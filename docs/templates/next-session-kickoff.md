# 다음 세션 Kickoff 메시지

| 항목 | 값 |
|---|---|
| **작성일** | 2026-04-17 야간 |
| **유효 시점** | MVP-B Session 3 3 커밋 (`b0e485d` ~ `6582d38`) **이후** 첫 번째 세션 |
| **대상 세션 목표** | MVP-B Session 4 — Layer 3 `LlmJudgeGrader` + Langfuse 프롬프트 + ADR-016 7개 안전장치 |
| **생명주기** | **1회용**. Session 4 착수 시점에만 유효. 다음 세션에서 사용한 뒤에는 Session 5 용으로 업데이트 또는 삭제. |

---

## 사용법

1. 새 Claude Code 세션을 연다.
2. 아래 코드블록 **전체를 복사**해 첫 메시지로 붙여넣는다.
3. 다음 세션의 Claude 가 Phase A → E 를 순차 진행하며 각 Phase 사이에 확인받는다.

> Session 3 의 kickoff 템플릿에서 Phase B(하네스 활성 점검)·Phase D(3+1 합의) 구조를 그대로 계승.
> `consensus-004` 실측 누락(Reviewer 약점)을 보완하기 위해 Phase D 에 "인용 문서는 Glob/Read 로 실재 확인" 지시 포함.

---

## Kickoff 메시지 (복붙용)

```
세션 시작. 이전 세션(2026-04-17 야간)에서 MVP-B Session 3 3 커밋
(Layer 1 AstCanonicalGrader + seed 게이트 + MT8 필터)을 마쳤고,
이번 세션은 MVP-B Session 4 (Layer 3 LlmJudgeGrader) 착수가
목표입니다. 다음 순서로 진행해주세요.

────────────────────────────────────────
Phase A — 상태 파악 (읽기만)
────────────────────────────────────────
1) CLAUDE.md 읽기
2) docs/CONTEXT.md 헤더 + `다음 세션 우선순위` 블록 읽기
3) docs/sessions/SESSION_2026-04-17.md §9 (Session 3 말 상태 + 연기
   항목) 읽기
4) docs/decisions/ADR-013 §Layer 3 + docs/decisions/ADR-016 (LLM-judge
   안전 7종) 읽기
5) apps/api/src/modules/grading/grading.orchestrator.ts 의
   LAYER_3_GRADER 토큰 위치 + DEFAULT_LAYER_3_GRADER 기본 구현 확인
6) apps/api/src/modules/ai/prompt-manager.ts + prompt-manager.test.ts
   훑어 기존 Langfuse fallback 패턴 파악 (evaluation/free-form-sql-v1
   을 여기에 올라가는 구조)

읽고 난 뒤 "착수 지점 확인" 1~3줄 요약만 보고해주세요.

────────────────────────────────────────
Phase B — 하네스 활성 사전 점검 (2분)
────────────────────────────────────────
7) 임의의 .ts 파일에 무해한 주석 한 줄 Edit → 되돌리기 로 Layer 1
   PostToolUse(tsc --noEmit) 훅 동작 확인. 오류 출력 없으면 통과.
8) Agent tool subagent_type="agent-a-impl" 경량 호출 — 로드 확인.
   (예: "LAYER_3_GRADER 기본 구현이 반환하는 verdict 를 1줄로 요약")

Phase B 결과 2~3줄로 요약해주세요.

────────────────────────────────────────
Phase C — Session 3 정리 현황 확인 (선택)
────────────────────────────────────────
9) git log main..HEAD --oneline 로 27 커밋 확인. 사용자에게
   "Session 4 착수 전 main 머지 먼저 수행할까요?" 물어주세요.
   - 머지 선행: 별도 PR 생성 (27 커밋)
   - 세션 내 머지 건너뜀: Session 4 커밋 후 다시 판단

답 받을 때까지 본 작업 착수 금지.

────────────────────────────────────────
Phase D — MVP-B Session 4 본 작업 (승인 후 착수)
────────────────────────────────────────
착수 전, 다음 3+1 합의를 1회 돌려주세요 (병렬 호출 → reviewer 집계):

주제: "LLM-judge 프롬프트 안전 아키텍처 (ADR-016 7종 안전장치의
       구체 구현 조합)"

세부 논점:
  - 경계 태그 선택: XML-like(<answer>...</answer>) / JSON 필드 /
    마크다운 코드펜스 중 어느 것이 Oracle LLM + StructuredOutputParser
    조합에 최적인가
  - temperature=0 + seed=42 의 재현성 보증 — Ollama / Anthropic 각각
    실제로 seed 를 지원하는지 (StructuredOutputParser 재시도 시
    비결정성 가능성)
  - Langfuse prompt 외부화 시 프롬프트 업데이트와 grader_digest
    버전 관리의 결합 방식 (prompt version 이 올라가도 자동 반영되지
    않아야 채점 재현성 유지)
  - 인젝션 방어: 학생 답안의 `</answer>` 토큰 등 경계 태그 탈출 시도
    (AnswerSanitizer 가 이미 의심 패턴 플래그하지만 LLM 경로엔 별도
    방어 필요)

독립 분석 시 "인용하는 문서/파일 경로는 Glob/Read 로 실재 확인 후
인용, 미확인 시 '(추정, 미검증)' 명시" 규칙 적용.
(Session 3 Reviewer 가 consensus-004 를 실측 없이 단정한 교훈.)

- agent-a-impl: LangChain Ollama/ChatAnthropic 의 seed/temperature 실
                동작 + StructuredOutputParser 구현 비용
- agent-b-quality: ADR-016 7종 안전장치 매핑 + 경계 태그별 인젝션
                   attack surface + WORM 기록 정합
- agent-c-alt: 대안 (guardrails / instructor / 자체 grammar 파서 /
               llama.cpp grammar mode 등)
- reviewer: 최종 아키텍처 + ADR-016 채택 안전장치 조합

합의 결과를 저에게 보여주시고 "채택합니까?" 확인 후 TDD 착수.

TDD 착수 시 순서 (커밋 단위 분할 권장):
  커밋 1: LlmJudgeGrader 기본 구현 + Langfuse prompt fallback +
          StructuredOutputParser + temperature=0/seed=42 + graderDigest
          에 prompt version 포함 (TDD 먼저)
  커밋 2: ADR-016 7종 안전장치 전체 (경계 태그 / 인젝션 방어 /
          타임아웃 / 재현성 / PII 필터링 / WORM / MT8 호출률 기록)
  커밋 3 (선택): 통합 테스트 + LAYER_3_GRADER DI 토큰 바인딩

────────────────────────────────────────
Phase E — 세션 마감 (Session 4 커밋 후)
────────────────────────────────────────
10) docs/sessions/SESSION_{오늘날짜}.md 작성 (새 파일 or
    SESSION_2026-04-17.md 가 오늘이면 §10 append)
11) docs/CONTEXT.md 헤더 + MVP-B 진행 카운트 갱신 (4/10)
12) docs/INDEX.md 업데이트 이력 한 줄 추가
13) main 머지 재판단 — Phase C 에서 머지 안 했다면 지금 다시 권고
14) 본 kickoff 템플릿(`docs/templates/next-session-kickoff.md`)을
    Session 5 용으로 재작성 또는 삭제

────────────────────────────────────────

각 Phase 사이마다 저에게 보고하고 "다음 Phase 진행?" 확인받아주세요.
Phase 건너뛰기 금지.
```

---

## 이 파일 유지보수 규칙

- **Session 4 착수 후**: 이 파일을 Session 5 용으로 재작성하거나 삭제.
- **Phase D 의 3+1 합의에서 "인용 문서 실재 확인" 규칙이 첫 적용**: 이 규칙이 실제로
  합의 품질을 개선했는지 Session 4 말에 평가하고 `.claude/agents/reviewer.md` 본문에
  흡수할지 결정.
- **상위 문서 링크가 깨지면**: ADR-013 / ADR-016 / SESSION 로그 번호가 변경됐는지 확인.
- **main 머지가 Phase C 에서 완료됐다면**: 이 kickoff 의 Phase E 재판단 단계는 skip.
