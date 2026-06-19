import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enUS, ru } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ChipGroup } from '@/components/ui/chip-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { cn } from '@/lib/utils'

// We pass dates around as local YYYY-MM-DD strings (metric values are keyed by
// day). These convert to/from JS Date for the calendar without timezone drift.
function dateToIso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function isoToDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function todayIso() {
  return dateToIso(new Date())
}

function shiftIso(iso: string, deltaDays: number) {
  const d = isoToDate(iso)
  d.setDate(d.getDate() + deltaDays)
  return dateToIso(d)
}

// Soft red→green ramp for the 1–5 metric chips. Full static class strings so
// Tailwind keeps them; index 0 = value 1.
const METRIC_TINT = [
  'bg-red-100 text-red-700 hover:bg-red-200',
  'bg-orange-100 text-orange-700 hover:bg-orange-200',
  'bg-amber-100 text-amber-700 hover:bg-amber-200',
  'bg-lime-100 text-lime-700 hover:bg-lime-200',
  'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
]
const METRIC_TINT_SELECTED = [
  'bg-red-300 text-red-950',
  'bg-orange-300 text-orange-950',
  'bg-amber-300 text-amber-950',
  'bg-lime-300 text-lime-950',
  'bg-emerald-400 text-emerald-950',
]

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const todayStr = todayIso()
  const [date, setDate] = useState(todayStr)
  const [calOpen, setCalOpen] = useState(false)
  const isToday = date === todayStr
  const dateLabel = isoToDate(date).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const calendarLocale = i18n.language.startsWith('ru') ? ru : enUS

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
      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {/* Left: AI dashboard (placeholders for now) + the day-input block */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <PlaceholderCard className="min-h-40">
            {t('today.chartPlaceholder')}
          </PlaceholderCard>
          <PlaceholderCard className="min-h-44">
            {t('today.coachingPlaceholder')}
          </PlaceholderCard>

          {/* Day-input panel — one card, placeholder style */}
          <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
            {/* Date selector */}
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('today.prevDay')}
                onClick={() => setDate((d) => shiftIso(d, -1))}
              >
                <ChevronLeft />
              </Button>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 text-base">
                    <CalendarDays className="size-5" />
                    {dateLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={calendarLocale}
                    selected={isoToDate(date)}
                    defaultMonth={isoToDate(date)}
                    disabled={{ after: isoToDate(todayStr) }}
                    onSelect={(d) => {
                      if (d) {
                        setDate(dateToIso(d))
                        setCalOpen(false)
                      }
                    }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDate(todayStr)}
                >
                  {t('today.jumpToday')}
                </Button>
              )}
            </div>

            {/* Metric chips — label on top, chips below, wrapping in a row */}
            {defsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                {t('today.loading')}
              </p>
            )}
            {defsQuery.isError && (
              <p className="text-sm text-destructive">{t('today.error')}</p>
            )}
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {manual.map((d) => {
                const count = d.scaleMax - d.scaleMin + 1
                const fiveScale = count === 5
                return (
                  <div
                    key={d.key}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label(d)}
                    </span>
                    <ChipGroup
                      size="sm"
                      ariaLabel={label(d)}
                      value={valueFor(d.key)}
                      onChange={(value) =>
                        record.mutate({
                          metricKey: d.key,
                          value,
                          occurredOn: date,
                        })
                      }
                      options={Array.from({ length: count }, (_, i) => ({
                        value: d.scaleMin + i,
                        label: String(d.scaleMin + i),
                        className: fiveScale ? METRIC_TINT[i] : undefined,
                        selectedClassName: fiveScale
                          ? METRIC_TINT_SELECTED[i]
                          : undefined,
                      }))}
                    />
                  </div>
                )
              })}
            </div>

            {/* Day entry */}
            <div className="flex flex-col gap-2">
              {dayQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t('today.loading')}
                </p>
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
            </div>
          </div>
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
  // The last persisted text — state (not a ref) so `dirty` recomputes on save.
  const [lastSaved, setLastSaved] = useState(initialText)

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
      setLastSaved(value)
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

  async function saveNow() {
    if (timer.current) clearTimeout(timer.current)
    await flush(text)
  }

  async function closeDay() {
    await saveNow() // make sure the latest text is saved (and entry created)
    if (!entryId.current) return
    const updated = await finalizeEntry(entryId.current)
    setDayStatus(updated.ingestStatus)
  }

  // "Save" appears whenever there are unsaved edits (works for a closed day
  // too); otherwise finalize an open day, or show the "closed" label.
  const dirty = text !== lastSaved

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
        {dirty ? (
          <Button
            size="sm"
            disabled={!text.trim()}
            onClick={() => void saveNow()}
          >
            {t('today.save')}
          </Button>
        ) : closed ? (
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
