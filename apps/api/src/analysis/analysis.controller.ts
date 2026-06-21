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
import { AnalysisService } from './analysis.service'
import { ParseDayDto } from './dto/parse-day.dto'

@UseGuards(JwtAuthGuard)
@Controller('entries')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  // Interactive day parse — one round. Returns clarify questions or the full
  // extraction. Rounds are stored server-side; the client sends only new answers.
  @Post(':id/parse')
  parse(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ParseDayDto,
  ) {
    return this.analysis.parse(user.id, id, dto)
  }

  // Persist a confirmed (user-edited) extraction. Body validated by zod in the
  // service (the extraction contract), so it's typed loosely here.
  @Post(':id/commit')
  commit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.analysis.commit(user.id, id, body)
  }
}
