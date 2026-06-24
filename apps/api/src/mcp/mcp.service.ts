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
      const body = this.encryption.decrypt(en.bodyEnc)
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
