import { api } from './api'

// Matches the backend GET /entries list item. The day text is split into two
// sides — `good` (pros / what went well) and `hard` (cons / difficulties).
export interface EntryListItem {
  id: string
  type: string
  origin: string
  title: string | null
  good: string | null
  hard: string | null
  summary: string | null
  occurredOn: string
  occurredTo: string | null
  ingestStatus: string
  createdAt: string
}

export function fetchEntries(
  params: { limit?: number; offset?: number; on?: string; type?: string } = {},
) {
  const q = new URLSearchParams()
  if (params.limit !== undefined) q.set('limit', String(params.limit))
  if (params.offset !== undefined) q.set('offset', String(params.offset))
  if (params.on) q.set('on', params.on)
  if (params.type) q.set('type', params.type)
  const qs = q.toString()
  return api.get<EntryListItem[]>(qs ? `/entries?${qs}` : '/entries')
}

export function createEntry(input: {
  type: string
  good?: string
  hard?: string
  occurredOn: string
  occurredTo?: string
  title?: string
}) {
  return api.post<EntryListItem>('/entries', input)
}

export interface UpdateEntryInput {
  good?: string
  hard?: string
  title?: string
  summary?: string
  type?: string
  occurredOn?: string
  occurredTo?: string
}

export function updateEntry(id: string, patch: UpdateEntryInput) {
  return api.patch<EntryListItem>(`/entries/${id}`, patch)
}

export function deleteEntry(id: string) {
  return api.delete<{ deleted: true }>(`/entries/${id}`)
}
