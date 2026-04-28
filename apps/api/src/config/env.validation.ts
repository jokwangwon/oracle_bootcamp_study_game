import { z } from 'zod';

/**
 * 환경변수 스키마 검증
 *
 * 헌법 제8-2조: 모든 환경별 값은 .env에 정의. 코드 시작 시 검증하여
 * 잘못된 설정으로 인한 런타임 오류를 사전 차단한다.
 */

/**
 * ADR-018 §7 refinement 4 — Shannon entropy 근사.
 * 유일 문자 수 / 길이. 0.5 미만은 반복 문자열로 간주하여 거부.
 * 운영 salt (openssl rand -base64 32) 는 보통 0.8+ 이므로 안전 마진.
 */
export function uniqueCharRatio(s: string): number {
  if (s.length === 0) return 0;
  return new Set(s).size / s.length;
}

/**
 * ADR-018 §7 refinement 1 — production 모드에서 placeholder 거부.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  // prefix 기반 — 실제 사용자가 16자 padding 한 경우도 탐지
  /^changeme/i,
  /^test[-_]?only/i,
  /^dev[-_]?salt/i,
  /^placeholder/i,
  /^<.*>$/, // <YOUR_SALT> 등
];
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((v) => Number.parseInt(v, 10)),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET은 최소 32자 이상이어야 합니다'),
  /**
   * ADR-020 §4.2.1 부속서 F. Q-R3 정식 30m. 임시 완화 (Session 12) 24h 는
   * .env 운영 값에서만 활성. PR-10a 머지 시 회귀.
   */
  JWT_EXPIRES_IN: z
    .string()
    .default('30m')
    .refine((v) => /^(\d+)[smhd]$/.test(v), {
      message: 'JWT_EXPIRES_IN 포맷 (예: 30m / 24h) (ADR-020 §4.2.1 F)',
    }),
  /**
   * ADR-020 §4.2.1 A. refresh JWT 의 별도 secret. 미설정 시 JWT_SECRET 으로 fallback
   * (Phase 6 AuthModule). production 에서는 명시 권장.
   */
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET 은 최소 32자 (ADR-020 §4.2.1 A)')
    .optional(),
  /** ADR-020 §4.2.1 F. Q-R3 정식 14d. */
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('14d')
    .refine((v) => /^(\d+)[smhd]$/.test(v), {
      message: 'JWT_REFRESH_EXPIRES_IN 포맷 (예: 14d) (ADR-020 §4.2.1 F)',
    }),
  /**
   * ADR-020 §4.2.1 D. production 에서 명시 권장 (subdomain hijack 방어 — Agent B G2).
   * dev/staging Tailscale IP 환경에서는 미설정 (host-only cookie, RFC 6265 §4.1.2.3).
   * 값에 IP 입력은 거부 (브라우저가 IP 에 Domain 속성 무시 — 오인 방지).
   */
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .refine((v) => v === undefined || !/^\d+\.\d+\.\d+\.\d+$/.test(v), {
      message: 'COOKIE_DOMAIN 에 IPv4 입력은 거부 (host-only cookie 사용, ADR-020 §4.2.1 D)',
    }),
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
  /**
   * ADR-013 + consensus-007 S6-C2-4 — free-form 3단 채점 경로 kill-switch.
   * 기본 false (프로덕션 보수). 'true' 설정 시 answerFormat='free-form' 문제는
   * GradingOrchestrator (AST → Keyword → LLM-judge) 로 채점.
   * false 시 기존 mode.evaluateAnswer 경로 유지 (회귀 0).
   */
  ENABLE_FREE_FORM_GRADING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * ADR-016 §추가 + consensus-007 Q1/S6-C2-5 — Layer 3 LLM-judge 호출 timeout (ms).
   * 기본 8000ms (사용자 체감 상한). 초과 시 gradingMethod='held' persist + HTTP 503.
   * 운영 p95 관측 후 ADR-018 §10 에 따라 조정.
   */
  LLM_JUDGE_TIMEOUT_MS: z
    .string()
    .default('8000')
    .transform((v) => Number.parseInt(v, 10))
    .refine((n) => Number.isFinite(n) && n > 0, {
      message: 'LLM_JUDGE_TIMEOUT_MS 는 양의 정수 (ms)',
    }),
  /**
   * ADR-019 §5.3 (Agent B-C4, 사용자 Q4=a) — SM-2 일일 신규 편입 상한.
   * user × day 당 처음 편입되는 review_queue 행 수의 상한. 초과 시 drop +
   * `ops_event_log(kind='sr_queue_overflow')` 기록. 기존 행 UPDATE 는 상한과 무관.
   */
  SR_DAILY_NEW_CAP: z
    .string()
    .default('100')
    .transform((v) => Number.parseInt(v, 10))
    .refine((n) => Number.isFinite(n) && n > 0, {
      message: 'SR_DAILY_NEW_CAP 은 양의 정수',
    }),
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
  // 최소 16자. rotation 정책 ADR-018.
  USER_TOKEN_HASH_SALT: z
    .string()
    .min(16, 'USER_TOKEN_HASH_SALT 은 최소 16자 (ADR-016 §7)'),
  // ADR-018 §4 — dual-salt overlap window 용 (현재는 유보, env 는 optional).
  USER_TOKEN_HASH_SALT_PREV: z.string().min(16).optional(),
  // Langfuse self-host encryption salt — USER_TOKEN_HASH_SALT 과 재사용 금지 (§7 refinement 3).
  LANGFUSE_SALT: z.string().optional(),
  /**
   * ADR-020 §4.2.1 E·K (consensus-011) — OriginGuard allow-list.
   * 콤마 구분 origin (예: `http://localhost:3000,http://100.102.41.122:3002`).
   * fail-closed: production 에서 비어있으면 boot 거부 (refinement 아래).
   * runtime 이중 안전망 — OriginGuard 가 빈 결과 시 InternalServerErrorException.
   */
  CORS_ORIGIN: z.string().optional(),
  /**
   * ADR-020 §4.2.1 E (consensus-011 H3) — OriginGuard 차단 모드.
   * `enforce` (기본): 차단 시 ForbiddenException.
   * `report`: 차단 대신 console.warn + 통과. PR-10c 머지 후 1주 관측 시 사용.
   */
  ORIGIN_GUARD_MODE: z.enum(['enforce', 'report']).default('enforce'),
  /**
   * ADR-020 §4.2.1 E (consensus-011 G3) — OriginGuard kill-switch.
   * `true` 시 모든 origin 검증 우회 (사고 시 즉시 비활성). production 에서는
   * 신중히 — 임시 대응 후 즉시 false 권장.
   */
  ORIGIN_GUARD_DISABLED: z.enum(['true', 'false']).optional(),
})
  // ADR-018 §7 refinement 1 — production 모드에서 placeholder salt 거부
  .refine(
    (cfg) => {
      if (cfg.NODE_ENV !== 'production') return true;
      return !PLACEHOLDER_PATTERNS.some((re) => re.test(cfg.USER_TOKEN_HASH_SALT));
    },
    {
      message:
        'USER_TOKEN_HASH_SALT 이 placeholder 값입니다 (production 차단, ADR-018 §7 refinement 1)',
      path: ['USER_TOKEN_HASH_SALT'],
    },
  )
  // ADR-018 §7 refinement 2 — PREV 와 동일값 거부 (dual-salt 활성 시)
  .refine(
    (cfg) =>
      !cfg.USER_TOKEN_HASH_SALT_PREV ||
      cfg.USER_TOKEN_HASH_SALT_PREV !== cfg.USER_TOKEN_HASH_SALT,
    {
      message:
        'USER_TOKEN_HASH_SALT_PREV 가 USER_TOKEN_HASH_SALT 과 동일 — 의미 없는 rotation (ADR-018 §7 refinement 2)',
      path: ['USER_TOKEN_HASH_SALT_PREV'],
    },
  )
  // ADR-018 §7 refinement 3 — 다른 secret 과 재사용 거부
  .refine(
    (cfg) => !cfg.LANGFUSE_SALT || cfg.LANGFUSE_SALT !== cfg.USER_TOKEN_HASH_SALT,
    {
      message:
        'USER_TOKEN_HASH_SALT 이 LANGFUSE_SALT 와 동일 — secret 재사용 금지 (ADR-018 §7 refinement 3, §8 금지 5)',
      path: ['USER_TOKEN_HASH_SALT'],
    },
  )
  .refine((cfg) => cfg.JWT_SECRET !== cfg.USER_TOKEN_HASH_SALT, {
    message:
      'USER_TOKEN_HASH_SALT 이 JWT_SECRET 과 동일 — secret 재사용 금지 (ADR-018 §8 금지 5)',
    path: ['USER_TOKEN_HASH_SALT'],
  })
  // ADR-018 §7 refinement 4 — Shannon entropy 근사 하한
  .refine(
    (cfg) => {
      // production 에서만 엄격 검사 (dev/test 는 편의 보전)
      if (cfg.NODE_ENV !== 'production') return true;
      return uniqueCharRatio(cfg.USER_TOKEN_HASH_SALT) >= 0.5;
    },
    {
      message:
        'USER_TOKEN_HASH_SALT 엔트로피 부족 — 반복 문자열 의심 (unique chars / length < 0.5). openssl rand -base64 32 권장 (ADR-018 §7 refinement 4)',
      path: ['USER_TOKEN_HASH_SALT'],
    },
  )
  /**
   * ADR-020 §4.2.1 E·K (consensus-011 CRITICAL #2) — production 에서 CORS_ORIGIN 필수.
   * dev/test 에서는 OriginGuard runtime 안전망이 InternalServerErrorException 으로 차단.
   */
  .refine(
    (cfg) => {
      if (cfg.NODE_ENV !== 'production') return true;
      return typeof cfg.CORS_ORIGIN === 'string' && cfg.CORS_ORIGIN.trim().length > 0;
    },
    {
      message:
        'production 에서 CORS_ORIGIN 미설정 — fail-closed (ADR-020 §4.2.1 E·K, consensus-011 CRITICAL #2)',
      path: ['CORS_ORIGIN'],
    },
  );

export type AppEnv = z.infer<typeof envSchema>;

export function configValidationSchema(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`환경변수 검증 실패:\n${issues}`);
  }
  return result.data;
}
