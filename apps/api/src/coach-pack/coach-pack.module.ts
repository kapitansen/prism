import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { CoachPackController } from './coach-pack.controller'
import { CoachPackService } from './coach-pack.service'

@Module({
  imports: [AuthModule],
  controllers: [CoachPackController],
  providers: [CoachPackService],
})
export class CoachPackModule {}
