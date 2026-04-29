# Audit Log SDD — CWE-778 차단 + WORM + ADR-016 §7 D3 Hybrid 재사용

> **상태**: Accepted (2026-04-29, consensus-013, ADR-021)
> **합의**: `docs/review/consensus-013-adr-021-community-hub.md` §4.6 + Reviewer 격상
> **결정**: `docs/decisions/ADR-021-community-hub.md` §3.6
> **선행 ADR**: ADR-016 §7 (LLM-judge 안전 D3 Hybrid 패턴 재사용)

---

## 1. 배경

ADR-021 community 도입 시 **모더레이션 액션 (lock/pin/hide/delete/role_change)** 의 영구 기록이 필수. 분쟁 시 책임 추적 + GDPR 대응 + OWASP A09 (Insufficient Logging) 차단.

**보안 식별자**: CWE-778 (Insufficient Logging) — community 가 user-generated content 첫 영역.

ADR-016 §7 D3 Hybrid (Langfuse trace + PII 필터링) 패턴이 이미 검증됨 → **community audit_log 가 동일 WORM 패턴 재사용** (신규 설계 비용 ≈ 0).

---

## 2. 설계 원칙

### 2.1 WORM (Write Once Read Many)

- INSERT 만 허용
- UPDATE / DELETE 차단 (PostgreSQL 트리거)
- 1년 후 archive (3기 트리거) — archive 도 WORM 유지

### 2.2 분리된 도메인

- `audit_log` 는 community 용 (모더레이션 + role 변경)
- Langfuse trace (ADR-016) 는 LLM 용 (별도 시스템)
- PR-13 통합 e2e 회귀가 WORM 트리거 검증 강제

### 2.3 PII 정책

- `by_user_id` UUID 만 저장 (이메일/이름 직접 저장 금지)
- `reason` 텍스트는 사용자 입력 — sanitize-html 적용
- `ip_addr` / `user_agent` 는 분쟁 추적용 (GDPR 필요 시 익명화 후속)

---

## 3. 스키마 (마이그레이션 1714000023000)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  action VARCHAR(30) NOT NULL,
  by_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NULL,
  ip_addr INET NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_audit_target_type CHECK (target_type IN (
    'discussion_thread',
    'discussion_post',
    'discussion_vote',
    'discussion_report',
    'user_role'
  )),

  CONSTRAINT chk_audit_action CHECK (action IN (
    'create', 'update', 'delete',
    'lock', 'unlock', 'pin', 'unpin',
    'hide', 'restore',
    'dismiss',
    'role_change',
    'auto_flag', 'auto_hide'  -- 2기 LLM 자동 모더레이션
  ))
);

-- 인덱스 (조회 패턴: target / actor / 시간)
CREATE INDEX idx_audit_log_target
  ON audit_log (target_type, target_id, created_at DESC);

CREATE INDEX idx_audit_log_actor
  ON audit_log (by_user_id, created_at DESC);

CREATE INDEX idx_audit_log_created
  ON audit_log (created_at DESC);

-- WORM (Write Once Read Many) 트리거
CREATE OR REPLACE FUNCTION audit_log_no_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is WORM — % blocked (CWE-778 prevention)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_no_update_delete();

CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_no_update_delete();

-- TRUNCATE 도 차단
CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_no_update_delete();
```

**검증**: `apps/api/src/migrations/1714000023000-AddAuditLog.ts` 의 마이그레이션 실행 후 `UPDATE audit_log SET reason='hack'` 시 트리거 발동 → 회귀 테스트로 검증.

---

## 4. NestJS 통합

### 4.1 AuditLogModule

```typescript
// apps/api/src/modules/audit-log/audit-log.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
```

### 4.2 AuditLogService

```typescript
// apps/api/src/modules/audit-log/audit-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export type AuditTargetType =
  | 'discussion_thread'
  | 'discussion_post'
  | 'discussion_vote'
  | 'discussion_report'
  | 'user_role';

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'lock' | 'unlock' | 'pin' | 'unpin'
  | 'hide' | 'restore'
  | 'dismiss'
  | 'role_change'
  | 'auto_flag' | 'auto_hide';

export interface AuditRecordInput {
  targetType: AuditTargetType;
  targetId: string;
  action: AuditAction;
  byUserId: string;
  reason?: string;
  ipAddr?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async record(input: AuditRecordInput): Promise<AuditLog> {
    return this.repo.save(this.repo.create(input));
  }

