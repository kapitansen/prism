import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { hash } from '@node-rs/argon2'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from './app.module'
import { FakeRunner } from './llm/fake-runner'
import { PrismaService } from './prisma/prisma.service'

describe('Tenant isolation (API)', () => {
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
    const a = await prisma.user.create({
      data: { email: 'a@test.local', passwordHash },
    })
    const b = await prisma.user.create({
      data: { email: 'b@test.local', passwordHash },
    })
    // recordValue requires a defined metric — give both users a 'mood' chip.
    for (const u of [a, b]) {
      await prisma.metricDefinition.create({
        data: {
          userId: u.id,
          key: 'mood',
          name: 'Mood',
          scaleMin: 1,
          scaleMax: 5,
          source: 'manual',
        },
      })
    }

    tokenA = await login('a@test.local')
    tokenB = await login('b@test.local')
  })

  beforeEach(async () => {
    // Each test starts with no per-tenant data (users/tokens stay).
    await prisma.entry.deleteMany()
    await prisma.entity.deleteMany()
    await prisma.metricValue.deleteMany()
    await prisma.cbtCard.deleteMany()
    await prisma.coachPackVersion.deleteMany()
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

  async function createEntityAs(token: string): Promise<string> {
    const res = await http()
      .post('/entities')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'person', name: 'Вася' })
      .expect(201)
    return res.body.id as string
  }

  async function createCardAs(token: string): Promise<string> {
    const res = await http()
      .post('/cbt-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'триггер', explanation: 'основной текст' })
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

  it("entities: B cannot read A's entity (404)", async () => {
    const id = await createEntityAs(tokenA)
    await http()
      .get(`/entities/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })

  it("entities: B does not see A's entities in their list", async () => {
    await createEntityAs(tokenA)
    const res = await http()
      .get('/entities')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    expect(res.body).toHaveLength(0)
  })

  it("entities: B cannot delete A's entity, and A still has it", async () => {
    const id = await createEntityAs(tokenA)
    await http()
      .delete(`/entities/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
    await http()
      .get(`/entities/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
  })

  it("entities: B cannot update A's entity; A's name is unchanged", async () => {
    const id = await createEntityAs(tokenA)
    await http()
      .patch(`/entities/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'hacked by B' })
      .expect(404)
    const res = await http()
      .get(`/entities/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(res.body.name).toBe('Вася')
  })

  it("metrics: A's value is not visible to B", async () => {
    await http()
      .put('/metrics/values')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ metricKey: 'mood', value: 4, occurredOn: '2026-06-16' })
      .expect(200)
    const a = await http()
      .get('/metrics/values')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(a.body).toHaveLength(1)
    const b = await http()
      .get('/metrics/values')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    expect(b.body).toHaveLength(0)
  })

  it('metrics: requires a token (401)', async () => {
    await http().get('/metrics/values').expect(401)
  })

  it('metrics: rejects an unknown metric key (400)', async () => {
    await http()
      .put('/metrics/values')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ metricKey: 'not-a-metric', value: 5, occurredOn: '2026-06-16' })
      .expect(400)
  })

  it('metrics: rejects a value outside the metric scale (400)', async () => {
    await http()
      .put('/metrics/values')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ metricKey: 'mood', value: 99, occurredOn: '2026-06-16' })
      .expect(400)
  })

  it("cbt: B cannot read A's card (404)", async () => {
    const id = await createCardAs(tokenA)
    await http()
      .get(`/cbt-cards/${id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })

  it('cbt: conviction 0 removes the card from the deck; >10 is rejected', async () => {
    const id = await createCardAs(tokenA)
    await http()
      .patch(`/cbt-cards/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isFavorite: true })
      .expect(200)
    const dropped = await http()
      .patch(`/cbt-cards/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ conviction: 0 })
      .expect(200)
    expect(dropped.body.isFavorite).toBe(false)
    expect(dropped.body.conviction).toBe(0)
    await http()
      .patch(`/cbt-cards/${id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ conviction: 11 })
      .expect(400)
  })

  it('entries: filters by day and type', async () => {
    const post = (type: string, occurredOn: string) =>
      http()
        .post('/entries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type, body: 'x', occurredOn })
        .expect(201)
    await post('daily', '2026-06-18')
    await post('note', '2026-06-18')
    await post('daily', '2026-06-19')

    const day = await http()
      .get('/entries?on=2026-06-18')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(day.body).toHaveLength(2)

    const dailyOnDay = await http()
      .get('/entries?on=2026-06-18&type=daily')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(dailyOnDay.body).toHaveLength(1)
    expect(dailyOnDay.body[0].type).toBe('daily')

    const emptyDay = await http()
      .get('/entries?on=2000-01-01')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(emptyDay.body).toHaveLength(0)
  })

  it("entries: finalize closes a draft (→ pending); B cannot finalize A's", async () => {
    const id = await createEntryAs(tokenA) // created as draft
    await http()
      .post(`/entries/${id}/finalize`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
    const res = await http()
      .post(`/entries/${id}/finalize`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201)
    expect(res.body.ingestStatus).toBe('pending')
  })

  it('coach-pack: GET auto-seeds a default active version', async () => {
    const res = await http()
      .get('/coach-pack')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(res.body.id).toBeTruthy()
    expect(res.body.voiceMd).toBeTruthy()
  })

  it('coach-pack: saving a version makes it active; history kept', async () => {
    await http()
      .get('/coach-pack')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    const created = await http()
      .post('/coach-pack/versions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ analysisMd: 'a2', voiceMd: 'v2', sourceNote: 'test' })
      .expect(201)
    const active = await http()
      .get('/coach-pack')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(active.body.id).toBe(created.body.id)
    expect(active.body.voiceMd).toBe('v2')
    const versions = await http()
      .get('/coach-pack/versions')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
    expect(versions.body.length).toBeGreaterThanOrEqual(2)
  })

  it("coach-pack: B cannot see or activate A's version", async () => {
    const created = await http()
      .post('/coach-pack/versions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ analysisMd: 'a', voiceMd: 'v' })
      .expect(201)
    const bList = await http()
      .get('/coach-pack/versions')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
    expect(
      bList.body.find((v: { id: string }) => v.id === created.body.id),
    ).toBeUndefined()
    await http()
      .post(`/coach-pack/versions/${created.body.id}/activate`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })

  it('coach-pack: requires a token (401)', async () => {
    await http().get('/coach-pack').expect(401)
  })

  it("ingestion: B cannot parse A's entry (404)", async () => {
    const id = await createEntryAs(tokenA)
    await http()
      .post(`/entries/${id}/parse`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(404)
  })

  it('ingestion: parse returns a complete extraction (fake)', async () => {
    const id = await createEntryAs(tokenA)
    const res = await http()
      .post(`/entries/${id}/parse`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201)
    expect(res.body.status).toBe('complete')
    expect(res.body.summary).toBeTruthy()
  })

  it('ingestion: parse returns clarify questions when the runner asks', async () => {
    const id = await createEntryAs(tokenA)
    app.get(FakeRunner).enqueue({
      status: 'needs_clarification',
      clarifyQuestions: [{ question: 'как спал?' }],
    })
    const res = await http()
      .post(`/entries/${id}/parse`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201)
    expect(res.body.status).toBe('needs_clarification')
    expect(res.body.clarifyQuestions[0].question).toBe('как спал?')
  })

  it('ingestion: parse requires a token (401)', async () => {
    await http()
      .post('/entries/00000000-0000-0000-0000-000000000000/parse')
      .expect(401)
  })
})
