import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';

/**
 * EvalAdminGuard — 평가 트리거 엔드포인트 전용 가드 (단계 7).
 *
 * 정책:
 *  - 인증은 선행 JwtAuthGuard가 처리한다 (req.user 채움)
 *  - 본 가드는 req.user.username이 EVAL_ADMIN_USERNAMES (comma-separated)
 *    환경변수 화이트리스트에 정확히 일치하는지 확인
 *  - whitelist 미설정/빈값/유효 토큰 0개 → fail-closed (모든 요청 거절)
 *
 * 설계 근거:
 *  - DB role 컬럼 존재. 그러나 JWT payload에 role을 싣지 않는 현행 구조에서
 *    매 요청 DB lookup을 추가하는 것은 인프라성 운영 작업에 비해 과하다
 *  - eval은 운영자(부트캠프 강사 1명)가 직접 트리거하는 단발성 작업 →
 *    .env로 username 화이트리스트를 관리하는 것이 SDD §7.4 (키 관리는 .env로
 *    분리) 정합
 *  - 화이트리스트가 비면 fail-closed: 환경변수 누락 시 정상 동작이 되어버리는
 *    구멍을 막는다 (M-09 키 관리 정합)
 *
 * SDD: docs/architecture/oss-model-evaluation-design.md (v2 §7.4)
 */
@Injectable()
export class EvalAdminGuard implements CanActivate {
  private readonly whitelist: ReadonlySet<string>;

  constructor(
    @Optional()
    @Inject('EVAL_ADMIN_USERNAMES')
    rawWhitelist: string | undefined,
  ) {
    this.whitelist = new Set(
      (rawWhitelist ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.whitelist.size === 0) {
      throw new ForbiddenException(
        'EVAL_ADMIN_USERNAMES 환경변수가 설정되지 않았습니다 (fail-closed).',
      );
    }

    const req = context.switchToHttp().getRequest<{
      user?: { username?: unknown };
    }>();

    const username = req?.user?.username;
    if (typeof username !== 'string' || username.length === 0) {
      throw new ForbiddenException('인증된 사용자 정보가 없습니다.');
    }

    if (!this.whitelist.has(username)) {
      throw new ForbiddenException(
        `사용자 '${username}'은 평가 트리거 권한이 없습니다.`,
      );
    }

    return true;
  }
}
