import { defineConfig, devices } from '@playwright/test';

/**
 * PR-13 (consensus-013, ADR-021) — Playwright smoke config.
 *
 * SDD §3.3: aarch64 GB10 호환 (Playwright 공식 ARM64 빌드).
 * - fullyParallel: false — 단일 환경 동시 실행 회피.
 * - retries: 1 — flaky 1회 보정, 그 이상은 진짜 결함으로 간주.
 * - trace: on-first-retry — 회귀 진단 자료 보존.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
