import { hash } from '@node-rs/argon2'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Dev-only seeded accounts (no signup flow yet). These passwords are dev
// credentials for local login, not production secrets.
const USERS = [
  { email: 'eugene@prism.local', password: '12345', isDemo: false },
  { email: 'demo@prism.local', password: '12345', isDemo: true },
]

// Starter metric set: 4 manual day-chips (1–10) + two extracted-from-text.
const METRICS = [
  { key: 'mood', name: 'Mood', scaleMin: 1, scaleMax: 10, source: 'manual' },
  {
    key: 'sleep_quality',
    name: 'Sleep quality',
    scaleMin: 1,
    scaleMax: 10,
    source: 'manual',
  },
  {
    key: 'fatigue',
    name: 'Fatigue',
    scaleMin: 1,
    scaleMax: 10,
    source: 'manual',
  },
  {
    key: 'activity',
    name: 'Activity',
    scaleMin: 1,
    scaleMax: 10,
    source: 'manual',
  },
  { key: 'sleep_hours', name: 'Sleep hours', unit: 'h', source: 'extracted' },
  {
    key: 'anxiety',
    name: 'Anxiety',
    scaleMin: 1,
    scaleMax: 10,
    source: 'extracted',
  },
] as const

async function main() {
  for (const u of USERS) {
    const passwordHash = await hash(u.password)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash }, // re-seeding resets the dev password to match this file
      create: {
        email: u.email,
        passwordHash,
        isDemo: u.isDemo,
        settings: { create: {} }, // defaults: ui_language=ru, theme=system, timezone=UTC
      },
    })

    for (const m of METRICS) {
      await prisma.metricDefinition.upsert({
        where: { userId_key: { userId: user.id, key: m.key } },
        update: {},
        create: { userId: user.id, ...m },
      })
    }

    console.log(`seeded user ${user.email} (${user.id})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
