import { ConfigService } from '@nestjs/config'
import { hash } from '@node-rs/argon2'
import { EntryType, PrismaClient } from '@prisma/client'

import { EncryptionService } from '../src/crypto/encryption.service'

const prisma = new PrismaClient()
// Encrypt seeded *_enc fields with the same service the app uses
// (ENCRYPTION_KEY comes from .env, which `prisma db seed` loads).
const encryption = new EncryptionService({
  getOrThrow: (key: string) => process.env[key],
} as unknown as ConfigService)

// Dev-only seeded accounts (no signup flow yet). These passwords are dev
// credentials for local login, not production secrets.
const USERS = [{ email: 'demo@prism.local', password: '12345', isDemo: true }]

// Starter metric set: 4 manual day-chips (1–10) + two extracted-from-text.
const METRICS = [
  { key: 'mood', name: 'Mood', scaleMin: 1, scaleMax: 5, source: 'manual' },
  {
    key: 'sleep_quality',
    name: 'Sleep quality',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
  },
  {
    key: 'fatigue',
    name: 'Fatigue',
    scaleMin: 1,
    scaleMax: 5,
    source: 'manual',
  },
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

// Demo content so the Journal and People screens aren't empty in dev.
interface DemoEntry {
  type: EntryType
  occurredOn: Date
  title: string | null
  body: string
}

const DEMO_BODIES = [
  'Дописал главу книги, вечером пробежка 5 км.',
  'Созвон по проекту, потом кофе с Васей.',
  'Спокойный день: читал, разобрал почту.',
  'Сходил в спортзал, вечером готовил ужин.',
  'Долгая прогулка, обдумывал план на неделю.',
  'Разобрал заметки и навёл порядок на столе.',
  'Встретился с Аней, обсудили рабочие задачи.',
  'Начал новую книгу, читал перед сном.',
  'Обычный рабочий день, без особых событий.',
  'Гулял в парке, сделал пару фотографий.',
  'Готовил большой обед, позвал друзей.',
  'Разгрёб бэклог задач, закрыл несколько мелких.',
]

// 30 entries counting back from a fixed date (deterministic across re-seeds).
const DEMO_ENTRIES: DemoEntry[] = Array.from(
  { length: 30 },
  (_, i): DemoEntry => {
    const occurredOn = new Date('2026-06-17')
    occurredOn.setDate(occurredOn.getDate() - i)
    const isReport = i % 7 === 6
    const isNote = !isReport && i % 4 === 1
    return {
      type: isReport ? 'report' : isNote ? 'note' : 'daily',
      occurredOn,
      title: isReport ? 'Итоги недели' : isNote ? 'Заметка' : null,
      body: DEMO_BODIES[i % DEMO_BODIES.length],
    }
  },
)

const DEMO_PEOPLE = [
  {
    name: 'Вася',
    aliases: ['Василий', 'Васёк'],
    description: 'друг с университета',
    digest: 'Июнь 2026: вместе работаем над проектом, часто пересекаемся.',
  },
  {
    name: 'Аня',
    aliases: ['Анна'],
    description: 'коллега по работе',
    digest: null,
  },
] as const

const DEMO_PROJECTS = [
  { name: 'Книга', description: 'личный писательский проект' },
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

    // Demo data — only for the demo account, and only when it's empty
    // (idempotent; never clobbers real data, never seeds real users).
    if (
      u.isDemo &&
      (await prisma.entry.count({ where: { userId: user.id } })) === 0
    ) {
      for (const e of DEMO_ENTRIES) {
        await prisma.entry.create({
          data: {
            userId: user.id,
            type: e.type,
            origin: 'web',
            titleEnc: e.title ? encryption.encrypt(e.title) : null,
            bodyEnc: encryption.encrypt(e.body),
            occurredOn: e.occurredOn,
          },
        })
      }
    }

    if (
      u.isDemo &&
      (await prisma.entity.count({ where: { userId: user.id } })) === 0
    ) {
      for (const p of DEMO_PEOPLE) {
        await prisma.entity.create({
          data: {
            userId: user.id,
            type: 'person',
            nameEnc: encryption.encrypt(p.name),
            aliasesEnc: p.aliases.length
              ? encryption.encrypt(JSON.stringify(p.aliases))
              : null,
            descriptionEnc: p.description
              ? encryption.encrypt(p.description)
              : null,
            digestEnc: p.digest ? encryption.encrypt(p.digest) : null,
            digestUpdatedAt: p.digest ? new Date() : null,
          },
        })
      }
      for (const pr of DEMO_PROJECTS) {
        await prisma.entity.create({
          data: {
            userId: user.id,
            type: 'project',
            nameEnc: encryption.encrypt(pr.name),
            descriptionEnc: pr.description
              ? encryption.encrypt(pr.description)
              : null,
          },
        })
      }
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
