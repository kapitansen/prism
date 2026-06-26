import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Audit trail for the AI's writes through the MCP layer: every update_entity
// attempt (including no-match misses), with the old and new profile text. The
// AI writes autonomously mid-analysis, so this lets the owner review what it
// changed. Contains personal data → lives under personal/ (git-ignored).
//
// Shares the PRISM_PARSE_LOG toggle; never runs in tests.
const ENABLED =
  process.env.PRISM_PARSE_LOG !== '0' && process.env.NODE_ENV !== 'test'
const LOG_DIR =
  process.env.PRISM_ENTITY_LOG_DIR ??
  join(process.cwd(), '..', '..', 'personal', 'entity-updates')

export interface EntityUpdateLog {
  userId: string
  query: string
  // The matched entity, or null when nothing matched (the attempt is still logged).
  matched: { id: string; name: string } | null
  oldDigest: string | null
  newDigest: string
}

// Append one record to a per-day log file. Best-effort: never throws.
export function writeEntityUpdateLog(log: EntityUpdateLog): void {
  if (!ENABLED) return
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const now = new Date().toISOString()
    const file = join(LOG_DIR, `${now.slice(0, 10)}.md`)
    const target = log.matched
      ? `"${log.matched.name}" (${log.matched.id})`
      : 'NO MATCH (no change)'
    const block = [
      `## ${now} · user ${log.userId.slice(0, 8)}`,
      `- query: "${log.query}" → ${target}`,
      '',
      '--- OLD profile ---',
      log.oldDigest ?? '(none)',
      '',
      '--- NEW profile ---',
      log.newDigest,
      '',
      '---',
      '',
    ].join('\n')
    appendFileSync(file, block, 'utf8')
  } catch {
    // logging must never break a tool call
  }
}
