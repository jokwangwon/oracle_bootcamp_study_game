import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

/**
 * PR-13 Phase 1A — e2e 환경변수 격리 (SDD §4.5).
 *
 * `apps/api/test/.env.test` 를 우선 로드 (override=true) — 운영 `.env` 누설 차단.
 * 실 secret 은 GitHub Actions secrets / 사용자 노트북의 `.env.test.local` (gitignored).
 */
loadEnv({ path: resolve(__dirname, '.env.test'), override: true });

/**
 * PR-13 결함 #13 회귀 차단 — typeorm `importOrRequireFile` 가 `migrations: *.{ts,js}`
 * 의 .ts 파일을 직접 `require` 하면 node 가 ts 미인식 → SyntaxError. vitest transform
 * (SWC) 는 vitest 가 import 한 파일에만 적용되므로 typeorm dynamic require 는 별도
 * transformer 가 필요. `ts-node/register/transpile-only` 로 가로채서 즉시 ts → js 변환.
 *
 * 운영(`nest start --watch` / `node dist/main.js`)에는 영향 없음 — 본 import 는
 * e2e setupFiles 에서만 실행.
 */
require('ts-node/register/transpile-only');
