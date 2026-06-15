/* eslint-disable no-console */
import { hash } from '@node-rs/argon2'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Dev-only seeded accounts (no signup flow yet). These passwords are dev
// credentials for local login, not production secrets.
const USERS = [
  { email: 'eugene@prism.local', password: '12345', isDemo: false },
  { email: 'demo@prism.local', password: '12345', isDemo: true },
]

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
    console.log(`seeded user ${user.email} (${user.id})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
