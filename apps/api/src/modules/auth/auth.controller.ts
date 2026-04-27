import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';

import { AuthService } from './auth.service';

/**
 * ADR-020 §4.3 / CRITICAL-B3 — auth brute-force 차단.
 *
 *  - login   : 15분 / 5회
 *  - register: 60분 / 3회
 *
 * 별도 named throttler 두 개로 분리 (login 카운터가 register 에 영향 없음).
 * `@nestjs/throttler` v6 의 in-memory tracker (default IP) 사용.
 */

const LOGIN_TTL_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const REGISTER_TTL_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 3;

class RegisterDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ register: { ttl: REGISTER_TTL_MS, limit: REGISTER_LIMIT } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ login: { ttl: LOGIN_TTL_MS, limit: LOGIN_LIMIT } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
