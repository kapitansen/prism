import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Debug logging for the analysis: dumps the exact prompt sent to the LLM and the
// raw text it returned, one file per parse round. The prompt contains personal
// journal text + dossiers, so logs live under personal/ (git-ignored).
//
// Enabled by default in dev; disable with PRISM_PARSE_LOG=0. Never runs in tests.
const ENABLED =
  process.env.PRISM_PARSE_LOG !== '0' && process.env.NODE_ENV !== 'test'
const LOG_DIR =
  process.env.PRISM_PARSE_LOG_DIR ??
  join(process.cwd(), '..', '..', 'personal', 'parse-logs')

export interface ParseLog {
  entryId: string
  occurredOn: string
  round: number
  runner: string
  model?: string
  effort?: string
  prompt: string
  raw: string
  outcome: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    costUsd?: number
    durationMs?: number
  }
}

// Writes the log and returns the file path (or null if disabled/failed), so the
// caller can surface it. Logging must never break a parse — errors are swallowed.
export function writeParseLog(log: ParseLog): string | null {
  if (!ENABLED) return null
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = join(
      LOG_DIR,
      `${log.occurredOn}__${log.entryId.slice(0, 8)}__r${log.round}__${stamp}.md`,
    )
    const u = log.usage
    const content = [
      '# parse log',
      `- entry: ${log.entryId} (${log.occurredOn})`,
      `- round: ${log.round}`,
      `- runner: ${log.runner}`,
      `- model: ${log.model ?? '(cli default)'} | effort: ${log.effort ?? '(cli default)'}`,
      `- outcome: ${log.outcome}`,
      `- tokens: in=${u?.inputTokens ?? '?'} out=${u?.outputTokens ?? '?'}`,
      `- cost: ${u?.costUsd != null ? `$${u.costUsd.toFixed(4)}` : '?'}`,
      `- duration: ${u?.durationMs != null ? `${(u.durationMs / 1000).toFixed(1)}s` : '?'}`,
      '',
      '## PROMPT → sent to the AI',
      '',
      '````````',
      log.prompt,
      '````````',
      '',
      '## RAW RESPONSE → from the AI',
      '',
      '````````',
      log.raw,
      '````````',
      '',
    ].join('\n')
    writeFileSync(file, content, 'utf8')
    return file
  } catch {
    return null
  }
}
