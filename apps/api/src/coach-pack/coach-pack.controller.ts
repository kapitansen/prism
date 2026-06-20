import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'

import { AuthUser } from '../auth/auth-user.interface'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CoachPackService } from './coach-pack.service'
import { CreateCoachPackVersionDto } from './dto/create-coach-pack-version.dto'

@UseGuards(JwtAuthGuard)
@Controller('coach-pack')
export class CoachPackController {
  constructor(private readonly coachPack: CoachPackService) {}

  @Get()
  getActive(@CurrentUser() user: AuthUser) {
    return this.coachPack.getActive(user.id)
  }

  @Get('versions')
  listVersions(@CurrentUser() user: AuthUser) {
    return this.coachPack.listVersions(user.id)
  }

  @Post('versions')
  createVersion(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCoachPackVersionDto,
  ) {
    return this.coachPack.createVersion(user.id, dto)
  }

  @Post('versions/:id/activate')
  activate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.coachPack.activate(user.id, id)
  }
}
