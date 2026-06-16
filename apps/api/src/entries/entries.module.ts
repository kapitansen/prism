import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { EntriesController } from './entries.controller'
import { EntriesService } from './entries.service'

@Module({
  imports: [AuthModule], // brings JwtAuthGuard (+ JwtService) for the routes
  controllers: [EntriesController],
  providers: [EntriesService],
})
export class EntriesModule {}
