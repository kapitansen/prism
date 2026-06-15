import { Controller, Get, UseGuards } from '@nestjs/common'

import { AuthUser } from './auth/auth-user.interface'
import { CurrentUser } from './auth/current-user.decorator'
import { JwtAuthGuard } from './auth/jwt-auth.guard'
import { PrismaService } from './prisma/prisma.service'

@Controller()
export class AppController {
  // Constructor injection: Nest reads the PrismaService type and supplies
  // the singleton instance from its container.
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return { status: 'ok' }
  }

  @Get('health/db')
  async healthDb() {
    await this.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'up' }
  }

  // Protected: requires a valid Bearer token. Returns who the guard resolved.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user
  }
}
