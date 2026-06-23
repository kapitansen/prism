import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { McpController } from './mcp.controller'
import { McpService } from './mcp.service'

// Prisma + Encryption are global; AuthModule provides the JWT guard/strategy.
@Module({
  imports: [AuthModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
