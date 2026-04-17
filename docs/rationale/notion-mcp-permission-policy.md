# Notion MCP 권한 정책 — 판단 근거

> **이 문서의 목적**: Claude Code 하네스가 제공하는 Notion MCP 툴(읽기/쓰기/구조 변경)을 **어떤 기준으로 어느 카테고리에 배치했는지** 기록하기 위한 narrative. `.claude/settings.json` 의 `permissions` 블록과 짝을 이룬다.

| 항목 | 값 |
|---|---|
| **문서 유형** | Decision Rationale (판단 근거) |
| **작성일** | 2026-04-17 |
| **작성자** | 사용자(jokwangwon) + Claude (하네스 점검 세션) |
| **상태** | 적용 완료 (`.claude/settings.json`) |
| **관련 ADR** | — (하네스 설정이라 ADR 대상 아님; `harness-engineering-design.md` 와 연관) |

---

## 1. 배경 (Why)

Claude Code 세션에서 `@claude_ai_Notion` MCP 서버가 연결되어 있고, 다음 14개 툴이 노출된다:

**읽기 계열 (5)**
- `notion-fetch`, `notion-search`, `notion-get-comments`, `notion-get-teams`, `notion-get-users`

**쓰기 계열 — 페이지/코멘트/뷰 수준 (7)**
- `notion-create-comment`, `notion-create-pages`, `notion-duplicate-page`, `notion-update-page`, `notion-move-pages`, `notion-create-view`, `notion-update-view`

**쓰기 계열 — 구조 수준 (2)**
- `notion-create-database`, `notion-update-data-source`

하네스 엔지니어링 원칙 ("잘못하는 것이 불가능하게 만들어라") 관점에서, 쓰기 툴을 무제약으로 열어두면 다음 문제가 발생한다.

1. **되돌리기 비용 비대칭**: Notion 쓰기는 로컬 commit 과 달리 원격 공유 workspace 에 즉시 반영되며, 다른 팀원이 이미 본 상태가 될 수 있다.
2. **구조 변경의 파급**: database / data source 변경은 그 데이터베이스를 참조하는 모든 뷰·페이지·링크에 영향을 준다. 특정 페이지 편집과는 위험도 차원이 다르다.
3. **부주의 commit 위험**: Claude 가 작업 중 "관련 맥락을 위해" 판단해 자동 생성한 페이지/코멘트가 실제 팀 공간을 오염시킬 수 있다.

---

## 2. 분류 기준

세 카테고리로 나눈다. Claude Code `permissions` 의 `allow` / `ask` / `deny` 키에 각각 매핑.

| 카테고리 | 의미 | 기준 |
|---------|------|------|
| **allow** | 매번 승인 없이 실행 | (a) 읽기 전용이고, (b) 현 작업 이해에 자주 필요 |
| **ask** | 매번 사용자 승인 요청 | 쓰기이지만 되돌리기 가능하고 범위가 특정 페이지/뷰에 한정 |
| **deny** | 명시적 차단 | 구조 변경 — 파급 범위 넓고, 사람 판단이 필요한 설계 행위 |

---

## 3. 매핑 결과

### 3.1 allow (5개 — 읽기)

| 툴 | 사유 |
|----|-----|
| `notion-fetch` | 페이지 본문 가져오기. 작업 맥락 확보에 필수. |
| `notion-search` | 키워드 검색. 관련 문서 탐색에 필수. |
| `notion-get-comments` | 페이지 코멘트 읽기. 리뷰/피드백 이해. |
| `notion-get-teams` | 팀 정보 읽기. 소유권/참조 판단. |
| `notion-get-users` | 사용자 정보 읽기. 담당자 판단. |

**전제**: MCP 서버 연결 자체가 이미 이 workspace 에 대한 *사용자의 합의된 접근*이다. 그 합의 안에서의 읽기는 매번 개별 승인을 요구할 필요가 없다. 읽기 남용은 로그로 추적 가능하며 되돌릴 것 자체가 없다.

### 3.2 ask (7개 — 특정 객체 쓰기)

