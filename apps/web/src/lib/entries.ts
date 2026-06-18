import { api } from './api'

// Matches the backend GET /entries list item.
export interface EntryListItem {
  id: string
  type: string
  origin: string
  title: string | null
  body: string
  summary: string | null
  occurredOn: string
  occurredTo: string | null
  ingestStatus: string
  createdAt: string
}

export function fetchEntries(params: { limit: number; offset: number }) {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  return api.get<EntryListItem[]>(`/entries?${q.toString()}`)
}
