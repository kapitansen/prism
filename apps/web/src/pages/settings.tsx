import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { CoachPackSettings } from '@/components/coach-pack-settings'
import { type Theme, useTheme } from '@/components/theme-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { themePresets } from '@/config/themes'
import {
  fetchSettings,
  settingsKey,
  updateSettings,
  type UserSettings,
} from '@/lib/settings'

// Languages are listed by their own name (endonym), the same in any UI
// language — so these labels are intentionally not translated.
const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

// Fixed GMT offsets (−12…+14, whole hours), stored as an ISO offset string.
// Deliberately no daylight-saving handling — see the timezone note in chat.
const TIMEZONES = Array.from({ length: 27 }, (_, i) => i - 12).map((h) => {
  const sign = h < 0 ? '-' : '+'
  const value = `${sign}${String(Math.abs(h)).padStart(2, '0')}:00`
  return { value, label: h === 0 ? 'GMT' : `GMT${sign}${Math.abs(h)}` }
})

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme()
  const queryClient = useQueryClient()
  // Saved settings (already fetched by useSettingsSync) — used for timezone,
  // which has no separate "instant-apply" layer like theme/language do.
  const { data: settings } = useQuery({
    queryKey: settingsKey,
    queryFn: fetchSettings,
  })

  // Persist a change to the backend; keep the cache in sync with the response.
  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) =>
      queryClient.setQueryData<UserSettings>(settingsKey, data),
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4">
      {/* Light / dark mode */}
      <section className="flex max-w-md flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {t('settings.theme.label')}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('settings.theme.hint')}
          </span>
        </div>
        <Select
          value={theme}
          onValueChange={(value) => {
            setTheme(value as Theme) // instant
            save.mutate({ theme: value as UserSettings['theme'] }) // persist
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
            <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
            <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Color palette */}
      <section className="flex max-w-md flex-col gap-2">
        <span className="text-sm font-medium">
          {t('settings.colorTheme.label')}
        </span>
        <Select
          value={colorTheme}
          onValueChange={(value) => {
            setColorTheme(value)
            save.mutate({ themePreset: value })
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {themePresets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.value === 'default'
                  ? t('settings.colorTheme.default')
                  : preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Language */}
      <section className="flex max-w-md flex-col gap-2">
        <span className="text-sm font-medium">
          {t('settings.language.label')}
        </span>
        <Select
          value={i18n.language}
          onValueChange={(value) => {
            void i18n.changeLanguage(value)
            save.mutate({ uiLanguage: value })
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((language) => (
              <SelectItem key={language.value} value={language.value}>
                {language.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Timezone */}
      <section className="flex max-w-md flex-col gap-2">
        <span className="text-sm font-medium">
          {t('settings.timezone.label')}
        </span>
        <Select
          value={settings?.timezone === 'UTC' ? '+00:00' : settings?.timezone}
          onValueChange={(value) => save.mutate({ timezone: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((zone) => (
              <SelectItem key={zone.value} value={zone.value}>
                {zone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <CoachPackSettings />
    </div>
  )
}
