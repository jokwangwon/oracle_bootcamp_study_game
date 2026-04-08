import { z } from 'zod';

/**
 * 환경변수 스키마 검증
 *
 * 헌법 제8-2조: 모든 환경별 값은 .env에 정의. 코드 시작 시 검증하여
 * 잘못된 설정으로 인한 런타임 오류를 사전 차단한다.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((v) => Number.parseInt(v, 10)),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET은 최소 32자 이상이어야 합니다'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default('claude-opus-4-6'),
  // ADR-009: AI 워커가 도입되었으므로 Langfuse 키는 필수.
  // 운영 정책상 모든 LLM 호출은 Langfuse trace로 기록되어야 한다.
  LANGFUSE_PUBLIC_KEY: z.string().min(1, 'LANGFUSE_PUBLIC_KEY는 필수 (ADR-009)'),
  LANGFUSE_SECRET_KEY: z.string().min(1, 'LANGFUSE_SECRET_KEY는 필수 (ADR-009)'),
  LANGFUSE_HOST: z.string().url().default('https://cloud.langfuse.com'),
  SEED_ON_BOOT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function configValidationSchema(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`환경변수 검증 실패:\n${issues}`);
  }
  return result.data;
}
