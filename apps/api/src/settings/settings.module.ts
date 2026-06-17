import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

@Module({
  imports: [AuthModule], // JwtAuthGuard for the routes
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
