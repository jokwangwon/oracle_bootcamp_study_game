import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import IORedis from 'ioredis';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import {
  REFRESH_REDIS,
  REFRESH_TOKEN_CONFIG,
  RefreshTokenService,
  type RefreshTokenServiceConfig,
} from './refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * ADR-020 §4.3 / CRITICAL-B3 — auth brute-force 차단 (Session 10).
 * ADR-020 §4.2.1 — refresh rotation + revoke epoch (PR-10a, Session 13~).
 *
 * 구성:
 *  - JwtModule (access secret = JWT_SECRET, expiresIn = JWT_EXPIRES_IN)
 *  - RefreshTokenService — rotation/reuse detection. 별도 secret = JWT_REFRESH_SECRET,
 *    별도 expiresIn = JWT_REFRESH_EXPIRES_IN.
 *  - REFRESH_REDIS — ioredis 단일 인스턴스 (BullMQ 와 분리, 동일 서버). SETNX mutex 용.
 *  - named throttler (login/register).
 */

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    TypeOrmModule.forFeature([RefreshTokenEntity]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'login', ttl: 15 * 60_000, limit: 5 },
        { name: 'register', ttl: 60 * 60_000, limit: 3 },
        // PR-10b §5.3 — R4 토론 write endpoint (분당 5회). DiscussionController 가 사용.
        { name: 'discussion_write', ttl: 60_000, limit: 5 },
      ],
      // PR-13 — e2e 환경에서 ThrottlerGuard 우회 (THROTTLE_DISABLED=1 에서만).
      // Throttler 회귀는 단위 테스트 (auth.controller.test 등) 가 검증.
      skipIf: () => process.env.THROTTLE_DISABLED === '1',
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenService,
    {
      provide: REFRESH_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): IORedis => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        return new IORedis(url, { maxRetriesPerRequest: null });
      },
    },
    {
      provide: REFRESH_TOKEN_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RefreshTokenServiceConfig => ({
        refreshSecret:
          config.get<string>('JWT_REFRESH_SECRET') ?? config.get<string>('JWT_SECRET') ?? '',
        refreshExpiresIn: config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '14d',
      }),
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
