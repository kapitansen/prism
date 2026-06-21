import { PrismaClient } from '@prisma/client'

import {
  DEFAULT_ANALYSIS_MD,
  DEFAULT_SOURCE_NOTE,
  DEFAULT_VOICE_MD,
} from '../src/coach-pack/coach-pack.defaults'

// The baseline every Prism user needs to be usable: the starter metric set and
// an active coach pack. Shared by both the demo seed and the personal-data
// import so there is a single source of truth (DRY).

// Starter metric set: 4 manual day-chips (1–5) + two extracted-from-text.
export const STARTER_METRICS = [
  { key: 'mood', name: 'Mood', scaleMin: 1, scaleMax: 5, source: 'manual' },
  {
    key: 'sleep_quality',
    name: 'Sleep quality',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
  },
  { key: 'energy', name: 'Energy', scaleMin: 1, scaleMax: 5, source: 'manual' },
  {
    key: 'activity',
    name: 'Activity',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
  },
  { key: 'sleep_hours', name: 'Sleep hours', unit: 'h', source: 'extracted' },
  {
    key: 'anxiety',
    name: 'Anxiety',
    scaleMin: 1,
    scaleMax: 5,
    source: 'extracted',
  },
] as const

// Idempotent: upsert the metric definitions and, if the user has no coach pack
// yet, create the default one and point the user's settings at it.
export async function ensureBaseline(prisma: PrismaClient, userId: string) {
  for (const m of STARTER_METRICS) {
    const { key, ...attrs } = m
    await prisma.metricDefinition.upsert({
      where: { userId_key: { userId, key } },
      update: attrs, // keep definitions in sync with this file on re-run
      create: { userId, key, ...attrs },
    })
  }

  if ((await prisma.coachPackVersion.count({ where: { userId } })) === 0) {
    const pack = await prisma.coachPackVersion.create({
      data: {
        userId,
        analysisMd: DEFAULT_ANALYSIS_MD,
        voiceMd: DEFAULT_VOICE_MD,
        sourceNote: DEFAULT_SOURCE_NOTE,
      },
    })
    await prisma.userSettings.update({
      where: { userId },
      data: { activeCoachPackVersionId: pack.id },
    })
  }
}
