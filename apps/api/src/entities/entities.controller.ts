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
import { CreateEntityDto } from './dto/create-entity.dto'
import { ListEntitiesDto } from './dto/list-entities.dto'
import { UpdateEntityDto } from './dto/update-entity.dto'
import { EntitiesService } from './entities.service'

@UseGuards(JwtAuthGuard)
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEntityDto) {
    return this.entities.create(user.id, dto)
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListEntitiesDto) {
    return this.entities.findAll(user.id, query)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entities.findOne(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntityDto,
  ) {
    return this.entities.update(user.id, id, dto)
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entities.remove(user.id, id)
  }
}
