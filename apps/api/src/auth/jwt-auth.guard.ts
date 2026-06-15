import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

interface JwtPayload {
  sub: string
  email: string
}

// Runs before protected handlers: reads the Bearer token, verifies its
// signature/expiry, and attaches the user to the request. No valid token → 401.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const token = this.extractToken(req)
    if (!token) {
      throw new UnauthorizedException('Missing bearer token')
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token)
      req.user = { id: payload.sub, email: payload.email }
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
    return true
  }

  private extractToken(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
