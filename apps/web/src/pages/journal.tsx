import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardActions } from '@/components/card-actions'
import { DayInputPanel } from '@/components/day-input-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteEntry,
  type EntryListItem,
  fetchEntries,
  updateEntry,
  type UpdateEntryInput,
} from '@/lib/entries'

const PAGE_SIZE = 20

export function JournalPage() {
  const { t } = useTranslation()
  const [composerOpen, setComposerOpen] = useState(false)

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['entries'],
    queryFn: ({ pageParam }) =>
      fetchEntries({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // Next offset = how many we've loaded; stop when a page is short.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  })

  const entries: EntryListItem[] = data?.pages.flat() ?? []

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver((obs) => {
      if (obs[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      {composerOpen ? (
        <DayInputPanel onClose={() => setComposerOpen(false)} />
      ) : (
        <Button
          variant="outline"
          className="gap-2 self-start"
          onClick={() => setComposerOpen(true)}
        >
          <Plus className="size-4" />
          {t('journal.addEntry')}
        </Button>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t('journal.loading')}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{t('journal.error')}</p>
      )}
      {!isLoading && !isError && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('journal.empty')}</p>
      )}

      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} />
        ))}
      </div>

      {/* scroll target that triggers loading older entries */}
      <div ref={sentinel} className="h-px" />
      {isFetchingNextPage && (
        <p className="text-center text-sm text-muted-foreground">
          {t('journal.loading')}
        </p>
      )}
    </div>
  )
}

function EntryCard({ entry }: { entry: EntryListItem }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [full, setFull] = useState(false)
  const [body, setBody] = useState(entry.body)
  const [title, setTitle] = useState(entry.title ?? '')
  const [summary, setSummary] = useState(entry.summary ?? '')
  const [type, setType] = useState(entry.type)
  const [occurredOn, setOccurredOn] = useState(entry.occurredOn.slice(0, 10))
  const [occurredTo, setOccurredTo] = useState(
    entry.occurredTo?.slice(0, 10) ?? '',
  )

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['entries'] })
    void queryClient.invalidateQueries({ queryKey: ['day-entry'] })
  }
  const save = useMutation({
    mutationFn: () => {
      const patch: UpdateEntryInput = { body }
      // Title/summary/type/dates are only touched in full mode.
      if (full) {
        patch.title = title
        patch.summary = summary
        patch.type = type
        patch.occurredOn = occurredOn
        if (occurredTo) patch.occurredTo = occurredTo
      }
      return updateEntry(entry.id, patch)
    },
    onSuccess: () => {
      invalidate()
      setEditing(false)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteEntry(entry.id),
    onSuccess: invalidate,
  })

  // A daily entry edits the whole day (text + metric chips) — reuse the panel.
  if (editing && entry.type === 'daily') {
    return (
      <DayInputPanel
        initialDate={entry.occurredOn.slice(0, 10)}
        onClose={() => setEditing(false)}
      />
    )
  }

  if (editing) {
    return (
      <article className="rounded-lg border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
          className="flex flex-col gap-3"
        >
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

          {full && (
            <div className="flex gap-3">
              <EditField label={t('journal.type')}>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                >
                  <option value="daily">{t('journal.typeDaily')}</option>
                  <option value="report">{t('journal.typeReport')}</option>
                  <option value="note">{t('journal.typeNote')}</option>
                </select>
              </EditField>
              <EditField label={t('journal.date')}>
                <Input
                  type="date"
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                />
              </EditField>
              <EditField label={t('journal.dateTo')}>
                <Input
                  type="date"
                  value={occurredTo}
                  onChange={(e) => setOccurredTo(e.target.value)}
                />
              </EditField>
            </div>
          )}

          {full && (
            <EditField label={t('journal.title')}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </EditField>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="focus-visible:ring-ring/50 min-h-28 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />

          {full && (
            <EditField
              label={t('journal.summary')}
              hint={t('journal.summaryAiHint')}
            >
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </EditField>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={save.isPending || !body.trim()}
            >
              {t('common.save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </article>
    )
  }

  return (
    <article className="group relative rounded-lg border p-4">
      <CardActions
        onEdit={() => setEditing(true)}
        onDelete={() => remove.mutate()}
      />
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={entry.occurredOn}>{formatDate(entry.occurredOn)}</time>
        <span className="rounded bg-muted px-1.5 py-0.5">{entry.type}</span>
      </div>
      {entry.title && <h2 className="font-medium">{entry.title}</h2>}
      <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
    </article>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

function EditField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {children}
    </label>
  )
}
