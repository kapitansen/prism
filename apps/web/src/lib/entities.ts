import { api } from './api'

// Matches the backend entity detail shape.
export interface Entity {
  id: string
  type: string
  name: string
  aliases: string[]
  description: string | null
  status: string
  periodStart: string | null
  periodEnd: string | null
  digest: string | null
  digestUpdatedAt: string | null
  createdAt: string
}

export function fetchPeople() {
  return api.get<Entity[]>('/entities?type=person')
}

export interface UpdateEntityInput {
  name?: string
  aliases?: string[]
  description?: string
  digest?: string
  status?: string
  periodStart?: string
  periodEnd?: string
}

export function updateEntity(id: string, patch: UpdateEntityInput) {
  return api.patch<Entity>(`/entities/${id}`, patch)
}

export function deleteEntity(id: string) {
  return api.delete<{ deleted: true }>(`/entities/${id}`)
}
