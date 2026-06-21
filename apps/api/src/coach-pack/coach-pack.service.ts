import { Injectable, NotFoundException } from '@nestjs/common'
import { CoachPackVersion } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import {
  DEFAULT_ANALYSIS_MD,
  DEFAULT_SOURCE_NOTE,
  DEFAULT_VOICE_MD,
} from './coach-pack.defaults'
import { CreateCoachPackVersionDto } from './dto/create-coach-pack-version.dto'

@Injectable()
export class CoachPackService {
  constructor(private readonly prisma: PrismaService) {}

  // The active version, self-healing: if the user has none yet, seed a default
  // and point at it. So this never 404s.
  async getActive(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    })
    if (settings?.activeCoachPackVersionId) {
      const active = await this.prisma.coachPackVersion.findFirst({
        where: { id: settings.activeCoachPackVersionId, userId },
      })
      if (active) return this.toResponse(active)
    }
    return this.toResponse(await this.createDefault(userId))
  }

  async listVersions(userId: string) {
    const [versions, settings] = await Promise.all([
      this.prisma.coachPackVersion.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userSettings.findUnique({ where: { userId } }),
    ])
    const activeId = settings?.activeCoachPackVersionId
    return versions.map((v) => ({
      ...this.toResponse(v),
      isActive: v.id === activeId,
    }))
  }

  // Saving edits = create a new immutable version and make it active.
  async createVersion(userId: string, dto: CreateCoachPackVersionDto) {
    const version = await this.prisma.coachPackVersion.create({
      data: {
        userId,
        analysisMd: dto.analysisMd,
        voiceMd: dto.voiceMd,
        sourceNote: dto.sourceNote ?? 'manual edit',
      },
    })
    await this.setActive(userId, version.id)
    return this.toResponse(version)
  }

  // Rollback: point the active marker at an existing (own) version.
  async activate(userId: string, id: string) {
    const version = await this.prisma.coachPackVersion.findFirst({
      where: { id, userId },
    })
    if (!version) {
      throw new NotFoundException('Coach pack version not found')
    }
    await this.setActive(userId, id)
    return this.toResponse(version)
  }

  private async createDefault(userId: string) {
    const version = await this.prisma.coachPackVersion.create({
      data: {
        userId,
        analysisMd: DEFAULT_ANALYSIS_MD,
        voiceMd: DEFAULT_VOICE_MD,
        sourceNote: DEFAULT_SOURCE_NOTE,
      },
    })
    await this.setActive(userId, version.id)
    return version
  }

  // The pointer lives on user_settings; upsert so a missing row is fine.
  private setActive(userId: string, versionId: string) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: { activeCoachPackVersionId: versionId },
      create: { userId, activeCoachPackVersionId: versionId },
    })
  }

  private toResponse(v: CoachPackVersion) {
    return {
      id: v.id,
      analysisMd: v.analysisMd,
      voiceMd: v.voiceMd,
      sourceNote: v.sourceNote,
      createdAt: v.createdAt,
    }
  }
}
