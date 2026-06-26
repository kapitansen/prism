import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardActions } from '@/components/card-actions'
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

// Conviction chips: 1–10. (0 stays valid server-side and drops the card from
// the deck; that removal is the star button here.)
const CONVICTION_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1)

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

  // index is unclamped state; we wrap it into range for render so the deck
  // shrinking (conviction → 0) needs no state-sync effect.
  const [index, setIndex] = useState(0)
  const safeIndex = deck.length
    ? ((index % deck.length) + deck.length) % deck.length
    : 0
  const card: CbtCard | undefined = deck[safeIndex]

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardPatch }) =>
      updateCard(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cbt-cards'] }),
  })

  // Cyclic: wrap around both ends so the deck loops.
  function go(delta: number) {
    const len = deck.length
    if (!len) return
    setIndex((i) => (((i + delta) % len) + len) % len)
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
      <span className="text-center text-xs text-muted-foreground">
        {`${safeIndex + 1} / ${deck.length}`}
      </span>

      {/* Only [arrow · card · arrow] in this row, so the arrows centre on the
          card itself; conviction lives below. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t('cards.prev')}
          onClick={() => go(-1)}
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft className="size-6" />
        </button>

        {/* keyed by id → flip state resets when the card changes */}
        <ReviewCard
          key={card.id}
          card={card}
          onSwipe={(dir) => go(dir === 'left' ? 1 : -1)}
          onRemoveFromDeck={() =>
            update.mutate({ id: card.id, patch: { isFavorite: false } })
          }
        />

        <button
          type="button"
          aria-label={t('cards.next')}
          onClick={() => go(1)}
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      <ConvictionChips
        key={`conviction-${card.id}`}
        card={card}
        onCommit={(value) =>
          update.mutate({ id: card.id, patch: { conviction: value } })
        }
      />
    </div>
  )
}

function ReviewCard({
  card,
  onSwipe,
  onRemoveFromDeck,
}: {
  card: CbtCard
  onSwipe: (dir: 'left' | 'right') => void
  onRemoveFromDeck: () => void
}) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const touchX = useRef<number | null>(null)

  return (
    <div className="relative flex-1">
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
        className="flex min-h-80 w-full flex-col rounded-xl border bg-card p-6 text-left shadow-sm transition active:scale-[0.99]"
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
            <p className="max-h-[34rem] overflow-y-auto whitespace-pre-wrap text-sm">
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
  )
}

function ConvictionChips({
  card,
  onCommit,
}: {
  card: CbtCard
  onCommit: (value: number) => void
}) {
  const { t } = useTranslation()
  const [conviction, setConviction] = useState(card.conviction)

  function select(value: number) {
    setConviction(value)
    if (value !== card.conviction) onCommit(value)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium">{t('cards.conviction')}</span>
      <ChipGroup
        ariaLabel={t('cards.conviction')}
        value={conviction}
        onChange={select}
        options={CONVICTION_LEVELS.map((v) => ({ value: v, label: String(v) }))}
      />
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
    <article className="group relative rounded-lg border p-4">
      <CardActions
        onEdit={() => setEditing(true)}
        onDelete={() => remove.mutate()}
        trailing={
          <button
            type="button"
            aria-label={
              card.isFavorite ? t('cards.removeFromDeck') : t('cards.addToDeck')
            }
            onClick={() => update.mutate({ isFavorite: !card.isFavorite })}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <Star
              className={card.isFavorite ? 'fill-current text-foreground' : ''}
              size={18}
            />
          </button>
        }
      />
      <h2 className="pr-16 font-medium">{card.title}</h2>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {card.explanation}
      </p>
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
