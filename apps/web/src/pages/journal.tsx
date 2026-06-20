import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardActions } from '@/components/card-actions'
import { DayInputPanel } from '@/components/day-input-panel'
import { Button } from '@/components/ui/button'
import {
  deleteEntry,
  type EntryListItem,
  fetchEntries,
  updateEntry,
} from '@/lib/entries'

const PAGE_SIZE = 20

export function JournalPage() {
  const { t } = useTranslation()

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
      <DayInputPanel />

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
  const [body, setBody] = useState(entry.body)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['entries'] })
    void queryClient.invalidateQueries({ queryKey: ['day-entry'] })
  }
  const save = useMutation({
    mutationFn: () => updateEntry(entry.id, { body }),
    onSuccess: () => {
      invalidate()
      setEditing(false)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteEntry(entry.id),
    onSuccess: invalidate,
  })

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
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="focus-visible:ring-ring/50 min-h-28 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
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
