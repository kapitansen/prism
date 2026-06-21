import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The fixed analysis methodology lives in `skills/` at the repo root (shared and
// version-controlled, one for all users). The API runs from apps/api, so resolve
// two levels up by default; override with SKILLS_DIR (e.g. in prod/tests).
const SKILLS_DIR =
  process.env.SKILLS_DIR ?? join(process.cwd(), '..', '..', 'skills')

export interface Skills {
  core: string
  entryAnalyst: string
}

// Read once and cache: skills change only on deploy (a restart picks them up).
let cache: Skills | null = null

export function loadSkills(): Skills {
  if (!cache) {
    cache = {
      core: readFileSync(join(SKILLS_DIR, 'core.md'), 'utf8'),
      entryAnalyst: readFileSync(join(SKILLS_DIR, 'entry-analyst.md'), 'utf8'),
    }
  }
  return cache
}
