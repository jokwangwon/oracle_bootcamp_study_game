/**
 * PR-13 Phase 1B (consensus-013) — e2e 환경 무결성 검증.
 *
 * SDD §5 회귀 매트릭스: hotfix #1 docker compose env 누락 / hotfix #8 docker env 6종.
 * `bootstrapTestApp` 직전 호출하여 실 부팅 전에 환경 결손을 조기 fail.
 *
 * `LANGFUSE_DISABLED=1` 강제 (SDD §4.3) — observability trace queue 누수 차단.
 */

const REQUIRED_ENV: ReadonlyArray<string> = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'USER_TOKEN_HASH_SALT',
  'CORS_ORIGIN',
  'LANGFUSE_DISABLED',
];

export function assertTestEnvLoaded(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[e2e] required env missing: ${missing.join(', ')}. ` +
        `Did setup-env.ts load apps/api/test/.env.test?`,
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `[e2e] NODE_ENV must be 'test', got '${process.env.NODE_ENV}' — ` +
        `prevents accidental run against dev/prod`,
    );
  }

  if (process.env.LANGFUSE_DISABLED !== '1') {
    throw new Error(
      `[e2e] LANGFUSE_DISABLED must be '1' (SDD §4.3) — ` +
        `prevents trace queue accumulation in tests`,
    );
  }

  // Session 14 hotfix #1 회귀 차단 — 운영 DB 포트 (5432) 와 분리되었는지
  // 기본 5435 (5433 은 ai-bench-db 점유). 환경별 override 는 E2E_DB_PORT.
  const expectedPort = process.env.E2E_DB_PORT ?? '5435';
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.includes(`:${expectedPort}/`) && !process.env.E2E_ALLOW_PROD_PORT) {
    throw new Error(
      `[e2e] DATABASE_URL must point to test-db (port ${expectedPort}), got '${dbUrl}'. ` +
        `Set E2E_ALLOW_PROD_PORT=1 to bypass (CI only).`,
    );
  }
}
