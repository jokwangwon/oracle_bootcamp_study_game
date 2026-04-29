# Community RBAC SDD — 1기 3-tier 권한 + RolesGuard + 이중 방어

> **상태**: Accepted (2026-04-29, consensus-013, ADR-021)
> **합의**: `docs/review/consensus-013-adr-021-community-hub.md` §4.4
> **결정**: `docs/decisions/ADR-021-community-hub.md` §3.4
> **선행 ADR**: ADR-020 (Q-R5-11 번복 base)

---

## 1. 배경

consensus-012 Q-R5-11=a (read 비인증 허용) 가 Session 14 §4.2 에서 사실상 번복 (middleware PUBLIC_PATHS 가 `/community/*` 차단). consensus-013 Q-R6-04 가 그 번복을 명시적으로 확정. 본 SDD 는 **1기 3-tier RBAC + RolesGuard + middleware/backend 이중 방어** 명세.

**사용자 컨텍스트** (2026-04-29):
- 부트캠프 1기 ~20명 / 강사 1~2명 / 운영자 1명
- 강사는 공지 작성 + 모더레이션 가능, **학생 글 수정 불가 (코드 강제)**
- 운영자 (admin) 는 full power

---

## 2. role 컬럼 + 3-tier

### 2.1 마이그레이션 (1714000022000-AddRoleToUsers)

```sql
ALTER TABLE users
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'
  CONSTRAINT chk_user_role CHECK (
    role IN ('user', 'operator', 'admin')
  );

CREATE INDEX idx_users_role ON users (role);
```

**기본값**: 모든 기존 사용자 = `'user'`. 운영자/강사 role 부여는 admin 의 별도 endpoint (`PATCH /api/users/:id/role`) 또는 DB 직접 INSERT.

### 2.2 권한 매트릭스

| 액션 | user | operator | admin |
|-----|------|---------|-------|
| community read (인증 후) | ✅ | ✅ | ✅ |
| `discussion` / `free` / `study` / `resource` 작성 | ✅ | ✅ | ✅ |
| **`notice` 카테고리 작성** | ❌ | ✅ | ✅ |
| 본인 글 수정 | ✅ | ✅ | ✅ |
| **본인 외 글 수정** | ❌ | ❌ (코드 강제) | ✅ |
| 본인 글 삭제 (soft) | ✅ | ✅ | ✅ |
| **본인 외 글 삭제 (모더레이션)** | ❌ | ✅ (audit log) | ✅ (audit log) |
| 글 신고 (모든 글) | ✅ | ✅ | ✅ |
| **글 lock/unlock/pin/hide/restore** | ❌ | ✅ (audit log) | ✅ (audit log) |
| **role 변경** | ❌ | ❌ | ✅ (audit log) |
| audit_log 조회 | ❌ | 본인 액션만 | 전체 |

**핵심 원칙**: operator 는 admin 의 부분집합 + 학생 글 수정만 차단.

---

## 3. RolesGuard

### 3.1 NestJS Guard 구현

```typescript
// apps/api/src/modules/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true; // 데코레이터 없으면 통과 (기본값 — JwtAuthGuard 만 검증)
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Role 정보 없음');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException(`권한 부족: ${required.join('|')} 필요`);
    }
    return true;
  }
}
```

### 3.2 데코레이터

```typescript
// apps/api/src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type UserRole = 'user' | 'operator' | 'admin';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### 3.3 글로벌 등록

```typescript
// apps/api/src/app.module.ts
providers: [
  { provide: APP_GUARD, useClass: OriginGuard },        // PR-10c
  { provide: APP_GUARD, useClass: JwtAuthGuard },        // PR-10a (기존)
  { provide: APP_GUARD, useClass: RolesGuard },          // 신규 (ADR-021)
  // ThrottlerGuard 는 controller 레벨 (PR-10b)
]
```

가드 순서: OriginGuard (글로벌, GET 면제) → JwtAuthGuard (글로벌, `@Public()` 면제) → RolesGuard (글로벌, `@Roles()` 데코레이터 미사용 시 통과) → ThrottlerGuard (컨트롤러).

### 3.4 사용 예

```typescript
// apps/api/src/modules/discussion/discussion.controller.ts
@Controller()
export class DiscussionController {
  @Get('community/threads')
  // @Public() 제거 (Q-R6-04 + Q-R6-05 이중 방어)
  // @Roles 미지정 → JwtAuthGuard 만 (모든 인증 user 통과)
  async listCommunityThreads(...) {}

