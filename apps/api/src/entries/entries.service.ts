import { Injectable, NotFoundException } from '@nestjs/common'
import { Entry, Prisma } from '@prisma/client'

import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateEntryDto } from './dto/create-entry.dto'
import { ListEntriesDto } from './dto/list-entries.dto'
import { UpdateEntryDto } from './dto/update-entry.dto'

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateEntryDto) {
    const entry = await this.prisma.entry.create({
      // On create `body` is always present (validated), so toData() always
      // yields bodyEnc here — the cast asserts what's true at runtime.
      data: {
        userId,
        origin: 'web',
        ...this.toData(dto),
      } as Prisma.EntryUncheckedCreateInput,
    })
    return this.toDetail(entry)
  }

  async findAll(
    userId: string,
    { limit = 20, offset = 0, on, type }: ListEntriesDto,
  ) {
    const entries = await this.prisma.entry.findMany({
      where: {
        userId, // tenant scope — only this user's rows
        ...(type ? { type } : {}),
        ...(on ? { occurredOn: new Date(on) } : {}),
      },
      // newest day first; createdAt breaks ties within a day for stable paging
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    })
    return entries.map((e) => this.toListItem(e))
  }

  async findOne(userId: string, id: string) {
    // findFirst (not findUnique) so we can filter by userId too — a row owned
    // by another tenant simply isn't found → 404.
    const entry = await this.prisma.entry.findFirst({ where: { id, userId } })
    if (!entry) {
      throw new NotFoundException('Entry not found')
    }
    return this.toDetail(entry)
  }

  async update(userId: string, id: string, dto: UpdateEntryDto) {
    // updateMany lets us scope by userId in one atomic query; count === 0 means
    // "not yours / doesn't exist".
    const { count } = await this.prisma.entry.updateMany({
      where: { id, userId },
      data: this.toData(dto),
    })
    if (count === 0) {
      throw new NotFoundException('Entry not found')
    }
    return this.findOne(userId, id)
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.entry.deleteMany({
      where: { id, userId },
    })
    if (count === 0) {
      throw new NotFoundException('Entry not found')
    }
    return { deleted: true }
  }

  // Single source of truth for "DTO field → DB column": encrypts text fields,
  // parses dates, and includes only the keys actually provided. Used by both
  // create and update — add a new field here once.
  private toData(
    dto: Partial<CreateEntryDto>,
  ): Prisma.EntryUpdateManyMutationInput {
    const data: Prisma.EntryUpdateManyMutationInput = {}
    if (dto.type !== undefined) data.type = dto.type
    if (dto.body !== undefined) data.bodyEnc = this.encryption.encrypt(dto.body)
    if (dto.title !== undefined) {
      data.titleEnc = dto.title ? this.encryption.encrypt(dto.title) : null
    }
    if (dto.summary !== undefined) {
      data.summaryEnc = dto.summary
        ? this.encryption.encrypt(dto.summary)
        : null
    }
    if (dto.occurredOn !== undefined) data.occurredOn = new Date(dto.occurredOn)
    if (dto.occurredTo !== undefined) {
      data.occurredTo = dto.occurredTo ? new Date(dto.occurredTo) : null
    }
    return data
  }

  // ── mappers: DB row (with *_enc blobs) → client shape (decrypted) ──

  private toDetail(e: Entry) {
    return {
      id: e.id,
      type: e.type,
      origin: e.origin,
      title: e.titleEnc ? this.encryption.decrypt(e.titleEnc) : null,
      body: this.encryption.decrypt(e.bodyEnc),
      summary: e.summaryEnc ? this.encryption.decrypt(e.summaryEnc) : null,
      occurredOn: e.occurredOn,
      occurredTo: e.occurredTo,
      ingestStatus: e.ingestStatus,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }
  }

  private toListItem(e: Entry) {
    return {
      id: e.id,
      type: e.type,
      origin: e.origin,
      title: e.titleEnc ? this.encryption.decrypt(e.titleEnc) : null,
      // The web feed shows content; the future MCP layer keeps its own
      // body-less, index-first responses.
      body: this.encryption.decrypt(e.bodyEnc),
      summary: e.summaryEnc ? this.encryption.decrypt(e.summaryEnc) : null,
      occurredOn: e.occurredOn,
      occurredTo: e.occurredTo,
      ingestStatus: e.ingestStatus,
      createdAt: e.createdAt,
    }
  }
}
