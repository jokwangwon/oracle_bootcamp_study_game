import { z } from 'zod';

/**
 * PR-10a Phase 3 — refresh token 순수 헬퍼.
 *
 * ADR-020 §4.2.1 부속서. JwtService 와 분리. iat/exp 직접 계산 — deterministic.
 * Phase 4 RefreshTokenService 가 본 헬퍼 + jwtService.signAsync 조합.
 */

/** 공유 schema — sign payload + verify result 양쪽에서 재사용 */
export const refreshClaimsSchema = z.object({
  jti: z.string(),
  sub: z.string(),
  familyId: z.string(),
  generation: z.number().int().nonnegative(),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type RefreshClaims = z.infer<typeof refreshClaimsSchema>;

/**
 * "14d" / "30m" / "2h" / "60s" 형태의 duration 문자열 → ms.
 * 기타 포맷은 throw (zod validate 의 boundary).
 */
function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`invalid duration format: "${duration}" (expected NNs|NNm|NNh|NNd)`);
  }
  const n = Number.parseInt(match[1]!, 10);
  const unit = match[2]!;
  const unitMs =
    unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * unitMs;
}

/**
 * `now + duration` 의 절대 시각.
 *
 * @example computeRefreshExpiry(now, '14d') → 14일 뒤
 */
export function computeRefreshExpiry(now: Date, duration: string): Date {
  return new Date(now.getTime() + parseDurationMs(duration));
}

/**
 * refresh JWT payload 빌더. iat/exp 를 deterministic 하게 채움.
 *
 * Phase 4 service 는 본 결과를 `jwtService.signAsync` 에 그대로 전달 가능.
 */
export function buildRefreshClaims(input: {
  jti: string;
  userId: string;
  familyId: string;
  generation: number;
  expiresIn: string;
  now?: Date;
}): RefreshClaims {
  const now = input.now ?? new Date();
  const exp = computeRefreshExpiry(now, input.expiresIn);
  return {
    jti: input.jti,
    sub: input.userId,
    familyId: input.familyId,
    generation: input.generation,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(exp.getTime() / 1000),
  };
}

/**
 * verify 결과 (unknown) 를 typed RefreshClaims 로 검증.
 * 누락/오타/타입 불일치 시 zod throw.
 */
export function parseRefreshClaims(payload: unknown): RefreshClaims {
  return refreshClaimsSchema.parse(payload);
}

/**
 * 만료 판정. `exp <= now` → true (경계는 만료, 시계 skew 안전 측).
 */
export function isRefreshExpired(claims: { exp: number }, now: Date): boolean {
  return claims.exp * 1000 <= now.getTime();
}
