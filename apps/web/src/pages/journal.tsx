import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { type EntryListItem, fetchEntries } from '@/lib/entries'

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
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t('nav.journal')}</h1>

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
          <article key={e.id} className="rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <time dateTime={e.occurredOn}>{formatDate(e.occurredOn)}</time>
              <span className="rounded bg-muted px-1.5 py-0.5">{e.type}</span>
            </div>
            {e.title && <h2 className="font-medium">{e.title}</h2>}
            <p className="whitespace-pre-wrap text-sm">{e.body}</p>
          </article>
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}
