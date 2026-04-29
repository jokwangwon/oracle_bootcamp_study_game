# Community Moderation SDD — 모더레이션 1기/2기/3기 단계

> **상태**: Accepted (2026-04-29, consensus-013, ADR-021)
> **합의**: `docs/review/consensus-013-adr-021-community-hub.md` §4.6
> **결정**: `docs/decisions/ADR-021-community-hub.md` §3.5
> **선행 ADR**: ADR-016 §7 D3 Hybrid (2기 LLM-judge 자동 모더레이션 패턴 재사용)

---

## 1. 배경

부트캠프 1기 ~20명 / 강사 1~2명 / 운영자 1명 환경에서 모더레이션 흐름 명세. 1기는 단순 (사용자 신고 + operator/admin queue), 2기는 LLM-judge 자동 모더레이션 (ADR-016 §7 D3 Hybrid 재사용), 3기는 shadow_ban / appeal 흐름.

ADR-019 SM2 단계적 적용 패턴 그대로 활용.

---

## 2. 1기 모더레이션 (본 ADR-021 적용 범위)

### 2.1 신고 흐름

```
학생: 부적절 글 발견 → "신고" 버튼 클릭
  ↓
POST /api/discussion/reports
  Body: { targetType: 'thread'|'post', targetId, reason }
  ↓
discussion_reports 테이블 INSERT (status='pending')
  ↓
operator/admin 의 모더레이션 queue 표시 (`/admin/moderation`)
  ↓
operator/admin: 신고 검토 → 액션 결정 (lock/hide/delete/dismiss)
  ↓
audit_log INSERT (action + reason + by_user_id)
  ↓
신고자에게 결과 통지 (1기는 미구현, 3기 트리거)
```

### 2.2 신고 테이블 (마이그레이션 1714000024000)

```sql
CREATE TABLE discussion_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed', 'escalated')),
  resolved_by UUID NULL REFERENCES users(id),
  resolved_at TIMESTAMPTZ NULL,
  resolution_action VARCHAR(30) NULL,  -- 'lock' / 'hide' / 'delete' / 'dismiss'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 사용자가 동일 대상 중복 신고 방지
  CONSTRAINT uq_report_unique UNIQUE (target_type, target_id, reporter_id)
);

CREATE INDEX idx_reports_status_created
  ON discussion_reports (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX idx_reports_target
  ON discussion_reports (target_type, target_id);
```

**UNIQUE 제약**: 동일 사용자가 동일 글 중복 신고 차단 (CWE-840 abuse 방어).

### 2.3 모더레이션 액션

| 액션 | 권한 | 효과 | 복구 |
|-----|------|-----|------|
| `lock` | operator+ | thread 잠금 (댓글 작성 불가, 읽기 가능) | `unlock` |
| `unlock` | operator+ | thread 잠금 해제 | `lock` |
| `pin` | operator+ | thread 상단 고정 (목록 sort 우선) | `unpin` |
| `unpin` | operator+ | 고정 해제 | `pin` |
| `hide` | operator+ | thread/post 숨김 (작성자 / operator+ 만 보임) | `restore` |
| `restore` | operator+ | 숨김 해제 | `hide` |
| `delete` (soft) | owner / operator+ | `is_deleted=true` (PR-10b 머지) | 1기 미구현 (3기 트리거) |
| `dismiss` | operator+ | 신고 기각 (audit log 기록) | — |

**모든 액션 audit_log INSERT 강제** (`audit-log SDD` 참조).

### 2.4 컬럼 추가 (마이그레이션 1714000025000)

