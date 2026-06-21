import { api } from './api'

// Mirrors the backend coach-pack responses (spec §5.2, editable layers 2–3).
export interface CoachPackVersion {
  id: string
  analysisMd: string
  voiceMd: string
  sourceNote: string
  createdAt: string
}

export interface CoachPackVersionListItem extends CoachPackVersion {
  isActive: boolean
}

export const coachPackKey = ['coach-pack'] as const
export const coachPackVersionsKey = ['coach-pack', 'versions'] as const

export function fetchActiveCoachPack() {
  return api.get<CoachPackVersion>('/coach-pack')
}

export function fetchCoachPackVersions() {
  return api.get<CoachPackVersionListItem[]>('/coach-pack/versions')
}

export function createCoachPackVersion(input: {
  analysisMd: string
  voiceMd: string
  sourceNote?: string
}) {
  return api.post<CoachPackVersion>('/coach-pack/versions', input)
}

export function activateCoachPackVersion(id: string) {
  return api.post<CoachPackVersion>(`/coach-pack/versions/${id}/activate`)
}
