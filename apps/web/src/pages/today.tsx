import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DayInputPanel } from '@/components/day-input-panel'
import { cn } from '@/lib/utils'

export function TodayPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {/* Left: AI dashboard (placeholders for now) + the day-input block */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <PlaceholderCard className="min-h-40">
            {t('today.chartPlaceholder')}
          </PlaceholderCard>
          <PlaceholderCard className="min-h-44">
            {t('today.coachingPlaceholder')}
          </PlaceholderCard>
          <DayInputPanel />
        </div>

        {/* Right: highlights & weekly goals (AI, placeholder for now) */}
        <PlaceholderCard className="min-h-96">
          {t('today.bulletsPlaceholder')}
        </PlaceholderCard>
      </div>
    </div>
  )
}

// A soft "coming soon" surface for the AI-generated panels (charts, the daily
// note, weekly-goal bullets) that the ingestion pipeline will fill in later.
function PlaceholderCard({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
