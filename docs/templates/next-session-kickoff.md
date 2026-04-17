# 다음 세션 Kickoff 메시지

| 항목 | 값 |
|---|---|
| **작성일** | 2026-04-17 저녁 |
| **유효 시점** | 하네스 점검 5 커밋 (`dda09f0` ~ `f64c887`) + 세션 로그 마감 커밋 (`1439e6c`) **이후** 첫 번째 세션 |
| **대상 세션 목표** | MVP-B Session 3 — Layer 1 AstCanonicalGrader + `node-sql-parser` + Oracle 방언 (ADR-013 §Layer 1) |
| **생명주기** | **1회용**. Session 3 착수 시점에만 유효. 다음 세션에서 사용한 뒤에는 내용을 Session 4 용으로 업데이트하거나 삭제. |

---

## 사용법

1. 새 Claude Code 세션을 연다 (기존 세션과 분리).
2. 아래 코드블록 **전체를 복사**해 첫 메시지로 붙여넣는다.
3. 다음 세션의 Claude 가 Phase A → E 를 순차 진행하며 각 Phase 사이에 확인받는다.

> 이 kickoff 는 자립형(self-contained)이라 세션 메모리에만 의존하지 않는다.
> Phase B 의 하네스 활성 점검이 실패하면 Claude Code 재시작을 권고받는다.

---

## Kickoff 메시지 (복붙용)

```
세션 시작. 이전 세션(2026-04-17 저녁)에서 하네스 점검 5 커밋을 마쳤고,
이번 세션은 MVP-B Session 3 (Layer 1 AstCanonicalGrader + node-sql-parser
+ Oracle 방언) 착수가 목표입니다. 다음 순서로 진행해주세요.

────────────────────────────────────────
Phase A — 상태 파악 (읽기만)
────────────────────────────────────────
1) CLAUDE.md 읽기 (프로젝트 규칙)
2) docs/CONTEXT.md 읽기 (현재 상태 헤더)
3) docs/sessions/SESSION_2026-04-17.md §6 (다음 세션 우선순위) + §8 (하네스
   점검 결과) 읽기
4) docs/decisions/ADR-013 (3단 채점) §Layer 1 읽기
5) apps/api/src/modules/grading/grading.module.ts 와 LAYER_1_GRADER DI
   토큰 위치 grep

읽고 난 뒤 "착수 지점 확인" 1~3줄 요약만 보고해주세요 (파일 읽은 흔적,
어떻게 시작할지).

────────────────────────────────────────
Phase B — 하네스 활성 사전 점검 (2분)
────────────────────────────────────────
6) 임의의 .ts 파일에 무해한 주석 한 줄을 Edit 으로 추가했다가 바로
   되돌려서, Layer 1 PostToolUse 훅(tsc --noEmit)이 실제로 돌아가는지
   상태 메시지로 확인.
   → 안 뜨면 "하네스 재시작 필요" 라고 보고하고 중단.
7) Agent tool 로 subagent_type="agent-a-impl" 을 가벼운 질문("현재
   grading 모듈의 Layer 1 DI 바인딩 상태를 1줄로 요약해줘")으로 호출해서
   서브에이전트가 로드됐는지 확인.
   → 실패하면 .claude/agents/ 가 활성 안 된 것. 재시작 권고.

Phase B 결과 2~3줄로 요약해주세요.

────────────────────────────────────────
Phase C — 병행 보안 핸드오프 문서 결정 (사용자 판단 필요)
────────────────────────────────────────
8) docs/security/audit-2026-04-17-access-control-and-dpa.md 를 열어 §0
   "병행 작업 경계" 를 읽고:
   - 이 문서가 본 프로젝트에 유효한 핸드오프인지 (상위 문서 링크 점검)
   - MVP-B Session 3 와 병행 가능한지 (문서가 grading/ 을 건드리지
     않는다고 선언되어 있음)
   - 지금 tracked 로 커밋해두는 것이 옳은지

세 가지를 3줄 이내로 보고하고 저에게 "포함할까요 / 보류할까요 / 이 파일
무시할까요" 를 물어주세요.
답 받을 때까지 이 파일은 건드리지 않습니다.

────────────────────────────────────────
Phase D — MVP-B Session 3 본 작업 (승인 후 착수)
────────────────────────────────────────
착수 전, 다음 3+1 합의 1번 돌려주세요 (병렬 호출 → reviewer 집계):

주제: "Oracle 방언 미지원 구문의 처리 정책 (UNKNOWN fallback → Layer 2
      강등이 옳은가, 아니면 syntax-error 로 채점 거부인가)"

- agent-a-impl: node-sql-parser 의 실제 커버리지 + fallback 구현 비용
- agent-b-quality: ADR-013 §Layer 1 정합성 + Layer 2 강등 시 채점 편향
                   위험 + 테스트 요구
- agent-c-alt: 대안 (sqlparse 포팅 / 자체 AST / strict mode 차단 /
               하이브리드)
- reviewer: 최종 정책 한 줄 + 위험도

합의 결과를 저에게 보여주시고 "채택합니까?" 확인 후 TDD 착수.

TDD 착수 시 순서:
  (a) npm i node-sql-parser -w apps/api
  (b) apps/api/src/modules/grading/graders/ast-canonical.grader.test.ts
      먼저 (RED) — 정규화 스펙 5종 (case fold / alias / 공백주석 /
      절순서 / 비교축) 각각 테스트
  (c) ast-canonical.grader.ts 구현 (GREEN)
  (d) grading.module.ts 의 LAYER_1_GRADER 토큰에 주입 (Orchestrator
      코드 변경 불필요 — DI 추상화는 이전 세션에서 완료)
  (e) npm run typecheck && npm test (pre-commit 이 자동)
  (f) 커밋

────────────────────────────────────────
Phase E — 세션 마감 (Session 3 커밋 후)
────────────────────────────────────────
9) docs/sessions/SESSION_{오늘날짜}.md 신규 작성 (2026-04-17 파일 구조
   참고)
10) docs/CONTEXT.md 헤더 갱신 (커밋 수, MVP-B 3/10)
11) docs/INDEX.md 업데이트 이력 한 줄 추가
12) main 머지 검토 시점인지 판단해서 보고 (SESSION_2026-04-17.md §5
    참조, 현재 25 커밋 앞섬)

────────────────────────────────────────

각 Phase 사이마다 저에게 보고하고 "다음 Phase 진행?" 확인받아주세요.
Phase 건너뛰기 금지.
```

---

## 이 파일 유지보수 규칙

- **Session 3 착수 후**: 이 파일을 Session 4 용으로 재작성하거나 삭제.
- **Phase D 의 3+1 합의가 첫 실전 사용**: 출력 품질 이슈가 있으면
  `.claude/agents/*.md` 를 사후 보강 대상으로 기록.
- **상위 문서 링크가 깨지면**: ADR-013 경로 / SESSION 로그 번호가 변경됐는지 확인.
