import { Injectable, NotFoundException } from '@nestjs/common'
import { Entity, Prisma } from '@prisma/client'

import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateEntityDto } from './dto/create-entity.dto'
import { ListEntitiesDto } from './dto/list-entities.dto'
import { UpdateEntityDto } from './dto/update-entity.dto'
import { slugifyHandle, uniqueHandle } from './handle'

@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateEntityDto) {
    const handle = await this.resolveHandle(userId, dto.handle, dto.name)
    const entity = await this.prisma.entity.create({
      // name is required (validated), so toData() always yields nameEnc here.
      data: {
        userId,
        handleEnc: this.encryption.encrypt(handle),
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
    const entity = await this.prisma.entity.findFirst({ where: { id, userId } })
    if (!entity) {
      throw new NotFoundException('Entity not found')
    }

    const data = this.toData(dto)

    // Changing the handle: pick a unique value and rewrite @old → @new in the
    // user's entry texts, so past entries show the current handle (no confusion
    // about who @person1 was). Search/links stay on the id relation regardless.
    if (dto.handle !== undefined) {
      const oldHandle = entity.handleEnc
        ? this.encryption.decrypt(entity.handleEnc)
        : null
      const newHandle = await this.resolveHandle(
        userId,
        dto.handle,
        this.encryption.decrypt(entity.nameEnc),
        id,
      )
      data.handleEnc = this.encryption.encrypt(newHandle)
      if (oldHandle && oldHandle !== newHandle) {
        await this.rewriteHandleInEntries(userId, oldHandle, newHandle)
      }
    }

    await this.prisma.entity.update({ where: { id: entity.id }, data })
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

  // Pick a unique handle for this user: slugify the desired value (or fall back
  // to the name), then de-duplicate against existing handles. Uniqueness is in
  // app code because handle_enc is encrypted (no DB unique index).
  private async resolveHandle(
    userId: string,
    desired: string | undefined,
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyHandle(desired?.trim() || name)
    return uniqueHandle(base, await this.takenHandles(userId, excludeId))
  }

  private async takenHandles(
    userId: string,
    excludeId?: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.entity.findMany({
      where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { handleEnc: true },
    })
    const taken = new Set<string>()
    for (const r of rows) {
      if (r.handleEnc)
        taken.add(this.encryption.decrypt(r.handleEnc).toLowerCase())
    }
    return taken
  }

  // Replace @old → @new in every entry body that references it (word-bounded so
  // @alex doesn't touch @alex2). Encrypted text isn't searchable in SQL, so
  // we decrypt each entry in memory, replace, and re-encrypt the changed ones.
  // Rename is a rare, manual action, so the full scan is fine at personal scale.
  private async rewriteHandleInEntries(
    userId: string,
    oldHandle: string,
    newHandle: string,
  ): Promise<void> {
    const escaped = oldHandle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`@${escaped}\\b`, 'g')
    const entries = await this.prisma.entry.findMany({
      where: { userId },
      select: { id: true, bodyEnc: true },
    })
    for (const e of entries) {
      const body = this.encryption.decrypt(e.bodyEnc)
      if (!body.includes(`@${oldHandle}`)) continue
      const next = body.replace(re, `@${newHandle}`)
      if (next !== body) {
        await this.prisma.entry.update({
          where: { id: e.id },
          data: { bodyEnc: this.encryption.encrypt(next) },
        })
      }
    }
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
      handle: e.handleEnc ? this.encryption.decrypt(e.handleEnc) : null,
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
