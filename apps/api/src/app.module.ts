import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { AuthModule } from './auth/auth.module'
import { CbtCardsModule } from './cbt-cards/cbt-cards.module'
import { CoachPackModule } from './coach-pack/coach-pack.module'
import { CryptoModule } from './crypto/crypto.module'
import { EntitiesModule } from './entities/entities.module'
import { EntriesModule } from './entries/entries.module'
import { LlmModule } from './llm/llm.module'
import { MetricsModule } from './metrics/metrics.module'
import { PrismaModule } from './prisma/prisma.module'
import { SettingsModule } from './settings/settings.module'

@Module({
  imports: [
    // Loads .env into process.env and provides ConfigService app-wide.
    ConfigModule.forRoot({ isGlobal: true }),
    CryptoModule,
    PrismaModule,
    AuthModule,
    CbtCardsModule,
    CoachPackModule,
    EntriesModule,
    EntitiesModule,
    LlmModule,
    MetricsModule,
    SettingsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
