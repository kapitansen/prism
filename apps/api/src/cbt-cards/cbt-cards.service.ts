import { Injectable, NotFoundException } from '@nestjs/common'
import { CbtCard, Prisma } from '@prisma/client'

import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCbtCardDto } from './dto/create-cbt-card.dto'
import { ListCbtCardsDto } from './dto/list-cbt-cards.dto'
import { UpdateCbtCardDto } from './dto/update-cbt-card.dto'

@Injectable()
export class CbtCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateCbtCardDto) {
    const card = await this.prisma.cbtCard.create({
      data: {
        userId,
        titleEnc: this.encryption.encrypt(dto.title),
        explanationEnc: this.encryption.encrypt(dto.explanation),
      },
    })
    return this.toResponse(card)
  }

  async findAll(userId: string, { favorite }: ListCbtCardsDto = {}) {
    const cards = await this.prisma.cbtCard.findMany({
      where: { userId, ...(favorite ? { isFavorite: true } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return cards.map((c) => this.toResponse(c))
  }

  async findOne(userId: string, id: string) {
    const card = await this.prisma.cbtCard.findFirst({ where: { id, userId } })
    if (!card) {
      throw new NotFoundException('Card not found')
    }
    return this.toResponse(card)
  }

  async update(userId: string, id: string, dto: UpdateCbtCardDto) {
    const data: Prisma.CbtCardUpdateManyMutationInput = {}
    if (dto.title !== undefined) {
      data.titleEnc = this.encryption.encrypt(dto.title)
    }
    if (dto.explanation !== undefined) {
      data.explanationEnc = this.encryption.encrypt(dto.explanation)
    }
    if (dto.isFavorite !== undefined) data.isFavorite = dto.isFavorite
    if (dto.conviction !== undefined) {
      data.conviction = dto.conviction
      // 0 conviction drops the card from the review deck
      if (dto.conviction === 0) data.isFavorite = false
    }

    const { count } = await this.prisma.cbtCard.updateMany({
      where: { id, userId },
      data,
    })
    if (count === 0) {
      throw new NotFoundException('Card not found')
    }
    return this.findOne(userId, id)
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.cbtCard.deleteMany({
      where: { id, userId },
    })
    if (count === 0) {
      throw new NotFoundException('Card not found')
    }
    return { deleted: true }
  }

  private toResponse(c: CbtCard) {
    return {
      id: c.id,
      title: this.encryption.decrypt(c.titleEnc),
      explanation: this.encryption.decrypt(c.explanationEnc),
      isFavorite: c.isFavorite,
      conviction: c.conviction,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }
  }
}
