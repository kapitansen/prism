import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { EntitiesController } from './entities.controller'
import { EntitiesService } from './entities.service'

@Module({
  imports: [AuthModule], // JwtAuthGuard for the routes
  controllers: [EntitiesController],
  providers: [EntitiesService],
})
export class EntitiesModule {}
