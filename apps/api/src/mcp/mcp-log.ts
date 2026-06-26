import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Audit trail of EVERY MCP tool call the AI makes (reads and writes) during
// analysis — so the owner can see exactly what the model requested and changed.
// Contains personal data → lives under personal/ (git-ignored). Shares the
// PRISM_PARSE_LOG toggle; never runs in tests.
const ENABLED =
  process.env.PRISM_PARSE_LOG !== '0' && process.env.NODE_ENV !== 'test'
const LOG_DIR =
  process.env.PRISM_MCP_LOG_DIR ??
  join(process.cwd(), '..', '..', 'personal', 'mcp-log')

export interface McpCallLog {
  userId: string
  tool: string
  input: Record<string, unknown>
  // Optional extra detail (e.g. what matched, or an old→new profile for writes).
  note?: string
}

// Append one record to a per-day log file. Best-effort: never throws.
export function writeMcpLog(log: McpCallLog): void {
  if (!ENABLED) return
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const now = new Date().toISOString()
    const file = join(LOG_DIR, `${now.slice(0, 10)}.md`)
    const block = [
      `## ${now} · user ${log.userId.slice(0, 8)} · ${log.tool}`,
      `- input: ${JSON.stringify(log.input)}`,
      ...(log.note ? ['', log.note] : []),
      '',
      '---',
      '',
    ].join('\n')
    appendFileSync(file, block, 'utf8')
  } catch {
    // logging must never break a tool call
  }
}