  // 조회는 admin only (RolesGuard)
  async listByTarget(targetType: AuditTargetType, targetId: string) {
    return this.repo.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
    });
  }

  async listByActor(byUserId: string, limit = 100) {
    return this.repo.find({
      where: { byUserId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
```

### 4.3 트랜잭션 내 INSERT (필수)

```typescript
// apps/api/src/modules/discussion/discussion.service.ts
async lockThread(threadId: string, ctx: { callerUserId: string; callerRole: UserRole; reason?: string }) {
  return await this.dataSource.transaction(async (mgr) => {
    const thread = await mgr.findOneByOrFail(DiscussionThread, { id: threadId });
    thread.isLocked = true;
    await mgr.save(thread);

    // 같은 트랜잭션 내 audit_log INSERT (롤백 시 동시 롤백)
    await mgr.insert(AuditLog, {
      targetType: 'discussion_thread',
      targetId: threadId,
      action: 'lock',
      byUserId: ctx.callerUserId,
      reason: ctx.reason ?? null,
    });

    return thread;
  });
}
```

**중요**: 모더레이션 액션과 audit_log INSERT 는 **반드시 동일 트랜잭션** — 둘 중 하나만 성공하는 일관성 위반 차단.

---

## 5. 기록 대상 (액션 매트릭스)

| 액션 | target_type | target_id | by_user_id | 권한 |
|-----|------------|----------|----------|-----|
| 모더레이션 lock | `discussion_thread` | thread.id | operator/admin | operator+ |
| 모더레이션 hide post | `discussion_post` | post.id | operator/admin | operator+ |
| 모더레이션 unlock | `discussion_thread` | thread.id | operator/admin | operator+ |
| 모더레이션 pin | `discussion_thread` | thread.id | operator/admin | operator+ |
| 모더레이션 delete (operator) | `discussion_thread` 또는 `discussion_post` | id | operator/admin | operator+ |
| 신고 처리 (resolve) | `discussion_report` | report.id | operator/admin | operator+ |
| 신고 기각 (dismiss) | `discussion_report` | report.id | operator/admin | operator+ |
| role 변경 | `user_role` | user.id | admin | admin |
| admin 의 본인 외 글 수정 | `discussion_thread` 또는 `discussion_post` | id | admin | admin |
| admin 의 본인 외 글 영구 삭제 (3기) | `discussion_thread` 또는 `discussion_post` | id | admin | admin |
| 자동 모더레이션 flag (2기 LLM) | `discussion_thread` 또는 `discussion_post` | id | system uuid | (자동) |
| 자동 모더레이션 hide (2기 LLM) | 동일 | id | system uuid | (자동) |

**기록 안 하는 항목** (1기):
- 일반 사용자 read (성능 부담)
- 본인 글 수정/삭제 (정상 흐름)
- vote (R6 UNIQUE 가 1차 방어)
- 신고 등록 자체 (`discussion_reports` 테이블 자체가 기록)

---

## 6. 조회 endpoint

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/admin/audit-log/target/:type/:id` | admin | 특정 대상의 audit history |
| GET | `/api/admin/audit-log/actor/:userId` | admin | 특정 사용자의 액션 history |
| GET | `/api/admin/audit-log/recent` | admin | 최근 100건 (대시보드) |
| GET | `/api/operator/audit-log/me` | operator+ | 본인 액션 history |

**RolesGuard `@Roles('admin')` 또는 `@Roles('operator', 'admin')` 적용**.

---

## 7. ADR-016 §7 D3 Hybrid 재사용 패턴

### 7.1 D3 Hybrid 핵심 (ADR-016 §7)

- Langfuse trace 의 PII 필터링 (학생 본명/이메일이 trace 에 노출되지 않도록)
- WORM 보장 (Langfuse trace 도 수정 불가)
- 운영 시 trace 폭증 방어 (sampling 또는 archive)

### 7.2 community audit_log 에 적용

| ADR-016 §7 패턴 | community audit_log 적용 |
|------------------|------------------------|
| PII 필터링 | `by_user_id` UUID 만 저장 (이메일/이름 직접 저장 금지) |
| WORM | PostgreSQL 트리거 (UPDATE/DELETE/TRUNCATE 차단) |
| sampling/archive | 1년 후 별도 테이블 archive (3기 트리거) |
| trace metadata | `reason` (sanitize-html 적용) + `ip_addr`/`user_agent` (분쟁 추적) |

신규 LLM 호출은 없으나 **운영 패턴 재사용** = 검증된 보안 안전성 그대로 차용.

---

## 8. PR-13 통합 e2e 회귀 (필수)

### 8.1 WORM 트리거 검증

```typescript
// apps/api/test/audit-log.e2e.test.ts (PR-13)
describe('audit_log WORM 트리거', () => {
  it('INSERT 통과', async () => {
    const log = await auditLogService.record({
      targetType: 'discussion_thread',
      targetId: thread.id,
      action: 'lock',
      byUserId: operator.id,
      reason: '테스트',
    });
    expect(log.id).toBeDefined();
  });

  it('UPDATE 차단 (트리거)', async () => {
    await expect(
      dataSource.query(`UPDATE audit_log SET reason='hack' WHERE id=$1`, [log.id]),
    ).rejects.toThrow('audit_log is WORM');
  });

  it('DELETE 차단 (트리거)', async () => {
    await expect(
      dataSource.query(`DELETE FROM audit_log WHERE id=$1`, [log.id]),
    ).rejects.toThrow('audit_log is WORM');
  });

  it('TRUNCATE 차단 (트리거)', async () => {
    await expect(
      dataSource.query(`TRUNCATE audit_log`),
    ).rejects.toThrow('audit_log is WORM');
  });
});

describe('audit_log 트랜잭션 일관성', () => {
  it('lockThread 실패 시 audit_log 도 롤백', async () => {
    // mock: thread save 실패 → 트랜잭션 롤백 → audit_log INSERT 도 취소
    const before = await auditLogService.listByTarget('discussion_thread', thread.id);
    await expect(svc.lockThread(invalidThreadId, ctx)).rejects.toThrow();
    const after = await auditLogService.listByTarget('discussion_thread', thread.id);
    expect(after).toHaveLength(before.length); // 변화 없음
  });
});
```

### 8.2 권한 검증

```typescript
describe('audit_log 조회 권한', () => {
  it('user 가 audit_log 조회 시 403', async () => { /* ... */ });
  it('operator 가 본인 액션만 조회 가능', async () => { /* ... */ });
  it('admin 이 전체 조회 가능', async () => { /* ... */ });
});
```

---

## 9. 운영 부담 추정

### 9.1 INSERT 빈도 (1기)

부트캠프 1기 추정:
- 모더레이션 액션 = 일 1~3건 × 8주 = 56~168건
- 신고 = 일 1~5건 × 8주 = 56~280건
- role 변경 = 1기 운영 동안 5~10건 (강사 부여)
- 합계: ~120~470건 / 8주 → **테이블 폭증 위험 0**

### 9.2 INSERT 비용

- 단일 row INSERT (UUID + VARCHAR + TIMESTAMPTZ) = ~0.1ms (PostgreSQL)
- 트랜잭션 내 두 번째 INSERT 추가 부하 ≈ 5~10% (모더레이션 액션 자체가 무거움)
- 수용 가능

### 9.3 1년 후 archive (3기 트리거)

```sql
-- 별도 테이블 archive (3기)
CREATE TABLE audit_log_archive (LIKE audit_log INCLUDING ALL);

-- 1년 이전 row 이동
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE created_at < now() - interval '1 year';

DELETE FROM audit_log
WHERE created_at < now() - interval '1 year';
-- ↑ DELETE 가 트리거에 막힘 → archive 테이블 자체는 INSERT 만
-- → 정책: WORM 유지, archive 도 별도 트리거 적용
```

3기 진입 시 별도 결정.

---

## 10. 위험 요소

| 위험 | 가능성 | 영향 | 완화 |
|------|-------|------|------|
| WORM 트리거 회귀 (UPDATE/DELETE 가능 상태) | 중간 | CWE-778 누적 | PR-13 통합 e2e 회귀 테스트 필수 |
| 트랜잭션 일관성 깨짐 (모더레이션 성공 + audit log 실패) | 낮음 | 분쟁 시 증거 부재 | 동일 트랜잭션 강제 + 회귀 테스트 |
| audit_log PII 노출 (reason 에 학생 이메일 등) | 낮음 | GDPR 위반 | sanitize-html + reason 가이드라인 |
| audit_log 테이블 폭증 (예상보다 많음) | 낮음 | 디스크 부담 | 1년 후 archive 트리거 (3기) |
| operator/admin 의 audit_log 조회 권한 우회 | 낮음 | 분쟁 시 증거 노출 | RolesGuard 검증 + 회귀 테스트 |

---

## 11. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 SDD 최초 작성 (Session 15, consensus-013) | Q-R6-06 + Reviewer 격상 |

---

## 12. 참조

- `docs/decisions/ADR-021-community-hub.md` §3.6
- `docs/decisions/ADR-016-llm-judge-safety.md` §7 D3 Hybrid
- `docs/architecture/community-rbac-design.md` §6 (role 변경 audit)
- `docs/architecture/community-moderation-design.md` (모더레이션 액션 audit)
- `docs/architecture/integrated-e2e-harness-design.md` (PR-13 회귀)
- CWE-778 (Insufficient Logging) — https://cwe.mitre.org/data/definitions/778.html
- OWASP A09:2021 (Security Logging and Monitoring Failures)
