import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { CbtCardsController } from './cbt-cards.controller'
import { CbtCardsService } from './cbt-cards.service'

@Module({
  imports: [AuthModule],
  controllers: [CbtCardsController],
  providers: [CbtCardsService],
})
export class CbtCardsModule {}
