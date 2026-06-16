import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { AuthModule } from './auth/auth.module'
import { EntriesModule } from './entries/entries.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    // Loads .env into process.env and provides ConfigService app-wide.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EntriesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
