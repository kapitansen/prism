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

// The day's analysis, kept (encrypted) on the entry: answered Q&A across rounds,
// the last LLM proposal (for resume/display), and the committed result (history).
interface AnalysisState {
  answeredQa: { question: string; answer: string }[]
  last?: ParseResponse
  committed?: Extraction
}

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @Inject(LLM_RUNNER) private readonly llm: LlmRunner,
  ) {}

  // One round of the interactive parse. Rounds are stored server-side, so the
  // client only sends the new answers; the parse is refresh-safe and resumable.
  async parse(
    userId: string,
    id: string,
    dto: ParseDayDto,
  ): Promise<ParseResponse> {
    const entry = await this.prisma.entry.findFirst({ where: { id, userId } })
    if (!entry) {
      throw new NotFoundException('Entry not found')
    }

    const state = this.loadState(entry.analysisEnc)
    if (dto.answers?.length) state.answeredQa.push(...dto.answers)

    const values = await this.prisma.metricValue.findMany({
      where: { userId, occurredOn: entry.occurredOn, source: 'manual' },
    })
    const prompt = buildParsePrompt({
      body: this.encryption.decrypt(entry.bodyEnc),
      chips: values.map((v) => ({
        key: v.metricKey,
        value: v.value.toNumber(),
      })),
      answers: state.answeredQa,
    })

    const response = this.validate(await this.llm.run(prompt))
    state.last = response
    await this.saveState(entry.id, state)
    return response
  }

  // Persist a confirmed (user-edited) extraction. Re-checks everything against
  // the user's own data. New entity candidates are auto-created with a minimal
  // stub (no per-candidate confirmation). Status → parsed; analysis kept as
  // history. intents/cbtFlags deferred (no tables yet).
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

    const state = this.loadState(entry.analysisEnc)
    state.committed = ex
    await this.prisma.entry.update({
      where: { id: entry.id },
      data: {
        summaryEnc: this.encryption.encrypt(ex.summary),
        ingestStatus: 'parsed',
        analysisEnc: this.encryption.encrypt(JSON.stringify(state)),
        ...(linkIds.length
          ? { entities: { connect: linkIds.map((eid) => ({ id: eid })) } }
          : {}),
      },
    })

    return { id: entry.id, ingestStatus: 'parsed' as const }
  }

  private loadState(enc: string | null): AnalysisState {
    if (!enc) return { answeredQa: [] }
    return JSON.parse(this.encryption.decrypt(enc)) as AnalysisState
  }

  private saveState(entryId: string, state: AnalysisState) {
    return this.prisma.entry.update({
      where: { id: entryId },
      data: { analysisEnc: this.encryption.encrypt(JSON.stringify(state)) },
    })
  }

  // The LLM returns raw text; trust nothing — it must parse as JSON and satisfy
  // the contract, else it's an upstream failure (retries land here later).
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
