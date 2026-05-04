# MVP 동결 + Hermes Agent 피벗 판단 근거 (Rationale)

> **문서 성격**: 사용자 메모리 `feedback_rationale_doc.md` (2026-04-09) 강제 사항 — 큰 의사결정의 narrative 기록
> **대상 결정**: 1기 운영 가정 무효화 + 오늘까지 MVP 동결 + Hermes Agent 메인 도입
> **연관 ADR**: ADR-022 (작성 예정), consensus-014, consensus-015
> **작성**: 2026-05-04 Session 17

---

## 1. 왜 이 narrative가 필요한가

본 결정은 **단일 결정이 아니라 4시간 동안 4단계로 진화한 메타 결정의 연쇄**다:

1. GPT-5.5 / Hermes Agent 검증 → 분업안 도출
2. consensus-014 (전면 재설계 SDD 헌법 시행)
3. consensus-015 (Hermes Agent Option A 검증, 만장일치 REJECT)
4. **메타 피벗 — 1기 운영 가정 무효화로 합의 결과 부분 번복**

각 단계는 이전 결정 위에 쌓였고, 가장 마지막 단계에서 **이전 분석의 전제 자체가 가공이었음이 드러났다**. 이 narrative는 향후 비슷한 메타 발견이 일어날 때 **합의 결과의 소급 안정성을 어떻게 다룰 것인가**의 선례로서 기록된다.

---

## 2. 분석 전제의 무효화 — 4시간 만의 발견

### 2.1 누적된 가정

`MEMORY.md`에 기록된 11개 메모리 중 다수가 1기 부트캠프 운영 시뮬레이션을 사실로 전제하고 있었다:

| 메모리 | 가정 |
|--------|------|
| `project_bootcamp_personnel.md` | 학생 ~20명 / 강사 1~2명 / 운영자 1명 / 8주 (현재 운영 중) |
| `project_external_channel_absence.md` | Slack/카톡 미사용, Zoom 만, **외부 채널 부재** = Community Hub가 메인 |
| `project_community_rbac_policy.md` | 1기 3-tier RBAC, 학생 글 수정 코드 강제, audit log WORM |
| `user_profile.md` | "유료 Oracle DBA 부트캠프 운영자/강사" |

이 가정 위에서 consensus-013 / consensus-014 / consensus-015가 **학생 ~20명 라이브 트래픽 보호** + **GDPR 삭제권** + **형평성 분쟁 방어** + **Community Hub 외부 채널 부재로 인한 보호 필요성**을 비협상 제약으로 도출했다.

### 2.2 발견의 순간

사용자 응답: "운영 중단해도 됩니다. **아직 아무런 계약도 안 하고 내 개인 PC에서만 하던 MVP였어요**."

이 한 문장이 위 모든 메모리의 시제(時制) 가정을 무효화했다. "1기 운영 중"이 아니라 "**미래 1기 운영을 위한 시뮬레이션**"이었음을 의미한다. 메모리는 표면상 사실 진술처럼 적혀 있었으나, 실제로는 사용자의 **목표/계획 컨텍스트**였다.

### 2.3 왜 이 차이가 결정적인가

consensus-015에서 Agent B가 비협상으로 격상한 5개 Gate 중:

| Gate | 운영 의존성 | 상태 |
|------|-----------|------|
| Gate 4 (ADR-016/018/021 회귀) | 부분 (MVP 자산만) | **유지** |
| Gate 6 (Community Hub 무변경) | 100% 운영 의존 | **무효** |
| Gate 9 (ADR 선행) | SDD 헌법 (운영 무관) | **유지** |
| Gate 10 (closed learning loop OFF) | 학생 PII 학습 위험 | **약화** (실재 PII 없음) |
| Gate 14 (1기 종료까지 메인 교체 금지) | 100% 운영 의존 | **무효** |

5개 비협상 중 **3개가 가공 제약** 위에 세워져 있었다. 이를 모르고 진행했다면 향후 모든 의사결정이 가공 제약 위에 누적되어 부정확해졌을 것이다.

---

## 3. 왜 합의 프로토콜이 이를 막지 못했는가

### 3.1 합의 프로토콜의 한계

CLAUDE.md §3 3+1 합의는 **사용자가 입력한 컨텍스트의 진위를 검증하지 않는다**. Agent A/B/C가 아무리 독립적이어도 모두 동일한 메모리를 입력으로 받기 때문에 **메모리의 가정이 실재인지 시뮬레이션인지 구별하지 못한다**.

이는 합의 프로토콜의 결함이 아니라 **설계 가정**이다. 합의는 "주어진 컨텍스트 위에서 최선의 결정"을 내리는 도구이지 "컨텍스트 자체의 진실성을 검증하는 도구"가 아니다.

### 3.2 발견을 가능하게 한 메커니즘

발견은 **사용자 결정과 데이터 합의가 충돌**하는 순간 일어났다:

