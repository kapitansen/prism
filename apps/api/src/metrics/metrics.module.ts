import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics.service'

@Module({
  imports: [AuthModule], // JwtAuthGuard for the routes
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
