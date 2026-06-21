import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { IngestionController } from './ingestion.controller'
import { IngestionService } from './ingestion.service'

// Prisma, Encryption and the LLM runner are global; only the auth guard needs
// importing here.
@Module({
  imports: [AuthModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