| 툴 | 사유 |
|----|-----|
| `notion-create-comment` | 코멘트 생성은 팀원에게 알림. 의도된 맥락에서만 허용. |
| `notion-create-pages` | 페이지 생성. 의도와 위치(상위 페이지) 확인 필요. |
| `notion-duplicate-page` | 복제. 원본을 오염시키진 않지만 공간 오염 위험. |
| `notion-update-page` | 페이지 수정. 기존 내용 덮어쓰기 위험. |
| `notion-move-pages` | 페이지 이동. 링크 깨짐·검색 결과 변경. |
| `notion-create-view` | 뷰 생성. 다른 팀원의 UX 에 영향. |
| `notion-update-view` | 뷰 수정. 기존 뷰 덮어쓰기. |

**전제**: 각 쓰기가 타겟팅하는 대상(페이지 ID / 뷰 ID)이 한정되며, 사용자가 매 호출마다 (1) 의도한 대상인지, (2) 이 시점에 수행해도 되는지 확인할 기회를 가진다. 자동 승인(allow)은 Claude 가 문맥을 착각했을 때의 피해를 키울 뿐이다.

### 3.3 deny (2개 — 구조/소스 변경)

| 툴 | 사유 |
|----|-----|
| `notion-create-database` | 데이터베이스 생성은 **조직 정보 구조**의 설계 행위. 자동화로 만들면 즉시 쓰기 흐름이 엉킨다. 사람이 설계 후 수동으로. |
| `notion-update-data-source` | 데이터 소스 변경은 **그 DB 를 참조하는 모든 뷰·페이지·링크**에 파급. 단일 호출의 영향 범위가 너무 크다. |

이 둘은 필요 시 사용자가 직접 `deny` 에서 빼고 한 번 쓴 뒤 다시 복원한다. 번거로움을 감수해야 할 정도의 파급력이다.

---

## 4. 고려했으나 채택하지 않은 대안

### 4.1 "전부 ask" — 단순성 우선

- **장점**: 설정 단순. 카테고리 분류 부담 없음.
- **단점**: `notion-fetch` / `notion-search` 는 에이전트 기본 작업의 일부. 매번 승인은 마찰 비용이 너무 크고, 결국 사용자가 기계적으로 Y 를 누르게 되어 실제로는 보호 효과가 떨어진다.
- **판정**: 미채택. 읽기와 쓰기의 비대칭 비용을 정책에 반영하는 것이 유의미한 보호.

### 4.2 "전부 allow" — 마찰 최소화

- **장점**: UX 최상.
- **단점**: Notion 쓰기는 되돌리기 비용이 비대칭적으로 높고, Claude 가 문맥을 착각한 경우의 피해가 로컬 파일 변경보다 크다.
- **판정**: 미채택. 이 비대칭성을 무시하는 정책은 하네스 원칙에 어긋남.

### 4.3 "ask 와 deny 의 경계를 `update-data-source` 만 deny"

- **장점**: `create-database` 도 사용자가 원할 때 한 번의 승인으로 열 수 있다.
- **단점**: 데이터베이스 생성은 **설계 문서가 선행**되어야 할 결정. 자동으로 만들어지면 SDD 문서와 실제 Notion 구조가 따로 놀 위험.
- **판정**: 미채택. `create-database` 도 deny 유지 — 설계 의도를 보호.

---

## 5. 후속 액션

1. **정책 리뷰 주기**: 분기 1회 또는 MCP 툴 세트가 바뀔 때 재검토.
2. **deny 해제 기록**: 누군가 일시 해제할 경우 이 문서 §3.3 에 *사례 로그*로 append.
3. **감사 로그 연계**: Claude Code 세션 로그에 남는 MCP 호출 이력을 `docs/sessions/` 로 주기적으로 링크.

---

## 6. 관련 파일

- 정책 적용 위치: `.claude/settings.json` — `permissions.{allow,ask,deny}`
- 하네스 원칙: `docs/architecture/harness-engineering-design.md`, `CLAUDE.md` §2