  @Post('community/threads')
  // 작성 권한 분기는 service 내부에서 (notice 만 operator+ 검증)
  async createCommunityThread(@Body() dto: CreateThreadDto, @Req() req) {
    if (dto.category === 'notice' && !['operator', 'admin'].includes(req.user.role)) {
      throw new ForbiddenException('공지 작성 권한 없음');
    }
    return this.service.createThread({ ...dto, callerUserId: req.user.id });
  }

  @Delete('community/threads/:threadId')
  // owner 또는 operator/admin
  async deleteCommunityThread(@Param('threadId') threadId: string, @Req() req) {
    return this.service.deleteThread(threadId, {
      callerUserId: req.user.id,
      callerRole: req.user.role,
    });
  }

  @Post(':threadId/lock')
  @Roles('operator', 'admin')
  async lockThread(@Param('threadId') threadId: string, @Req() req) {
    return this.service.lockThread(threadId, {
      callerUserId: req.user.id,
      callerRole: req.user.role,
    });
  }

  @Patch('users/:id/role')
  @Roles('admin')
  async changeUserRole(@Param('id') userId: string, @Body() dto: ChangeRoleDto, @Req() req) {
    return this.service.changeRole(userId, dto.role, { byAdminId: req.user.id });
  }
}
```

---

## 4. 학생 글 수정 코드 강제 (Q-R6-09 격상)

### 4.1 DiscussionService 검증

```typescript
// apps/api/src/modules/discussion/discussion.service.ts
async updatePost(
  postId: string,
  body: UpdatePostDto,
  caller: { userId: string; role: UserRole },
): Promise<PostDto> {
  const post = await this.postRepo.findOneByOrFail({ id: postId });

  // 본인 글이면 통과
  if (post.userId === caller.userId) {
    return this.applyUpdate(post, body);
  }

  // operator 는 본인 외 글 수정 불가 (코드 강제)
  if (caller.role === 'operator') {
    throw new ForbiddenException('강사는 학생 글을 수정할 수 없습니다');
  }

  // admin 만 본인 외 글 수정 가능 + audit log
  if (caller.role === 'admin') {
    await this.auditLog.record({
      targetType: 'discussion_post',
      targetId: postId,
      action: 'update',
      byUserId: caller.userId,
      reason: body.reason ?? 'admin override',
    });
    return this.applyUpdate(post, body);
  }

  throw new ForbiddenException('권한 부족');
}
```

**중요**: operator 가 admin 의 부분집합이지만 `update` 만 차단. 다른 모더레이션 액션 (lock/pin/hide/delete) 은 operator 도 가능 + audit log.

### 4.2 회귀 테스트

```typescript
// apps/api/src/modules/discussion/discussion.service.test.ts
describe('updatePost — RBAC 코드 강제', () => {
  it('user 가 본인 글 수정: 통과', () => { /* ... */ });
  it('user 가 본인 외 글 수정: ForbiddenException', () => { /* ... */ });
  it('operator 가 본인 외 글 수정: ForbiddenException (코드 강제)', () => {
    expect(() => svc.updatePost(otherPostId, body, { userId: opId, role: 'operator' }))
      .toThrow('강사는 학생 글을 수정할 수 없습니다');
  });
  it('admin 이 본인 외 글 수정: 통과 + audit log INSERT', () => { /* ... */ });
});
```

---

## 5. 이중 방어 (middleware + backend, Q-R6-05)

### 5.1 web middleware (Session 14 c19bf03 적용 상태 유지)

```typescript
// apps/web/src/middleware.ts
const PUBLIC_PATHS = ['/', '/login', '/register'];
// /community/* 는 PUBLIC_PATHS 미포함 → 게스트 시 /login?next=/community/... 307 redirect
```

**변경 없음** — 본 ADR-021 진입 전 이미 적용 상태.

### 5.2 backend `@Public()` 제거

```diff
// apps/api/src/modules/discussion/discussion.controller.ts (PR-12 머지 상태)
- @Get('questions/:questionId/threads')
- @Public()                                ← 제거 (Q-R6-04 번복 확정)
- async listThreadsByQuestion(...) {}

+ @Get('questions/:questionId/threads')
+ async listThreadsByQuestion(...) {}      ← JwtAuthGuard 적용 (글로벌)
```

**제거 대상 endpoint** (PR-12 머지 시 `@Public()` 적용된 read endpoint 3종):
- `GET /api/discussion/questions/:questionId/threads`
- `GET /api/discussion/threads/:threadId`
- `GET /api/discussion/threads/:threadId/posts`

(`POST /api/discussion/my-votes` 등 4번째는 PR-12 시 이미 인증 — 변경 없음)

### 5.3 회귀 테스트 (PR-13 통합 e2e)

```typescript
// apps/e2e/tests/community-auth.e2e.spec.ts (PR-13)
test('비인증 직접 호출 (curl/Postman 우회) 시 401', async ({ request }) => {
  const res = await request.get('/api/community/threads', {
    headers: { /* cookie 없음 */ },
  });
  expect(res.status()).toBe(401);
});

