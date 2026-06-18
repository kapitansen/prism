import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'

import { AuthUser } from '../auth/auth-user.interface'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateEntryDto } from './dto/create-entry.dto'
import { ListEntriesDto } from './dto/list-entries.dto'
import { UpdateEntryDto } from './dto/update-entry.dto'
import { EntriesService } from './entries.service'

@UseGuards(JwtAuthGuard) // every route here requires a valid token
@Controller('entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEntryDto) {
    return this.entries.create(user.id, dto)
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListEntriesDto) {
    return this.entries.findAll(user.id, query)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entries.findOne(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.entries.update(user.id, id, dto)
  }

  @Post(':id/finalize')
  finalize(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entries.finalize(user.id, id)
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entries.remove(user.id, id)
  }
}
