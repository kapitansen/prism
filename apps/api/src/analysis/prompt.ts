import type { Skills } from './skills'

// Metric definition fields the prompt needs to list valid keys for extraction.
interface MetricDef {
  key: string
  name: string
  unit: string | null
  scaleMin: number | null
  scaleMax: number | null
  source: string
}

// Context pushed from the DB so the LLM can ground its analysis (spec layer 5).
export interface ParseContext {
  // All of the user's entities — the candidate list for setting existingId.
  entities: {
    id: string
    name: string
    handle: string | null
    aliases: string[]
    type: string
  }[]
  // Summaries of entities likely mentioned today (AI digest, else human note).
  dossiers: { name: string; summary: string }[]
  // CBT cards (trigger thoughts), so the LLM can raise cbtFlags by id.
  cbtCards: { id: string; title: string }[]
  // The few preceding days (AI summary, else raw text), for continuity.
  recentDays: { date: string; text: string }[]
}

// Assembles the full parse prompt in layers (spec §5.2):
//   1. methodology  — skills/core.md + entry-analyst.md (fixed, in repo)
//   2. coach pack   — analysis_md (per-user analysis tuning; voice is NOT here,
//                     it belongs to the read-time companion, not extraction)
//   3. data         — the day's text, manual chips, answered clarifications,
//                     and the catalog of extractable metric keys
//   4. context      — DB-pushed entities, dossiers, CBT cards, recent days
export function buildParsePrompt(input: {
  skills: Skills
  coach: { analysisMd: string }
  metricDefs: MetricDef[]
  body: string
  chips: { key: string; value: number }[]
  answers: { question: string; answer: string }[]
  context: ParseContext
}): string {
  const metricList = input.metricDefs.length
    ? input.metricDefs.map((d) => `- ${describeMetric(d)}`).join('\n')
    : '—'
  const chips = input.chips.length
    ? input.chips.map((c) => `${c.key}=${c.value}`).join(', ')
    : '—'
  const qa = input.answers.length
    ? input.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
    : '—'

  return [
    section(
      'METHODOLOGY',
      `${input.skills.core}\n\n${input.skills.entryAnalyst}`,
    ),
    section('COACH SETTINGS — ANALYSIS', input.coach.analysisMd),
    section(
      'DAY DATA',
      [
        `Metrics available for extraction from the text (use only these keys):\n${metricList}`,
        '',
        `Metrics the user already marked (chips): ${chips}`,
        'No need to extract those again.',
        '',
        `Day text:\n${input.body}`,
        '',
        `Answers to clarifying questions:\n${qa}`,
      ].join('\n'),
    ),
    section('CONTEXT FROM THE DATABASE', buildContextBlock(input.context)),
    'Return ONLY JSON per the extraction contract. No markdown fences.',
  ].join('\n\n')
}

function buildContextBlock(ctx: ParseContext): string {
  const entities = ctx.entities.length
    ? ctx.entities
        .map((e) => {
          const handle = e.handle ? ` @${e.handle}` : ''
          const aliases = e.aliases.length
            ? ` (aliases: ${e.aliases.join(', ')})`
            : ''
          return `- [${e.id}]${handle} ${e.name}${aliases} — ${e.type}`
        })
        .join('\n')
    : '—'
  // Profiles/days can contain arbitrary markdown, so wrap each in explicit
  // start/end fences — the LLM can always tell where one ends.
  const dossiers = ctx.dossiers.length
    ? ctx.dossiers
        .map((d) => fence(`PROFILE: ${d.name}`, d.summary))
        .join('\n\n')
    : '—'
  const cards = ctx.cbtCards.length
    ? ctx.cbtCards.map((c) => `- [${c.id}] ${c.title}`).join('\n')
    : '—'
  const recent = ctx.recentDays.length
    ? ctx.recentDays.map((r) => fence(`DAY ${r.date}`, r.text)).join('\n\n')
    : '—'

  return [
    `Known people and entities — format "[id] @handle Name (aliases) — type". In the day text, @handle refers to exactly this entity; put its id in existingId.\n${entities}`,
    '',
    `Dossiers of those likely mentioned today:\n${dossiers}`,
    '',
    `CBT cards (for cbtFlags):\n${cards}`,
    '',
    `Recent entries:\n${recent}`,
  ].join('\n')
}

// An explicitly delimited block so nested markdown can't blur its boundaries.
function fence(label: string, body: string): string {
  return `===== BEGIN · ${label} =====\n${body.trim()}\n===== END · ${label} =====`
}

function describeMetric(d: MetricDef): string {
  const range =
    d.scaleMin !== null && d.scaleMax !== null
      ? `scale ${d.scaleMin}–${d.scaleMax}`
      : d.unit
        ? `unit: ${d.unit}`
        : 'no scale'
  return `${d.key} — ${d.name} (${range}, type: ${d.source})`
}

function section(title: string, body: string): string {
  return `## ${title}\n${body.trim()}`
}
