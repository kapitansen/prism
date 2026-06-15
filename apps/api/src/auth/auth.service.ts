import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { verify } from '@node-rs/argon2'

import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    // One generic error for both "no such user" and "wrong password" — don't
    // leak which accounts exist.
    if (!user || !(await verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password')
    }

    // `sub` (subject) is the standard JWT claim for "who this token is about".
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    })
    return { accessToken }
  }
}
