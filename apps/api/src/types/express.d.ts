import { AuthUser } from '../auth/auth-user.interface'

// Module augmentation: teach TS that requests may carry an authenticated user,
// so `req.user` is typed everywhere (set by JwtAuthGuard).
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