```sql
ALTER TABLE discussion_threads
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE discussion_posts
  ADD COLUMN hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

### 2.5 endpoint 신규

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/discussion/reports` | user+ | 신고 등록 |
| GET | `/api/admin/moderation/queue` | operator+ | 신고 queue (status='pending') |
| POST | `/api/admin/moderation/threads/:id/lock` | operator+ | thread 잠금 |
| POST | `/api/admin/moderation/threads/:id/unlock` | operator+ | thread 잠금 해제 |
| POST | `/api/admin/moderation/threads/:id/pin` | operator+ | thread 고정 |
| POST | `/api/admin/moderation/threads/:id/hide` | operator+ | thread 숨김 |
| POST | `/api/admin/moderation/posts/:id/hide` | operator+ | post 숨김 |
| POST | `/api/admin/moderation/posts/:id/restore` | operator+ | post 복구 |
| POST | `/api/admin/moderation/reports/:id/resolve` | operator+ | 신고 처리 (액션 + 메모) |
| POST | `/api/admin/moderation/reports/:id/dismiss` | operator+ | 신고 기각 |

### 2.6 UI

#### 2.6.1 사용자 신고 (학생)

- thread/post 우상단 "..." 메뉴 → "신고" 옵션
- 모달: 신고 사유 (`abuse` / `spam` / `off-topic` / `other` + 자유 입력) + 확인
- 신고 완료 토스트: "신고가 접수되었습니다. 검토 중"
- 동일 글 중복 신고 시 토스트: "이미 신고하셨습니다"

#### 2.6.2 모더레이션 queue (operator/admin)

- `/admin/moderation` 라우트 (인증 + RolesGuard `operator+`)
- 표 형식: 신고 일시 / 대상 thread/post / 신고자 / 사유 / 액션 버튼
- 액션 버튼: 잠금 / 숨김 / 삭제 / 기각
- 액션 클릭 시 사유 입력 모달 → audit_log INSERT 트리거
- 페이지네이션: 50건/page, status=pending 우선

#### 2.6.3 모더레이션 표시 (학생)

- 잠금: "🔒 잠긴 글입니다" 배지 + 댓글 입력 비활성
- 고정: "📌 고정" 배지 + 목록 상단 우선 정렬
- 숨김: 본인 외 표시 안 함 (404 또는 "모더레이션 처리됨" 표시)

---

## 3. 2기 모더레이션 (트리거)

### 3.1 트리거 조건

| 트리거 | 도입 시점 |
|--------|---------|
| community 글 ≥ 200건 | 운영자 queue 부담 한계 |
| 신고 빈도 ≥ 주 5건 | 자동 사전 검출 ROI 발생 |
| 부트캠프 1기 종료 (8주) | 1기 데이터 축적 후 검증 |

### 3.2 LLM-judge D3 Hybrid 자동 모더레이션 (ADR-016 §7 재사용)

```
글 작성 (POST /api/discussion/threads, /posts)
  ↓
sanitize-html (PR-10b)
  ↓
[2기 신규] LLM-judge self-check (toxicity / off-topic / spam)
  ↓
toxicity_score < 0.3 → 통과 (즉시 게시)
toxicity_score 0.3~0.7 → operator queue 자동 등록 (audit log: 'auto_flag')
toxicity_score > 0.7 → 즉시 hidden_by_admin=true + queue 등록 (audit log: 'auto_hide')
```

ADR-016 §7 D3 Hybrid 패턴:
- LangChain (LLM 호출 추상화 — 사용자 메모리 강제)
- Langfuse trace (PII 필터링 D3 적용)
- 모델: m3 (ADR-011, OSS Qwen3-Coder-Next) — 추론 비용 ≈ 0
- 프롬프트: 안전 7종 경계 태그 (ADR-016 §1)

### 3.3 운영자 escalation queue

LLM 자동 분류 후에도 operator/admin 가 최종 검증. LLM false positive 방어.

### 3.4 신규 SDD

2기 진입 시 별도 SDD `docs/architecture/community-llm-moderation-design.md` 작성.

---

## 4. 3기 모더레이션 (트리거)

### 4.1 트리거 조건

| 트리거 | 도입 |
|--------|-----|
| 부정 사용자 ≥ 3건 | shadow_ban + 운영자 노트 |
| 부트캠프 2기 (학생 ≥ 50명) | appeal 흐름 + escalation |
| 분쟁 ≥ 5건 | appeal 사용자 차원 통지 |

