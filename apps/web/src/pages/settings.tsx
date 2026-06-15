import { useTranslation } from 'react-i18next'

import { type Theme, useTheme } from '@/components/theme-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { themePresets } from '@/config/themes'

// Languages are listed by their own name (endonym), the same in any UI
// language — so these labels are intentionally not translated.
const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>

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
          onValueChange={(value) => setTheme(value as Theme)}
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
        <Select value={colorTheme} onValueChange={setColorTheme}>
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
          onValueChange={(value) => i18n.changeLanguage(value)}
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

      <p className="max-w-md text-xs text-muted-foreground">
        {t('settings.notSyncedNote')}
      </p>
    </div>
  )
}
