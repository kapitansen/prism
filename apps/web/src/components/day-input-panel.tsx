import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enUS, ru } from 'date-fns/locale'
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
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

// Inclusive list of ISO days from..to (capped, ISO strings compare by date).
function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  for (let i = 0; i < 366 && cur <= to; i++) {
    out.push(cur)
    cur = shiftIso(cur, 1)
  }
  return out
}

// The whole day-input block: date selector + metric chips + autosaving day
// text. Self-contained (own date state + queries), so it can be dropped on any
// screen — currently Today and Journal (DRY).
export function DayInputPanel({
  initialDate,
  onClose,
}: {
  initialDate?: string
  onClose?: () => void
} = {}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const todayStr = todayIso()
  const [from, setFrom] = useState(initialDate ?? todayStr)
  const [to, setTo] = useState<string | null>(null)
  const [pickMode, setPickMode] = useState<'single' | 'range'>('single')
  const [calOpen, setCalOpen] = useState(false)
  const isRange = to !== null && to !== from
  const days = isRange ? daysBetween(from, to) : [from]
  const isToday = from === todayStr && to === null
  const fmt = (iso: string) =>
    isoToDate(iso).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  const dateLabel = isRange ? `${fmt(from)} – ${fmt(to)}` : fmt(from)
  const calendarLocale = i18n.language.startsWith('ru') ? ru : enUS
  const pickSingle = (iso: string) => {
    setFrom(iso)
    setTo(null)
    setPickMode('single')
  }

  const defsQuery = useQuery({
    queryKey: ['metric-definitions'],
    queryFn: fetchMetricDefinitions,
  })
  const valuesQuery = useQuery({
    queryKey: ['metric-values', from],
    queryFn: () => fetchMetricValues({ from, to: from }),
  })
  // The day's draft entry (at most one `daily` per day), or null if not started.
  const dayQuery = useQuery({
    queryKey: ['day-entry', from],
    queryFn: async () => {
      const list = await fetchEntries({ on: from, type: 'daily', limit: 1 })
      return list[0] ?? null
    },
  })

  // A chip writes the same value to every day in the range.
  const record = useMutation({
    mutationFn: ({ metricKey, value }: { metricKey: string; value: number }) =>
      Promise.all(
        days.map((d) => recordMetricValue({ metricKey, value, occurredOn: d })),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['metric-values'] }),
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
    <div className="relative flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      {onClose && (
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
      {/* Date selector: calendar · today · prev · next */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 text-base">
              <CalendarDays className="size-5" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="flex w-auto flex-col gap-2 p-2"
            align="start"
          >
            {/* explicit mode toggle — no guessing single vs range */}
            <ChipGroup
              ariaLabel={t('today.dateMode')}
              value={pickMode}
              onChange={(m) => {
                setPickMode(m)
                if (m === 'single') setTo(null)
              }}
              options={[
                { value: 'single', label: t('today.dateSingle') },
                { value: 'range', label: t('today.dateRange') },
              ]}
            />
            {pickMode === 'single' ? (
              <Calendar
                mode="single"
                locale={calendarLocale}
                selected={isoToDate(from)}
                defaultMonth={isoToDate(from)}
                disabled={{ after: isoToDate(todayStr) }}
                onSelect={(d) => {
                  if (!d) return
                  setFrom(dateToIso(d))
                  setTo(null)
                  setCalOpen(false)
                }}
                autoFocus
              />
            ) : (
              <Calendar
                mode="range"
                locale={calendarLocale}
                selected={{
                  from: isoToDate(from),
                  to: to ? isoToDate(to) : undefined,
                }}
                defaultMonth={isoToDate(from)}
                disabled={{ after: isoToDate(todayStr) }}
                onSelect={(range) => {
                  if (!range?.from) return
                  const f = dateToIso(range.from)
                  setFrom(f)
                  setTo(range.to ? dateToIso(range.to) : null)
                  if (range.to) setCalOpen(false) // both ends picked → close
                }}
                autoFocus
              />
            )}
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('today.jumpToday')}
          disabled={isToday}
          onClick={() => pickSingle(todayStr)}
        >
          <CalendarCheck />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('today.prevDay')}
          onClick={() => pickSingle(shiftIso(from, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('today.nextDay')}
          disabled={from === todayStr}
          onClick={() => pickSingle(shiftIso(from, 1))}
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
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {manual.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5">
            <span className="text-sm text-muted-foreground">{label(d)}</span>
            <ChipGroup
              ariaLabel={label(d)}
              value={valueFor(d.key)}
              onChange={(value) => record.mutate({ metricKey: d.key, value })}
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
            key={from}
            date={from}
            to={isRange ? to : null}
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
  to,
  initialId,
  initialText,
  initialStatus,
}: {
  date: string
  to: string | null
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
          occurredTo: to ?? undefined,
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
