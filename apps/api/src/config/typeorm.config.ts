import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * NestJS 런타임용 TypeORM 설정.
 *
 * ADR-018 §10 Session 5 반영:
 *  - production: `synchronize: false` (기존), migrations 수동 실행 (`npm run migration:run`).
 *  - dev/test: `synchronize: true` (기존) + `migrationsRun: true` 로 WORM 트리거·CHECK 제약 등
 *    synchronize 가 처리 못 하는 DB 오브젝트를 부팅 시 반영.
 *
 * CLI 용 DataSource 는 `apps/api/src/config/data-source.ts` (별도 파일) — migrations generate/run/revert.
 *
 * PR-13 결함 #15 — typeorm glob `*.{ts,js}` 가 `migrations/*.test.ts` 까지 매칭하여
 * e2e (vitest + ts-node register) 환경에서 test 파일을 require 시 vitest cjs/esm
 * 충돌. timestamp prefix(`^\d+-`) + `.test/.spec` 접미사 제외 필터로 차단.
 */
function discoverMigrationFiles(): string[] {
  const dir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+-.+\.(ts|js)$/.test(f))
    .filter((f) => !/\.(test|spec)\.(ts|js)$/.test(f))
    .map((f) => path.join(dir, f));
}

export function typeOrmConfig(): TypeOrmModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  // PR-13 결함 #16 — e2e (NODE_ENV=test) 의 빈 DB 첫 부팅 시 synchronize/migrationsRun
  // 순서 충돌로 ALTER TABLE 마이그레이션이 fail. e2e 는 entity sync 만 사용하고
  // 마이그레이션은 e2e 테스트가 필요할 때 직접 SQL 로 적용. dev (NODE_ENV=development)
  // 는 누적 DB 라 충돌 없음.
  const isE2E = process.env.NODE_ENV === 'test';

  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    autoLoadEntities: true,
    synchronize: !isProduction,
    logging: process.env.NODE_ENV === 'development',
    migrations: isE2E ? [] : discoverMigrationFiles(),
    migrationsRun: !isE2E && !isProduction,
  };
}
