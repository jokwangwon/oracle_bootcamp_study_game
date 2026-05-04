# MVP Archive Manifest — 2026-05-04 시점 동결

> **문서 성격**: ADR-022 §3.1 + §5 충족용 보존 정책 매니페스트
> **동결 일자**: 2026-05-04 (Session 17 메타 피벗)
> **연관 ADR**: ADR-022 (D3 MVP 동결 결정)
> **연관 세션**: `docs/sessions/SESSION_2026-05-04.md`

---

## 1. 동결 범위

### 1.1 동결되는 것 (ARCHIVE)

`/home/delangi/문서/project/category/bootcamp_game` 저장소 전체를 **2026-05-04 시점으로 동결**한다.

| 자산 | 위치 | 동결 처리 |
|------|------|---------|
| 백엔드 코드 | `apps/api/` | git tag로 동결, 신규 시스템 학습 입력 |
| 프론트엔드 코드 | `apps/web/` | git tag로 동결, 신규 시스템 학습 입력 |
| 공유 패키지 | `packages/` | git tag로 동결 |
| OSS 평가 인프라 | `eval/`, `apps/eval-results/` | git tag로 동결, 신규 시스템에서 재사용 |
| SDD 설계 문서 | `docs/architecture/` | 신규 시스템 ADR 작성 시 참조 |
| ADR 1~21 | `docs/decisions/` | 의사결정 자산, 신규 ADR에서 인용 |
| Rationale narrative | `docs/rationale/` | 의사결정 진화 기록 |
| Session 1~17 | `docs/sessions/` | 의사결정 진화 기록 |
| Operations 문서 | `docs/operations/` | 본 매니페스트 + 향후 운영 문서 |
| Constitution | `docs/constitution/` | CLAUDE.md 모태 — 신규 시스템에 그대로 적용 가능 |
| Guides | `docs/guides/` | 학습 자산 |
| 시드 / 마이그레이션 | `apps/api/src/migrations/`, seed 파일 | 신규 시스템 학습 입력 |
| Docker compose | `docker-compose.yml` 등 | 인프라 패턴 참조 |

### 1.2 동결되지 않는 것 (CONTINUOUS)

| 자산 | 이유 |
|------|------|
| **이 매니페스트** (`docs/operations/mvp-archive-manifest.md`) | 동결 정책 자체는 동결 후에도 갱신 가능 |
| **CLAUDE.md** | 향후 신규 시스템 진입 후 갱신될 가능성 (단 v1.0 기록은 보존) |
| **자동 메모리** (`~/.claude/projects/.../memory/*.md`) | 의사결정 진화 추적이 계속됨 |
| **신규 ADR** (ADR-023+) | 신규 시스템 작업이 시작되면 추가됨 |

### 1.3 머지하지 않는 것 (FROZEN PR)

진행 중이던 PR은 **머지하지 않고 동결 상태 보존**한다.