1. consensus-015 Reviewer가 사용자 Option A 결정을 REJECT (데이터 편 듦)
2. 사용자가 충돌의 원인을 설명하기 위해 새 메타 정보(1기 운영 가정 무효)를 공개
3. 새 메타 정보가 합의 분석 전제를 무효화
4. Reviewer 권한으로 합의 결과 부분 번복

**즉 데이터 편 들기 → 사용자 충돌 → 메타 정보 공개 → 컨텍스트 정정**이라는 4단 흐름이 합의 프로토콜의 사각지대를 보완했다. 이는 합의 프로토콜의 **간접 자기 진단 메커니즘**으로 작동한다.

### 3.3 향후 적용

`user_profile.md`에 다음 행동 패턴 추가:

> 의사결정 스타일: 큰 메타 결정에서 데이터에 반하는 선택을 하기도 함 — 그 경우 Reviewer가 데이터 편을 들어 솔직히 짚으면 사용자가 새 입력(예: 1기 가정 무효)을 공개해 합리화함.

향후 사용자 결정이 데이터와 충돌할 때 Reviewer는 **즉시 굴복하지 않고 데이터 편을 든 후 사용자 추가 입력을 기다리는** 패턴을 유지한다. 이것이 메타 정보 공개를 유도한다.

---

## 4. Hermes Agent를 왜 메인으로 채택했는가

### 4.1 사용자 동기 (Q-D = 5번 = 전부)

- **self-improving skills 학습 누적** — 시간이 갈수록 강해지는 시스템
- **hierarchical multi-agent orchestration** — "AI 팀" 메타포 직접 매칭
- **Hermes 4.3 LLM 자체** — 91% FC 정확도, 512K context, GB10 로컬 가능
- **118 bundled skills** — 즉시 활용 가능한 도구 라이브러리

이 4가지를 **분리 흡수**(consensus-015 Layer 2: ChatHermes 어댑터)하면 self-improving skills와 multi-agent orchestration의 핵심 가치가 손상된다. 사용자 의도는 "Hermes Agent 시스템 전체를 다뤄보고 진화의 도구로 삼는 것"이라 부분 흡수로는 불충분하다.

### 4.2 1기 운영 무효화로 풀린 제약

| 제약 | 풀린 후 |
|------|--------|
| Python 자체 엔진 ↔ NestJS+TS 모노레포 통합 불가능 | "전면 재설계"로 NestJS 자체 from-scratch — 통합 우려 무효 |
| closed learning loop ↔ ADR-016 D3 Hybrid 결정성 충돌 | 학생 PII 없음 — sandbox 아닌 메인에서도 실험 가능 (단 향후 production 정책 별도 검토) |
| 신생 v0.10 4개월차 안정성 | 학생 라이브 트래픽 없음 — breaking change 노출 위험 무효 |
| Hermes에 적재된 skill = 새 lock-in | 신규 시스템 자체가 새 출발이라 lock-in 경로 새로 정의 가능 |

→ consensus-015의 핵심 반대 근거 5건 중 4건이 **운영 의존이었음**. 1기 무효화로 4건 자동 해소.

### 4.3 남은 우려와 대응

| 우려 | 대응 |
|------|------|
| consensus-014 §C3 4일 만의 번복 → 합의 프로토콜 안정성 | ADR-022 narrative에 번복 이력 명시 (본 문서) |
| `feedback_ai_stack.md` (LangChain 강제) 자기충돌 | ADR-022 §정책 갱신에서 재해석 명시 |
| Gate 9 (ADR 선행) 비협상 | 본 narrative + ADR-022 작성 후에만 코드 진입 |
| GB10 aarch64 + Hermes 4.3 36B 실측 미검증 | spike PR 별도 (consensus-014 Phase 4 계승) |
| 학생 데이터 부재가 영원한가 (향후 production) | closed learning loop 정책은 production 진입 전 별도 ADR |

---

## 5. 왜 MVP 동결인가

### 5.1 동결의 의미

"오늘까지 동결"은 다음을 의미한다:

