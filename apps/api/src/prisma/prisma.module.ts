import { Global, Module } from '@nestjs/common'

import { PrismaService } from './prisma.service'

// @Global: PrismaService becomes injectable everywhere without importing this
// module each time — fits a single, cross-cutting DB access point.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