| PR | 상태 | 처리 |
|----|------|------|
| PR #62 (ADR-021 docs) | 머지 대기 | **draft 상태로 동결**, close 안 함. 신규 시스템 진입 시 학습 입력. |
| PR #63 (PR-13 통합 e2e) | 머지 대기 | 동일 |
| PR-13 follow-up 5건 (#19/#20/Phase 4/5/6) | 미작성 또는 진행 중 | **미작성**. follow-up 메모리(`project_pr13_followup.md`)는 학습 입력으로 유지. |

→ 진행 중 PR은 **history 자산**으로 위치 변경. 코드 자체는 archive에 포함되나 main 머지는 영구 보류.

---

## 2. Git 동결 절차

### 2.1 Tag 부여 (필수)

```bash
git -C /home/delangi/문서/project/category/bootcamp_game checkout main
git -C /home/delangi/문서/project/category/bootcamp_game tag -a mvp-freeze-2026-05-04 \
  -m "MVP archive freeze. ADR-022 §3.1 + §5 충족.

Decision date: 2026-05-04 (Session 17 메타 피벗)
Reason: 1기 운영 가정 무효화 + Hermes Agent 메인 도입 결정
References:
- docs/decisions/ADR-022-hermes-agent-main-adoption.md
- docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md
- docs/sessions/SESSION_2026-05-04.md
- docs/operations/mvp-archive-manifest.md (this manifest)

이 tag 이후 main 브랜치 변경은 archive 정책 갱신 또는 신규 시스템과 분리된 후속 ADR에 한정한다."
```

### 2.2 Branch 보호 (선택, 사용자 결정)

GitHub repository 설정:
- main branch protection 활성화 (force-push 차단)
- 직접 commit 차단 (PR 통해서만)
- 단 신규 시스템 위치가 (a) 동일 저장소 새 브랜치인 경우 main 병행 운영 가능성 있어 사용자 결정 필요

### 2.3 진행 중 PR 처리

```bash
# PR #62 / #63 — draft로 변환 (close 하지 않음)
gh pr ready --undo 62
gh pr ready --undo 63

# PR description에 동결 사유 명시 (수동 또는 gh pr edit)
gh pr edit 62 --body "$(cat <<'EOF'
[FROZEN — MVP archive 2026-05-04]

ADR-022 (Hermes Agent 메인 도입 + MVP 동결) 결정으로 본 PR은 머지하지 않고 동결 상태로 보존됩니다.

코드/문서 자산은 신규 시스템(별도 위치)에서 학습 입력 및 SDD 참조로 활용됩니다.

References:
- docs/decisions/ADR-022-hermes-agent-main-adoption.md
- docs/operations/mvp-archive-manifest.md
EOF
)"
```

→ 사용자 권한이 필요한 작업이므로 **사용자가 직접 실행** 또는 사용자 동의 후 자동화.

---

## 3. 신규 시스템에서의 참조 경로

### 3.1 학습 입력 (신규 시스템에서 명시 활용)

| MVP archive 자산 | 신규 시스템 활용 경로 |
|-----------------|------------------|
| `apps/api/src/modules/ai/llm-client.ts` (250 lines) | LangChain provider 추상화 패턴 → Hermes provider 추상화 설계 입력 |
| ADR-016 LLM-judge 7종 안전장치 | Hermes self-improving skill의 결정성 게이트 재해석 |
| ADR-018 SALT rotation | 향후 multi-user 진입 시 정책 재사용 |
| ADR-021 RBAC 3-tier | 향후 multi-user 진입 시 RBAC 모델 재사용 |
| Operational monitoring SDD | Hermes skill 호출 모니터링으로 재구성 |
| OSS 모델 평가 인프라 (eval/) | Hermes 4.3 vs 다른 LLM 비교 평가에 직접 재사용 |
| 시드 데이터 (sql-basics, transactions) | 신규 시스템 학습 콘텐츠로 재사용 |
| 노션 시안 페이지 (`352b362f-...`) | 신규 시스템 입력 데이터 그대로 활용 |

### 3.2 SDD 참조 (인용만)

신규 시스템 ADR 작성 시 다음 패턴으로 인용:

```markdown
## References (예시)

- MVP archive `docs/decisions/ADR-016-llm-judge-safety.md` — 7종 안전장치 (참조)
- MVP archive `docs/architecture/multi-agent-system-design.md` — 3+1 합의 프로토콜 (참조, 신규 시스템 합의 노드 설계 입력)
```

**중요**: 신규 시스템에서 MVP archive 코드를 **직접 import 하지 않는다** (from-scratch 원칙). 패턴/설계만 참조.

### 3.3 의사결정 진화 추적

향후 비슷한 메타 피벗이 일어날 때 본 archive를 다음 형태로 인용:

> "MVP archive (mvp-freeze-2026-05-04 tag)에서 NestJS+TypeScript+LangChain 스택을 21개월간 검증했고, 메타 피벗으로 Hermes Agent 메인으로 전환했다. 본 결정은 그 결과를 학습한 것이다."

---

## 4. 동결 검증 체크리스트

### 4.1 동결 시점 확인 (사용자 작업)

- [ ] `mvp-freeze-2026-05-04` tag 부여 완료
- [ ] main 브랜치 보호 활성화 (force-push 차단) — 사용자 GitHub 설정
- [ ] PR #62 draft 전환 + 동결 사유 명시 — 사용자 작업
- [ ] PR #63 draft 전환 + 동결 사유 명시 — 사용자 작업
- [ ] 본 매니페스트 commit + push (Gate 9 ADR-022 충족 후)

### 4.2 archive 무결성

- [ ] git log가 SESSION_2026-05-04.md commit까지 명확히 추적되는가
- [ ] tag log가 SESSION_2026-05-04 + ADR-022 + rationale + 매니페스트를 포함하는가
- [ ] 진행 중 PR이 close 되지 않았는가 (draft만)

### 4.3 신규 시스템 진입 전 확인

- [ ] ADR-022 status = Accepted (사용자 검토 완료)
- [ ] 신규 시스템 위치 결정 (사용자 Phase 5 응답)
- [ ] 본 매니페스트의 §3 참조 경로가 신규 시스템 ADR/SDD에 명시되는가

---

## 5. 향후 갱신 정책

### 5.1 본 매니페스트 갱신 트리거

| 트리거 | 갱신 내용 |
|--------|---------|
| 신규 시스템 위치 확정 (Phase 5) | §3 참조 경로 구체화 (신규 시스템 디렉터리/저장소 경로 추가) |
| MVP archive에서 새로운 결함 발견 | §6 신설 — 결함 inventory + 신규 시스템에서의 회피 경로 |
| 신규 시스템에서 MVP 자산 직접 마이그레이션 결정 (예외) | §3.2 갱신 — 마이그레이션 사유 + ADR 참조 |
| MVP archive에 보안 이슈 발견 | §7 신설 — 보안 disclosure 정책 (archive에는 패치 안 함, 신규 시스템에서만 회피) |

### 5.2 사용자 확정 사항

ADR-022 Status = Accepted로 전환되는 시점에 본 매니페스트도 `Active`로 발효된다. 그 전까지는 `Proposed` 상태로 보존.

---

## 6. References

- `docs/decisions/ADR-022-hermes-agent-main-adoption.md` — D3 MVP 동결 결정
- `docs/sessions/SESSION_2026-05-04.md` — 메타 피벗 흐름
- `docs/rationale/2026-05-04-mvp-freeze-and-hermes-pivot.md` — 판단 근거 narrative
- 자동 메모리: `project_pivot_2026_05_04.md`, `project_actual_state.md`
- v1.0.0 tag (이전 release tag, 본 archive와 별개로 보존)
