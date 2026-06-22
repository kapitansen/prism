import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  type Extraction,
  extractionSchema,
  type ParseResponse,
  parseResponseSchema,
} from '@prism/shared'
import { Entry } from '@prisma/client'

import { CoachPackService } from '../coach-pack/coach-pack.service'
import { EncryptionService } from '../crypto/encryption.service'
import { LLM_RUNNER, type LlmRunner } from '../llm/llm-runner.port'
import { PrismaService } from '../prisma/prisma.service'
import { ParseDayDto } from './dto/parse-day.dto'
import { mentioned } from './entity-match'
import { writeParseLog } from './parse-log'
import { buildParsePrompt, type ParseContext } from './prompt'
import { loadSkills } from './skills'

// The day's analysis, kept (encrypted) on the entry: answered Q&A across rounds,
// the last LLM proposal (for resume/display), and the committed result (history).
interface AnalysisState {
  answeredQa: { question: string; answer: string }[]
  last?: ParseResponse
  committed?: Extraction
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly coachPack: CoachPackService,
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

    const body = this.encryption.decrypt(entry.bodyEnc)
    const [values, coach, metricDefs, context] = await Promise.all([
      this.prisma.metricValue.findMany({
        where: { userId, occurredOn: entry.occurredOn, source: 'manual' },
      }),
      this.coachPack.getActive(userId),
      this.prisma.metricDefinition.findMany({ where: { userId } }),
      this.buildContext(userId, entry, body),
    ])
    const prompt = buildParsePrompt({
      skills: loadSkills(),
      coach: { analysisMd: coach.analysisMd },
      // Only the metrics the user actively tracks (enabled in settings).
      metricDefs: metricDefs
        .filter((d) => d.enabled)
        .map((d) => ({
          key: d.key,
          name: d.name,
          unit: d.unit,
          scaleMin: d.scaleMin,
          scaleMax: d.scaleMax,
          source: d.source,
        })),
      body,
      chips: values.map((v) => ({
        key: v.metricKey,
        value: v.value.toNumber(),
      })),
      answers: state.answeredQa,
      context,
    })

    const result = await this.llm.run(prompt)
    const raw = result.text
    const round = state.answeredQa.length
    const runner = process.env.LLM_RUNNER ?? 'claude-code'
    const logBase = {
      entryId: entry.id,
      occurredOn: dayIso(entry.occurredOn),
      round,
      runner,
      prompt,
      raw,
      usage: result.usage,
    }

    let response: ParseResponse
    try {
      response = this.validate(raw)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid output'
      const file = writeParseLog({ ...logBase, outcome: `ERROR: ${msg}` })
      this.logger.warn(`parse round ${round} FAILED${file ? ` → ${file}` : ''}`)
      throw err
    }

    const file = writeParseLog({ ...logBase, outcome: response.status })
    const u = result.usage
    this.logger.log(
      `parse round ${round} → ${response.status}` +
        (u
          ? ` (in=${u.inputTokens} out=${u.outputTokens}, ${u.durationMs != null ? `${(u.durationMs / 1000).toFixed(1)}s` : '?'})`
          : '') +
        (file ? ` → ${file}` : ''),
    )
    state.last = response
    await this.saveState(entry.id, state)
    return response
  }

  // Pull grounding context from the DB (spec layer 5): the user's entities (as
  // candidates for existingId), dossiers of those likely mentioned today, CBT
  // cards, and the few preceding days. All decrypted in memory.
  private async buildContext(
    userId: string,
    entry: Entry,
    body: string,
  ): Promise<ParseContext> {
    const [entities, cbtCards, recent] = await Promise.all([
      this.prisma.entity.findMany({ where: { userId } }),
      this.prisma.cbtCard.findMany({ where: { userId } }),
      this.prisma.entry.findMany({
        where: { userId, occurredOn: { lt: entry.occurredOn } },
        orderBy: { occurredOn: 'desc' },
        take: 5,
      }),
    ])

    const decrypted = entities.map((e) => ({
      id: e.id,
      name: this.encryption.decrypt(e.nameEnc),
      handle: e.handleEnc ? this.encryption.decrypt(e.handleEnc) : null,
      aliases: e.aliasesEnc
        ? (JSON.parse(this.encryption.decrypt(e.aliasesEnc)) as string[])
        : [],
      type: e.type,
      // AI-maintained dossier, falling back to the human-written description.
      summary: e.digestEnc
        ? this.encryption.decrypt(e.digestEnc)
        : e.descriptionEnc
          ? this.encryption.decrypt(e.descriptionEnc)
          : null,
    }))

    return {
      entities: decrypted.map(({ id, name, handle, aliases, type }) => ({
        id,
        name,
        handle,
        aliases,
        type,
      })),
      dossiers: decrypted
        .filter((e) => e.summary && mentioned(body, [e.name, ...e.aliases]))
        .map((e) => ({ name: e.name, summary: e.summary as string })),
      cbtCards: cbtCards.map((c) => ({
        id: c.id,
        title: this.encryption.decrypt(c.titleEnc),
      })),
      recentDays: recent.map((r) => ({
        date: dayIso(r.occurredOn),
        // Prefer the AI summary; otherwise the full text — no arbitrary cut.
        text: r.summaryEnc
          ? this.encryption.decrypt(r.summaryEnc)
          : this.encryption.decrypt(r.bodyEnc),
      })),
    }
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

function dayIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}
