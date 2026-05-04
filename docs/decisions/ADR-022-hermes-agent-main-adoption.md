# ADR-022 — Hermes Agent 메인 도입 + MVP 동결 + 시스템 진화

| 항목 | 값 |
|------|---|
| 상태 | **Accepted (2026-05-04)** — 사용자 "권고 채택" 명시 승인 |
| 제안 세션 | Session 17 (메타 피벗) |
| 선행 문서 | `docs/sessions/SESSION_2026-05-04.md`, `docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md`, consensus-014 / consensus-015 |
| 번복 대상 ADR | consensus-014 §C3 (LangGraph 메인) — **번복**, consensus-015 §3층 분리안 — **부분 번복** |
| 정책 재해석 | 사용자 메모리 `feedback_ai_stack.md` (2026-04-08, LangChain 강제) — **재해석** |
| 영향 범위 | **전체** — 신규 시스템 from-scratch. MVP 자산은 archive로 동결 보존. |
| Gate 충족 | Gate 9 (ADR 선행) — 비협상, 본 ADR이 충족 수단 |

---

## 1. 배경

### 1.1 트리거

사용자 결정 (2026-05-04 Session 17):

1. **Hermes Agent 도입** — "AI 팀을 만들기 위해서 Hermes Agent 도입하려고 합니다"
2. **Option A 선택** — Hermes Agent 메인 오케스트레이션 전면 도입
3. **메타 피벗** — 1기 운영 가정 무효화 (계약 없음, 개인 PC MVP) + 오늘까지 코드/문서 동결 + Hermes 5번(전부)

### 1.2 합의 결과 (consensus-015)

3 Agent 만장일치 — Option A REJECT, 3층 분리 권고. Reviewer 데이터 편 들기 후 사용자 메타 정보 공개로 분석 전제 재해석.

핵심 발견 (rationale §2.3):

| Gate | 운영 의존성 | 1기 무효 후 상태 |
|------|-----------|---------------|
| Gate 4 (ADR-016/018/021 회귀) | 부분 (MVP 자산만) | **유지** |
| Gate 6 (Community Hub 무변경) | 100% 운영 의존 | **무효** |
| **Gate 9 (ADR 선행)** | SDD 헌법 (운영 무관) | **유지 — 본 ADR이 충족** |
| Gate 10 (closed loop OFF) | 학생 PII 학습 위험 | **약화** (실재 PII 없음) |
| Gate 14 (1기 종료까지 메인 교체 금지) | 100% 운영 의존 | **무효** |

비협상 5건 중 4건이 운영 의존 → 풀림. 남은 비협상 = Gate 9.

### 1.3 합의 번복 이력 (3회 누적, narrative §6.1)

| 시점 | 합의 | 번복 시점 | 번복 트리거 |
|------|------|---------|-----------|
| consensus-014 §C3 (4일 전) | 메인 = LangGraph TypeScript | 2026-05-04 사용자 Option A | 사용자 메타 결정 |
| consensus-015 (오전) | 3층 분리, Hermes 메인 거부 | 2026-05-04 오후 | 1기 운영 가정 무효 공개 |
| 메타 피벗 (오후) | 1기 무효 + Hermes 메인 회복 | (현재 상태) | — |

**메타 안정성 의무**: 본 ADR §10에 번복 이력 명시 + narrative 교차 참조 → 추적 가능성 보존.

---

## 2. 결정 요약

### 2.1 핵심 결정 (5건)

