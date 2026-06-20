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
    key: 'energy',
    name: 'Energy',
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
  'Утром прогулка, днём немного поработал.',
  'Посмотрел фильм, приготовил ужин.',
  'Сходил за продуктами, прибрался дома.',
  'Почитал перед сном, лёг пораньше.',
  'Тренировка и долгая прогулка.',
  'Спокойный день без особых событий.',
  'Поучил новую тему, порешал задачи.',
  'Кофе с приятелем, прошлись по центру.',
  'Разобрал почту, ответил на сообщения.',
  'Слушал музыку, гулял в парке.',
  'Пробовал новый рецепт на ужин.',
  'День дома: отдых и сериал.',
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
    name: 'Алекс',
    aliases: ['Саша'],
    description: 'приятель',
    digest: 'Иногда видимся, общаемся на нейтральные темы.',
  },
  {
    name: 'Мария',
    aliases: [],
    description: 'знакомая',
    digest: null,
  },
] as const

const DEMO_PROJECTS = [
  { name: 'Изучение языка', description: 'личный учебный проект' },
] as const

// CBT cards: trigger thought (title) + reframe (explanation, can be long).
const DEMO_CARDS = [
  {
    title: 'Я ничего не довожу до конца',
    explanation:
      'Кажется, что я бросаю всё на полпути.\n\nЕсли посмотреть на факты:\n— регулярно занимаюсь спортом несколько раз в неделю;\n— прошёл онлайн-курс до конца;\n— держу режим дня и порядок дома;\n— дочитываю книги, а не бросаю на середине;\n— довёл до результата задачи, которые долго откладывал.\n\nВывод: я довожу дела до конца чаще, чем кажется в плохой момент.',
    isFavorite: true,
    conviction: 8,
  },
  {
    title: 'Если ошибусь — это катастрофа',
    explanation:
      'Ошибка — это данные, а не приговор. Большинство ошибок исправимы, и я не раз их исправлял.',
    isFavorite: true,
    conviction: 5,
  },
  {
    title: 'Я должен всем нравиться',
    explanation:
      'Нравиться всем невозможно, и это нормально. Важнее быть в ладу со своими ценностями, чем угождать каждому.',
    isFavorite: false,
    conviction: 3,
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
      const { key, ...attrs } = m
      await prisma.metricDefinition.upsert({
        where: { userId_key: { userId: user.id, key } },
        update: attrs, // keep definitions in sync with this file on re-seed
        create: { userId: user.id, key, ...attrs },
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

    if (
      u.isDemo &&
      (await prisma.cbtCard.count({ where: { userId: user.id } })) === 0
    ) {
      for (const c of DEMO_CARDS) {
        await prisma.cbtCard.create({
          data: {
            userId: user.id,
            titleEnc: encryption.encrypt(c.title),
            explanationEnc: encryption.encrypt(c.explanation),
            isFavorite: c.isFavorite,
            conviction: c.conviction,
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
