import { api } from './api'

// Mirrors the backend GET/PATCH /settings shape.
export interface UserSettings {
  uiLanguage: string
  theme: 'light' | 'dark' | 'system'
  themePreset: string | null
  timezone: string
}

export const settingsKey = ['settings'] as const

export function fetchSettings() {
  return api.get<UserSettings>('/settings')
}

export function updateSettings(patch: Partial<UserSettings>) {
  return api.patch<UserSettings>('/settings', patch)
}
