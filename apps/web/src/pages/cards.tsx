import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type CbtCard,
  createCard,
  deleteCard,
  fetchCards,
  updateCard,
} from '@/lib/cbt-cards'

type Mode = 'review' | 'manage'

export function CardsPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('review')

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('nav.cards')}</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            size="sm"
            variant={mode === 'review' ? 'default' : 'ghost'}
            onClick={() => setMode('review')}
          >
            {t('cards.review')}
          </Button>
          <Button
            size="sm"
            variant={mode === 'manage' ? 'default' : 'ghost'}
            onClick={() => setMode('manage')}
          >
            {t('cards.manage')}
          </Button>
        </div>
      </div>

      {mode === 'review' ? <ReviewMode /> : <ManageMode />}
    </div>
  )
}

// ── Review: the deck (favorites), one card at a time ───────────

function ReviewMode() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cbt-cards', 'favorite'],
    queryFn: () => fetchCards(true),
  })
  const deck = data ?? []

  // index is unclamped state; we derive a safe index for render so the deck
  // shrinking (conviction → 0) needs no state-sync effect.
  const [index, setIndex] = useState(0)
  const safeIndex = deck.length ? Math.min(index, deck.length - 1) : 0
  const card: CbtCard | undefined = deck[safeIndex]

  const save = useMutation({
    mutationFn: ({ id, conviction }: { id: string; conviction: number }) =>
      updateCard(id, { conviction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cbt-cards'] }),
  })

  function go(delta: number) {
    setIndex((i) => {
      const cur = deck.length ? Math.min(i, deck.length - 1) : 0
      return Math.min(deck.length - 1, Math.max(0, cur + delta))
    })
  }

  // Keyboard arrows
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.length])

  if (isLoading)
    return <p className="text-sm text-muted-foreground">{t('cards.loading')}</p>
  if (isError)
    return <p className="text-sm text-destructive">{t('cards.error')}</p>
  if (!card)
    return <p className="text-sm text-muted-foreground">{t('cards.empty')}</p>

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4">
      <span className="text-xs text-muted-foreground">
        {`${safeIndex + 1} / ${deck.length}`}
      </span>

      <div className="flex items-stretch gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('cards.prev')}
          disabled={safeIndex === 0}
          onClick={() => go(-1)}
        >
          <ChevronLeft />
        </Button>

        {/* keyed by id → per-card state (revealed, conviction) resets on change */}
        <CardView
          key={card.id}
          card={card}
          onSwipe={(dir) => go(dir === 'left' ? 1 : -1)}
          onCommitConviction={(value) =>
            save.mutate({ id: card.id, conviction: value })
          }
        />

        <Button
          variant="ghost"
          size="icon"
          aria-label={t('cards.next')}
          disabled={safeIndex === deck.length - 1}
          onClick={() => go(1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

function CardView({
  card,
  onSwipe,
  onCommitConviction,
}: {
  card: CbtCard
  onSwipe: (dir: 'left' | 'right') => void
  onCommitConviction: (value: number) => void
}) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const [conviction, setConviction] = useState(card.conviction)
  const touchX = useRef<number | null>(null)

  function commit() {
    if (conviction !== card.conviction) onCommitConviction(conviction)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 50) onSwipe(dx < 0 ? 'left' : 'right')
        }}
        className="flex min-h-64 flex-1 flex-col rounded-xl border bg-card p-6 text-left shadow-sm transition active:scale-[0.99]"
      >
        {!revealed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg font-medium">{card.title}</p>
            <span className="text-xs text-muted-foreground">
              {t('cards.reveal')}
            </span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {card.title}
            </p>
            <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm">
              {card.explanation}
            </p>
          </div>
        )}
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="font-medium">{t('cards.conviction')}</span>
          <span className="text-muted-foreground">{conviction}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={conviction}
          onChange={(e) => setConviction(Number(e.target.value))}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          className="w-full"
        />
      </div>
    </div>
  )
}

// ── Manage: list / add / edit / delete / toggle deck ───────────

function ManageMode() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cbt-cards', 'all'],
    queryFn: () => fetchCards(false),
  })
  const cards = data ?? []

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['cbt-cards'] })

  const create = useMutation({
    mutationFn: createCard,
    onSuccess: () => {
      void invalidate()
      setAdding(false)
    },
  })

  return (
    <div className="flex flex-1 flex-col gap-3">
      {adding ? (
        <CardEditor
          submitLabel={t('cards.add')}
          onCancel={() => setAdding(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      ) : (
        <Button
          size="sm"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          {t('cards.addNew')}
        </Button>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t('cards.loading')}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{t('cards.error')}</p>
      )}
      {!isLoading && !isError && cards.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('cards.noCards')}</p>
      )}

      {cards.map((card) => (
        <CardRow key={card.id} card={card} onChanged={invalidate} />
      ))}
    </div>
  )
}

function CardRow({
  card,
  onChanged,
}: {
  card: CbtCard
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updateCard>[1]) =>
      updateCard(card.id, patch),
    onSuccess: () => {
      onChanged()
      setEditing(false)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteCard(card.id),
    onSuccess: onChanged,
  })

  if (editing) {
    return (
      <CardEditor
        initial={{ title: card.title, explanation: card.explanation }}
        submitLabel={t('cards.save')}
        onCancel={() => setEditing(false)}
        onSubmit={(v) => update.mutate(v)}
      />
    )
  }

  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium">{card.title}</h2>
        <button
          type="button"
          aria-label={
            card.isFavorite ? t('cards.removeFromDeck') : t('cards.addToDeck')
          }
          onClick={() => update.mutate({ isFavorite: !card.isFavorite })}
          className="text-muted-foreground hover:text-foreground"
        >
          <Star
            className={card.isFavorite ? 'fill-current text-foreground' : ''}
            size={18}
          />
        </button>
      </div>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {card.explanation}
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {t('cards.edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
        >
          {t('cards.delete')}
        </Button>
      </div>
    </article>
  )
}

function CardEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; explanation: string }
  submitLabel: string
  onSubmit: (v: { title: string; explanation: string }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ title, explanation })
      }}
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('cards.title')}</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('cards.explanation')}</span>
        <Textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={5}
          required
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('cards.cancel')}
        </Button>
      </div>
    </form>
  )
}

function Textarea(props: ComponentProps<'textarea'>) {
  return (
    <textarea
      className="focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      {...props}
    />
  )
}
