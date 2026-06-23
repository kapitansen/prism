import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'

import { EncryptionService } from '../crypto/encryption.service'
import { PrismaService } from '../prisma/prisma.service'

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
        const profile = await this.findEntity(userId, query)
        return {
          content: [
            {
              type: 'text',
              text: profile ?? `No entity found for "${query}".`,
            },
          ],
        }
      },
    )

    return server
  }

  // Match an entity by exact handle / name / alias (case-insensitive), decrypt
  // and format its profile. All of the user's entities decrypt in memory.
  private async findEntity(
    userId: string,
    query: string,
  ): Promise<string | null> {
    const q = query.replace(/^@/, '').toLowerCase().trim()
    const entities = await this.prisma.entity.findMany({ where: { userId } })
    for (const e of entities) {
      const name = this.encryption.decrypt(e.nameEnc)
      const handle = e.handleEnc ? this.encryption.decrypt(e.handleEnc) : ''
      const aliases = e.aliasesEnc
        ? (JSON.parse(this.encryption.decrypt(e.aliasesEnc)) as string[])
        : []
      const hit =
        handle.toLowerCase() === q ||
        name.toLowerCase() === q ||
        aliases.some((a) => a.toLowerCase() === q)
      if (!hit) continue

      const description = e.descriptionEnc
        ? this.encryption.decrypt(e.descriptionEnc)
        : null
      const digest = e.digestEnc ? this.encryption.decrypt(e.digestEnc) : null
      return [
        `name: ${name}`,
        handle ? `handle: @${handle}` : null,
        `type: ${e.type}`,
        `status: ${e.status}`,
        aliases.length ? `aliases: ${aliases.join(', ')}` : null,
        description ? `description: ${description}` : null,
        digest ? `\nprofile:\n${digest}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    }
    return null
  }
}
