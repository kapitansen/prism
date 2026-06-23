import { ConfigService } from '@nestjs/config'
import { hash } from '@node-rs/argon2'
import { EntryType, PrismaClient } from '@prisma/client'

import { EncryptionService } from '../src/crypto/encryption.service'
import { ensureBaseline } from './starter'

const prisma = new PrismaClient()
// Encrypt seeded *_enc fields with the same service the app uses
// (ENCRYPTION_KEY comes from .env, which `prisma db seed` loads).
const encryption = new EncryptionService({
  getOrThrow: (key: string) => process.env[key],
} as unknown as ConfigService)

type Lang = 'en' | 'ru'

// Dev-only seeded accounts (no signup flow yet). Two demo tenants — one English,
// one Russian — so the product can be shown to coaches in either language. These
// passwords are dev credentials, not production secrets. All content is fictional.
const USERS: { email: string; password: string; lang: Lang }[] = [
  { email: 'demo@prism.local', password: '12345', lang: 'en' },
  { email: 'demo-ru@prism.local', password: '12345', lang: 'ru' },
]

interface DemoEntry {
  type: EntryType
  occurredOn: Date
  title: string | null
  body: string
}

interface DemoPerson {
  name: string
  aliases: string[]
  description: string | null
  digest: string | null
}

interface DemoContent {
  bodies: string[]
  reportTitle: string
  noteTitle: string
  people: DemoPerson[]
  projects: { name: string; description: string | null }[]
  cards: {
    title: string
    explanation: string
    isFavorite: boolean
    conviction: number
  }[]
}

// Demo content per language, so the Journal / People / Cards screens aren't empty.
const DEMO: Record<Lang, DemoContent> = {
  en: {
    bodies: [
      'Morning walk, worked a bit in the afternoon.',
      'Watched a film, cooked dinner.',
      'Did some grocery shopping, tidied up at home.',
      'Read before bed, turned in early.',
      'Workout and a long walk.',
      'A calm day, nothing special.',
      'Studied a new topic, solved some problems.',
      'Coffee with a friend, strolled downtown.',
      'Cleared my inbox, replied to messages.',
      'Listened to music, walked in the park.',
      'Tried a new dinner recipe.',
      'A day at home: rest and a series.',
    ],
    reportTitle: 'Weekly summary',
    noteTitle: 'Note',
    people: [
      {
        name: 'Alex',
        aliases: ['Lex'],
        description: 'a friend',
        digest: 'We meet now and then, chat about neutral topics.',
      },
      {
        name: 'Maria',
        aliases: [],
        description: 'an acquaintance',
        digest: null,
      },
    ],
    projects: [
      { name: 'Language learning', description: 'a personal study project' },
    ],
    cards: [
      {
        title: 'I never finish anything',
        explanation:
          "It feels like I drop everything halfway.\n\nLooking at the facts:\n— I exercise several times a week, consistently;\n— I finished an online course end to end;\n— I keep a daily routine and a tidy home;\n— I finish books instead of abandoning them midway;\n— I saw through tasks I'd long put off.\n\nConclusion: I finish things more often than it feels in a low moment.",
        isFavorite: true,
        conviction: 8,
      },
      {
        title: "If I make a mistake, it's a catastrophe",
        explanation:
          "A mistake is data, not a verdict. Most mistakes are fixable, and I've fixed them many times.",
        isFavorite: true,
        conviction: 5,
      },
      {
        title: 'Everyone has to like me',
        explanation:
          'Being liked by everyone is impossible, and that is fine. Being at peace with my values matters more than pleasing everyone.',
        isFavorite: false,
        conviction: 3,
      },
    ],
  },
  ru: {
    bodies: [
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
    ],
    reportTitle: 'Итоги недели',
    noteTitle: 'Заметка',
    people: [
      {
        name: 'Аня',
        aliases: ['Анечка'],
        description: 'приятельница',
        digest: 'Иногда видимся, общаемся на нейтральные темы.',
      },
      { name: 'Олег', aliases: [], description: 'знакомый', digest: null },
    ],
    projects: [
      { name: 'Изучение языка', description: 'личный учебный проект' },
    ],
    cards: [
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
    ],
  },
}

// 30 entries counting back from a fixed date (deterministic across re-seeds).
function demoEntries(content: DemoContent): DemoEntry[] {
  return Array.from({ length: 30 }, (_, i): DemoEntry => {
    const occurredOn = new Date('2026-06-17')
    occurredOn.setDate(occurredOn.getDate() - i)
    const isReport = i % 7 === 6
    const isNote = !isReport && i % 4 === 1
    return {
      type: isReport ? 'report' : isNote ? 'note' : 'daily',
      occurredOn,
      title: isReport ? content.reportTitle : isNote ? content.noteTitle : null,
      body: content.bodies[i % content.bodies.length],
    }
  })
}

async function main() {
  for (const u of USERS) {
    const passwordHash = await hash(u.password)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash }, // re-seeding resets the dev password to match this file
      create: {
        email: u.email,
        passwordHash,
        isDemo: true,
        settings: { create: { uiLanguage: u.lang } },
      },
    })

    // Starter metric set + default coach pack (shared with the import script).
    await ensureBaseline(prisma, user.id)

    const content = DEMO[u.lang]

    // Demo data — seeded once, only when empty (idempotent; never clobbers data).
    if ((await prisma.entry.count({ where: { userId: user.id } })) === 0) {
      for (const e of demoEntries(content)) {
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

    if ((await prisma.entity.count({ where: { userId: user.id } })) === 0) {
      for (const p of content.people) {
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
      for (const pr of content.projects) {
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

    if ((await prisma.cbtCard.count({ where: { userId: user.id } })) === 0) {
      for (const c of content.cards) {
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

    console.log(`seeded ${u.lang} demo user ${user.email} (${user.id})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
