import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
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
 */
export function typeOrmConfig(): TypeOrmModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  // dist 빌드 경로(프로덕션)와 src 경로(dev/test) 모두 포함 — 환경별 glob 자동 선택은 node-sql-parser
  // 와 달리 TypeORM 이 실제 파일 시스템을 조회하므로 양쪽을 등록해도 중복 로드되지 않는다.
  const migrationsDir = path.join(__dirname, '..', 'migrations', '*.{ts,js}');

  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    autoLoadEntities: true,
    synchronize: !isProduction,
    logging: process.env.NODE_ENV === 'development',
    migrations: [migrationsDir],
    migrationsRun: true,
  };
}
