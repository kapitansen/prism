import { z } from 'zod'

// The extraction-JSON contract (spec §6): the shape the LLM must return when
// parsing a day. zod gives both runtime validation (the worker checks the LLM
// output) and the TS types (reused on the web) — one source of truth.

export const ENTITY_TYPES = ['person', 'project', 'habit', 'event'] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

// One metric the LLM found explicitly in the text (never invented). The worker
// re-checks `key` is one of the user's metrics and `value` fits its scale.
export const extractedMetricSchema = z
  .object({
    key: z.string().min(1),
    value: z.number(),
    confidence: z.number().min(0).max(1),
    occurredOn: isoDate.optional(), // day attribution for multi-day entries
  })
  .strict()

// A mention matched to an existing entity (existingId) or a new candidate (null).
export const extractedEntitySchema = z
  .object({
    type: z.enum(ENTITY_TYPES),
    name: z.string().min(1),
    existingId: z.string().uuid().nullable(),
    confidence: z.number().min(0).max(1),
  })
  .strict()

export const extractedIntentSchema = z
  .object({ text: z.string().min(1) })
  .strict()

// Free-text by default. `options` may offer one-click answers (e.g. ["Да","Нет"]
// for an entity-confirm question like "Is this @sam_k?"); the chosen option
// string is sent back as the answer.
export const clarifyQuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
  })
  .strict()

export const cbtFlagSchema = z
  .object({ cardId: z.string().uuid(), note: z.string().optional() })
  .strict()

// The full extraction once the parse is complete. `summary` is editable by the
// user before commit; length is intentionally not capped.
const extractionShape = {
  summary: z.string().min(1),
  metrics: z.array(extractedMetricSchema),
  entities: z.array(extractedEntitySchema),
  intents: z.array(extractedIntentSchema),
  cbtFlags: z.array(cbtFlagSchema).default([]),
}
export const extractionSchema = z.object(extractionShape).strict()

// One round of the interactive parse: either the LLM needs answers (mandatory,
// any number), or it's done and returns the extraction.
export const parseResponseSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('needs_clarification'),
      clarifyQuestions: z.array(clarifyQuestionSchema).min(1),
    })
    .strict(),
  z.object({ status: z.literal('complete'), ...extractionShape }).strict(),
])

export type ExtractedMetric = z.infer<typeof extractedMetricSchema>
export type ExtractedEntity = z.infer<typeof extractedEntitySchema>
export type ExtractedIntent = z.infer<typeof extractedIntentSchema>
export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>
export type CbtFlag = z.infer<typeof cbtFlagSchema>
export type Extraction = z.infer<typeof extractionSchema>
export type ParseResponse = z.infer<typeof parseResponseSchema>
