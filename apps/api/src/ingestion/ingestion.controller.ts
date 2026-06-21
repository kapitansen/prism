import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'

import { AuthUser } from '../auth/auth-user.interface'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ParseDayDto } from './dto/parse-day.dto'
import { IngestionService } from './ingestion.service'

@UseGuards(JwtAuthGuard)
@Controller('entries')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  // Interactive day parse — returns a proposal (clarify questions or the full
  // extraction). The client loops rounds (sending answers) and commits later.
  @Post(':id/parse')
  parse(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ParseDayDto,
  ) {
    return this.ingestion.parse(user.id, id, dto)
  }

  // Persist a confirmed (user-edited) extraction. Body is validated by zod in
  // the service (the extraction contract), so it's typed loosely here.
  @Post(':id/commit')
  commit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.ingestion.commit(user.id, id, body)
  }
}
