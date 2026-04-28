import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshFamilyId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<IssuedTokens> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.usersService.create({
      username: input.username,
      email: input.email,
      passwordHash,
    });
    return this.issueTokens(user.id, user.username);
  }

  async login(email: string, password: string): Promise<IssuedTokens> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user.id, user.username);
  }

  /** /api/auth/refresh — rotation + 새 access JWT epoch 동기화. */
  async refresh(rawRefreshToken: string): Promise<IssuedTokens> {
    const rotated = await this.refreshTokenService.rotate(rawRefreshToken);
    const user = await this.usersService.findById(rotated.userId);
    const epoch = await this.usersService.getTokenEpoch(rotated.userId);
    const accessToken = await this.jwtService.signAsync({
      sub: rotated.userId,
      username: user.username,
      epoch,
    });
    return {
      accessToken,
      refreshToken: rotated.refreshToken,
      refreshJti: rotated.jti,
      refreshFamilyId: rotated.familyId,
    };
  }

  /**
   * /api/auth/logout — atomic 의 의미 (parallel):
   *  - incrementTokenEpoch → 모든 access JWT 즉시 무효화 (JwtStrategy 가 epoch 비교)
   *  - revokeAllForUser → 모든 활성 refresh chain revoke
   *
   * 순서 무관 (둘 다 idempotent), 한쪽 실패 시도 다른 쪽은 진행 — 전체 무효화 보장.
   */
  async logout(userId: string): Promise<void> {
    await Promise.all([
      this.usersService.incrementTokenEpoch(userId),
      this.refreshTokenService.revokeAllForUser(userId),
    ]);
  }

  private async issueTokens(userId: string, username: string): Promise<IssuedTokens> {
    const epoch = await this.usersService.getTokenEpoch(userId);
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      username,
      epoch,
    });
    const refresh = await this.refreshTokenService.issueInitial(userId);
    return {
      accessToken,
      refreshToken: refresh.refreshToken,
      refreshJti: refresh.jti,
      refreshFamilyId: refresh.familyId,
    };
  }
}
