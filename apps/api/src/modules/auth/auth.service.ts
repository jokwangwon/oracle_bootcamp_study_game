import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: { username: string; email: string; password: string }) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.usersService.create({
      username: input.username,
      email: input.email,
      passwordHash,
    });
    return this.issueToken(user.id, user.username);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(user.id, user.username);
  }

  private issueToken(userId: string, username: string) {
    const accessToken = this.jwtService.sign({ sub: userId, username });
    return { accessToken };
  }
}
