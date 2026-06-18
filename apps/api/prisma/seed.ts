import { ConfigService } from '@nestjs/config'
import { hash } from '@node-rs/argon2'
import { PrismaClient } from '@prisma/client'

import { EncryptionService } from '../src/crypto/encryption.service'

const prisma = new PrismaClient()
// Encrypt seeded *_enc fields with the same service the app uses
// (ENCRYPTION_KEY comes from .env, which `prisma db seed` loads).
const encryption = new EncryptionService({
  getOrThrow: (key: string) => process.env[key],
} as unknown as ConfigService)

// Dev-only seeded accounts (no signup flow yet). These passwords are dev
// credentials for local login, not production secrets.
const USERS = [
  { email: 'eugene@prism.local', password: '12345', isDemo: false },
  { email: 'demo@prism.local', password: '12345', isDemo: true },
]

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
const DEMO_ENTRIES = [
  {
    type: 'daily',
    occurredOn: '2026-06-17',
    title: null,
    body: 'Дописал главу книги, вечером пробежка 5 км.',
  },
  {
    type: 'daily',
    occurredOn: '2026-06-16',
    title: null,
    body: 'Созвон по проекту, потом кофе с Васей.',
  },
  {
    type: 'note',
    occurredOn: '2026-06-15',
    title: 'Идея',
    body: 'Попробовать вставать в 7 и гулять до завтрака.',
  },
  {
    type: 'daily',
    occurredOn: '2026-06-13',
    title: null,
    body: 'Спокойный день: читал, разобрал почту.',
  },
  {
    type: 'report',
    occurredOn: '2026-06-10',
    title: 'Итоги недели',
    body: 'Неделя продуктивная: книга +2 главы, спорт 3 раза.',
  },
] as const

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

    // Demo data — only when the user has none yet (idempotent, never clobbers
    // real entries/entities on re-seed).
    if ((await prisma.entry.count({ where: { userId: user.id } })) === 0) {
      for (const e of DEMO_ENTRIES) {
        await prisma.entry.create({
          data: {
            userId: user.id,
            type: e.type,
            origin: 'web',
            titleEnc: e.title ? encryption.encrypt(e.title) : null,
            bodyEnc: encryption.encrypt(e.body),
            occurredOn: new Date(e.occurredOn),
          },
        })
      }
    }

    if ((await prisma.entity.count({ where: { userId: user.id } })) === 0) {
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
