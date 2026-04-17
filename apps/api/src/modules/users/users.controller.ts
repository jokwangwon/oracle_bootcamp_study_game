import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

interface JwtUser {
  sub: string;
  username: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.usersService.findById(user.sub);
  }

  @Get('me/progress')
  async getMyProgress(@Req() req: Request) {
    const user = req.user as JwtUser;
    return this.usersService.getProgress(user.sub);
  }
}
