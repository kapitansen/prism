import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  type Extraction,
  extractionSchema,
  type ParseResponse,
  parseResponseSchema,
} from '@prism/shared'

import { EncryptionService } from '../crypto/encryption.service'
import { LLM_RUNNER, type LlmRunner } from '../llm/llm-runner.port'
import { PrismaService } from '../prisma/prisma.service'
import { ParseDayDto } from './dto/parse-day.dto'
import { buildParsePrompt } from './prompt'

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @Inject(LLM_RUNNER) private readonly llm: LlmRunner,
  ) {}

  // One interactive parse round: build context → ask the LLM → validate against
  // the contract. Returns clarify questions or the complete extraction. Nothing
  // is committed here (the user reviews/edits, then commits separately).
  async parse(
    userId: string,
    id: string,
    dto: ParseDayDto,
  ): Promise<ParseResponse> {
    const entry = await this.prisma.entry.findFirst({ where: { id, userId } })
    if (!entry) {
      throw new NotFoundException('Entry not found')
    }

    const values = await this.prisma.metricValue.findMany({
      where: { userId, occurredOn: entry.occurredOn, source: 'manual' },
    })

    const prompt = buildParsePrompt({
      body: this.encryption.decrypt(entry.bodyEnc),
      chips: values.map((v) => ({
        key: v.metricKey,
        value: v.value.toNumber(),
      })),
      answers: dto.answers ?? [],
    })

    return this.validate(await this.llm.run(prompt))
  }

  // Persist a confirmed (possibly user-edited) extraction: summary → entry,
  // metrics → metric_values (extracted), entities → links / new rows. Re-checks
  // everything against the user's own data — never trust the payload blindly.
  // intents/cbtFlags are deferred (no tables yet). Status → parsed.
  async commit(userId: string, id: string, body: unknown) {
    const entry = await this.prisma.entry.findFirst({ where: { id, userId } })
    if (!entry) {
      throw new NotFoundException('Entry not found')
    }
    const parsed = extractionSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException('Invalid extraction payload')
    }
    const ex: Extraction = parsed.data

    // Metrics — only keys the user actually has, values within scale.
    const defs = await this.prisma.metricDefinition.findMany({
      where: { userId },
    })
    const defByKey = new Map(defs.map((d) => [d.key, d]))
    for (const m of ex.metrics) {
      const def = defByKey.get(m.key)
      if (!def) continue
      if (
        def.scaleMin !== null &&
        def.scaleMax !== null &&
        (m.value < def.scaleMin || m.value > def.scaleMax)
      ) {
        continue
      }
      const occurredOn = m.occurredOn
        ? new Date(m.occurredOn)
        : entry.occurredOn
      await this.prisma.metricValue.upsert({
        where: {
          userId_metricKey_occurredOn_source: {
            userId,
            metricKey: m.key,
            occurredOn,
            source: 'extracted',
          },
        },
        update: { value: m.value, entryId: entry.id },
        create: {
          userId,
          metricKey: m.key,
          occurredOn,
          source: 'extracted',
          value: m.value,
          entryId: entry.id,
        },
      })
    }

    // Entities — link matches (verified as the user's), create confirmed
    // candidates, then connect all to this entry.
    const linkIds: string[] = []
    for (const e of ex.entities) {
      if (e.existingId) {
        const existing = await this.prisma.entity.findFirst({
          where: { id: e.existingId, userId },
        })
        if (existing) linkIds.push(existing.id)
      } else {
        const created = await this.prisma.entity.create({
          data: {
            userId,
            type: e.type,
            nameEnc: this.encryption.encrypt(e.name),
          },
        })
        linkIds.push(created.id)
      }
    }

    await this.prisma.entry.update({
      where: { id: entry.id },
      data: {
        summaryEnc: this.encryption.encrypt(ex.summary),
        ingestStatus: 'parsed',
        ...(linkIds.length
          ? { entities: { connect: linkIds.map((eid) => ({ id: eid })) } }
          : {}),
      },
    })

    return { id: entry.id, ingestStatus: 'parsed' as const }
  }

  // The LLM returns raw text; trust nothing — it must parse as JSON and satisfy
  // the contract, else it's an upstream failure. (Retries land here with the
  // real runner; FakeRunner is always valid.)
  private validate(raw: string): ParseResponse {
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      throw new BadGatewayException('LLM returned invalid JSON')
    }
    const result = parseResponseSchema.safeParse(json)
    if (!result.success) {
      throw new BadGatewayException('LLM output failed contract validation')
    }
    return result.data
  }
}
