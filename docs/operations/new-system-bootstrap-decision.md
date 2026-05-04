# 신규 시스템 초기화 결정 — 옵션 분석

> **문서 성격**: ADR-022 §3.2 + §8.3 1번 충족용 — 신규 시스템 위치/구조 결정 입력
> **작성**: 2026-05-04 Session 17
> **상태**: Proposed — 사용자 결정 대기
> **연관**: ADR-022, MVP archive manifest

---

## 1. 결정해야 할 사항 (3가지)

| ID | 항목 | 의미 |
|----|------|------|
| **D-Loc** | 신규 시스템 위치 | 디렉터리/저장소 정책 |
| **D-Lang** | 메인 언어 / 런타임 | Python 단일 vs 폴리글랏 |
| **D-Name** | 프로젝트 이름 | 디렉터리/저장소 명명 |

---

## 2. D-Loc — 신규 시스템 위치

### 2.1 옵션 비교

| 옵션 | 의미 | 장점 | 단점 |
|------|------|------|------|
| **(a) 동일 저장소 새 디렉터리** | `bootcamp_game/v2/` 또는 `bootcamp_game/hermes-system/` 추가 | git history 단일 추적 / archive 참조 즉시 가능 | main 브랜치 동결과 충돌 (새 commit이 main에 추가됨) → branch protection 우회 필요 |
| **(b) 동일 저장소 새 브랜치** | `bootcamp_game/main` 동결 + `bootcamp_game/v2-hermes` 브랜치에서 작업 | git history 통합 / branch protection 충돌 없음 | archive에 코드를 가지러 갈 때마다 브랜치 전환 필요 |
| **(c) 새 저장소 (별도 GitHub repo)** | `bootcamp-game-v2/` 또는 `oracle-game-hermes/` 신규 | archive와 완전 분리 / 신규 시스템 정체성 명확 / Python 모노레포로 자유 설계 | archive 참조 시 cross-repo 작업 / GitHub 권한 신규 / CI 신규 |
| **(d) 동일 디렉터리 다른 위치** | `~/문서/project/category/bootcamp_game_v2/` 같은 새 디렉터리 (저장소도 별개) | local 작업 즉시 시작 / archive와 완전 분리 | (c)와 유사하나 GitHub 미생성 — local-only |

### 2.2 트레이드오프 매트릭스

| 기준 | (a) 새 디렉터리 | (b) 새 브랜치 | **(c) 새 저장소** | (d) local 새 디렉터리 |
|------|-------------|----------|-------------|------------------|
| Archive 동결 보존 | ❌ main에 추가 commit | ✅ branch 분리 | ✅ 완전 분리 | ✅ 완전 분리 |
| 신규 정체성 | ❌ 같은 저장소 | △ 같은 저장소 다른 브랜치 | ✅ 명확 | ✅ 명확 |
| Archive 참조 비용 | ✅ 같은 곳 | △ 브랜치 전환 | △ cross-repo | △ cross-dir |
| Python 모노레포 자유 | △ 기존 구조 영향 | △ 기존 구조 영향 | ✅ 자유 | ✅ 자유 |
| GitHub 운영 부담 | ✅ 기존 활용 | ✅ 기존 활용 | △ 신규 setup | ✅ local-only |
| CI/CD 재사용 | ✅ 기존 | ✅ 기존 | △ 신규 | N/A |
| 합의 번복 추적 가시성 | ✅ 같은 git history | ✅ 같은 git history | △ 별 history | ❌ git 분리 |

### 2.3 권고

**(c) 새 저장소** — 다음 이유로 가장 정합:

1. **Archive 동결의 진정성** — `mvp-freeze-2026-05-04` tag가 진짜 동결 의미를 가지려면 신규 작업이 그 저장소에 들어가지 않는 게 깔끔함
2. **Python 모노레포 자유** — Hermes Agent는 Python 1차, 기존 NestJS+TS 구조는 Python 모노레포 컨벤션과 맞지 않음. 새 저장소에서 from-scratch가 자연스러움
3. **신규 시스템 정체성** — "AI 팀 시스템"이라는 메타포가 명확한 분리에서 더 잘 드러남
4. **Cross-repo 참조 비용은 낮음** — git submodule 또는 단순 clone으로 archive 접근 가능. SDD 문서는 markdown copy-paste로 충분.

**(b) 새 브랜치도 차선책** — GitHub 신규 setup 부담을 피하고 싶을 때.

---

## 3. D-Lang — 메인 언어 / 런타임

### 3.1 옵션 비교

