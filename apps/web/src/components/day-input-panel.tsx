import type { ParseResponse } from '@prism/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enUS, ru } from 'date-fns/locale'
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MentionTextarea } from '@/components/mention-textarea'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ChipGroup } from '@/components/ui/chip-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { commitEntry, parseEntry } from '@/lib/analysis'
import { fetchEntities } from '@/lib/entities'
import { createEntry, fetchEntries, updateEntry } from '@/lib/entries'
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

// Inclusive list of ISO days from..to (capped; ISO strings compare by date).
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
  const [date, setDate] = useState(initialDate ?? todayStr) // the day / range start
  const [rangeTo, setRangeTo] = useState<string | null>(null)
  const [rangeMode, setRangeMode] = useState(false)
  const [calOpen, setCalOpen] = useState(false)

  const isRange = rangeMode && rangeTo !== null && rangeTo !== date
  const days = rangeMode && rangeTo ? daysBetween(date, rangeTo) : [date]
  const isToday = date === todayStr && !rangeMode
  const calendarLocale = i18n.language.startsWith('ru') ? ru : enUS
  const fmt = (iso: string) =>
    isoToDate(iso).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  const dateLabel = isRange ? `${fmt(date)} – ${fmt(rangeTo)}` : fmt(date)

  // Arrows / "today" always act on a single day and leave range mode.
  const pickSingle = (iso: string) => {
    setDate(iso)
    setRangeTo(null)
    setRangeMode(false)
  }
  const toggleRange = () => {
    if (rangeMode) {
      setRangeMode(false)
      setRangeTo(null)
    } else {
      setRangeMode(true)
      setRangeTo((prev) => prev ?? date) // default end = start (one day)
    }
  }

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

  // A chip writes the same value to every day of the range (one day if single).
  const record = useMutation({
    mutationFn: ({ metricKey, value }: { metricKey: string; value: number }) =>
      Promise.all(
        days.map((d) => recordMetricValue({ metricKey, value, occurredOn: d })),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['metric-values'] }),
  })

  // A chip for every enabled metric with a 1–N scale (regardless of source —
  // you can tap to rate it). Scaleless metrics (e.g. sleep_hours) aren't chips.
  const chipMetrics = (defsQuery.data ?? []).filter(
    (d): d is MetricDefinition & { scaleMin: number; scaleMax: number } =>
      d.enabled && d.scaleMin !== null && d.scaleMax !== null,
  )

  // A chip shows the manual rating if set, otherwise the AI-extracted value
  // (both can exist for one key/day).
  const valueFor = (key: string) => {
    const forKey = valuesQuery.data?.filter((v) => v.metricKey === key) ?? []
    const manual = forKey.find((v) => v.source === 'manual')
    return (manual ?? forKey[0])?.value ?? null
  }

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
      {/* Date selector: range toggle · calendar · today · prev · next */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={rangeMode ? 'default' : 'outline'}
          size="icon"
          aria-pressed={rangeMode}
          aria-label={t('today.rangeMode')}
          onClick={toggleRange}
        >
          <CalendarRange />
        </Button>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 text-base">
              <CalendarDays className="size-5" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {rangeMode ? (
              // Two independent single-date pickers — no range-calendar guessing
              <div className="flex flex-col gap-3 p-3 sm:flex-row">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('today.dateFrom')}
                  </span>
                  <Calendar
                    mode="single"
                    locale={calendarLocale}
                    selected={isoToDate(date)}
                    defaultMonth={isoToDate(date)}
                    disabled={{
                      after: rangeTo ? isoToDate(rangeTo) : isoToDate(todayStr),
                    }}
                    onSelect={(d) => d && setDate(dateToIso(d))}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('today.dateTo')}
                  </span>
                  <Calendar
                    mode="single"
                    locale={calendarLocale}
                    selected={rangeTo ? isoToDate(rangeTo) : undefined}
                    defaultMonth={isoToDate(rangeTo ?? date)}
                    disabled={{
                      before: isoToDate(date),
                      after: isoToDate(todayStr),
                    }}
                    onSelect={(d) => d && setRangeTo(dateToIso(d))}
                  />
                </div>
              </div>
            ) : (
              <Calendar
                mode="single"
                locale={calendarLocale}
                selected={isoToDate(date)}
                defaultMonth={isoToDate(date)}
                disabled={{ after: isoToDate(todayStr) }}
                onSelect={(d) => {
                  if (!d) return
                  setDate(dateToIso(d))
                  setCalOpen(false)
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
          onClick={() => pickSingle(shiftIso(date, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('today.nextDay')}
          disabled={date === todayStr}
          onClick={() => pickSingle(shiftIso(date, 1))}
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
        {chipMetrics.map((d) => (
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
            key={date}
            date={date}
            to={isRange ? rangeTo : null}
            initialId={dayQuery.data?.id ?? null}
            initialGood={dayQuery.data?.good ?? ''}
            initialHard={dayQuery.data?.hard ?? ''}
            initialStatus={dayQuery.data?.ingestStatus ?? 'draft'}
            initialTitle={dayQuery.data?.title ?? ''}
            initialSummary={dayQuery.data?.summary ?? ''}
            initialType={dayQuery.data?.type ?? 'daily'}
          />
        )}
      </div>
    </div>
  )
}

const AUTOSAVE_MS = 800

const ANALYSIS_FIELD =
  'focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

function DayEditor({
  date,
  to,
  initialId,
  initialGood,
  initialHard,
  initialStatus,
  initialTitle,
  initialSummary,
  initialType,
}: {
  date: string
  to: string | null
  initialId: string | null
  initialGood: string
  initialHard: string
  initialStatus: string
  initialTitle: string
  initialSummary: string
  initialType: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [good, setGood] = useState(initialGood)
  const [hard, setHard] = useState(initialHard)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [parsed, setParsed] = useState(initialStatus === 'parsed')
  // Full edit mode: the day's meta + AI fields, saved separately from the parse.
  const [full, setFull] = useState(false)
  const [editTitle, setEditTitle] = useState(initialTitle)
  const [editSummary, setEditSummary] = useState(initialSummary)
  const [editType, setEditType] = useState(initialType)
  const [editFrom, setEditFrom] = useState(date)
  const [editTo, setEditTo] = useState(to ?? '')
  const [metaSaving, setMetaSaving] = useState(false)
  // The current parse proposal (null = not analysing).
  const [proposal, setProposal] = useState<ParseResponse | null>(null)
  const [answers, setAnswers] = useState<string[]>([]) // current round inputs
  const [summary, setSummary] = useState('') // editable in review
  // Per proposed-entity decision (by index): 'skip' (default — never auto-create),
  // 'new' (create it), or an existing entity id (link to it). Nothing is created
  // unless the user picks 'new' here.
  const [entityChoices, setEntityChoices] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  const entryId = useRef(initialId)
  const inFlight = useRef(false)
  // A change landed while a save was in flight → re-flush once it returns.
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs hold the latest text so the debounced flush never reads a stale value.
  const goodRef = useRef(initialGood)
  const hardRef = useRef(initialHard)
  const [lastSavedGood, setLastSavedGood] = useState(initialGood)
  const [lastSavedHard, setLastSavedHard] = useState(initialHard)
  const dirty = good !== lastSavedGood || hard !== lastSavedHard
  const hasText = good.trim().length > 0 || hard.trim().length > 0

  // Entities with a handle → @-mention suggestions for the day text.
  const entitiesQuery = useQuery({
    queryKey: ['entities'],
    queryFn: fetchEntities,
  })
  const mentionOptions = (entitiesQuery.data ?? [])
    .filter((e) => e.handle)
    .map((e) => ({ handle: e.handle as string, name: e.name }))

  function syncCaches(saved: Awaited<ReturnType<typeof updateEntry>>) {
    queryClient.setQueryData(['day-entry', date], saved)
    void queryClient.invalidateQueries({ queryKey: ['entries'] })
  }

  // Serialize saves: create-or-update both sides, coalescing edits made
  // mid-request. Reads the latest values from refs (not stale closure state).
  async function flush() {
    const g = goodRef.current
    const h = hardRef.current
    if (!g.trim() && !h.trim()) return // can't create an empty entry
    if (inFlight.current) {
      pending.current = true
      return
    }
    inFlight.current = true
    setSaveStatus('saving')
    try {
      let saved
      if (entryId.current) {
        // Persist the range here too: a range set after the entry was first
        // created (its text autosaved) would otherwise never be stored.
        saved = await updateEntry(entryId.current, {
          good: g,
          hard: h,
          ...(to ? { occurredTo: to } : {}),
        })
      } else {
        saved = await createEntry({
          type: 'daily',
          good: g,
          hard: h,
          occurredOn: date,
          occurredTo: to ?? undefined,
        })
        entryId.current = saved.id
      }
      syncCaches(saved)
      setLastSavedGood(g)
      setLastSavedHard(h)
      setSaveStatus('saved')
    } finally {
      inFlight.current = false
      if (pending.current) {
        pending.current = false
        void flush()
      }
    }
  }

  // Schedule a debounced save after either side changes.
  function touch() {
    setSaveStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }

  function onChangeGood(value: string) {
    setGood(value)
    goodRef.current = value
    touch()
  }

  function onChangeHard(value: string) {
    setHard(value)
    hardRef.current = value
    touch()
  }

  async function saveNow() {
    if (timer.current) clearTimeout(timer.current)
    await flush()
  }

  // One parse round: ensure the text is saved, then ask the server. First call
  // has no answers; later rounds send answers to the previous questions.
  async function runRound(
    roundAnswers?: { question: string; answer: string }[],
  ) {
    await saveNow()
    if (!entryId.current) return
    setBusy(true)
    try {
      const res = await parseEntry(
        entryId.current,
        roundAnswers ? { answers: roundAnswers } : {},
      )
      setProposal(res)
      if (res.status === 'complete') {
        setSummary(res.summary)
        setEntityChoices({}) // fresh proposal → default every new entity to skip
      } else setAnswers(res.clarifyQuestions.map(() => ''))
    } finally {
      setBusy(false)
    }
  }

  function submitAnswers() {
    if (proposal?.status !== 'needs_clarification') return
    void runRound(
      proposal.clarifyQuestions.map((q, i) => ({
        question: q.question,
        answer: answers[i] ?? '',
      })),
    )
  }

  async function commit() {
    if (!entryId.current || proposal?.status !== 'complete') return
    // Apply per-entity decisions: parser-linked entities are kept; for the rest,
    // 'skip' drops them, 'new' creates, an id links to that existing entity.
    const entities = proposal.entities.flatMap((e, i) => {
      if (e.existingId) return [e]
      const choice = entityChoices[i] ?? 'skip'
      if (choice === 'skip') return []
      if (choice === 'new') return [e]
      return [{ ...e, existingId: choice }]
    })
    setBusy(true)
    try {
      await commitEntry(entryId.current, {
        summary,
        metrics: proposal.metrics,
        entities,
        intents: proposal.intents,
        cbtFlags: proposal.cbtFlags,
      })
      setParsed(true)
      setProposal(null)
      // Reflect the just-committed analysis without a reload: the AI summary in
      // the full-edit form, and the extracted metric chips.
      setEditSummary(summary)
      void queryClient.invalidateQueries({ queryKey: ['entries'] })
      void queryClient.invalidateQueries({ queryKey: ['day-entry'] })
      void queryClient.invalidateQueries({ queryKey: ['metric-values'] })
    } finally {
      setBusy(false)
    }
  }

  // Save the day's meta/AI fields. Ensures the entry exists first (the body
  // autosave creates it), then patches it. occurredOn may move the day, so we
  // invalidate rather than write the day-entry cache directly.
  async function saveMeta() {
    await saveNow()
    if (!entryId.current) return
    setMetaSaving(true)
    try {
      await updateEntry(entryId.current, {
        title: editTitle,
        summary: editSummary,
        type: editType,
        occurredOn: editFrom,
        ...(editTo ? { occurredTo: editTo } : {}),
      })
      void queryClient.invalidateQueries({ queryKey: ['day-entry'] })
      void queryClient.invalidateQueries({ queryKey: ['entries'] })
    } finally {
      setMetaSaving(false)
    }
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // A single options-only question submits on click, so the "Answer" button
  // would be redundant (and looked like a double-press); hide it in that case.
  const autoSubmitSingle =
    proposal?.status === 'needs_clarification' &&
    proposal.clarifyQuestions.length === 1 &&
    (proposal.clarifyQuestions[0].options?.length ?? 0) > 0

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t('today.dayTitle')}</h2>
        <div className="flex items-center gap-2">
          {saveStatus !== 'idle' && (
            <span className="text-xs text-muted-foreground">
              {saveStatus === 'saving' ? t('today.saving') : t('today.saved')}
            </span>
          )}
          <div className="flex gap-1">
            <Button
              type="button"
              size="xs"
              variant={full ? 'outline' : 'default'}
              onClick={() => setFull(false)}
            >
              {t('common.simpleMode')}
            </Button>
            <Button
              type="button"
              size="xs"
              variant={full ? 'default' : 'outline'}
              onClick={() => setFull(true)}
            >
              {t('common.fullMode')}
            </Button>
          </div>
        </div>
      </div>
      {/* Two parallel sides of the day, shown side by side (stack on mobile). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">
            {t('today.goodLabel')}
          </span>
          <MentionTextarea
            value={good}
            onChange={onChangeGood}
            options={mentionOptions}
            placeholder={t('today.goodPlaceholder')}
            rows={6}
            className={`min-h-32 w-full ${ANALYSIS_FIELD}`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">
            {t('today.hardLabel')}
          </span>
          <MentionTextarea
            value={hard}
            onChange={onChangeHard}
            options={mentionOptions}
            placeholder={t('today.hardPlaceholder')}
            rows={6}
            className={`min-h-32 w-full ${ANALYSIS_FIELD}`}
          />
        </div>
      </div>

      {full && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t('journal.title')}</span>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={ANALYSIS_FIELD}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm">{t('journal.type')}</span>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className={ANALYSIS_FIELD}
              >
                <option value="daily">{t('journal.typeDaily')}</option>
                <option value="report">{t('journal.typeReport')}</option>
                <option value="note">{t('journal.typeNote')}</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm">{t('journal.date')}</span>
              <input
                type="date"
                value={editFrom}
                onChange={(e) => setEditFrom(e.target.value)}
                className={ANALYSIS_FIELD}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm">{t('journal.dateTo')}</span>
              <input
                type="date"
                value={editTo}
                onChange={(e) => setEditTo(e.target.value)}
                className={ANALYSIS_FIELD}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t('today.summaryLabel')}</span>
            <span className="text-xs text-muted-foreground">
              {t('journal.summaryAiHint')}
            </span>
            <textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              rows={4}
              className={ANALYSIS_FIELD}
            />
          </label>
          <div>
            <Button
              type="button"
              size="sm"
              disabled={metaSaving}
              onClick={() => void saveMeta()}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}

      {proposal?.status === 'needs_clarification' ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="text-sm font-medium">{t('today.clarifyTitle')}</span>
          {proposal.clarifyQuestions.map((q, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-sm">{q.question}</span>
              {q.options && q.options.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      size="sm"
                      variant={answers[i] === opt ? 'default' : 'outline'}
                      disabled={busy}
                      onClick={() => {
                        setAnswers((a) => a.map((x, j) => (j === i ? opt : x)))
                        // Single one-click question → submit immediately.
                        if (proposal.clarifyQuestions.length === 1) {
                          void runRound([{ question: q.question, answer: opt }])
                        }
                      }}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[i] ?? ''}
                  onChange={(e) =>
                    setAnswers((a) =>
                      a.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                  rows={2}
                  className={ANALYSIS_FIELD}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            {!autoSubmitSingle && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={submitAnswers}
              >
                {t('today.answer')}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setProposal(null)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : proposal?.status === 'complete' ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="text-sm font-medium">{t('today.reviewTitle')}</span>
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t('today.summaryLabel')}</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className={ANALYSIS_FIELD}
            />
          </label>
          {proposal.metrics.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {proposal.metrics.map((m) => `${m.key}=${m.value}`).join(', ')}
            </p>
          )}
          {proposal.entities.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t('today.entitiesTitle')}
              </span>
              {proposal.entities.map((e, i) =>
                e.existingId ? (
                  // Parser already linked it to an existing entity — nothing
                  // gets created, so just show it.
                  <p key={i} className="flex items-center gap-1.5 text-sm">
                    <Check className="size-3.5 text-muted-foreground" />
                    <span>{e.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('today.entityLinked')}
                    </span>
                  </p>
                ) : (
                  // New mention — never created unless the user opts in here.
                  <div key={i} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {e.name}
                    </span>
                    <select
                      className={ANALYSIS_FIELD}
                      value={entityChoices[i] ?? 'skip'}
                      onChange={(ev) =>
                        setEntityChoices((c) => ({
                          ...c,
                          [i]: ev.target.value,
                        }))
                      }
                    >
                      <option value="skip">{t('today.entitySkip')}</option>
                      <option value="new">{t('today.entityCreate')}</option>
                      {(entitiesQuery.data ?? [])
                        .filter((x) => x.type === e.type)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {t('today.entityLinkTo')}: {x.name}
                            {x.handle ? ` @${x.handle}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                ),
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !summary.trim()}
              onClick={() => void commit()}
            >
              {t('today.commit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setProposal(null)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          {parsed && (
            <span className="text-sm text-muted-foreground">
              {t('today.parsed')}
            </span>
          )}
          {dirty ? (
            <Button
              size="sm"
              disabled={!hasText}
              onClick={() => void saveNow()}
            >
              {t('today.save')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant={parsed ? 'outline' : 'default'}
              disabled={!hasText || busy}
              onClick={() => void runRound()}
            >
              {busy
                ? t('today.parsing')
                : parsed
                  ? t('today.reparse')
                  : t('today.closeDay')}
            </Button>
          )}
        </div>
      )}
    </>
  )
}
