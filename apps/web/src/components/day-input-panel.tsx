import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enUS, ru } from 'date-fns/locale'
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

// The whole day-input block: date selector + metric chips + autosaving day
// text. Self-contained (own date state + queries), so it can be dropped on any
// screen — currently Today and Journal (DRY).
export function DayInputPanel() {
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
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      {/* Date selector: calendar · today · prev · next */}
      <div className="flex flex-wrap items-center gap-1.5">
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
          variant="outline"
          size="icon"
          aria-label={t('today.jumpToday')}
          disabled={isToday}
          onClick={() => setDate(todayStr)}
        >
          <CalendarCheck />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('today.prevDay')}
          onClick={() => setDate((d) => shiftIso(d, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('today.nextDay')}
          disabled={isToday}
          onClick={() => setDate((d) => shiftIso(d, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      {/* Metric chips — label on top, chips below, wrapping in a row */}
      {defsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">{t('today.loading')}</p>
      )}
      {defsQuery.isError && (
        <p className="text-sm text-destructive">{t('today.error')}</p>
      )}
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {manual.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5">
            <span className="text-sm text-muted-foreground">{label(d)}</span>
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
      </div>

      {/* Day entry */}
      <div className="flex flex-col gap-2">
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
      </div>
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
  const queryClient = useQueryClient()
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

  // After any write, refresh both caches the feed/panel read from.
  function syncCaches(saved: Awaited<ReturnType<typeof updateEntry>>) {
    queryClient.setQueryData(['day-entry', date], saved)
    void queryClient.invalidateQueries({ queryKey: ['entries'] })
  }

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
      let saved
      if (entryId.current) {
        saved = await updateEntry(entryId.current, { body: value })
      } else {
        saved = await createEntry({
          type: 'daily',
          body: value,
          occurredOn: date,
        })
        entryId.current = saved.id
      }
      syncCaches(saved)
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
    syncCaches(updated)
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
