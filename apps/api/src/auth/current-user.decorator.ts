import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

import { AuthUser } from './auth-user.interface'

// Param decorator: pulls the user that JwtAuthGuard attached to the request.
// Usage: `someHandler(@CurrentUser() user: AuthUser) { ... }`
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request>()
    return req.user as AuthUser
  },
)
