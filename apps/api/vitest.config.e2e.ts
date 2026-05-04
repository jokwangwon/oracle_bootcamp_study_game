import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import swc from 'unplugin-swc';

/**
 * PR-13 (consensus-013, ADR-021) — 통합 e2e vitest config (단위와 분리).
 *
 * SDD §3.1 에 표기된 `jest-e2e.json` 은 vitest 일관 사용 프로젝트에 맞춰
 * 본 파일로 대체 (PR-13 머지 후 SDD docs follow-up 으로 정정).
 *
 * - include: `test/**\/*.e2e.test.ts` 만 (단위 테스트는 src 의 *.test.ts)
 * - testTimeout 60s: NestJS AppModule 부팅 + TypeORM migrations 실행 시간 포함
 * - pool=forks + singleFork: 동일 DB schema 동시 접근 회피 (Session 14 hotfix #1 패턴)
 * - setupFiles: `.env.test` 우선 로드 (운영 `.env` 누설 차단)
 * - **SWC transform**: NestJS DI 가 의존하는 `emitDecoratorMetadata` 를 vite 기본
 *   esbuild 가 지원하지 않아 (esbuild#257) 부팅 시 GameModeRegistry constructor
 *   인자 undefined 결함 발생 → SWC 로 교체. PR-13 검증 단계에서 발견된
 *   결함 #12 (DI 누락) 차단.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        keepClassNames: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ['./test/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@oracle-game/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
