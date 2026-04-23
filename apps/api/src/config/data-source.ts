import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

/**
 * TypeORM CLI 용 DataSource (ADR-018 §10 Session 5 이관 — production migrations 신설).
 *
 * 용도:
 *  - `npm run migration:generate` / `migration:run` / `migration:revert` CLI.
 *  - 런타임 NestJS 부팅은 `typeorm.config.ts` 의 `typeOrmConfig()` 를 사용. 본 DataSource
 *    는 CLI 전용 — TypeORM 0.3.x 는 CLI 가 default export 또는 named `dataSource` 를
 *    필요로 한다.
 *
 * 주의:
 *  - entities glob 은 `src/**\/*.entity.ts` — migration generate 시 src 경로 기준.
 *    build 시에는 dist 를 쓰지만 CLI 는 ts 경로 그대로.
 *  - migrations 디렉토리는 `src/migrations/*.ts`.
 *  - `synchronize: false` 강제 — CLI 환경에서 synchronize 가 켜지면 의도치 않은 schema 변경 위험.
 */

loadEnv({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
