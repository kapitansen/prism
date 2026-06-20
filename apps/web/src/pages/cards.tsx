import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { HeaderActions } from '@/components/header-actions'
import { Button } from '@/components/ui/button'
import { ChipGroup } from '@/components/ui/chip-group'
import { Input } from '@/components/ui/input'
import {
  type CardPatch,
  type CbtCard,
  createCard,
  deleteCard,
  fetchCards,
  updateCard,
} from '@/lib/cbt-cards'

type Mode = 'review' | 'manage'

// Conviction is stored 0–100; the deck uses these fixed levels as chips.
// Tapping 0 drops the card from the deck (backend clears isFavorite).
const CONVICTION_LEVELS = [0, 25, 50, 75, 100]

export function CardsPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('review')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <HeaderActions>
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
      </HeaderActions>

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

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardPatch }) =>
      updateCard(id, patch),
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t('cards.prev')}
          disabled={safeIndex === 0}
          onClick={() => go(-1)}
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft className="size-6" />
        </button>

        {/* keyed by id → per-card state (revealed, conviction) resets on change */}
        <CardView
          key={card.id}
          card={card}
          onSwipe={(dir) => go(dir === 'left' ? 1 : -1)}
          onCommitConviction={(value) =>
            update.mutate({ id: card.id, patch: { conviction: value } })
          }
          onRemoveFromDeck={() =>
            update.mutate({ id: card.id, patch: { isFavorite: false } })
          }
        />

        <button
          type="button"
          aria-label={t('cards.next')}
          disabled={safeIndex === deck.length - 1}
          onClick={() => go(1)}
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
    </div>
  )
}

function CardView({
  card,
  onSwipe,
  onCommitConviction,
  onRemoveFromDeck,
}: {
  card: CbtCard
  onSwipe: (dir: 'left' | 'right') => void
  onCommitConviction: (value: number) => void
  onRemoveFromDeck: () => void
}) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const [conviction, setConviction] = useState(card.conviction)
  const touchX = useRef<number | null>(null)

  function selectConviction(value: number) {
    setConviction(value)
    if (value !== card.conviction) onCommitConviction(value)
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="relative">
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
          className="flex min-h-64 w-full flex-col rounded-xl border bg-card p-6 text-left shadow-sm transition active:scale-[0.99]"
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
        <button
          type="button"
          aria-label={t('cards.removeFromDeck')}
          onClick={onRemoveFromDeck}
          className="absolute top-2 right-2 rounded-md p-1.5 text-foreground/60 transition hover:bg-muted hover:text-foreground"
        >
          <Star className="size-4 fill-current" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium">{t('cards.conviction')}</span>
        <ChipGroup
          ariaLabel={t('cards.conviction')}
          value={conviction}
          onChange={selectConviction}
          options={CONVICTION_LEVELS.map((v) => ({
            value: v,
            label: String(v),
          }))}
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
