import { PrismaClient } from '@prisma/client'

import {
  COACH_DEFAULTS,
  type Lang,
  resolveLang,
} from '../src/coach-pack/coach-pack.defaults'
import { EncryptionService } from '../src/crypto/encryption.service'

// The author's self-card (@me): a default person entity flagged isSelf, always
// fed to the analysis prompt. Its description is a template the user edits.
// Localized by the user's UI language.
export const SELF_HANDLE = 'me'
export const SELF_DEFAULTS: Record<
  Lang,
  { name: string; description: string }
> = {
  en: {
    name: 'Me',
    description: `This card is about you — the journal's author. It is always given to the AI when it analyzes your days, so keep here the context that helps it read your entries correctly. Edit it freely; add personal history or insights over time.

For example:
- Where you live; what you do (work / studies).
- What you value and what you dislike.
- Important ongoing context: health, key relationships, current goals.`,
  },
  ru: {
    name: 'Я',
    description: `Эта карточка — о тебе, авторе дневника. Она всегда передаётся ИИ при разборе дней, поэтому держи здесь контекст, который помогает правильно читать твои записи. Правь свободно; со временем дописывай личную историю и инсайты.

Например:
- Где живёшь; чем занимаешься (работа / учёба).
- Что ценишь и что не любишь.
- Важный постоянный контекст: здоровье, ключевые отношения, текущие цели.`,
  },
}

// The baseline every Prism user needs to be usable: the starter metric set and
// an active coach pack. Shared by both the demo seed and the personal-data
// import so there is a single source of truth (DRY).

// Starter metric set: 4 manual day-chips (1–5) + two extracted-from-text.
// `enabled` is the default tracked-set (≤4); the user changes it in settings.
export const STARTER_METRICS = [
  {
    key: 'mood',
    name: 'Mood',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
    enabled: true,
  },
  {
    key: 'sleep_quality',
    name: 'Sleep quality',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
    enabled: true,
  },
  {
    key: 'energy',
    name: 'Energy',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
    enabled: true,
  },
  {
    key: 'activity',
    name: 'Activity',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
    enabled: true,
  },
  {
    key: 'sleep_hours',
    name: 'Sleep hours',
    unit: 'h',
    source: 'extracted',
    enabled: false,
  },
  {
    key: 'anxiety',
    name: 'Anxiety',
    scaleMin: 1,
    scaleMax: 5,
    source: 'extracted',
    enabled: false,
  },
] as const

// Idempotent: upsert the metric definitions and, if the user has no coach pack
// yet, create the default one and point the user's settings at it. Also ensures
// the author's @me self-card exists (entity fields are encrypted, hence the
// EncryptionService).
export async function ensureBaseline(
  prisma: PrismaClient,
  userId: string,
  encryption: EncryptionService,
) {
  // Seed default content in the user's UI language.
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  const lang = resolveLang(settings?.uiLanguage)

  for (const m of STARTER_METRICS) {
    const { key, enabled, ...attrs } = m
    await prisma.metricDefinition.upsert({
      where: { userId_key: { userId, key } },
      // Sync definition fields on re-run, but never clobber the user's enabled
      // choice — enabled is only set when the row is first created.
      update: attrs,
      create: { userId, key, enabled, ...attrs },
    })
  }

  if ((await prisma.coachPackVersion.count({ where: { userId } })) === 0) {
    const coach = COACH_DEFAULTS[lang]
    const pack = await prisma.coachPackVersion.create({
      data: {
        userId,
        analysisMd: coach.analysisMd,
        voiceMd: coach.voiceMd,
        sourceNote: coach.sourceNote,
      },
    })
    await prisma.userSettings.update({
      where: { userId },
      data: { activeCoachPackVersionId: pack.id },
    })
  }

  // Exactly one self-card per user.
  if ((await prisma.entity.count({ where: { userId, isSelf: true } })) === 0) {
    const self = SELF_DEFAULTS[lang]
    await prisma.entity.create({
      data: {
        userId,
        type: 'person',
        isSelf: true,
        nameEnc: encryption.encrypt(self.name),
        handleEnc: encryption.encrypt(SELF_HANDLE),
        descriptionEnc: encryption.encrypt(self.description),
      },
    })
  }
}
