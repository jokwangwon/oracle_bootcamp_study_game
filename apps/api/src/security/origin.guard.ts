import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * ADR-020 §4.2.1 E (consensus-011 갱신본) — CSRF 정책: SameSite=Lax + Origin 검증.
 *
 * Session 12 명세 sample (17 LOC) 의 CRITICAL 결함 3건 패치:
 *  1. startsWith bypass (`example.com.attacker.com` / port prefix 우회)
 *     → URL 객체 parse + protocol/host:port exact match
 *  2. CORS_ORIGIN 미설정 fail-OPEN (`''.startsWith('')` = true)
 *     → fail-closed (env.validation refine + 본 가드 runtime 이중 안전망)
 *  3. 운영 회귀 (학생 curl/Postman 차단)
 *     → SkipOriginCheck decorator + ORIGIN_GUARD_MODE=report 1주 관측
 *       + 한국어 학습 힌트 + ORIGIN_GUARD_DISABLED kill-switch
 *
 * 가드 순서: APP_GUARD (글로벌) 로 등록 → 컨트롤러별 ThrottlerGuard / JwtAuthGuard 전 동작.
 * 결과적으로 실 순서 = OriginGuard → ThrottlerGuard → JwtAuthGuard. consensus-011 Q-S6
 * "Origin 빠른 차단 (throttle 카운터 소모 절감) + 인증 부담 회피" 의도와 일치.
 */

export const SKIP_ORIGIN_CHECK_KEY = 'skip_origin_check';

/**
 * 미래 외부 통합 (OAuth callback / webhook / API key endpoint) 시 endpoint 별 옵트아웃.
 * 부트캠프 학생 학습 endpoint 에 instructor 가 일시 적용 가능.
 */
export const SkipOriginCheck = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ORIGIN_CHECK_KEY, true);

/**
 * fail-closed 정규화 — invalid 항목은 무시. 결과가 빈 배열이면 호출부가 throw.
 * URL.origin = `${protocol}//${host}${port?}` (path/query/fragment 없음, lowercase).
 */
export function parseAllowedOrigins(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin.toLowerCase();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // (G1) endpoint 별 SkipOriginCheck (Reflector — handler 우선, 없으면 class)
    const skip =
      this.reflector.get<boolean>(SKIP_ORIGIN_CHECK_KEY, ctx.getHandler()) ||
      this.reflector.get<boolean>(SKIP_ORIGIN_CHECK_KEY, ctx.getClass());
    if (skip) return true;

    // (G3) kill-switch
    if (process.env.ORIGIN_GUARD_DISABLED === 'true') return true;

    const req = ctx.switchToHttp().getRequest<{
      method: string;
      url?: string;
      headers: Record<string, string | undefined>;
    }>();

    // (A1~A3) safe method 통과 — 상태 변경 endpoint 만 검증
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    // (B1, B2) CORS_ORIGIN 미설정 → fail-closed (env.validation 보조 안전망)
    const allowed = parseAllowedOrigins(process.env.CORS_ORIGIN);
    if (allowed.length === 0) {
      throw new InternalServerErrorException(
        'CORS_ORIGIN 운영 값 미설정 — fail-closed (ADR-020 §4.2.1 E·K)',
      );
    }

    // (A5, E3) Origin / Referer 둘 다 부재
    const rawOrigin = req.headers.origin ?? req.headers.referer;
    if (!rawOrigin || rawOrigin === 'null') {
      return this.deny(
        req,
        'Origin 헤더가 필요합니다. 학습용 curl/Postman 호출 시 -H "Origin: http://localhost:3000" 옵션을 추가하세요.',
      );
    }

    // (C1~C3, F3) URL parse — startsWith bypass 회피, invalid format 차단
    let reqOriginNormalized: string;
    try {
      reqOriginNormalized = new URL(rawOrigin).origin.toLowerCase();
    } catch {
      return this.deny(req, '유효하지 않은 Origin 형식입니다.');
    }

    // (B3~B6, C4, D1~D3, F1~F2) exact match (정규화된 양측)
    const ok = allowed.some((a) => a === reqOriginNormalized);
    if (!ok) {
      return this.deny(req, '허용되지 않은 Origin 입니다.');
    }

    return true;
  }

  /**
   * (H3) ORIGIN_GUARD_MODE=report — 차단 대신 console.warn + 통과.
   * 1주 관측 후 enforce 전환 (default).
   */
  private deny(
    req: { method: string; url?: string; headers: Record<string, string | undefined> },
    msg: string,
  ): boolean {
    if (process.env.ORIGIN_GUARD_MODE === 'report') {
      console.warn(
        `[OriginGuard:report] ${req.method} ${req.url ?? ''} origin=${req.headers.origin ?? ''} referer=${req.headers.referer ?? ''} ua=${req.headers['user-agent'] ?? ''}`,
      );
      return true;
    }
    throw new ForbiddenException(msg);
  }
}