| 자산 | 처리 |
|------|------|
| 코드 (apps/web, apps/api, scripts) | git tag로 동결, 신규 시스템 학습 입력으로 활용 |
| 문서 (docs/architecture, docs/decisions, docs/sessions) | 신규 시스템 ADR 작성 시 참조 |
| 메모리 (11개) | 가정 부분만 정정 (운영 시제), 결정 narrative는 보존 |
| 진행 중 PR (#62/#63/PR-13 follow-up) | **머지 안 함** — MVP archive에 동결 상태로 보존 |

### 5.2 왜 신규 시스템을 from-scratch로 가는가

대안 (이어 개발):
- 기존 NestJS 위에 Hermes Agent를 어댑터로 통합
- consensus-014/015의 Strangler fig 점진 마이그레이션

거부 사유:
- 사용자 메타 결정 = "프로젝트 진화" — 점진은 과거 결정 누적을 그대로 끌고 감
- Hermes Agent의 self-improving / 118 skills / 3-layer memory를 NestJS 위에 어댑터로 끼워 넣으면 본질이 사라짐 (consensus-015 Agent C 분석)
- 1기 운영이 없으니 점진의 핵심 명분(라이브 트래픽 보호) 무효

채택 사유:
- 신규 시스템 = Python 기반 Hermes Agent 메인 + 필요시 NestJS 또는 다른 백엔드를 외부 도구로 → "AI 팀" 메타포에 정확히 매칭
- 기존 코드는 archive로 학습 입력 — 사라지는 것이 아니라 **참조 자산**으로 위치 변경

---

## 6. 합의 번복 3회 누적의 메타 안정성

### 6.1 번복 패턴

| 시점 | 합의 | 번복 |
|------|------|------|
| consensus-014 §C3 (4일 전) | 메인 = LangGraph TypeScript | 사용자 Option A |
| consensus-015 (오늘 오전) | 3층 분리, Hermes 메인 거부 | 메타 피벗 |
| 메타 피벗 (오늘 오후) | 1기 무효 + Hermes 메인 회복 | (현재) |

### 6.2 위험

빠른 번복이 누적되면:
- **결정의 구속력 약화** — 다음 결정도 곧 번복될 수 있다는 인식
- **합의 프로토콜의 신뢰성 저하** — "어차피 사용자가 번복할 것"이라는 메타 학습
- **ADR/SDD의 추적 곤란** — 번복 이력이 코드에 남지 않으면 향후 결정 근거 추적 불가

### 6.3 완화책

각 번복마다:

1. **번복 트리거를 narrative로 외화** — 본 문서 §2.2처럼 "어떤 새 정보가 번복을 정당화했는가" 명시
2. **이전 합의 번복 이력을 ADR에 누적** — ADR-022는 consensus-014 §C3 + consensus-015 부분 번복 명시
3. **합의 프로토콜의 한계 인정** — §3에서 메모리 가정 검증 부재를 명시화
4. **메타 안정성 메모리 추가** — `project_pivot_2026_05_04.md` 에 패턴 기록

이렇게 하면 번복 자체가 **추적 가능한 의사결정 진화**가 되어 합의 프로토콜이 자기 학습한다.

---

## 7. 결정 후 책임

### 7.1 즉시 의무 (Gate 9 비협상)

- ADR-022 작성 + 본 narrative와 교차 참조 (ADR-022 §References)
- 코드 진입 전 사용자 검토 통과

### 7.2 신규 시스템 설계 시 명시

- consensus-014 §C3 (LangGraph 메인) 채택하지 않은 이유 = 사용자 동기 5번(전부) 흡수에 부적합
- `feedback_ai_stack.md` (LangChain 강제) 정책 재해석 명시 — Hermes 자체 엔진 허용 또는 LangChain 통합 정책 갱신
- ADR-016 7종 안전장치 / ADR-018 SALT rotation / ADR-021 RBAC 정책 — MVP archive 자산으로 보존, 신규 시스템은 from-scratch 적용

### 7.3 향후 production 진입 전 별도 ADR

- closed learning loop 정책 — 학생 PII 발생 시
- 메모리/skill의 lock-in 경로 — 신규 vendor 추가 시
- audit log + WORM 정합성 — 사용자 데이터 보호 의무 발생 시

---

## 8. 거부된 대안 (참고)

| 대안 | 거부 이유 |
|------|---------|
| consensus-014 그대로 (Strangler fig + LangGraph 메인) | 1기 무효화로 점진의 명분 사라짐 |
| consensus-015 3층 분리 (LangGraph 메인 + Hermes 4.3 LLM 어댑터) | 사용자 동기 Q-D 5번 = 전부 → Hermes Agent 시스템 전체가 필요 |
| Hermes Agent 부분 도입 (보조 도구만) | 위와 동일 |
| 1기 종료 후 평가 (현재 시스템 유지) | 1기 자체가 무효 — 종료 시점 정의 불가 |
| 새 ADR 가동 (consensus-016) | 합의 데이터는 충분, 새 입력(1기 무효)이 분석 재해석만 필요 — 가동 비용 비대칭 |

---

## 9. 결론

본 결정은 다음을 동시에 인정한다:

1. **사용자의 메타 권위** — 1기 운영 가정의 진위는 사용자만 알 수 있음. 합의 프로토콜은 이를 검증할 수단이 없음.
2. **Reviewer의 데이터 권위** — 사용자 결정이 데이터와 충돌할 때 즉시 굴복하지 않고 데이터 편을 드는 것이 메타 정보 공개를 유도함.
3. **합의 프로토콜의 자기 진단** — 충돌이 자기 진단을 트리거함. 충돌 자체가 시스템의 건강함의 신호.
4. **번복의 추적 의무** — narrative 외화로 의사결정 진화를 코드/문서에 남겨야 향후 결정 근거 추적 가능.

본 narrative는 ADR-022 §References의 핵심 입력이며, 향후 비슷한 메타 발견이 일어날 때 선례로 활용된다.

---

**다음 문서**: `docs/decisions/ADR-022-hermes-agent-main-adoption.md` (Gate 9 비협상 충족용)