| 옵션 | 의미 | 장점 | 단점 |
|------|------|------|------|
| **(I) Python 단일** | Hermes Agent + 모든 도구 Python | 단일 런타임 / 의존성 단순 / Hermes 네이티브 | 웹 UI 약함 (Streamlit/Gradio 한정) |
| **(II) Python 메인 + TS 웹 UI 폴리글랏** | Hermes는 Python, 사용자 인터페이스는 Next.js/Remix | 풍부한 웹 UI 가능 / archive Next.js 자산 일부 재사용 | 두 런타임 / IPC 또는 API 중간층 필요 |
| **(III) Python 메인 + 외부 도구 MCP** | Hermes가 모든 도구를 MCP 서버로 호출 | 표준 준수 / 도구 격리 | MCP 서버 운영 부담 / latency |

### 3.2 트레이드오프

| 기준 | (I) Python 단일 | (II) Python+TS 웹 | (III) Python + MCP |
|------|-------------|---------------|---------------|
| 단순도 | ✅ 가장 단순 | △ 중간 | △ 중간 |
| 웹 UI 풍부함 | ❌ 제한적 | ✅ 풍부 | △ MCP 통한 UI 가능성 |
| Hermes 네이티브 정합 | ✅ 최고 | △ 보통 | ✅ MCP 표준 |
| Archive 자산 재사용 | △ 시드/평가 인프라만 | ✅ Next.js 일부 + 시드/평가 | △ MCP 서버 신규 작성 |
| 부트캠프 학습 콘텐츠 표시 | ❌ Streamlit 한정 | ✅ Next.js 풍부 | ✅ 외부 UI 자유 |
| 운영 복잡도 | ✅ 낮음 | △ 중간 | △ 높음 |

### 3.3 권고

**(II) Python 메인 + TS 웹 UI** — 다음 이유로:

1. 부트캠프 학습 게임 메타포가 살아있다면 풍부한 웹 UI는 사용자 경험에 결정적
2. archive `apps/web/` 의 Tailwind/시안 D/시안 ε 디자인 자산을 부분 재사용 가능
3. Hermes Agent는 Python 메인으로 강하게 동작 + Next.js는 Hermes의 REST API 또는 SSE로 통신
4. (I) Python 단일은 사용자 의도 "AI 팀"의 시각적 표현이 약함

**단** 사용자가 "MVP로 본다 = UI는 후순위"로 판단한다면 **(I) Python 단일**도 합리적 (Streamlit으로 빠른 데모).

---

## 4. D-Name — 프로젝트 이름

### 4.1 후보

| 후보 | 의미 |
|------|------|
| `bootcamp-game-v2/` | archive와의 연속성 강조 |
| `oracle-game-hermes/` | Hermes Agent 메인 강조 |
| `hermes-bootcamp/` | Hermes 메타포 + 부트캠프 컨텍스트 |
| `oracle-ai-team/` | "AI 팀" 메타포 + Oracle DBA 도메인 |
| 사용자 직접 명명 | — |

### 4.2 권고

사용자 직접 명명을 권합니다. 다만 **하이픈 `-` 사용 (Python 모노레포 컨벤션)** + **archive와 충돌하지 않는 명칭** 두 조건 충족 권장.

`bootcamp_game`은 underscore — Python 패키지명에 그대로 쓸 수 없으므로 어차피 변경 필요.

---

## 5. 최종 결정 요청

다음 형태로 응답해주세요:

```
D-Loc: (a) / (b) / (c) / (d) — 권고 (c)
D-Lang: (I) / (II) / (III) — 권고 (II)
D-Name: 직접 명명 (예: oracle-ai-team)
```

또는 권고안 그대로 가시려면:

```
권고 채택 — D-Loc=(c) + D-Lang=(II) + D-Name=oracle-ai-team
```

---

## 6. 결정 후 즉시 작업 (Phase 1 — 신규 시스템)

사용자 결정 후 즉시:

1. **신규 저장소/디렉터리 생성** (D-Loc 결정에 따라)
2. **CLAUDE.md 복사 + 갱신** — 신규 시스템 컨텍스트로 헤더 갱신
3. **MVP archive 참조 정책 명문화** — `docs/references-to-mvp-archive.md` 작성
4. **Hermes Agent 설치 + Hermes 4.3 36B GGUF 다운로드 + GB10 로컬 추론 검증**
5. **Langfuse 통합 가능성 spike** (Hermes provider trace 가능 여부)
6. **첫 SDD 문서** — `docs/architecture/hermes-system-design.md` (또는 신규 디렉터리)
7. **첫 ADR** — ADR-001 (신규 시스템 시작점, archive ADR-022 인용)

---

## 7. References

- ADR-022 §3.2 — 신규 시스템 결정 항목
- ADR-022 §8.3 — 결정 후 즉시 작업
- MVP archive manifest §3.1 — 학습 입력 매핑 (신규 시스템 진입 시 활용)
- rationale §5 — 왜 from-scratch인가
