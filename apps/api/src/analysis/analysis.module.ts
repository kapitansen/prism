import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'

// Prisma, Encryption and the LLM runner are global; only the auth guard needs
// importing here.
@Module({
  imports: [AuthModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
