import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Module({
  imports: [
    // Async config: the secret comes from ConfigService, which is only
    // populated after ConfigModule loads .env — so we configure JwtModule
    // via a factory rather than inline.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // expiresIn is typed as ms's StringValue (e.g. `'7d'`), not plain string.
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // Export the guard AND re-export JwtModule so JwtService resolves wherever
  // the guard is used (e.g. AppModule's routes).
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
