import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { hash } from '@node-rs/argon2'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../app.module'
import { PrismaService } from '../prisma/prisma.service'

describe('Tenant isolation (API) — entries + settings', () => {
  let app: INestApplication
  let prisma: PrismaService
  let tokenA: string
  let tokenB: string

  beforeAll(async () => {
    // Boot the real app (DI, guards, pipes — everything) just like in prod.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    await app.init()
    prisma = app.get(PrismaService)

    // SAFETY: never touch the real database.
    const rows = await prisma.$queryRaw<
      { current_database: string }[]
    >`SELECT current_database()`
    if (rows[0].current_database !== 'prism_test') {
      throw new Error(
        `Refusing to run: expected prism_test, got ${rows[0].current_database}`,
      )
    }

    await prisma.entry.deleteMany()
    await prisma.user.deleteMany()

    const passwordHash = await hash('pw')
    await prisma.user.create({ data: { email: 'a@test.local', passwordHash } })
    await prisma.user.create({ data: { email: 'b@test.local', passwordHash } })

    tokenA = await login('a@test.local')
    tokenB = await login('b@test.local')
  })

  beforeEach(async () => {
    // Each test starts with no entries (users/tokens stay).
    await prisma.entry.deleteMany()
  })

  afterAll(async () => {
    await prisma.entry.deleteMany()
    await prisma.user.deleteMany()
    await app.close()
  })

  function http() {
    return request(app.getHttpServer())
  }

  async function login(email: string): Promise<string> {
    const res = await http().post('/auth/login').send({ email, password: 'pw' })
    return res.body.accessToken as string
  }

  async function createEntryAs(token: string): Promise<string> {
    const res = await http()
      .post('/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'daily', body: 'secret', occurredOn: '2026-06-16' })
      .expect(201)
    return res.body.id as string
  }

  it('rejects requests without a token (401)', async () => {
    await http().get('/entries').expect(401)
  })

  it("B cannot read A's entry (404)", async () => {
    const id = await createEntryAs(tokenA)
    await http()
      .get(`/entries/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })

  it("B does not see A's entries in their own list", async () => {
    await createEntryAs(tokenA)
    const res = await http()
      .get('/entries')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    expect(res.body).toHaveLength(0)
  })

  it("B cannot delete A's entry, and A still has it", async () => {
    const id = await createEntryAs(tokenA)
    await http()
      .delete(`/entries/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
    await http()
      .get(`/entries/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
  })

  it('A sees only their own entry', async () => {
    await createEntryAs(tokenA)
    await createEntryAs(tokenB)
    const res = await http()
      .get('/entries')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(res.body).toHaveLength(1)
  })

  it("B cannot update A's entry; A's body is unchanged", async () => {
    const id = await createEntryAs(tokenA)
    await http()
      .patch(`/entries/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ body: 'hacked by B' })
      .expect(404)
    const res = await http()
      .get(`/entries/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(res.body.body).toBe('secret')
  })

  it('A reads back their own entry with the body decrypted', async () => {
    const id = await createEntryAs(tokenA)
    const res = await http()
      .get(`/entries/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(res.body.body).toBe('secret')
  })

  it('rejects a garbage token (401)', async () => {
    await http()
      .get('/entries')
      .set('Authorization', 'Bearer not.a.real.token')
      .expect(401)
  })

  it('login rejects a wrong password (401)', async () => {
    await http()
      .post('/auth/login')
      .send({ email: 'a@test.local', password: 'wrong' })
      .expect(401)
  })

  it('settings: requires a token (401)', async () => {
    await http().get('/settings').expect(401)
  })

  it("settings: A's change does not affect B", async () => {
    await http()
      .patch('/settings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ theme: 'dark' })
      .expect(200)
    const a = await http()
      .get('/settings')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(a.body.theme).toBe('dark')
    const b = await http()
      .get('/settings')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    expect(b.body.theme).toBe('system') // B keeps their own default
  })

  it('settings: rejects an invalid value (400)', async () => {
    await http()
      .patch('/settings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ theme: 'neon' })
      .expect(400)
  })
})
