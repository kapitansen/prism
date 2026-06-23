import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { All, Controller, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'

import { AuthUser } from '../auth/auth-user.interface'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { McpService } from './mcp.service'

// Prism's MCP server over Streamable HTTP. Authenticated with the same JWT as
// the REST API (Bearer), so every tool call is scoped to the token's user.
// Stateless: a fresh per-user MCP server + transport per request.
@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @All()
  async handle(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const server = this.mcp.buildServer(user.id)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body as unknown)
  }
}
