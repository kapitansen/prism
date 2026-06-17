import { Injectable } from '@nestjs/common'
import { UserSettings } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    // upsert as a safety net: the row is seeded at user creation, but never 404
    // on settings — fall back to defaults.
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
    return this.toResponse(settings)
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: dto, // undefined fields are ignored by Prisma
      create: { userId, ...dto },
    })
    return this.toResponse(settings)
  }

  // Shape sent to the client (no internal columns).
  private toResponse(s: UserSettings) {
    return {
      uiLanguage: s.uiLanguage,
      theme: s.theme,
      themePreset: s.themePreset,
      timezone: s.timezone,
    }
  }
}