test('비인증 web 진입 시 /login redirect (middleware)', async ({ page }) => {
  await page.goto('/community');
  await page.waitForURL(/\/login\?next=/);
});

test('인증 후 community 진입 시 200', async ({ page }) => {
  await loginAsUser(page);
  await page.goto('/community');
  await expect(page).toHaveURL('/community');
});
```

---

## 6. role 부여 흐름 (운영)

### 6.1 초기 setup (마이그레이션 직후)

```sql
-- 부트캠프 운영자 (사용자 본인)
UPDATE users SET role = 'admin' WHERE email = 'tgdata200@gmail.com';

-- 강사 (예시)
UPDATE users SET role = 'operator' WHERE email = 'instructor@bootcamp.example';
```

### 6.2 admin 의 role 변경 endpoint

```typescript
// PATCH /api/users/:id/role
// Body: { role: 'user' | 'operator' | 'admin', reason: string }
// 권한: admin only
// audit_log INSERT 강제
```

### 6.3 audit log 기록

```typescript
async changeRole(userId: string, newRole: UserRole, ctx: { byAdminId: string }) {
  return await this.dataSource.transaction(async (mgr) => {
    const user = await mgr.findOneByOrFail(User, { id: userId });
    const oldRole = user.role;
    user.role = newRole;
    await mgr.save(user);

    await mgr.insert(AuditLog, {
      targetType: 'user_role',
      targetId: userId,
      action: 'role_change',
      byUserId: ctx.byAdminId,
      reason: `${oldRole} → ${newRole}`,
    });

    return user;
  });
}
```

---

## 7. 단계적 적용 (1기/2기/3기)

| 단계 | 적용 | 트리거 |
|------|------|-------|
| **1기 (본 SDD)** | 3-tier (user/operator/admin) + RolesGuard + 이중 방어 + 학생 글 수정 코드 강제 | ADR-021 결정 (2026-04-29) |
| 2기 | 4-tier 분리 (instructor/operator/admin) — operator 와 admin 명확 분리 | 강사 ≥ 3명 또는 학생 글 수정 사고 ≥ 1건 |
| 3기 | ABAC (per-thread / per-category 세분 권한) + appeal 흐름 | 부정 사용자 ≥ 3건 또는 부트캠프 2기 |

---

## 8. 위험 요소

| 위험 | 가능성 | 영향 | 완화 |
|------|-------|------|------|
| `@Public()` 제거 누락 (CRITICAL 회귀) | 중간 | 비인증 read 가능 → CWE-862 | PR-13 통합 e2e 회귀 테스트 (3종 endpoint) |
| operator 가 admin 권한 시도 (role escalation) | 낮음 | RolesGuard 우회 시 CWE-269 | RolesGuard 단위 테스트 + audit_log 회귀 |
| middleware 정책 재변경 (Session 14 패턴) | 중간 | 사용자 결정 변경 시 ADR-021 재검토 | ADR-021 §재검토 트리거 명시 |
| role 컬럼 backfill 없는 운영 환경 | 낮음 | NOT NULL DEFAULT 'user' 로 자동 채움 | 마이그레이션 검증 |
| 강사가 학생 글 수정 시도 (UX 회귀) | 낮음 | 403 토스트 → 학생 학습 가짜 방지 | "강사는 학생 글을 수정할 수 없습니다" 한국어 메시지 |

---

## 9. 변경 이력

| 일시 | 변경 | 근거 |
|------|------|------|
| 2026-04-29 | 본 SDD 최초 작성 (Session 15, consensus-013) | Q-R6-04, Q-R6-05, Q-R6-09, Q-R6-10 |

---

## 10. 참조

- `docs/decisions/ADR-021-community-hub.md` §3.4
- `docs/architecture/community-hub-design.md` §2-3 (도메인 모델 + 카테고리)
- `docs/architecture/audit-log-design.md` (role 변경 + 모더레이션 audit)
- `docs/architecture/community-moderation-design.md` (operator 모더레이션 흐름)
- `docs/architecture/integrated-e2e-harness-design.md` (PR-13 회귀)
- `docs/decisions/ADR-020-ux-redesign.md` §4.2.1 K (CSRF + Origin) 기존 보안 base
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` — JwtAuthGuard base
- `apps/api/src/modules/auth/decorators/public.decorator.ts` — `@Public` base (community read 에서 제거 대상)
