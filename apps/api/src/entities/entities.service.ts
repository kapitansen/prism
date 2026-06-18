import { Injectable, NotFoundException } from '@nestjs/common'
import { Entity, Prisma } from '@prisma/client'

import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateEntityDto } from './dto/create-entity.dto'
import { ListEntitiesDto } from './dto/list-entities.dto'
import { UpdateEntityDto } from './dto/update-entity.dto'

@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateEntityDto) {
    const entity = await this.prisma.entity.create({
      // name is required (validated), so toData() always yields nameEnc here.
      data: {
        userId,
        ...this.toData(dto),
      } as Prisma.EntityUncheckedCreateInput,
    })
    return this.toDetail(entity)
  }

  async findAll(userId: string, { type }: ListEntitiesDto = {}) {
    const entities = await this.prisma.entity.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    // Full shape here: the People screen edits name/aliases/description/summary,
    // so list items carry everything (entity catalogs are small).
    return entities.map((e) => this.toDetail(e))
  }

  async findOne(userId: string, id: string) {
    const entity = await this.prisma.entity.findFirst({ where: { id, userId } })
    if (!entity) {
      throw new NotFoundException('Entity not found')
    }
    return this.toDetail(entity)
  }

  async update(userId: string, id: string, dto: UpdateEntityDto) {
    const { count } = await this.prisma.entity.updateMany({
      where: { id, userId },
      data: this.toData(dto),
    })
    if (count === 0) {
      throw new NotFoundException('Entity not found')
    }
    return this.findOne(userId, id)
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.entity.deleteMany({
      where: { id, userId },
    })
    if (count === 0) {
      throw new NotFoundException('Entity not found')
    }
    return { deleted: true }
  }

  // DTO field → DB column: encrypts text fields, serialises+encrypts the alias
  // array as one blob, parses dates. Used by both create and update.
  private toData(
    dto: Partial<CreateEntityDto>,
  ): Prisma.EntityUpdateManyMutationInput {
    const data: Prisma.EntityUpdateManyMutationInput = {}
    if (dto.type !== undefined) data.type = dto.type
    if (dto.name !== undefined) data.nameEnc = this.encryption.encrypt(dto.name)
    if (dto.aliases !== undefined) {
      data.aliasesEnc = dto.aliases.length
        ? this.encryption.encrypt(JSON.stringify(dto.aliases))
        : null
    }
    if (dto.description !== undefined) {
      data.descriptionEnc = dto.description
        ? this.encryption.encrypt(dto.description)
        : null
    }
    if (dto.digest !== undefined) {
      // a manual edit counts as a (re)build of the summary
      data.digestEnc = dto.digest ? this.encryption.encrypt(dto.digest) : null
      data.digestUpdatedAt = dto.digest ? new Date() : null
    }
    if (dto.status !== undefined) data.status = dto.status
    if (dto.periodStart !== undefined) {
      data.periodStart = dto.periodStart ? new Date(dto.periodStart) : null
    }
    if (dto.periodEnd !== undefined) {
      data.periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : null
    }
    return data
  }

  private toDetail(e: Entity) {
    return {
      id: e.id,
      type: e.type,
      name: this.encryption.decrypt(e.nameEnc),
      aliases: e.aliasesEnc
        ? (JSON.parse(this.encryption.decrypt(e.aliasesEnc)) as string[])
        : [],
      description: e.descriptionEnc
        ? this.encryption.decrypt(e.descriptionEnc)
        : null,
      status: e.status,
      periodStart: e.periodStart,
      periodEnd: e.periodEnd,
      digest: e.digestEnc ? this.encryption.decrypt(e.digestEnc) : null,
      digestUpdatedAt: e.digestUpdatedAt,
      createdAt: e.createdAt,
    }
  }
}
