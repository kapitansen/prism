import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { CoachPackModule } from '../coach-pack/coach-pack.module'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'

// Prisma, Encryption and the LLM runner are global; we also pull in CoachPack
// (for the active analysis/voice settings) and the auth guard.
@Module({
  imports: [AuthModule, CoachPackModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
