import type { Extraction, ParseResponse } from '@prism/shared'

import { api } from './api'

// One interactive parse round. First call: no answers. Next rounds: answers to
// the questions from the previous round (server stores the accumulated state).
export function parseEntry(
  id: string,
  body: { answers?: { question: string; answer: string }[] } = {},
) {
  return api.post<ParseResponse>(`/entries/${id}/parse`, body)
}

// Persist the confirmed (user-edited) extraction → status parsed.
export function commitEntry(id: string, extraction: Extraction) {
  return api.post<{ id: string; ingestStatus: string }>(
    `/entries/${id}/commit`,
    extraction,
  )
}
