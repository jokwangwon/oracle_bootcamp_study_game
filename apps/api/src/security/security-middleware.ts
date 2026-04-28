import type { INestApplication } from '@nestjs/common';
import helmet, { type HelmetOptions } from 'helmet';

/**
 * ADR-020 §4.1 PR-3a (CRITICAL-B1) — helmet 옵션 빌더.
 *
 *  - `contentSecurityPolicy: false` → CSP 는 Next.js `apps/web/next.config.mjs`
 *    가 단독 관리 (PR-3b). helmet default CSP 와 이중 헤더 충돌 회피.
 *  - `crossOriginEmbedderPolicy: false` → 외부 자원(폰트/이미지) 호환.
 *  - `hsts`: production 만 활성화. tailscale 외부 노트북(`100.102.41.122:3002`,
 *    HTTP 평문) 학생 접속 차단 방지 (3+1 합의 CRITICAL-1).
 *
 * 그 외 default 헤더 (X-Content-Type-Options / X-Frame-Options / Referrer-Policy
 * / X-DNS-Prefetch-Control / X-Download-Options / X-Permitted-Cross-Domain-Policies
 * / X-Powered-By 제거) 는 그대로 적용.
 */
export function buildHelmetOptions(env: NodeJS.ProcessEnv = process.env): HelmetOptions {
  const isProd = env.NODE_ENV === 'production';
  return {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  };
}

/**
 * NestJS app 에 보안 미들웨어를 적용. `app.use()` 만 호출하므로 Express 인스턴스
 * 와도 duck-type 호환 (테스트에서 활용).
 */
export function applySecurityMiddleware(
  app: Pick<INestApplication, 'use'>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  app.use(helmet(buildHelmetOptions(env)));
}
