import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChipGroup } from '@/components/ui/chip-group'
import { createEntry, fetchEntries, updateEntry } from '@/lib/entries'
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
  // The day's draft entry (at most one `daily` per day), or null if not started.
  const dayQuery = useQuery({
    queryKey: ['day-entry', today],
    queryFn: async () => {
      const list = await fetchEntries({ on: today, type: 'daily', limit: 1 })
      return list[0] ?? null
    },
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

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        {dayQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('today.loading')}</p>
        ) : (
          // keyed by day → switching the date later remounts with fresh state
          <DayEditor
            key={today}
            today={today}
            initialId={dayQuery.data?.id ?? null}
            initialText={dayQuery.data?.body ?? ''}
          />
        )}
      </section>
    </div>
  )
}

const AUTOSAVE_MS = 800

function DayEditor({
  today,
  initialId,
  initialText,
}: {
  today: string
  initialId: string | null
  initialText: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Refs, not state: the autosave closure must read live values without
  // re-rendering, and we never render these directly.
  const entryId = useRef(initialId)
  const inFlight = useRef(false)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Serialize saves: create-or-update, and coalesce edits made mid-request so
  // a fast typist can't spawn two `daily` drafts for the same day.
  async function flush(value: string) {
    if (!value.trim()) return
    if (inFlight.current) {
      pending.current = value
      return
    }
    inFlight.current = true
    setStatus('saving')
    try {
      if (entryId.current) {
        await updateEntry(entryId.current, { body: value })
      } else {
        const created = await createEntry({
          type: 'daily',
          body: value,
          occurredOn: today,
        })
        entryId.current = created.id
      }
      setStatus('saved')
    } finally {
      inFlight.current = false
      const next = pending.current
      pending.current = null
      if (next !== null && next !== value) void flush(next)
    }
  }

  function onChange(value: string) {
    setText(value)
    setStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(value), AUTOSAVE_MS)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t('today.dayTitle')}</h2>
        {status !== 'idle' && (
          <span className="text-xs text-muted-foreground">
            {status === 'saving' ? t('today.saving') : t('today.saved')}
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('today.dayPlaceholder')}
        rows={6}
        className="focus-visible:ring-ring/50 min-h-32 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      />
    </>
  )
}
