import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/components/theme-provider'
import { fetchSettings, settingsKey } from '@/lib/settings'

// Loads the user's saved settings (after login) and pushes them into the
// instant-apply layers: ThemeProvider (light/dark + palette) and i18n (language).
export function useSettingsSync() {
  const { setTheme, setColorTheme } = useTheme()
  const { i18n } = useTranslation()
  const { data } = useQuery({ queryKey: settingsKey, queryFn: fetchSettings })

  useEffect(() => {
    if (!data) return
    setTheme(data.theme)
    setColorTheme(data.themePreset ?? 'default') // null preset → "default"
    if (i18n.language !== data.uiLanguage) {
      void i18n.changeLanguage(data.uiLanguage)
    }
  }, [data, setTheme, setColorTheme, i18n])
}
