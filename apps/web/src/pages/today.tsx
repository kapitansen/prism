import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ChipGroup } from '@/components/ui/chip-group'
import {
  createEntry,
  fetchEntries,
  finalizeEntry,
  updateEntry,
} from '@/lib/entries'
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

// Shift an ISO day by N days using local-calendar math (no timezone drift).
function shiftIso(iso: string, deltaDays: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

export function TodayPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const todayStr = todayIso()
  const [date, setDate] = useState(todayStr)
  const isToday = date === todayStr

  const defsQuery = useQuery({
    queryKey: ['metric-definitions'],
    queryFn: fetchMetricDefinitions,
  })
  const valuesQuery = useQuery({
    queryKey: ['metric-values', date],
    queryFn: () => fetchMetricValues({ from: date, to: date }),
  })
  // The day's draft entry (at most one `daily` per day), or null if not started.
  const dayQuery = useQuery({
    queryKey: ['day-entry', date],
    queryFn: async () => {
      const list = await fetchEntries({ on: date, type: 'daily', limit: 1 })
      return list[0] ?? null
    },
  })

  const record = useMutation({
    mutationFn: recordMetricValue,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['metric-values', date] }),
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
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{t('nav.today')}</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('today.prevDay')}
            onClick={() => setDate((d) => shiftIso(d, -1))}
          >
            <ChevronLeft />
          </Button>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('today.nextDay')}
            disabled={isToday}
            onClick={() => setDate((d) => shiftIso(d, 1))}
          >
            <ChevronRight />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(todayStr)}>
              {t('today.jumpToday')}
            </Button>
          )}
        </div>
      </div>

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
                record.mutate({ metricKey: d.key, value, occurredOn: date })
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
          // keyed by day → switching the date remounts with fresh state
          <DayEditor
            key={date}
            date={date}
            initialId={dayQuery.data?.id ?? null}
            initialText={dayQuery.data?.body ?? ''}
            initialStatus={dayQuery.data?.ingestStatus ?? 'draft'}
          />
        )}
      </section>
    </div>
  )
}

const AUTOSAVE_MS = 800

function DayEditor({
  date,
  initialId,
  initialText,
  initialStatus,
}: {
  date: string
  initialId: string | null
  initialText: string
  initialStatus: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  // Day-level lifecycle (ingest_status). 'draft' = still open for the button.
  const [dayStatus, setDayStatus] = useState(initialStatus)
  const closed = dayStatus !== 'draft'

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
          occurredOn: date,
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

  async function closeDay() {
    if (timer.current) clearTimeout(timer.current)
    await flush(text) // make sure the latest text is saved (and entry created)
    if (!entryId.current) return
    const updated = await finalizeEntry(entryId.current)
    setDayStatus(updated.ingestStatus)
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
      <div className="flex justify-end">
        {closed ? (
          <span className="text-sm text-muted-foreground">
            {t('today.dayClosed')}
          </span>
        ) : (
          <Button
            size="sm"
            disabled={!text.trim()}
            onClick={() => void closeDay()}
          >
            {t('today.closeDay')}
          </Button>
        )}
      </div>
    </>
  )
}