| # | 결정 | 비고 |
|---|------|------|
| D1 | **Hermes Agent를 신규 시스템 메인 오케스트레이션으로 채택** | Python 기반 자체 엔진. consensus-014 §C3 번복. |
| D2 | **Hermes 4.3 36B Dense (512K)를 1차 LLM**으로 채택 (GB10 로컬 vLLM/llama.cpp 우선) | 91% FC 정확도, 비용 0, 데이터 외부 유출 차단 |
| D3 | **2026-05-04 시점 코드/문서 MVP archive 동결** | 진행 중 PR(#62/#63/PR-13 follow-up) 머지 안 함 |
| D4 | **신규 시스템 from-scratch** — MVP 자산은 archive에서 학습 입력/참조로 활용 | 점진 마이그레이션 거부 (rationale §5.2) |
| D5 | **`feedback_ai_stack.md` 정책 재해석** — Hermes 자체 엔진 허용. Langfuse 통합은 가능 범위에서 유지 | §6 정책 갱신 |

### 2.2 채택 사유 (rationale §4 요약)

사용자 동기 Q-D = 5번 = 전부:
- self-improving skills 누적
- hierarchical multi-agent orchestration ("AI 팀" 메타포)
- Hermes 4.3 LLM 자체
- 118 bundled skills

이 4가지를 부분 흡수하면 self-improving + multi-agent 핵심 가치 손상. **시스템 전체 채택**이 사용자 의도 정합.

### 2.3 거부된 대안 (rationale §8)

| 대안 | 거부 이유 |
|------|---------|
| consensus-014 Strangler fig + LangGraph 메인 | 1기 무효화로 점진 명분 사라짐 |
| consensus-015 3층 분리 (LangGraph 메인 + Hermes 4.3 LLM 어댑터) | 사용자 Q-D = 전부 → 시스템 전체 필요 |
| Hermes Agent 부분 도입 (보조만) | 동일 |
| 1기 종료 후 평가 | 1기 자체 무효 → 종료 시점 정의 불가 |
| 새 합의 라운드 (consensus-016) | 데이터 충분, 새 입력은 재해석만 필요 — 비대칭 비용 |

---

## 3. 시스템 경계

### 3.1 동결되는 것 (MVP archive, 2026-05-04 기준)

```
bootcamp_game/                              ← 현 저장소 (archive 처리)
├── apps/api/                              ← NestJS + LangChain + Langfuse
├── apps/web/                              ← Next.js + Tailwind
├── packages/                              ← 공유 타입
├── docs/architecture/                     ← SDD 자산
├── docs/decisions/ ADR-001~021            ← 의사결정 자산
├── docs/sessions/ Session 1~17            ← 의사결정 진화 기록
├── eval/                                  ← OSS 모델 평가 자산
└── 진행 중 PR (#62/#63/PR-13 follow-up)    ← 머지 안 함, 동결 상태로 보존
```

**보존 정책** (상세는 §5 archive 매니페스트):
- Git tag `mvp-freeze-2026-05-04` 부여
- main 브랜치는 archive 라벨로 동결 (force-push 금지)
- 신규 시스템에서 학습 입력/SDD 참조 자산으로 활용

### 3.2 신규 시스템 (별도 위치, 결정 대기)

| 결정 항목 | 옵션 | 선호 |
|---------|------|------|
| 위치 | (a) 별도 디렉터리 동일 저장소 / (b) 동일 저장소 새 브랜치 / (c) 새 모노레포 | 사용자 결정 (Phase 5) |
| 메인 언어 | Python (Hermes Agent 네이티브) | 확정 |
| LLM 1차 | Hermes 4.3 36B Dense (GB10 로컬) | 확정 |
| 백엔드 | Hermes Agent 자체 + 필요시 외부 도구(NestJS/Python 등) MCP 경유 | 확정 |
| Observability | Langfuse 가능 범위에서 통합 (Hermes provider 호출 trace) | 가능성 검증 필요 |

### 3.3 신규 시스템에서 적용되는 자산

MVP archive에서 신규 시스템으로 **참조 자산**으로 가져갈 항목:

| MVP 자산 | 신규 시스템 적용 |
|---------|---------------|
| ADR-016 LLM-judge 7종 안전장치 | Hermes self-improving skill의 결정성 게이트로 재해석 적용 |
| ADR-018 USER_TOKEN_HASH_SALT rotation | 향후 사용자 데이터 발생 시 적용 (현재는 단일 사용자) |
| ADR-021 Community Hub RBAC | 향후 multi-user 진입 시 재설계 입력 |
| ADR-009 LangChain 강제 | **재해석** — Hermes 자체 엔진 허용 (§6) |
| operational-monitoring SDD | Hermes skill 호출 모니터링으로 재구성 |
| OSS 모델 평가 인프라 | Hermes 4.3 vs 다른 LLM 비교 평가에 재사용 |

---

## 4. 14 Gate 갱신

| Gate | 출처 | 1기 무효 전 | 1기 무효 후 |
|------|------|----------|----------|
| Gate 1: ADR 선행 | 014 | — | 유지 |
| Gate 2: 메모리 외화 | 014 | — | **부분 완료** (인라인 4건 정정) |
| Gate 3: 별도 브랜치 롤백 | 014 | — | 유지 (archive 동결로 자동 충족) |
| Gate 4: ADR-016/018/021 회귀 | 014 | ✓ 비협상 | **유지** — 신규 시스템 적용 시 |
| Gate 5: 진행 PR 정리 후 진입 | 014 | — | **무효** — MVP archive 동결로 자동 충족 |
| Gate 6: Community Hub 무변경 | 014 | ✓ 비협상 | **무효** — 신규 시스템에서 재설계 |
| Gate 7: 70% 커버리지 | 014 | — | 신규 시스템 별도 정의 |
| Gate 8: 카오스 테스트 | 014 | — | 신규 시스템 별도 정의 |
| **Gate 9: ADR 선행** | 015 | ✓ **비협상** | **유지 — 본 ADR이 충족 수단** |
| Gate 10: closed learning loop OFF | 015 | ✓ 비협상 | **약화** — 향후 production 진입 전 별도 ADR |
| Gate 11: 3-layer memory PII 차단 | 015 | — | 향후 multi-user 진입 시 재정의 |
| Gate 12: WORM audit log | 015 | — | 향후 multi-user 진입 시 재정의 |
| Gate 13: 롤백 시 학습 산출물 삭제 | 015 | — | 향후 production 진입 시 재정의 |
| Gate 14: 1기 종료까지 메인 교체 금지 | 015 | ✓ 비협상 | **무효** — 1기 자체 무효 |

→ **현재 활성 비협상 Gate = Gate 9 (본 ADR) + Gate 4 (MVP 자산 보존)**.

---

## 5. MVP archive 매니페스트 (별도 작성 예정)

상세는 `docs/operations/mvp-archive-manifest.md` (작성 예정).

본 ADR §3.1의 보존 정책을 매니페스트로 외화:
- Git tag `mvp-freeze-2026-05-04` 부여 절차
- main 브랜치 동결 정책 (force-push 차단, branch protection)
- 신규 시스템에서의 참조 경로 매핑
- 진행 중 PR 동결 상태 (close vs draft 결정)

---

## 6. 정책 재해석 — `feedback_ai_stack.md`

### 6.1 원본 정책 (2026-04-08 사용자 직접 지시)

> "Anthropic SDK 직접 호출 금지. LangChain(추상화) + Langfuse(observability) 강제."

### 6.2 재해석

| 측면 | 재해석 |
|------|------|
| LangChain 강제 | **신규 시스템에서는 비강제** — Hermes 자체 엔진 허용. MVP archive에는 정책 유지 (NestJS 코드 보존). |
| Langfuse 강제 | **유지 (가능 범위에서)** — Hermes provider 호출 시 trace 통합 가능하면 통합. 불가능하면 Hermes 자체 observability 활용 + Langfuse는 외부 LLM 호출에만 적용. |
| Anthropic SDK 직접 호출 | 신규 시스템에서는 **Hermes provider를 통해서만 호출** (Hermes 내부 추상화). MVP archive 정책은 유지. |

### 6.3 메모리 갱신

`feedback_ai_stack.md`에 본 ADR 참조 추가 + 재해석 메모 첨부 (별도 작업).

### 6.4 정합성 검증

본 재해석은 다음과 충돌하지 않는다:
- `feedback_model_decoupling_test_first.md` (인터페이스 분리 + 가상 데이터 검증) — Hermes provider 추상화로 충족
- `feedback_rationale_doc.md` (큰 결정 narrative) — 본 narrative (`docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md`)로 충족

---

## 7. 향후 별도 ADR 필요 항목

| 트리거 | 별도 ADR 필요 |
|--------|------------|
| 신규 시스템에서 multi-user 진입 | ADR-23X — Hermes 3-layer memory PII 격리 정책 |
| 신규 시스템에서 production 트래픽 진입 | ADR-23X — closed learning loop 활성/비활성 기준 |
| Hermes Agent 외 새 vendor 추가 | ADR-23X — vendor neutrality 정책 (Hermes 메인 위에서) |
| GB10 로컬 추론 안정성 검증 후 production 채택 | ADR-23X — Hermes 4.3 36B 운영 SLO + digest pin (ADR-011 패턴 재사용) |
| Langfuse 통합 가능성 검증 결과 | ADR-23X — Hermes ↔ Langfuse 어댑터 또는 대체 observability |

---

## 8. 즉시 작업 (Gate 9 통과 후)

### 8.1 권고 순서 잔여 (사용자 채택)

| 단계 | 산출물 | 상태 |
|------|------|------|
| 1 | `docs/sessions/SESSION_2026-05-04.md` | ✅ 완료 |
| 2 | `docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md` | ✅ 완료 |
| **3** | **`docs/decisions/ADR-022-hermes-agent-main-adoption.md`** (본 ADR) | **✅ 완료 — 사용자 검토 대기** |
| 4 | MVP archive 매니페스트 (`docs/operations/mvp-archive-manifest.md`) | 다음 작업 |
| 5 | 신규 시스템 초기화 결정 (위치 + 명명 + 초기 구조) | 사용자 결정 |

### 8.2 사용자 검토 후 (Gate 9 충족)

본 ADR Status를 `Proposed` → `Accepted`로 갱신. 그 시점부터 신규 시스템 코드 작업 진입 허용.

### 8.3 신규 시스템 첫 작업 (Phase 1 — 사용자 검토 통과 후)

1. 신규 시스템 위치/저장소/디렉터리 확정 (사용자 결정)
2. Hermes Agent 설치 + Hermes 4.3 36B GGUF 다운로드 + GB10 로컬 추론 검증
3. Langfuse 통합 가능성 spike (Hermes provider trace 가능 여부)
4. ADR-016 7종 안전장치를 Hermes skill 결정성 게이트로 재해석한 design 작성
5. 신규 시스템 첫 SDD 문서 (`docs/architecture/hermes-system-design.md` 또는 신규 시스템 디렉터리)

---

## 9. 위험과 완화

| 위험 | 완화 |
|------|------|
| 합의 번복 3회 누적 → 의사결정 신뢰성 약화 | §10 번복 이력 명시 + narrative 교차 참조 |
| Hermes Agent 신생 v0.10 (4개월) breaking change 위험 | 단일 사용자 환경이므로 영향 격리. version pinning. |
| Hermes 4.3 36B GB10 로컬 추론 미검증 | spike PR 별도 (consensus-014 Phase 4 계승) |
| Langfuse 통합 불가 시 observability 공백 | Hermes 자체 observability 활용 + 별도 ADR |
| 신규 시스템 from-scratch로 MVP 검증 코드 손실 | archive 매니페스트로 참조 자산 보존 + 학습 입력 활용 |
| `feedback_ai_stack.md` 재해석이 향후 메모리 일관성 약화 | 메모리에 본 ADR 참조 추가 + 신규/MVP 정책 분리 명시 |
| ADR-016 7종 안전장치 신규 시스템 적용 미명세 | §3.3 + §8.3 4번 명시 — 신규 시스템 SDD 작성 시 강제 |
| GB10 로컬 추론 외 vendor 의존성 | §7 별도 ADR 트리거 정의 |

---

## 10. 합의 번복 이력 명시 (메타 안정성 의무)

본 ADR은 다음 결정을 명시적으로 번복/재해석한다:

### 10.1 consensus-014 §C3 — 번복

> "메인 프레임워크 = LangGraph TypeScript"

**번복 사유**:
- 1기 운영 가정 무효화로 NestJS+TS 모노레포 보호 명분 사라짐 (rationale §2)
- 사용자 Q-D = 5번 = 전부 → Hermes Agent 시스템 전체가 사용자 의도 정합 (rationale §4)
- 신규 시스템 from-scratch로 LangGraph TypeScript 자산이 archive로 위치 변경 (§3)

### 10.2 consensus-015 §3층 분리안 — 부분 번복

> "Layer 1: LangGraph 메인 + Layer 2: Hermes 4.3 LLM 어댑터 + Layer 3: experiments/hermes-sandbox/"

**부분 번복 사유**:
- Layer 1 거부 — 1기 무효화로 production 운영 보호 명분 사라짐
- Layer 2/3 구조 거부 — 사용자 Q-D = 전부 → 부분 흡수로는 불충분 (rationale §4.1)
- **단 Layer 2의 정신은 보존** — Hermes 4.3 LLM 자체는 신규 시스템 1차 LLM으로 채택 (D2)

### 10.3 `feedback_ai_stack.md` — 재해석 (§6)

> "LangChain(추상화) + Langfuse(observability) 강제"

**재해석 사유** (§6.2):
- 신규 시스템에서는 Hermes 자체 엔진 허용
- Langfuse 강제는 가능 범위에서 유지
- MVP archive 정책은 유지

---

## 11. References

- `docs/sessions/SESSION_2026-05-04.md` — 본 결정의 세션 흐름
- `docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md` — 판단 근거 narrative (사용자 메모리 강제)
- consensus-014 합의 보고서 (Reviewer 출력)
- consensus-015 합의 보고서 (Reviewer 출력)
- 사용자 메모리: `feedback_ai_stack.md`, `feedback_rationale_doc.md`, `feedback_model_decoupling_test_first.md`, `project_actual_state.md`, `project_pivot_2026_05_04.md`, `project_consensus_015.md`
- 검증 데이터: GPT-5.5 (2026-04-23), Hermes Agent v0.10.0 (2026-04-16) — 본 세션 web search 결과
- CLAUDE.md §1 (SDD 헌법), §3 (3+1 합의 프로토콜)

---

## 12. 사용자 검토 결과

**2026-05-04 사용자 응답**: "권고 채택"

- [x] D1 Hermes Agent 메인 채택 동의
- [x] D2 Hermes 4.3 36B 1차 LLM 동의
- [x] D3 2026-05-04 MVP archive 동결 동의
- [x] D4 신규 시스템 from-scratch 동의
- [x] D5 `feedback_ai_stack.md` 재해석 동의
- [x] §10 합의 번복 이력 명시 동의

**부수 결정** (`docs/operations/new-system-bootstrap-decision.md` 채택값):
- D-Loc = (c) 새 저장소
- D-Lang = (II) Python 메인 + TS 웹 UI
- D-Name = `oracle-ai-team`

신규 시스템 위치: `~/문서/project/category/oracle-ai-team/` (별도 git 저장소).
