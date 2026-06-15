import { useTranslation } from 'react-i18next'

export function TodayPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t('nav.today')}</h1>
      <p className="text-muted-foreground">{t('today.comingSoon')}</p>
    </div>
  )
}
