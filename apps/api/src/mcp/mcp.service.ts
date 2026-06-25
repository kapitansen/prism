import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Injectable } from '@nestjs/common'
import { Entity } from '@prisma/client'
import { z } from 'zod'

import { mentioned } from '../analysis/entity-match'
import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'

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
          'return its profile (name, handle, aliases, description, AI digest). ' +
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
          '(or a text snippet). Use it to judge patterns over time — e.g. whether ' +
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
        if (!e) {
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
        return {
          content: [
            { type: 'text', text: `Updated the profile of ${e.name}.` },
          ],
        }
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
      const good = en.goodEnc ? this.encryption.decrypt(en.goodEnc) : ''
      const hard = en.hardEnc ? this.encryption.decrypt(en.hardEnc) : ''
      const body = [good, hard].filter(Boolean).join('\n\n')
      if (!(handleRe?.test(body) || mentioned(body, names))) continue
      const snippet = en.summaryEnc
        ? this.encryption.decrypt(en.summaryEnc)
        : truncate(body, 240)
      hits.push(`${isoDay(en.occurredOn)}: ${snippet}`)
      if (hits.length >= limit) break
    }

    return hits.length
      ? `Entries mentioning ${target.name} (most recent first):\n\n${hits.join('\n\n')}`
      : `No entries mention ${target.name}.`
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
  return [
    `name: ${e.name}`,
    e.handle ? `handle: @${e.handle}` : null,
    `type: ${e.type}`,
    `status: ${e.status}`,
    e.aliases.length ? `aliases: ${e.aliases.join(', ')}` : null,
    e.description ? `description: ${e.description}` : null,
    e.digest ? `\nprofile:\n${e.digest}` : null,
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

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}