### 4.2 신규 기능

- **shadow_ban**: `users.shadow_banned_at TIMESTAMPTZ NULL` — 본인은 정상 게시 보이나 다른 사용자에게는 숨김
- **운영자 노트**: `discussion_moderation_notes` 테이블 (operator 가 사용자별 메모, audit 별도)
- **appeal**: 학생이 모더레이션 결정에 이의 제기 (UI + endpoint)
- **하드 삭제 (admin only)**: GDPR / 법적 요구 시 영구 삭제 + audit_log "purged" 기록 (단 audit_log 자체는 WORM 유지)

---

## 5. 강사 read-only 모더레이션 (Q-R6-09 격상 결정)

### 5.1 코드 강제

operator role 은 학생 글 수정 불가 (RBAC SDD §4 코드 강제). 단:
- 모든 모더레이션 액션 (lock/pin/hide/delete/restore/dismiss) 가능
- 본인 글은 수정/삭제 가능
- audit_log 모두 기록

### 5.2 단순화 근거

부트캠프 1기 강사 1~2명 환경에서:
- 강사가 학생 글을 수정할 정당한 사유 거의 없음 (학생 학습 가짜 방지)
- 학생이 잘못 작성 → 학생 본인이 수정 (operator 가 안내)
- 부적절 글 → 모더레이션 (lock/hide/delete) 으로 처리

### 5.3 admin 만 본인 외 글 수정 가능 (예외)

- 운영자 (admin) 는 GDPR / 법적 요구 / 학생 요청 시 글 수정 가능
- 모든 admin update 는 audit_log INSERT
- 사유 (reason) 필수 입력

---

## 6. 부정 vote 모더레이션 (PR-10b R6 UNIQUE 의존)

### 6.1 R6 UNIQUE 가 1차 방어

`discussion_votes (user_id, target_type, target_id)` UNIQUE = 동일 사용자가 동일 대상 중복 vote 방지 (PR-10b 머지).

### 6.2 vote abuse 신고 흐름

- 사용자가 부정 vote (계정 다중 사용) 신고 → operator/admin queue
- 1기는 자동 차단 없음, operator 수동 검증
- 2기 트리거 시 LLM-judge 보강 (행동 패턴 감지)

---

## 7. 위험 요소

| 위험 | 가능성 | 영향 | 완화 |
|------|-------|------|------|
| 신고 abuse (학생이 자유게시판 글 무차별 신고) | 중간 | operator queue 폭증 | UNIQUE 제약 + 사용자별 신고 빈도 제한 (24h 10건) |
| operator 의 부적절 모더레이션 (학생 학습 방해) | 중간 | 강사 신뢰 저하 | audit_log + admin 검증 endpoint |
| LLM 자동 모더레이션 false positive (2기) | 중간 | 학생 글 부당 차단 | operator escalation queue + appeal (3기) |
| audit_log 폭증 (모든 액션 INSERT) | 낮음 | 테이블 크기 ↑ | 1년 후 archive 트리거 (3기) |
| 신고자 신원 노출 (CWE-359) | 낮음 | 신고자 ↔ 피신고자 갈등 | 신고자 ID는 audit_log 외부 노출 안 함 |

---

## 8. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 SDD 최초 작성 (Session 15, consensus-013) | Q-R6-06 + Q-R6-09 |

---

## 9. 참조

- `docs/decisions/ADR-021-community-hub.md` §3.5
- `docs/decisions/ADR-016-llm-judge-safety.md` §7 D3 Hybrid (2기 재사용)
- `docs/architecture/community-rbac-design.md` (operator 권한)
- `docs/architecture/audit-log-design.md` (모든 액션 audit)
- `docs/architecture/community-hub-design.md` §3 (카테고리 권한)
- `apps/api/src/modules/discussion/discussion.service.ts` — soft delete base (PR-10b)
