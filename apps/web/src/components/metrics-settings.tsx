import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  fetchMetricDefinitions,
  type MetricDefinition,
  setEnabledMetrics,
} from '@/lib/metrics'

const MAX_ENABLED = 4

// Settings block: pick which metrics the user actively tracks (≤4). Enabled ones
// show as chips in the day editor and go into the analysis prompt. The catalog
// is whatever the DB holds (the source of truth) — we render all of it.
export function MetricsSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['metric-definitions'],
    queryFn: fetchMetricDefinitions,
  })
  const defs = data ?? []
  const enabledKeys = defs.filter((d) => d.enabled).map((d) => d.key)

  const save = useMutation({
    mutationFn: setEnabledMetrics,
    onSuccess: (next) => queryClient.setQueryData(['metric-definitions'], next),
  })

  const toggle = (key: string) => {
    const on = enabledKeys.includes(key)
    if (!on && enabledKeys.length >= MAX_ENABLED) return // hard cap
    save.mutate(
      on ? enabledKeys.filter((k) => k !== key) : [...enabledKeys, key],
    )
  }

  // Translated label (today.metric.<key>) with the DB name as fallback.
  const label = (d: MetricDefinition) => {
    const tk = `today.metric.${d.key}`
    const translated = t(tk)
    return translated === tk ? d.name : translated
  }

  return (
    <section className="flex max-w-md flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">
          {t('settings.metrics.label')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('settings.metrics.hint', {
            count: enabledKeys.length,
            max: MAX_ENABLED,
          })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {defs.map((d) => {
          const on = enabledKeys.includes(d.key)
          const atCap = !on && enabledKeys.length >= MAX_ENABLED
          return (
            <Button
              key={d.key}
              type="button"
              size="sm"
              variant={on ? 'default' : 'outline'}
              disabled={atCap || save.isPending}
              onClick={() => toggle(d.key)}
            >
              {label(d)}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
