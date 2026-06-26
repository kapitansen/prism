import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Injectable, Logger } from '@nestjs/common'
import { Entity } from '@prisma/client'
import { z } from 'zod'

import { mentioned } from '../analysis/entity-match'
import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'
import { writeEntityUpdateLog } from './entity-update-log'

// An entity with its *_enc fields decrypted, for in-memory matching/formatting.
interface DecryptedEntity {
  id: string
  name: string
  handle: string | null
  aliases: string[]
  description: string | null
  digest: string | null
  type: string
  status: string
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // A fresh MCP server scoped to one user. Stateless HTTP → one per request, so
  // the user id is baked into every tool and tenant isolation can't leak.
  buildServer(userId: string): McpServer {
    const server = new McpServer({ name: 'prism', version: '0.1.0' })

    server.registerTool(
      'get_entity',
      {
        title: 'Get entity profile',
        description:
          'Look up a person/project/habit/event by @handle, name, or alias and ' +
          'return its profile (name, handle, aliases, and a short profile note). ' +
          'Use it during analysis to understand who/what a mention refers to.',
        inputSchema: {
          query: z.string().describe('A @handle, name, or alias'),
        },
      },
      async ({ query }: { query: string }) => {
        const e = this.match(await this.loadEntities(userId), query)
        return {
          content: [
            { type: 'text', text: e ? formatProfile(e) : notFound(query) },
          ],
        }
      },
    )

    server.registerTool(
      'find_entries_mentioning',
      {
        title: 'Find entries mentioning an entity',
        description:
          "Find the user's past journal entries that mention an entity (by " +
          '@handle, name, or alias), most recent first. Returns date + summary ' +
          '(or the full entry text). Use it to judge patterns over time — e.g. ' +
          'whether ' +
          'arguments with someone tend to be constructive or draining.',
        inputSchema: {
          query: z.string().describe('A @handle, name, or alias'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe('Max entries (default 10)'),
        },
      },
      async ({ query, limit }: { query: string; limit?: number }) => {
        const text = await this.findMentions(userId, query, limit ?? 10)
        return { content: [{ type: 'text', text }] }
      },
    )

    server.registerTool(
      'update_entity',
      {
        title: 'Update an entity profile',
        description:
          'Update the AI profile (digest) of a person/project/habit/event the ' +
          'user ALREADY has, found by @handle, name, or alias. Use it when an ' +
          'entry holds durable information worth remembering (e.g. a new fact ' +
          'about someone). First read the current profile with get_entity, merge ' +
          'in the new facts, and pass the FULL updated profile — it replaces the ' +
          'old digest. Never creates an entity; if none matches it does nothing.',
        inputSchema: {
          query: z
            .string()
            .describe('A @handle, name, or alias of an existing entity'),
          digest: z
            .string()
            .min(1)
            .describe('The full updated profile text (replaces the old one)'),
        },
      },
      async ({ query, digest }: { query: string; digest: string }) => {
        const e = this.match(await this.loadEntities(userId), query)
        // Audit every attempt — including misses — since the AI writes on its own.
        if (!e) {
          writeEntityUpdateLog({
            userId,
            query,
            matched: null,
            oldDigest: null,
            newDigest: digest,
          })
          this.logger.warn(`update_entity: no match for "${query}" (no change)`)
          return { content: [{ type: 'text', text: notFound(query) }] }
        }
        // Scope by userId too (defence in depth — e.id is already the user's).
        await this.prisma.entity.updateMany({
          where: { id: e.id, userId },
          data: {
            digestEnc: this.encryption.encrypt(digest),
            digestUpdatedAt: new Date(),
          },
        })
        writeEntityUpdateLog({
          userId,
          query,
          matched: { id: e.id, name: e.name },
          oldDigest: e.digest,
          newDigest: digest,
        })
        this.logger.log(
          `update_entity: "${e.name}" (${e.id.slice(0, 8)}) profile updated`,
        )
        return {
          content: [
            { type: 'text', text: `Updated the profile of ${e.name}.` },
          ],
        }
      },
    )

    server.registerTool(
      'get_entries_on_date',
      {
        title: 'Get entries on a date',
        description:
          "Return the user's journal entries for a specific day (YYYY-MM-DD), " +
          'including any multi-day entry that spans it. Each entry is its AI ' +
          'summary, or the full text if it has not been analyzed yet.',
        inputSchema: {
          date: z.string().describe('A day, YYYY-MM-DD'),
        },
      },
      async ({ date }: { date: string }) => {
        const text = await this.entriesInWindow(userId, date, date, 50)
        return { content: [{ type: 'text', text }] }
      },
    )

    server.registerTool(
      'get_entries_in_range',
      {
        title: 'Get entries in a date range',
        description:
          "Return the user's journal entries between two dates inclusive " +
          '(YYYY-MM-DD), oldest first. Each entry is its AI summary, or the full ' +
          'text if not analyzed yet. Wide ranges are capped by count (the reply ' +
          'says so) — narrow the range or raise limit; text is never truncated.',
        inputSchema: {
          from: z.string().describe('Start day, YYYY-MM-DD'),
          to: z.string().describe('End day, YYYY-MM-DD'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .optional()
            .describe('Max entries (default 50)'),
        },
      },
      async ({
        from,
        to,
        limit,
      }: {
        from: string
        to: string
        limit?: number
      }) => {
        const text = await this.entriesInWindow(userId, from, to, limit ?? 50)
        return { content: [{ type: 'text', text }] }
      },
    )

    return server
  }

  // Decrypt all of the user's entities once (small set, encrypted at rest).
  private async loadEntities(userId: string): Promise<DecryptedEntity[]> {
    const rows = await this.prisma.entity.findMany({ where: { userId } })
    return rows.map((e: Entity) => ({
      id: e.id,
      name: this.encryption.decrypt(e.nameEnc),
      handle: e.handleEnc ? this.encryption.decrypt(e.handleEnc) : null,
      aliases: e.aliasesEnc
        ? (JSON.parse(this.encryption.decrypt(e.aliasesEnc)) as string[])
        : [],
      description: e.descriptionEnc
        ? this.encryption.decrypt(e.descriptionEnc)
        : null,
      digest: e.digestEnc ? this.encryption.decrypt(e.digestEnc) : null,
      type: e.type,
      status: e.status,
    }))
  }

  // Exact match by handle / name / alias (case-insensitive, @ optional).
  private match(
    entities: DecryptedEntity[],
    query: string,
  ): DecryptedEntity | null {
    const q = query.replace(/^@/, '').toLowerCase().trim()
    return (
      entities.find(
        (e) =>
          (e.handle && e.handle.toLowerCase() === q) ||
          e.name.toLowerCase() === q ||
          e.aliases.some((a) => a.toLowerCase() === q),
      ) ?? null
    )
  }

  // Entries whose text mentions the entity (by @handle or by name/alias), newest
  // first. Encrypted text isn't SQL-searchable, so we decrypt + match in memory.
  private async findMentions(
    userId: string,
    query: string,
    limit: number,
  ): Promise<string> {
    const target = this.match(await this.loadEntities(userId), query)
    if (!target) return notFound(query)

    const names = [target.name, ...target.aliases]
    const handleRe = target.handle
      ? new RegExp(`@${escapeRegex(target.handle)}\\b`, 'i')
      : null
    const entries = await this.prisma.entry.findMany({
      where: { userId },
      orderBy: { occurredOn: 'desc' },
    })

    const hits: string[] = []
    for (const en of entries) {
      const body = this.entryFullText(en)
      if (!(handleRe?.test(body) || mentioned(body, names))) continue
      hits.push(`${isoDay(en.occurredOn)}: ${this.entryDisplay(en)}`)
      if (hits.length >= limit) break
    }

    return hits.length
      ? `Entries mentioning ${target.name} (most recent first):\n\n${hits.join('\n\n')}`
      : `No entries mention ${target.name}.`
  }

  // The full plaintext of an entry: both sides joined. Never truncated.
  private entryFullText(en: {
    goodEnc: string | null
    hardEnc: string | null
  }): string {
    return [
      en.goodEnc ? this.encryption.decrypt(en.goodEnc) : '',
      en.hardEnc ? this.encryption.decrypt(en.hardEnc) : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  // What to show for an entry: the AI summary if present, else the full text.
  private entryDisplay(en: {
    summaryEnc: string | null
    goodEnc: string | null
    hardEnc: string | null
  }): string {
    return en.summaryEnc
      ? this.encryption.decrypt(en.summaryEnc)
      : this.entryFullText(en)
  }

  // Entries overlapping [from, to] (inclusive, YYYY-MM-DD), oldest first. Covers
  // multi-day entries that span the window. Capped by count (reported, never a
  // text cut) to respect the MCP token budget.
  private async entriesInWindow(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<string> {
    const fromD = new Date(`${from}T00:00:00Z`)
    const toD = new Date(`${to}T00:00:00Z`)
    const rows = await this.prisma.entry.findMany({
      where: {
        userId,
        occurredOn: { lte: toD },
        // entry end (occurredTo, else occurredOn) >= window start
        OR: [
          { occurredTo: { gte: fromD } },
          { occurredTo: null, occurredOn: { gte: fromD } },
        ],
      },
      orderBy: { occurredOn: 'asc' },
      take: limit + 1, // +1 to detect "there's more" without counting all
    })
    const label = from === to ? from : `${from}–${to}`
    if (!rows.length) return `No entries for ${label}.`

    const more = rows.length > limit
    const shown = more ? rows.slice(0, limit) : rows
    const lines = shown.map((en) => {
      const span =
        en.occurredTo && isoDay(en.occurredTo) !== isoDay(en.occurredOn)
          ? `${isoDay(en.occurredOn)}–${isoDay(en.occurredTo)}`
          : isoDay(en.occurredOn)
      return `${span} (${en.type}): ${this.entryDisplay(en)}`
    })
    let out = `Entries for ${label} (oldest first):\n\n${lines.join('\n\n')}`
    if (more) {
      out += `\n\n(showing ${shown.length} of more than ${limit} — narrow the range or raise limit; text is never truncated)`
    }
    return out
  }
}

function formatProfile(e: {
  name: string
  handle: string | null
  type: string
  status: string
  aliases: string[]
  description: string | null
  digest: string | null
}): string {
  // Prefer the AI-maintained digest (kept short and current); fall back to the
  // user's description. Never send both — keep the response compact.
  const profile = e.digest ?? e.description
  return [
    `name: ${e.name}`,
    e.handle ? `handle: @${e.handle}` : null,
    `type: ${e.type}`,
    `status: ${e.status}`,
    e.aliases.length ? `aliases: ${e.aliases.join(', ')}` : null,
    profile ? `\nprofile:\n${profile}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function notFound(query: string): string {
  return `No entity found for "${query}".`
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}
