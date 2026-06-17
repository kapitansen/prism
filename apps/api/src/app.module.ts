import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { AuthModule } from './auth/auth.module'
import { CryptoModule } from './crypto/crypto.module'
import { EntriesModule } from './entries/entries.module'
import { PrismaModule } from './prisma/prisma.module'
import { SettingsModule } from './settings/settings.module'

@Module({
  imports: [
    // Loads .env into process.env and provides ConfigService app-wide.
    ConfigModule.forRoot({ isGlobal: true }),
    CryptoModule,
    PrismaModule,
    AuthModule,
    EntriesModule,
    SettingsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
