import { api } from './api'

export interface CbtCard {
  id: string
  title: string
  explanation: string
  isFavorite: boolean
  conviction: number
  createdAt: string
  updatedAt: string
}

export function fetchCards(favorite?: boolean) {
  return api.get<CbtCard[]>(
    favorite ? '/cbt-cards?favorite=true' : '/cbt-cards',
  )
}

export interface CardPatch {
  title?: string
  explanation?: string
  isFavorite?: boolean
  conviction?: number
}

export function createCard(input: { title: string; explanation: string }) {
  return api.post<CbtCard>('/cbt-cards', input)
}

export function updateCard(id: string, patch: CardPatch) {
  return api.patch<CbtCard>(`/cbt-cards/${id}`, patch)
}

export function deleteCard(id: string) {
  return api.delete<{ deleted: true }>(`/cbt-cards/${id}`)
}
