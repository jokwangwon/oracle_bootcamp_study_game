import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { applySecurityMiddleware } from '../src/security/security-middleware';
import { assertTestEnvLoaded } from './helpers/env-check';

/**
 * PR-13 Phase 1A (consensus-013, ADR-021) — 통합 e2e 부트스트랩.
 *
 * `Test.createTestingModule({ imports: [AppModule] }).compile()` 로 실 IoC + 실 DB +
 * 실 Redis 부팅. Session 14 §3.1 hotfix #1 (DI 누락) 회귀 차단.
 *
 * - 실 AppModule 그대로 import — `@Optional()` 누락이나 모듈 의존성 미선언 즉시 감지.
 * - main.ts 의 helmet / cookieParser / ValidationPipe 동일 적용 — production parity 보장.
 * - 5종 안전장치 전제 (SDD §4): docker-compose.test.yml 의 test-db / test-redis 가 떠 있어야 함.
 */
export async function bootstrapTestApp(): Promise<INestApplication> {
  // SDD §5 hotfix #1/#8 — env 결손 조기 fail
  assertTestEnvLoaded();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // PR-13 진단 — 500 root cause 추적용 logger.
  // 운영 (default) 은 ERROR/WARN 만 stdout, debug 시에는 verbose.
  const app = moduleFixture.createNestApplication({
    logger: process.env.E2E_VERBOSE === '1'
      ? ['error', 'warn', 'log', 'debug', 'verbose']
      : ['error', 'warn'],
  });

  // main.ts 와 동일 미들웨어 — production parity (Session 14 hotfix 패턴: 실 부팅 검증)
  applySecurityMiddleware(app, process.env);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}
