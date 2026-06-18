import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ChipGroup } from '@/components/ui/chip-group'
import {
  fetchMetricDefinitions,
  fetchMetricValues,
  type MetricDefinition,
  recordMetricValue,
} from '@/lib/metrics'

// Local calendar date as YYYY-MM-DD (metric values are keyed by day).
function todayIso() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function TodayPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const today = todayIso()

  const defsQuery = useQuery({
    queryKey: ['metric-definitions'],
    queryFn: fetchMetricDefinitions,
  })
  const valuesQuery = useQuery({
    queryKey: ['metric-values', today],
    queryFn: () => fetchMetricValues({ from: today, to: today }),
  })

  const record = useMutation({
    mutationFn: recordMetricValue,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['metric-values', today] }),
  })

  // Chips only for manual, scaled metrics; extracted ones (sleep_hours,
  // anxiety) are filled by the parser, not tapped here.
  const manual = (defsQuery.data ?? []).filter(
    (d): d is MetricDefinition & { scaleMin: number; scaleMax: number } =>
      d.source === 'manual' && d.scaleMin !== null && d.scaleMax !== null,
  )

  const valueFor = (key: string) =>
    valuesQuery.data?.find((v) => v.metricKey === key)?.value ?? null

  function label(d: MetricDefinition) {
    const key = `today.metric.${d.key}`
    const translated = t(key)
    return translated === key ? d.name : translated
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t('nav.today')}</h1>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-medium">{t('today.metricsTitle')}</h2>

        {defsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">{t('today.loading')}</p>
        )}
        {defsQuery.isError && (
          <p className="text-sm text-destructive">{t('today.error')}</p>
        )}

        {manual.map((d) => (
          <div
            key={d.key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm">{label(d)}</span>
            <ChipGroup
              ariaLabel={label(d)}
              value={valueFor(d.key)}
              onChange={(value) =>
                record.mutate({ metricKey: d.key, value, occurredOn: today })
              }
              options={Array.from(
                { length: d.scaleMax - d.scaleMin + 1 },
                (_, i) => ({
                  value: d.scaleMin + i,
                  label: String(d.scaleMin + i),
                }),
              )}
            />
          </div>
        ))}
      </section>
    </div>
  )
}
