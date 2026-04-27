import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * ADR-020 §4.3 / CRITICAL-B3 — auth 의 brute-force 차단을 위해
 * `@nestjs/throttler` 의 named throttler 2 개 (login, register) 를 등록.
 * AuthController 가 `@UseGuards(ThrottlerGuard)` + `@Throttle()` 로 적용.
 *
 * AuthModule 단위 import 만으로 충분 (ThrottlerModule.forRoot 는 글로벌이지만,
 * 컨트롤러 단위 가드 적용으로 다른 컨트롤러에는 영향 없음).
 */

@Module({
  imports: [
    UsersModule,
    PassportModule,
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
