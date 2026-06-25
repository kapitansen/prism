import { existsSync, readFileSync } from 'node:fs'
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

// Read once per variant and cache: skills change only on deploy (a restart picks
// them up). `local` uses the git-ignored `*.local.md` working copies when present
// (Eugene edits the methodology in Russian there); `base` always uses the
// committed English `*.md`.
const cache: Record<'base' | 'local', Skills | null> = {
  base: null,
  local: null,
}

// Read `<name>.md`, or its `<name>.local.md` twin when preferLocal and it exists.
function readSkill(name: string, preferLocal: boolean): string {
  if (preferLocal) {
    const local = join(SKILLS_DIR, `${name}.local.md`)
    if (existsSync(local)) return readFileSync(local, 'utf8')
  }
  return readFileSync(join(SKILLS_DIR, `${name}.md`), 'utf8')
}

export function loadSkills(preferLocal = false): Skills {
  const key = preferLocal ? 'local' : 'base'
  cache[key] ??= {
    core: readSkill('core', preferLocal),
    entryAnalyst: readSkill('entry-analyst', preferLocal),
  }
  return cache[key]
}
