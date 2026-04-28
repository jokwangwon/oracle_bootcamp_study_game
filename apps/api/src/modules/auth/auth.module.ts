import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * ADR-020 §4.3 / CRITICAL-B3 — auth brute-force 차단 (Session 10).
 * ADR-020 §4.2.1 — refresh rotation + revoke epoch (PR-10a, Session 13~).
 *
 * named throttler (login/register) + RefreshTokenEntity 등록 + JwtModule.
 */

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshTokenEntity]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'login', ttl: 15 * 60_000, limit: 5 },
      { name: 'register', ttl: 60 * 60_000, limit: 3 },
    ]),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
