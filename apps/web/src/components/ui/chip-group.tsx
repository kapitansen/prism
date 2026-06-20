import { cn } from '@/lib/utils'

export interface ChipOption<T extends string | number> {
  value: T
  label: string
}

interface ChipGroupProps<T extends string | number> {
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
}

// Segmented single-select: one border around the whole track, hairline
// dividers between segments, the selected one filled with the theme colour.
// All theme tokens, so dark mode works. Reused for metric chips and card
// conviction.
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: ChipGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex divide-x divide-border overflow-hidden rounded-lg border',
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-8 min-w-8 items-center justify-center px-3 text-sm font-medium transition',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
