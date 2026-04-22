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
  // ADR-011 P1 운영 교체 후 ollama가 primary. anthropic은 평가/베이스라인 용도.
  LLM_PROVIDER: z.enum(['anthropic', 'ollama']).default('anthropic'),
  // anthropic provider일 때만 필수. ollama는 키 없음 — LlmClient에서 fail-closed 처리.
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-opus-4-6'),
  OLLAMA_BASE_URL: z.string().url().default('http://ollama:11434'),
  OLLAMA_PORT: z.string().default('11434'),
  // ADR-009: AI 워커가 도입되었으므로 Langfuse 키는 필수.
  // 운영 정책상 모든 LLM 호출은 Langfuse trace로 기록되어야 한다.
  LANGFUSE_PUBLIC_KEY: z.string().min(1, 'LANGFUSE_PUBLIC_KEY는 필수 (ADR-009)'),
  LANGFUSE_SECRET_KEY: z.string().min(1, 'LANGFUSE_SECRET_KEY는 필수 (ADR-009)'),
  LANGFUSE_HOST: z.string().url().default('https://cloud.langfuse.com'),
  SEED_ON_BOOT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // OSS 모델 평가 (단계 7) — 운영자 화이트리스트 + 결과 디렉토리 + config 경로.
  // EVAL_ADMIN_USERNAMES는 fail-closed (미설정 시 모든 eval 트리거 거부).
  EVAL_ADMIN_USERNAMES: z.string().optional(),
  EVAL_RESULTS_DIR: z.string().optional(),
  EVAL_PROMPTFOO_CONFIG: z.string().optional(),
  // ADR-011 #2 운영 부팅 시 digest 검증 우회 (R&D/dev 한정).
  // docker compose가 미설정 env를 빈 문자열로 전달해도 optional로 해석.
  DIGEST_PIN_SKIP: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(['true', 'false']).optional(),
  ),
  // SDD §4.2 v2 Stage 1 — 노션 증분 동기화. 토큰/DB ID 미설정 시 NotionSyncService는
  // 부팅하지만 sync는 disabled. RepeatableJob은 두 값이 모두 있어야 등록.
  NOTION_API_TOKEN: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),
  NOTION_SYNC_CRON: z.string().default('0 0 * * 1'), // 매주 월요일 00:00
  // ADR-016 §7 + consensus-005 §커밋2 — userId hash 용 HMAC salt (fail-closed).
  // 환경별로 다른 값 강제 (dev/staging/prod 트레이스 교차 추적 방지).
  // 최소 16자. rotation 정책은 ADR-018 (별도 세션에서 작성 예정).
  USER_TOKEN_HASH_SALT: z
    .string()
    .min(16, 'USER_TOKEN_HASH_SALT 은 최소 16자 (ADR-016 §7)'),
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
