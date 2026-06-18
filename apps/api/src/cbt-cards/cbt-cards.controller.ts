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
import { CbtCardsService } from './cbt-cards.service'
import { CreateCbtCardDto } from './dto/create-cbt-card.dto'
import { ListCbtCardsDto } from './dto/list-cbt-cards.dto'
import { UpdateCbtCardDto } from './dto/update-cbt-card.dto'

@UseGuards(JwtAuthGuard)
@Controller('cbt-cards')
export class CbtCardsController {
  constructor(private readonly cards: CbtCardsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCbtCardDto) {
    return this.cards.create(user.id, dto)
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListCbtCardsDto) {
    return this.cards.findAll(user.id, query)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.findOne(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCbtCardDto,
  ) {
    return this.cards.update(user.id, id, dto)
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.remove(user.id, id)
  }
}
